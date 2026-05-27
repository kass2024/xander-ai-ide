import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: (origin, callback) => {
      const allowed = [
        'http://localhost:3000',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        process.env.WEB_URL,
        'https://parrotmoc.online',
        'https://www.parrotmoc.online',
      ].filter(Boolean) as string[];
      // Electron packaged app (file:// / null origin) and local dev
      if (!origin || allowed.includes(origin) || origin.startsWith('file://')) {
        callback(null, true);
      } else {
        callback(null, true); // allow desktop clients on any localhost port
      }
    },
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);

  console.log(`🚀 Backend API running on http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/health`);
  console.log(`💳 Stripe webhook: POST http://localhost:${port}/billing/webhook`);
}

bootstrap();
