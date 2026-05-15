// MUST be imported before any other module so Sentry can instrument Node
// (http, fs, db drivers) before NestJS resolves them.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });

  // Catch any exception NestJS doesn't already handle so Sentry sees it.
  // SentryGlobalFilter forwards to the default exception filter after
  // capturing, so this is purely additive.
  if (process.env.SENTRY_DSN) {
    app.useGlobalFilters(new SentryGlobalFilter(app.getHttpAdapter()));
  }

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('Maa Platform API')
    .setDescription('Multi-tenant SaaS API for Iraqi water plant operations')
    .setVersion('0.1')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`Maa API running on http://localhost:${port}/api/v1`);
}

bootstrap();
