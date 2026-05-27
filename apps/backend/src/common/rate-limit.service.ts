import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';

const memoryBuckets = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class RateLimitService {
  constructor(
    private redis: RedisService,
    private config: ConfigService,
  ) {}

  async checkLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    label = 'requests',
  ): Promise<void> {
    if (this.redis.isEnabled()) {
      const count = await this.redis.increment(`rl:${key}`, windowSeconds);
      if (count > limit) {
        throw new HttpException(
          `Rate limit exceeded: max ${limit} ${label} per ${windowSeconds}s`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      return;
    }

    const now = Date.now();
    const bucket = memoryBuckets.get(key);
    if (!bucket || now > bucket.resetAt) {
      memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
      return;
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      throw new HttpException(
        `Rate limit exceeded: max ${limit} ${label} per ${windowSeconds}s`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  async checkAiRateLimit(userId: string): Promise<void> {
    const perMinute = parseInt(this.config.get<string>('AI_RATE_LIMIT_PER_MIN') || '60', 10);
    await this.checkLimit(`ai:${userId}`, perMinute, 60, 'AI requests');
  }
}
