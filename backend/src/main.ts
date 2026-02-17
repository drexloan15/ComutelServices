import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import { getRuntimeConfig } from './config/runtime-config';
import {
  createPinoInstance,
  createPinoLoggerService,
  createRequestContextMiddleware,
} from './logging/pino-logger';
import { MonitoringService } from './monitoring/monitoring.service';

async function bootstrap() {
  const config = getRuntimeConfig();
  const pinoInstance = createPinoInstance(config);
  const app = await NestFactory.create(AppModule, {
    logger: createPinoLoggerService(pinoInstance),
  });
  const monitoringService = app.get(MonitoringService);

  if (config.trustProxy) {
    const expressApp = app.getHttpAdapter().getInstance() as {
      set: (name: string, value: number) => void;
    };
    expressApp.set('trust proxy', 1);
  }

  app.use(createRequestContextMiddleware(pinoInstance));
  app.use(monitoringService.createHttpMetricsMiddleware());
  const cookieParserMiddleware = cookieParser() as (
    req: Request,
    res: Response,
    next: () => void,
  ) => void;
  const helmetMiddleware = helmet() as (
    req: Request,
    res: Response,
    next: () => void,
  ) => void;

  app.use(cookieParserMiddleware);
  app.use(helmetMiddleware);
  app.use(
    rateLimit({
      windowMs: config.rateLimitWindowMs,
      limit: config.rateLimitMax,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (req: Request & { requestId?: string }, res: Response) => {
        const requestId = (req as { requestId?: string }).requestId;
        pinoInstance.warn(
          {
            event: 'http.rate_limit.blocked',
            requestId,
            method: req.method,
            path: req.originalUrl,
            ip: req.ip,
          },
          'rate.limit.blocked',
        );
        res.status(429).json({
          statusCode: 429,
          message: 'Demasiadas solicitudes, intenta nuevamente.',
          requestId,
        });
      },
    }),
  );

  const authRateLimiter = rateLimit({
    windowMs: config.authRateLimitWindowMs,
    limit: config.authRateLimitMax,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req: Request & { requestId?: string }, res: Response) => {
      const requestId = req.requestId;
      pinoInstance.warn(
        {
          event: 'http.auth_rate_limit.blocked',
          requestId,
          method: req.method,
          path: req.originalUrl,
          ip: req.ip,
        },
        'auth.rate.limit.blocked',
      );
      res.status(429).json({
        statusCode: 429,
        message: 'Demasiados intentos de autenticacion.',
        requestId,
      });
    },
  }) as (req: Request, res: Response, next: () => void) => void;

  app.use('/api/auth/login', authRateLimiter);
  app.use('/api/auth/register', authRateLimiter);
  app.use('/api/auth/bootstrap-admin', authRateLimiter);
  app.use('/api/auth/refresh', authRateLimiter);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: config.corsOrigins,
    credentials: config.corsCredentials,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Authorization',
      'Content-Type',
      'X-Request-Id',
      'X-Requested-With',
    ],
    exposedHeaders: ['X-Request-Id'],
  });

  await app.listen(config.port);
  pinoInstance.info(
    {
      event: 'app.started',
      port: config.port,
      env: config.nodeEnv,
      corsOrigins: config.corsOrigins,
      refreshCookieEnabled: config.refreshCookieEnabled,
      metricsProtected: Boolean(config.monitoringMetricsToken),
    },
    'backend.started',
  );
}
void bootstrap();
