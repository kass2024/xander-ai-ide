import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /** Liveness probe — no DB/Redis; used by Docker healthcheck */
  @Get('live')
  live() {
    return {
      status: 'alive',
      timestamp: new Date().toISOString(),
      service: 'xander-ai-ide-backend',
    };
  }

  @Get()
  async check() {
    let db = false;
    let redis = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch { /* db down */ }
    redis = await this.redis.ping();

    return {
      status: db ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'xander-ai-ide-backend',
      checks: { database: db, redis },
    };
  }

  @Get('detailed')
  async detailedCheck() {
    const basic = await this.check();
    return {
      ...basic,
      version: '1.0.0',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV || 'development',
    };
  }
}
