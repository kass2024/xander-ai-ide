import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { BillingModule } from './billing/billing.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AiModule } from './ai/ai.module';
import { FilesModule } from './files/files.module';
import { TerminalModule } from './terminal/terminal.module';
import { AdminModule } from './admin/admin.module';
import { RepoModule } from './repo/repo.module';
import { CommonModule } from './common/common.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    RedisModule,
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BillingModule,
    AiModule,
    FilesModule,
    TerminalModule,
    AdminModule,
    RepoModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
