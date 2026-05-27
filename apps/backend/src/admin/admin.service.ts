import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUsers(page: number, limit: number) {
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          fullName: true,
          role: true,
          isActive: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);
    return { users, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getSubscriptions(page: number, limit: number) {
    const [subscriptions, total] = await Promise.all([
      this.prisma.subscription.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          plan: true,
          user: { select: { id: true, email: true, fullName: true } },
        },
      }),
      this.prisma.subscription.count(),
    ]);
    return { subscriptions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async getUsageStats(period?: string) {
    const start = new Date();
    if (period === 'week') start.setDate(start.getDate() - 7);
    else if (period === 'month') start.setMonth(start.getMonth() - 1);
    else start.setDate(start.getDate() - 1);

    const [totalUsers, activeSubscriptions, usageLogs, totalTokens] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.subscription.count({ where: { status: 'ACTIVE' } }),
      this.prisma.usageLog.count({ where: { createdAt: { gte: start } } }),
      this.prisma.usageLog.aggregate({
        where: { createdAt: { gte: start } },
        _sum: { tokensUsed: true, cost: true },
      }),
    ]);

    const byModel = await this.prisma.usageLog.groupBy({
      by: ['model'],
      where: { createdAt: { gte: start } },
      _sum: { tokensUsed: true, cost: true },
      _count: true,
    });

    return {
      period: period || 'day',
      totalUsers,
      activeSubscriptions,
      requests: usageLogs,
      tokensUsed: totalTokens._sum.tokensUsed || 0,
      totalCost: Number(totalTokens._sum.cost || 0),
      byModel: byModel.map((m) => ({
        model: m.model,
        requests: m._count,
        tokens: m._sum.tokensUsed || 0,
        cost: Number(m._sum.cost || 0),
      })),
    };
  }
}
