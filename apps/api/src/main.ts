import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import * as Sentry from '@sentry/node';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Monitoring integration points (spec §Monitoring — "prepare integration
// points... do not over-engineer"). Sentry activates only if SENTRY_DSN is
// set, so local dev never sends anything anywhere. OpenTelemetry is left
// as a documented point rather than wired up: add an `instrumentation.ts`
// bootstrapped via `--require` (or `@opentelemetry/auto-instrumentations-node`)
// when tracing is actually needed — doing it now would be exactly the
// over-engineering the spec warns against for an MVP.
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN, tracesSampleRate: 0.1 });
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet());
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? true,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.setGlobalPrefix('api');

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Bii Localfinder API')
      .setDescription('Service marketplace platform API (Phase 1: auth + RBAC)')
      .setVersion('0.1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.API_PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Bii Localfinder API running on http://localhost:${port}/api`);
}
bootstrap();
