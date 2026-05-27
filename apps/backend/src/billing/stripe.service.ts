import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private stripe: Stripe | null = null;

  constructor(private configService: ConfigService) {}

  get client(): Stripe {
    if (!this.stripe) {
      const secret =
        this.configService.get<string>('STRIPE_SECRET_KEY') ||
        this.configService.get<string>('STRIPE_SECRET');
      if (!secret) {
        throw new Error('STRIPE_SECRET_KEY is not configured');
      }
      this.stripe = new Stripe(secret);
    }
    return this.stripe;
  }

  isConfigured(): boolean {
    const secret =
      this.configService.get<string>('STRIPE_SECRET_KEY') ||
      this.configService.get<string>('STRIPE_SECRET');
    return Boolean(secret);
  }

  async createCustomer(email: string, name?: string, metadata?: Record<string, string>) {
    return this.client.customers.create({
      email,
      name: name || undefined,
      metadata,
    });
  }

  async createSubscriptionCheckout(params: {
    customerId: string;
    planName: string;
    planDescription?: string;
    amountCents: number;
    interval: 'month' | 'year';
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }) {
    return this.client.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: params.planName,
              description: params.planDescription,
            },
            unit_amount: params.amountCents,
            recurring: { interval: params.interval },
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
      subscription_data: {
        metadata: params.metadata,
      },
    });
  }

  async createCreditsCheckout(params: {
    customerId: string;
    credits: number;
    amountCents: number;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }) {
    return this.client.checkout.sessions.create({
      mode: 'payment',
      customer: params.customerId,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `${params.credits.toLocaleString()} Xander AI Credits`,
              description: 'Extra usage credits for Xander AI IDE',
            },
            unit_amount: params.amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      metadata: params.metadata,
    });
  }

  async createPortalSession(customerId: string, returnUrl: string) {
    return this.client.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async cancelSubscriptionAtPeriodEnd(stripeSubscriptionId: string) {
    return this.client.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';

    if (!secret) {
      if (isProd) {
        throw new Error('STRIPE_WEBHOOK_SECRET is required in production');
      }
      this.logger.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification (dev only)');
      return JSON.parse(payload.toString()) as Stripe.Event;
    }

    if (!signature) {
      throw new Error('Missing stripe-signature header');
    }

    return this.client.webhooks.constructEvent(payload, signature, secret);
  }
}
