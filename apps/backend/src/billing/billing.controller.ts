import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('plans')
  async getAvailablePlans() {
    return this.billingService.getAvailablePlans();
  }

  @UseGuards(JwtAuthGuard)
  @Get('usage')
  async getUsage(@Request() req, @Query('period') period?: string) {
    return this.billingService.getUsage(req.user.id, period);
  }

  @UseGuards(JwtAuthGuard)
  @Get('credit-history')
  async getCreditHistory(
    @Request() req,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
  ) {
    return this.billingService.getCreditHistory(req.user.id, page, limit, type);
  }

  @UseGuards(JwtAuthGuard)
  @Get('subscription')
  async getCurrentSubscription(@Request() req) {
    return this.billingService.getCurrentSubscription(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('subscription')
  async createSubscription(@Request() req, @Body() body: { planId: string; interval?: string }) {
    return this.billingService.createSubscription(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('subscription')
  async updateSubscription(@Request() req, @Body() body: { planId: string; interval?: string }) {
    return this.billingService.updateSubscription(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscription')
  async cancelSubscription(@Request() req) {
    return this.billingService.cancelSubscription(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckout(@Request() req, @Body() body: { planId: string; interval?: string }) {
    const session = await this.billingService.createCheckoutSession(
      req.user.id,
      body.planId,
      body.interval || 'month',
    );
    return { url: session.url };
  }

  @UseGuards(JwtAuthGuard)
  @Post('confirm-checkout')
  async confirmCheckout(@Request() req, @Body() body: { sessionId: string }) {
    return this.billingService.confirmCheckoutSession(req.user.id, body.sessionId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('sync')
  async syncFromStripe(@Request() req) {
    return this.billingService.syncFromStripe(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal')
  async createPortal(@Request() req) {
    return this.billingService.createPortalSession(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase-credits')
  async purchaseCredits(@Request() req, @Body() body: { amount: number }) {
    return this.billingService.purchaseUsage(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('purchase-usage')
  async purchaseUsage(@Request() req, @Body() body: { amount: number }) {
    return this.billingService.purchaseUsage(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('auto-recharge')
  async updateAutoRecharge(
    @Request() req,
    @Body() body: { enabled: boolean; threshold?: number; amount?: number },
  ) {
    return this.billingService.updateAutoRecharge(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('invoices')
  async getInvoices(@Request() req, @Query('page') page?: number) {
    return this.billingService.getInvoices(req.user.id, page);
  }

  @UseGuards(JwtAuthGuard)
  @Get('analytics')
  async getAnalytics(@Request() req, @Query('period') period?: string) {
    return this.billingService.getAnalytics(req.user.id, period);
  }
}
