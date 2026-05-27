import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'production'
          ? ['warn', 'error']
          : ['query', 'info', 'warn', 'error'],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (err) {
      console.error(
        'Prisma failed to connect. Check DATABASE_URL / POSTGRES_PASSWORD (must match the postgres volume from first deploy).',
        err,
      );
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async cleanDatabase() {
    // Only for testing - clean all data
    if (process.env.NODE_ENV === 'test') {
      const tablenames = await this.$queryRaw<Array<{ tablename: string }>>`SELECT tablename FROM pg_tables WHERE schemaname='public'`;
      
      for (const { tablename } of tablenames) {
        if (tablename !== '_prisma_migrations') {
          try {
            await this.$executeRawUnsafe(`TRUNCATE TABLE "public"."${tablename}" CASCADE;`);
          } catch (error) {
            console.log({ error });
          }
        }
      }
    }
  }
}
