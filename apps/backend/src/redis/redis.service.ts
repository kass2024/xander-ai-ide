import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis | null = null;
  private enabled = false;

  constructor(private configService: ConfigService) {
    const url = this.configService.get<string>('REDIS_URL');
    if (!url) {
      this.logger.warn('REDIS_URL not set — rate limiting uses in-memory fallback');
      return;
    }
    try {
      this.client = new Redis(url, {
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      this.client.connect().then(() => {
        this.enabled = true;
        this.logger.log('Redis connected');
      }).catch((err) => {
        this.logger.warn(`Redis unavailable: ${err.message}`);
        this.client = null;
      });
    } catch (err) {
      this.logger.warn(`Redis init failed: ${(err as Error).message}`);
    }
  }

  isEnabled(): boolean {
    return this.enabled && !!this.client;
  }

  async ping(): Promise<boolean> {
    if (!this.client) return false;
    try {
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      return false;
    }
  }

  async increment(key: string, windowSeconds: number): Promise<number> {
    if (!this.client) return 0;
    const count = await this.client.incr(key);
    if (count === 1) {
      await this.client.expire(key, windowSeconds);
    }
    return count;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    return this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    if (ttlSeconds) {
      await this.client.set(key, value, 'EX', ttlSeconds);
    } else {
      await this.client.set(key, value);
    }
  }

  onModuleDestroy() {
    this.client?.disconnect();
  }
}
