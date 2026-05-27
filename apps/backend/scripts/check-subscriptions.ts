import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      stripeCustomerId: true,
      subscriptions: {
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  for (const u of users) {
    console.log(`\n${u.email} (${u.id})`);
    console.log(`  stripeCustomerId: ${u.stripeCustomerId || '(none)'}`);
    for (const s of u.subscriptions) {
      console.log(
        `  - ${s.plan.slug} | ${s.status} | stripe=${s.stripeSubscriptionId || 'local'} | ends ${s.currentPeriodEnd?.toISOString?.() || 'n/a'}`,
      );
    }
    if (!u.subscriptions.length) console.log('  - (no subscription rows)');
  }
}

main().finally(() => prisma.$disconnect());
