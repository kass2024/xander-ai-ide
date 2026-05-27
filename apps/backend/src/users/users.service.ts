import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionStatus } from '@prisma/client';

export interface CreateUserDto {
  email: string;
  password: string;
  fullName?: string;
}

export interface UpdateUserDto {
  fullName?: string;
  avatar?: string;
  role?: string;
  isActive?: boolean;
}

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async create(createUserDto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: createUserDto.email },
    });
    if (existingUser) {
      throw new BadRequestException('User with this email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: createUserDto.email,
        password: createUserDto.password,
        fullName: createUserDto.fullName,
      },
    });

    await this.prisma.userSettings.create({ data: { userId: user.id } });

    const freePlan = await this.prisma.plan.findUnique({ where: { slug: 'free' } });
    if (freePlan) {
      await this.prisma.subscription.create({
        data: {
          userId: user.id,
          planId: freePlan.id,
          status: SubscriptionStatus.ACTIVE,
        },
      });
    }

    return this.sanitizeUser(user);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'desc' } });
    return users.map((u) => this.sanitizeUser(u));
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return this.sanitizeUser(user);
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async update(id: string, updateUserDto: UpdateUserDto) {
    const { role, ...rest } = updateUserDto;
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...rest,
        ...(role ? { role: role as 'USER' | 'ADMIN' | 'SUPER_ADMIN' } : {}),
      },
    });
    return this.sanitizeUser(user);
  }

  async updateLastLogin(id: string) {
    await this.prisma.user.update({
      where: { id },
      data: { lastLoginAt: new Date() },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.delete({ where: { id } });
    return this.sanitizeUser(user);
  }

  async getUserSettings(userId: string) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
  }

  async updateUserSettings(userId: string, settings: Record<string, unknown>) {
    return this.prisma.userSettings.upsert({
      where: { userId },
      update: settings,
      create: { userId, ...settings },
    });
  }

  async getUserSubscription(userId: string) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING, SubscriptionStatus.PAST_DUE] },
      },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });

    if (!subscription) {
      return {
        id: 'free',
        plan: { id: 'free', name: 'Free', slug: 'free', limits: {} },
        status: 'ACTIVE',
      };
    }

    return {
      id: subscription.id,
      plan: {
        id: subscription.plan.slug,
        name: subscription.plan.name,
        slug: subscription.plan.slug,
        limits: subscription.plan.limits,
        price: Number(subscription.plan.price),
      },
      status: subscription.status,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
    };
  }

  async getUserUsageStats(userId: string) {
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(dayStart);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const aggregate = async (since: Date) => {
      const result = await this.prisma.usageLog.aggregate({
        where: { userId, createdAt: { gte: since } },
        _sum: { tokensUsed: true, cost: true },
        _count: true,
      });
      return {
        tokensUsed: result._sum.tokensUsed ?? 0,
        requests: result._count,
        cost: Number(result._sum.cost ?? 0),
      };
    };

    return {
      daily: await aggregate(dayStart),
      weekly: await aggregate(weekStart),
      monthly: await aggregate(monthStart),
    };
  }

  async getAnalytics(userId: string, period?: string) {
    const startDate = new Date();
    if (period === 'year') startDate.setFullYear(startDate.getFullYear() - 1);
    else startDate.setMonth(startDate.getMonth() - 1);

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalLinesWritten: true, currentStreak: true, recordStreak: true },
    });

    const logs = await this.prisma.usageLog.groupBy({
      by: ['model'],
      where: { userId, createdAt: { gte: startDate } },
      _sum: { cost: true },
    });

    const costByModel = new Map<string, number>();
    for (const row of logs) {
      costByModel.set(row.model, Number(row._sum.cost ?? 0));
    }
    const totalCost = [...costByModel.values()].reduce((a, b) => a + b, 0);

    return {
      totalLinesWritten: user?.totalLinesWritten || 0,
      contributionGraph: [],
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

  async getContributions(_userId: string, _period?: string) {
    return [];
  }

  async getNotifications(_userId: string) {
    return { notifications: [], unreadCount: 0 };
  }

  async markNotificationAsRead(_userId: string, _notificationId: string) {
    return { success: true };
  }

  private sanitizeUser(user: { password?: string; [key: string]: unknown }) {
    const { password: _, ...rest } = user;
    return rest;
  }
}
