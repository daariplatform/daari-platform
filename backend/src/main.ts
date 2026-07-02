// MUST be imported before any other module so Sentry can instrument Node
// (http, fs, db drivers) before NestJS resolves them.
import './instrument';

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { SentryGlobalFilter } from '@sentry/nestjs/setup';
import { APP_FILTER } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  // CORS — restrict to the dashboard origin in production. Previously we
  // had `cors: true` which reflects *every* incoming origin, letting any
  // site embed authenticated requests against the API. Audit finding H10.
  // The mobile apps use no Origin header (native HTTP client) so CORS
  // doesn't gate them.
  const corsOrigins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // In production, fail closed if CORS_ORIGINS is unset rather than reflecting
  // every origin — a forgotten env var must not silently open the API to any
  // site. Locally we still match all origins for convenience.
  if (corsOrigins.length === 0 && process.env.NODE_ENV === 'production') {
    throw new Error(
      'CORS_ORIGINS must be set in production (comma-separated allowed origins).',
    );
  }
  const cors = corsOrigins.length > 0
    ? { origin: corsOrigins, credentials: true }
    : true; // dev fallback — match all origins locally

  // bufferLogs lets Nest buffer the boot-up logs until our pino logger is
  // resolved, so the framework messages also come out as JSON instead of
  // the default colored text Nest emits during startup.
  const app = await NestFactory.create(AppModule, {
    cors,
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));

  // نحن خلف nginx (الاستماع على 127.0.0.1) — اجعل Express يثق بترويسة الوكيل
  // كي يصير req.ip عنوان العميل الحقيقي. بدونها ينهار ThrottlerGuard إلى دلو
  // واحد مشترك (loopback) يُبطِل حماية brute-force على login/OTP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

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

  // Gate Swagger UI behind dev/staging — in production the full API surface
  // shouldn't be browsable by anyone who hits /api/docs. Audit finding
  // (MEDIUM). Set ENABLE_SWAGGER=true in staging to opt back in.
  const enableSwagger =
    process.env.ENABLE_SWAGGER === 'true' || process.env.NODE_ENV !== 'production';
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('Maa Platform API')
      .setDescription('Multi-tenant SaaS API for Iraqi water plant operations')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = Number(process.env.PORT ?? 3000);
  // Bind to loopback only — nginx is the public-facing edge. Defends
  // against any future config slip that would otherwise expose 3004 to
  // the public internet. Audit finding (MEDIUM).
  await app.listen(port, '127.0.0.1');
  console.log(`Maa API running on http://127.0.0.1:${port}/api/v1`);
}

bootstrap();
