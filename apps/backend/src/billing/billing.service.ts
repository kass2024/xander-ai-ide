import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';
import { CreditTransactionType, InvoiceStatus, SubscriptionStatus } from '@prisma/client';

type PlanLimits = {
  dailyRequests?: number;
  weeklyRequests?: number;
  monthlyTokens?: number;
  monthlyRequests?: number;
  agentMode?: boolean;
  composerMode?: boolean;
};

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private prisma: PrismaService,
    private stripeService: StripeService,
    private configService: ConfigService,
  ) {}

  async getAvailablePlans() {
    const plans = await this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
    return plans.map((plan) => this.formatPlan(plan));
  }

  async getCurrentSubscription(userId: string) {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) {
      return this.buildFreeSubscription();
    }
    return this.formatSubscription(subscription);
  }

  async getUsage(userId: string, period?: string) {
    const subscription = await this.getActiveSubscription(userId);
    const limits = this.parseLimits(subscription?.plan?.limits);
    const startDate = this.getStartDate(period);

    const usageLogs = await this.prisma.usageLog.findMany({
      where: { userId, createdAt: { gte: startDate } },
      orderBy: { createdAt: 'asc' },
    });

    const dailyUsage = this.aggregateDailyUsage(usageLogs);
    const totalUsage = usageLogs.reduce(
      (acc, log) => ({
        tokensUsed: acc.tokensUsed + log.tokensUsed,
        requests: acc.requests + 1,
        cost: acc.cost + Number(log.cost),
      }),
      { tokensUsed: 0, requests: 0, cost: 0 },
    );

    const { dailyUsed, weeklyUsed } = await this.getQuotaUsage(userId, subscription?.id);
    const creditBalance = await this.getCreditBalance(userId);
    const settings = await this.prisma.userSettings.findUnique({ where: { userId } });
    const periodEnd = subscription?.currentPeriodEnd || this.nextMonthStart();

    return {
      period: this.getPeriodLabel(period),
      dailyUsage,
      totalUsage,
      limits: {
        tokens: limits.monthlyTokens || 10000,
        requests: limits.monthlyRequests || 500,
        cost: Number(subscription?.plan?.price || 0),
      },
      quota: {
        daily: {
          used: dailyUsed,
          limit: limits.dailyRequests || 20,
          resetTime: '00:00 UTC',
        },
        weekly: {
          used: weeklyUsed,
          limit: limits.weeklyRequests || 100,
          resetTime: 'Monday 00:00 UTC',
        },
        extraBalance: {
          balance: creditBalance,
          currency: 'credits',
        },
        autoRecharge: {
          enabled: settings?.autoRecharge ?? false,
          threshold: 1000,
          amount: 5000,
        },
        billingCycle: {
          nextBillingDate: periodEnd.toISOString().split('T')[0],
          daysRemaining: Math.max(
            0,
            Math.ceil((periodEnd.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
          ),
        },
      },
    };
  }

  async getCreditHistory(userId: string, page = 1, limit = 10, type?: string) {
    const where: { userId: string; type?: CreditTransactionType } = { userId };
    if (type) {
      where.type = type.toUpperCase() as CreditTransactionType;
    }

    const [transactions, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.creditTransaction.count({ where }),
    ]);

    const balance = await this.getCreditBalance(userId);

    return {
      transactions: transactions.map((tx) => ({
        id: tx.id,
        type: tx.type.toLowerCase(),
        amount: tx.amount,
        balance: tx.balance,
        description: tx.description || '',
        date: tx.createdAt.toISOString(),
        metadata: tx.metadata,
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
      currentBalance: balance,
    };
  }

  async createSubscription(userId: string, dto: { planId: string; interval?: string }) {
    return this.changePlan(userId, dto.planId, dto.interval || 'month');
  }

  async updateSubscription(userId: string, dto: { planId: string; interval?: string }) {
    return this.changePlan(userId, dto.planId, dto.interval || 'month');
  }

  async changePlan(userId: string, planId: string, interval = 'month') {
    const plan = await this.findPlan(planId);
    if (!plan) throw new NotFoundException('Plan not found');

    if (plan.slug === 'free' || Number(plan.price) === 0) {
      return this.assignFreePlan(userId);
    }

    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe is not configured. Set STRIPE_SECRET_KEY in backend .env');
    }

    const session = await this.createCheckoutSession(userId, plan.id, interval);
    return { checkoutUrl: session.url, requiresPayment: true };
  }

  async createCheckoutSession(userId: string, planId: string, interval = 'month') {
    const plan = await this.findPlan(planId);
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.slug === 'free') throw new BadRequestException('Free plan does not require checkout');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const customerId = await this.ensureStripeCustomer(userId, user.email, user.fullName || undefined);
    const webUrl = this.configService.get<string>('WEB_URL') || 'http://localhost:3000';
    const amount =
      interval === 'year'
        ? Math.round(Number(plan.price) * 10 * 100)
        : Math.round(Number(plan.price) * 100);

    return this.stripeService.createSubscriptionCheckout({
      customerId,
      planName: `Xander AI IDE ${plan.name}`,
      planDescription: plan.description || undefined,
      amountCents: amount,
      interval: interval === 'year' ? 'year' : 'month',
      successUrl: `${webUrl}/dashboard/manage-plan?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${webUrl}/dashboard/manage-plan?checkout=cancelled`,
      metadata: {
        userId,
        planId: plan.id,
        planSlug: plan.slug,
        type: 'subscription',
        interval,
      },
    });
  }

  async createPortalSession(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const customerId = user?.stripeCustomerId;
    if (!customerId) {
      throw new BadRequestException('No billing account found. Subscribe to a paid plan first.');
    }

    const webUrl = this.configService.get<string>('WEB_URL') || 'http://localhost:3000';
    const session = await this.stripeService.createPortalSession(
      customerId,
      `${webUrl}/dashboard/manage-plan`,
    );
    return { url: session.url };
  }

  /** Called from success URL when webhook hasn't fired yet (common in local dev). */
  async confirmCheckoutSession(userId: string, sessionId: string) {
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const session = await this.stripeService.client.checkout.sessions.retrieve(sessionId);

    if (session.metadata?.userId !== userId) {
      throw new BadRequestException('Checkout session does not belong to this account');
    }

    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      throw new BadRequestException('Payment is still processing. Please wait a moment and refresh.');
    }

    this.logger.log(`Confirming checkout session ${sessionId} for user ${userId}`);
    await this.applyCheckoutSession(session);
    return this.getCurrentSubscription(userId);
  }

  /** Pull active Stripe subscription into DB (webhook fallback / account repair). */
  async syncFromStripe(userId: string) {
    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customers = await this.stripeService.client.customers.list({
        email: user.email,
        limit: 1,
      });
      customerId = customers.data[0]?.id ?? null;
      if (customerId) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { stripeCustomerId: customerId },
        });
      }
    }

    if (!customerId) {
      return this.getCurrentSubscription(userId);
    }

    const subs = await this.stripeService.client.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 10,
    });
    const active = subs.data.find((s) =>
      ['active', 'trialing', 'past_due', 'incomplete'].includes(s.status),
    );

    if (!active) {
      return this.getCurrentSubscription(userId);
    }

    let planId = active.metadata?.planId;
    if (!planId) {
      const sessions = await this.stripeService.client.checkout.sessions.list({
        customer: customerId,
        limit: 5,
      });
      const paid = sessions.data.find(
        (s) => s.payment_status === 'paid' && s.metadata?.type === 'subscription',
      );
      planId = paid?.metadata?.planId;
    }

    const plan = planId
      ? await this.prisma.plan.findFirst({
          where: { OR: [{ id: planId }, { slug: planId }] },
        })
      : await this.prisma.plan.findUnique({ where: { slug: 'pro' } });

    if (!plan) {
      throw new NotFoundException('Could not resolve plan for Stripe subscription');
    }

    this.logger.log(`Syncing Stripe subscription ${active.id} → ${plan.slug} for user ${userId}`);
    await this.upsertPaidSubscription(userId, plan.id, active, customerId);
    return this.getCurrentSubscription(userId);
  }

  async cancelSubscription(userId: string) {
    const subscription = await this.getActiveSubscription(userId);
    if (!subscription) throw new NotFoundException('No active subscription');

    if (subscription.stripeSubscriptionId) {
      await this.stripeService.cancelSubscriptionAtPeriodEnd(subscription.stripeSubscriptionId);
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: true },
      });
    } else {
      await this.assignFreePlan(userId);
    }

    return this.getCurrentSubscription(userId);
  }

  async purchaseUsage(userId: string, dto: { amount: number }) {
    const credits = dto.amount;
    if (!credits || credits <= 0) throw new BadRequestException('Invalid credit amount');

    if (!this.stripeService.isConfigured()) {
      throw new BadRequestException('Stripe is not configured');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const customerId = await this.ensureStripeCustomer(userId, user.email, user.fullName || undefined);
    const webUrl = this.configService.get<string>('WEB_URL') || 'http://localhost:3000';
    const amountCents = Math.max(500, Math.round(credits * 0.01 * 100));

    const session = await this.stripeService.createCreditsCheckout({
      customerId,
      credits,
      amountCents,
      successUrl: `${webUrl}/dashboard/usage?purchase=success`,
      cancelUrl: `${webUrl}/dashboard/usage?purchase=cancelled`,
      metadata: {
        userId,
        type: 'credits',
        credits: String(credits),
      },
    });

    return { success: true, checkoutUrl: session.url, message: `Redirecting to purchase ${credits} credits` };
  }

  async updateAutoRecharge(
    userId: string,
    dto: { enabled: boolean; threshold?: number; amount?: number },
  ) {
    await this.prisma.userSettings.upsert({
      where: { userId },
      update: { autoRecharge: dto.enabled },
      create: {
        userId,
        autoRecharge: dto.enabled,
      },
    });

    return {
      success: true,
      autoRecharge: {
        enabled: dto.enabled,
        threshold: dto.threshold || 1000,
        amount: dto.amount || 5000,
      },
    };
  }

  async getInvoices(userId: string, page = 1) {
    const limit = 10;
    const [invoices, total] = await Promise.all([
      this.prisma.billingInvoice.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.billingInvoice.count({ where: { userId } }),
    ]);

    return {
      invoices: invoices.map((inv) => ({
        id: inv.id,
        number: inv.number || inv.stripeInvoiceId,
        amount: Number(inv.amount),
        status: inv.status,
        date: inv.createdAt.toISOString(),
        dueDate: inv.dueDate?.toISOString(),
        paidAt: inv.paidAt?.toISOString(),
      })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async getAnalytics(userId: string, period?: string) {
    const startDate = this.getStartDate(period);
    const logs = await this.prisma.usageLog.findMany({
      where: { userId, createdAt: { gte: startDate } },
    });

    const costByModel = new Map<string, number>();
    for (const log of logs) {
      costByModel.set(log.model, (costByModel.get(log.model) || 0) + Number(log.cost));
    }
    const totalCost = [...costByModel.values()].reduce((a, b) => a + b, 0);

    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    return {
      totalLinesWritten: user?.totalLinesWritten || 0,
      streakData: {
        current: user?.currentStreak || 0,
        record: user?.recordStreak || 0,
      },
      costBreakdown: [...costByModel.entries()].map(([model, cost]) => ({
        model,
        cost,
        percentage: totalCost > 0 ? Math.round((cost / totalCost) * 100) : 0,
      })),
    };
  }

  async handleStripeWebhook(payload: Buffer, signature: string) {
    const event = this.stripeService.constructWebhookEvent(payload, signature);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as any);
        break;
      case 'invoice.paid':
        await this.handleInvoicePaid(event.data.object as any);
        break;
      case 'invoice.payment_failed':
        await this.handleInvoiceFailed(event.data.object as any);
        break;
      default:
        this.logger.debug(`Unhandled Stripe event: ${event.type}`);
    }

    return { received: true };
  }

  private async handleCheckoutCompleted(session: any) {
    await this.applyCheckoutSession(session);
  }

  private async applyCheckoutSession(session: any) {
    const userId = session.metadata?.userId;
    if (!userId) {
      this.logger.warn(`Checkout session ${session.id} missing userId metadata`);
      return;
    }

    if (session.metadata?.type === 'credits') {
      const credits = parseInt(session.metadata.credits || '0', 10);
      if (credits > 0) {
        await this.addCredits(userId, credits, 'Credit purchase via Stripe');
        this.logger.log(`Added ${credits} credits for user ${userId}`);
      }
      return;
    }

    if (session.mode !== 'subscription' || !session.subscription) {
      this.logger.warn(`Checkout session ${session.id} is not a subscription checkout`);
      return;
    }

    const planId = session.metadata?.planId;
    const plan = planId ? await this.prisma.plan.findUnique({ where: { id: planId } }) : null;
    if (!plan) {
      this.logger.error(`Checkout session ${session.id}: plan ${planId} not found in DB`);
      return;
    }

    const subId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription.id;
    const stripeSub = await this.stripeService.client.subscriptions.retrieve(subId);
    await this.upsertPaidSubscription(userId, plan.id, stripeSub, session.customer as string);
    this.logger.log(`Activated ${plan.slug} plan for user ${userId}`);
  }

  private async handleSubscriptionUpdated(stripeSub: any) {
    const userId = stripeSub.metadata?.userId;
    if (!userId) return;

    const planId = stripeSub.metadata?.planId;
    const existing = await this.prisma.subscription.findFirst({
      where: { userId, stripeSubscriptionId: stripeSub.id },
    });

    const status = this.mapStripeStatus(stripeSub.status);
    const data = {
      status,
      currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
      canceledAt: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
    };

    if (existing) {
      await this.prisma.subscription.update({ where: { id: existing.id }, data });
    } else if (planId) {
      await this.upsertPaidSubscription(userId, planId, stripeSub, stripeSub.customer as string);
    }
  }

  private async handleSubscriptionDeleted(stripeSub: any) {
    const userId = stripeSub.metadata?.userId;
    if (userId) {
      await this.assignFreePlan(userId);
    }
  }

  private async handleInvoicePaid(invoice: any) {
    const customerId = invoice.customer as string;
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
      include: { user: true },
    });
    if (!subscription?.userId) return;

      const existing = await this.prisma.billingInvoice.findFirst({
        where: { stripeInvoiceId: invoice.id },
      });

      const invoiceData = {
        userId: subscription.userId,
        stripeInvoiceId: invoice.id,
        number: invoice.number,
        status: InvoiceStatus.PAID,
        amount: (invoice.amount_paid || 0) / 100,
        currency: invoice.currency || 'usd',
        dueDate: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        paidAt: new Date(),
      };

      if (existing) {
        await this.prisma.billingInvoice.update({
          where: { id: existing.id },
          data: invoiceData,
        });
      } else {
        await this.prisma.billingInvoice.create({ data: invoiceData });
      }
  }

  private async handleInvoiceFailed(invoice: any) {
    const customerId = invoice.customer as string;
    const subscription = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (subscription) {
      await this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.PAST_DUE },
      });
    }
  }

  private async upsertPaidSubscription(
    userId: string,
    planId: string,
    stripeSub: any,
    stripeCustomerId: string,
  ) {
    await this.prisma.subscription.updateMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId },
    });

    await this.prisma.subscription.create({
      data: {
        userId,
        planId,
        status: this.mapStripeStatus(stripeSub.status),
        stripeCustomerId,
        stripeSubscriptionId: stripeSub.id,
        currentPeriodStart: new Date(stripeSub.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSub.current_period_end * 1000),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end ?? false,
      },
    });
  }

  private async assignFreePlan(userId: string) {
    const freePlan = await this.prisma.plan.findUnique({ where: { slug: 'free' } });
    if (!freePlan) throw new NotFoundException('Free plan not found');

    await this.prisma.subscription.updateMany({
      where: { userId, status: SubscriptionStatus.ACTIVE },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });

    const sub = await this.prisma.subscription.create({
      data: { userId, planId: freePlan.id, status: SubscriptionStatus.ACTIVE },
      include: { plan: true },
    });

    return this.formatSubscription(sub);
  }

  private async ensureStripeCustomer(userId: string, email: string, name?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.stripeCustomerId) return user.stripeCustomerId;

    const customer = await this.stripeService.createCustomer(email, name, { userId });
    await this.prisma.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customer.id },
    });
    return customer.id;
  }

  private async getActiveSubscription(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] } },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  private async getCreditBalance(userId: string): Promise<number> {
    const latest = await this.prisma.creditTransaction.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return latest?.balance ?? 0;
  }

  private async addCredits(userId: string, amount: number, description: string) {
    const balance = (await this.getCreditBalance(userId)) + amount;
    await this.prisma.creditTransaction.create({
      data: {
        userId,
        type: CreditTransactionType.PURCHASE,
        amount,
        balance,
        description,
      },
    });
    return balance;
  }

  private async getQuotaUsage(userId: string, subscriptionId?: string) {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());

    const [dailyLogs, weeklyLogs] = await Promise.all([
      this.prisma.usageLog.count({ where: { userId, createdAt: { gte: dayStart } } }),
      this.prisma.usageLog.count({ where: { userId, createdAt: { gte: weekStart } } }),
    ]);

    return { dailyUsed: dailyLogs, weeklyUsed: weeklyLogs };
  }

  private async findPlan(planId: string) {
    return this.prisma.plan.findFirst({
      where: { OR: [{ id: planId }, { slug: planId }] },
    });
  }

  private formatPlan(plan: any) {
    const limits = this.parseLimits(plan.limits);
    return {
      id: plan.slug,
      dbId: plan.id,
      name: plan.name,
      price: Number(plan.price),
      interval: plan.interval,
      features: plan.features as string[],
      limits: {
        tokens: `${(limits.monthlyTokens || 0).toLocaleString()}/month`,
        requests: `${limits.monthlyRequests || 0}/month`,
        models: limits.agentMode ? 'GPT-5.1, Agent, Composer' : 'GPT-5.1 Mini',
        support: plan.slug === 'free' ? 'Community' : 'Priority',
      },
      popular: plan.slug === 'pro',
    };
  }

  private formatSubscription(subscription: any) {
    const plan = subscription.plan;
    return {
      id: subscription.id,
      plan: {
        id: plan.slug,
        name: plan.name,
        price: Number(plan.price),
        interval: plan.interval,
      },
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart?.toISOString() || new Date().toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd?.toISOString() || this.nextMonthStart().toISOString(),
      isPaid: Number(plan.price) > 0,
      cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
      stripeCustomerId: subscription.stripeCustomerId,
    };
  }

  private buildFreeSubscription() {
    return {
      id: 'free',
      plan: { id: 'free', name: 'Free', price: 0, interval: 'month' },
      status: 'ACTIVE',
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: this.nextMonthStart().toISOString(),
      isPaid: false,
    };
  }

  private parseLimits(limits: unknown): PlanLimits {
    if (limits && typeof limits === 'object') return limits as PlanLimits;
    return {};
  }

  private mapStripeStatus(status: string): SubscriptionStatus {
    switch (status) {
      case 'active':
      case 'incomplete':
        return SubscriptionStatus.ACTIVE;
      case 'trialing':
        return SubscriptionStatus.TRIALING;
      case 'past_due':
        return SubscriptionStatus.PAST_DUE;
      case 'unpaid':
        return SubscriptionStatus.UNPAID;
      default:
        return SubscriptionStatus.CANCELED;
    }
  }

  private aggregateDailyUsage(logs: { createdAt: Date; tokensUsed: number; cost: unknown }[]) {
    const byDate = new Map<string, { tokensUsed: number; requests: number; cost: number }>();
    for (const log of logs) {
      const date = log.createdAt.toISOString().split('T')[0];
      const entry = byDate.get(date) || { tokensUsed: 0, requests: 0, cost: 0 };
      entry.tokensUsed += log.tokensUsed;
      entry.requests += 1;
      entry.cost += Number(log.cost);
      byDate.set(date, entry);
    }
    return [...byDate.entries()].map(([date, data]) => ({ date, ...data }));
  }

  private getStartDate(period?: string): Date {
    const now = new Date();
    switch (period) {
      case 'last':
        return new Date(now.getFullYear(), now.getMonth() - 1, 1);
      case '3months':
        return new Date(now.getFullYear(), now.getMonth() - 3, 1);
      case '6months':
        return new Date(now.getFullYear(), now.getMonth() - 6, 1);
      case 'year':
        return new Date(now.getFullYear() - 1, now.getMonth(), 1);
      default:
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }

  private getPeriodLabel(period?: string): string {
    const now = new Date();
    switch (period) {
      case 'last':
        return `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear() - 1}`;
      case '3months':
        return 'Last 3 months';
      case '6months':
        return 'Last 6 months';
      case 'year':
        return 'Last year';
      default:
        return `${now.toLocaleString('default', { month: 'long' })} ${now.getFullYear()}`;
    }
  }

  private nextMonthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
}
