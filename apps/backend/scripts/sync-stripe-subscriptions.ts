/**
 * Sync paid Stripe subscriptions into the local database.
 * Usage: npx ts-node scripts/sync-stripe-subscriptions.ts [email]
 */
import { PrismaClient, SubscriptionStatus } from '@prisma/client';
import Stripe from 'stripe';
import { readFileSync } from 'fs';
import { join } from 'path';

const envPath = join(__dirname, '..', '.env');
try {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '');
    }
  }
} catch {
  /* .env optional if vars already set */
}

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function mapStripeStatus(status: string): SubscriptionStatus {
  switch (status) {
    case 'active':
    case 'incomplete':
      return SubscriptionStatus.ACTIVE;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
      return SubscriptionStatus.CANCELED;
    default:
      return SubscriptionStatus.ACTIVE;
  }
}

async function upsertPaidSubscription(
  userId: string,
  planId: string,
  stripeSub: Stripe.Subscription,
  stripeCustomerId: string,
) {
  await prisma.subscription.updateMany({
    where: { userId, status: SubscriptionStatus.ACTIVE },
    data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
  });

  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId },
  });

  await prisma.subscription.create({
    data: {
      userId,
      planId,
      status: mapStripeStatus(stripeSub.status),
      stripeCustomerId,
      stripeSubscriptionId: stripeSub.id,
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
    },
  });
}

async function syncUser(user: { id: string; email: string; stripeCustomerId: string | null }) {
  let customerId = user.stripeCustomerId;

  if (!customerId) {
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    customerId = customers.data[0]?.id ?? null;
    if (customerId) {
      await prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId: customerId } });
      console.log(`Linked Stripe customer ${customerId} to ${user.email}`);
    }
  }

  if (!customerId) {
    console.log(`No Stripe customer for ${user.email}`);
    return;
  }

  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 });
  const active = subs.data.find((s) => ['active', 'trialing', 'past_due', 'incomplete'].includes(s.status));

  if (!active) {
    console.log(`No active Stripe subscription for ${user.email}`);
    return;
  }

  const planSlug = active.metadata?.planSlug || active.metadata?.planId;
  let plan = planSlug
    ? await prisma.plan.findFirst({ where: { OR: [{ id: planSlug }, { slug: planSlug }] } })
    : null;

  if (!plan) {
    const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 5 });
    const paid = sessions.data.find(
      (s) => s.payment_status === 'paid' && s.metadata?.type === 'subscription',
    );
    const metaPlanId = paid?.metadata?.planId;
    plan = metaPlanId ? await prisma.plan.findUnique({ where: { id: metaPlanId } }) : null;
    if (!plan && paid?.metadata?.planSlug) {
      plan = await prisma.plan.findUnique({ where: { slug: paid.metadata.planSlug } });
    }
  }

  if (!plan) {
    plan = await prisma.plan.findUnique({ where: { slug: 'pro' } });
    console.warn(`Could not resolve plan from metadata — defaulting to pro`);
  }

  await upsertPaidSubscription(user.id, plan.id, active, customerId);
  console.log(`Activated ${plan.slug} for ${user.email} (Stripe sub ${active.id})`);
}

async function main() {
  const emailArg = process.argv[2];
  const users = emailArg
    ? await prisma.user.findMany({ where: { email: emailArg } })
    : await prisma.user.findMany({ where: { stripeCustomerId: { not: null } } });

  if (!users.length) {
    console.log('No users found');
    return;
  }

  for (const user of users) {
    await syncUser(user);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
