import { Controller, Post, Req, Headers, RawBodyRequest, BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingWebhookController {
  constructor(private readonly billingService: BillingService) {}

  @Post('webhook')
  async handleWebhook(
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody;
    if (!payload) {
      throw new BadRequestException('Missing raw body for Stripe webhook');
    }
    return this.billingService.handleStripeWebhook(payload, signature || '');
  }
}
