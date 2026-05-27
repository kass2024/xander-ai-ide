import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
        },
        settings: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Transform the data to match the dashboard expectations
    return {
      id: user.id,
      name: user.fullName || 'Unknown User',
      email: user.email,
      avatar: user.avatar,
      plan: this.getUserPlan(user.subscriptions),
      streak: user.currentStreak || 0,
      recordStreak: user.recordStreak || 0,
      linesWritten: user.totalLinesWritten || 0,
      totalLines: user.totalLinesWritten || 0,
      joinDate: user.createdAt.toISOString(),
      settings: user.settings,
    };
  }

  async updateProfile(userId: string, updateProfileDto: any) {
    const { fullName, avatar } = updateProfileDto;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        avatar,
      },
    });

    return updatedUser;
  }

  async getAnalytics(userId: string, period?: string) {
    const startDate = this.getStartDate(period);
    
    // Get contributions for the period
    const contributions = await this.prisma.contribution.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Get usage logs for detailed analytics
    const usageLogs = await this.prisma.usageLog.findMany({
      where: {
        userId,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalLines = contributions.reduce((sum, curr) => sum + curr.linesWritten, 0);
    const totalRequests = contributions.reduce((sum, curr) => sum + curr.requests, 0);
    const totalCommits = contributions.reduce((sum, curr) => sum + curr.commits, 0);

    return {
      period: this.getPeriodLabel(period),
      totalLines,
      totalRequests,
      totalCommits,
      contributions: contributions.map(c => ({
        date: c.date.toISOString().split('T')[0],
        linesWritten: c.linesWritten,
        requests: c.requests,
        commits: c.commits,
      })),
      dailyAverage: Math.round(totalLines / Math.max(1, contributions.length)),
      mostActiveDay: this.getMostActiveDay(contributions),
    };
  }

  async getContributions(userId: string, period?: string) {
    const startDate = this.getStartDate(period);
    
    const contributions = await this.prisma.contribution.findMany({
      where: {
        userId,
        date: {
          gte: startDate,
        },
      },
      orderBy: { date: 'asc' },
    });

    // Generate contribution graph data
    const contributionGraph = this.generateContributionGraph(contributions, startDate);
    
    return {
      contributions: contributionGraph,
      totalLines: contributions.reduce((sum, curr) => sum + curr.linesWritten, 0),
      currentStreak: await this.calculateCurrentStreak(userId),
      recordStreak: await this.calculateRecordStreak(userId),
    };
  }

  private getUserPlan(subscriptions: any[]): 'free' | 'pro' | 'enterprise' {
    if (!subscriptions || subscriptions.length === 0) {
      return 'free';
    }
    
    const planName = subscriptions[0].plan?.name?.toLowerCase() || 'free';
    if (planName.includes('enterprise')) return 'enterprise';
    if (planName.includes('pro')) return 'pro';
    return 'free';
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

  private generateContributionGraph(contributions: any[], startDate: Date) {
    const contributionMap = new Map();
    
    // Map existing contributions
    contributions.forEach(c => {
      const date = c.date.toISOString().split('T')[0];
      contributionMap.set(date, c.linesWritten);
    });

    // Generate full date range
    const graph = [];
    const now = new Date();
    
    for (let d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      const date = d.toISOString().split('T')[0];
      const count = contributionMap.get(date) || 0;
      
      let level = 0;
      if (count > 15) level = 4;
      else if (count > 10) level = 3;
      else if (count > 5) level = 2;
      else if (count > 0) level = 1;
      
      graph.push({
        date,
        count,
        level,
      });
    }
    
    return graph;
  }

  private async calculateCurrentStreak(userId: string): Promise<number> {
    const contributions = await this.prisma.contribution.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      take: 365, // Last year
    });

    if (contributions.length === 0) return 0;

    let streak = 0;
    const today = new Date().toISOString().split('T')[0];
    
    for (let i = 0; i < contributions.length; i++) {
      const contribution = contributions[i];
      const contributionDate = contribution.date.toISOString().split('T')[0];
      
      if (contribution.linesWritten > 0) {
        if (i === 0) {
          // Check if the most recent contribution is today or yesterday
          const expectedDate = new Date();
          expectedDate.setDate(expectedDate.getDate() - streak);
          const expectedDateStr = expectedDate.toISOString().split('T')[0];
          
          if (contributionDate === expectedDateStr || contributionDate === today) {
            streak++;
          } else {
            break;
          }
        } else {
          // Check consecutive days
          const expectedDate = new Date(contributions[i - 1].date);
          expectedDate.setDate(expectedDate.getDate() - 1);
          const expectedDateStr = expectedDate.toISOString().split('T')[0];
          
          if (contributionDate === expectedDateStr) {
            streak++;
          } else {
            break;
          }
        }
      } else {
        break;
      }
    }

    return streak;
  }

  private async calculateRecordStreak(userId: string): Promise<number> {
    const contributions = await this.prisma.contribution.findMany({
      where: { userId },
      orderBy: { date: 'asc' },
    });

    let maxStreak = 0;
    let currentStreak = 0;

    contributions.forEach(contribution => {
      if (contribution.linesWritten > 0) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    });

    return maxStreak;
  }

  private getMostActiveDay(contributions: any[]): string {
    if (contributions.length === 0) return 'No data';
    
    const dayOfWeek = contributions.reduce((max, curr) => 
      curr.linesWritten > max.linesWritten ? curr : max
    );
    
    return new Date(dayOfWeek.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
