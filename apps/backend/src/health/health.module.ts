import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [PrismaModule, RedisModule, AiModule],
  controllers: [HealthController],
})
export class HealthModule {}
