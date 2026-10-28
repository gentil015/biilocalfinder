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

function assertProductionSecrets() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'CORS_ORIGIN'];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }
  for (const name of ['JWT_SECRET', 'JWT_REFRESH_SECRET']) {
    if ((process.env[name] ?? '').startsWith('change-me')) {
      throw new Error(`${name} still uses the example value`);
    }
  }
}

async function bootstrap() {
  assertProductionSecrets();
  const app = await NestFactory.create(AppModule);
  // nginx terminates TLS and forwards the client address; without this the
  // global throttler would see every request coming from the proxy IP.
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(helmet());
  const corsOrigin = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',')
        .map((o) => o.trim())
        .filter(Boolean)
    : [];
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigin.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      // No wildcard preview domains in production: an open *.vercel.app
      // allowlist lets anyone host a page that makes credentialed calls.
      if (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      return callback(null, false);
    },
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

  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 4000);
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`Bii Localfinder API listening on 0.0.0.0:${port}/api`);
}
bootstrap();
