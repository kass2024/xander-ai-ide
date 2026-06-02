import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MultiModelService } from '../ai/multi-model.service';

@Controller('health')
export class HealthController {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private multiModel: MultiModelService,
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

  @Get('ai')
  aiProviders() {
    const providers = this.multiModel.getProvidersStatus();
    const models = this.multiModel.getDefaultModels();
    return {
      status: providers.openai || providers.anthropic || providers.google ? 'ready' : 'unconfigured',
      providers,
      models: {
        openai: { agent: models.agent, fast: models.fast, embedding: models.embedding },
        anthropic: models.claude,
        google: models.gemini,
      },
      routing: 'auto — OpenAI agent, Claude UI/deep/refactor, Gemini fast/analysis',
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
