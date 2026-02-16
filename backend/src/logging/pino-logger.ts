import { LoggerService } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import pino, { type Logger as PinoLogger } from 'pino';
import type { RuntimeConfig } from '../config/runtime-config';

const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'headers.authorization',
  'headers.cookie',
  'body.password',
  'body.refreshToken',
  '*.password',
  '*.refreshToken',
];

export type RequestWithId = Request & {
  requestId?: string;
};

export function createPinoInstance(config: RuntimeConfig): PinoLogger {
  return pino({
    level: config.logLevel,
    base: {
      service: 'comutelservices-backend',
      env: config.nodeEnv,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: REDACT_PATHS,
      censor: '[REDACTED]',
    },
  });
}

export class PinoLoggerService implements LoggerService {
  constructor(private readonly logger: PinoLogger) {}

  log(message: unknown, ...optionalParams: unknown[]) {
    this.write('info', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]) {
    this.write('error', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]) {
    this.write('warn', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]) {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.write('trace', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]) {
    this.write('fatal', message, optionalParams);
  }

  private write(
    level: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace',
    message: unknown,
    optionalParams: unknown[],
  ) {
    const meta = this.buildMeta(optionalParams);
    if (message instanceof Error) {
      this.logger[level](
        {
          ...meta,
          err: {
            name: message.name,
            message: message.message,
            stack: message.stack,
          },
        },
        message.message,
      );
      return;
    }

    if (typeof message === 'object' && message !== null) {
      this.logger[level](
        {
          ...meta,
          payload: message,
        },
        'nestjs.log',
      );
      return;
    }

    this.logger[level](meta, String(message));
  }

  private buildMeta(optionalParams: unknown[]) {
    if (optionalParams.length === 0) {
      return {};
    }

    const [first, second] = optionalParams;
    return {
      context: typeof second === 'string' ? second : undefined,
      trace: typeof first === 'string' ? first : undefined,
      extra:
        optionalParams.length > 2
          ? optionalParams.slice(2)
          : typeof first === 'string' || typeof second === 'string'
            ? undefined
            : optionalParams,
    };
  }
}

export function createPinoLoggerService(logger: PinoLogger): PinoLoggerService {
  return new PinoLoggerService(logger);
}

export function createRequestContextMiddleware(logger: PinoLogger) {
  return (req: RequestWithId, res: Response, next: NextFunction) => {
    const requestId =
      normalizeRequestId(req.header('x-request-id')) ?? randomUUID();
    req.requestId = requestId;
    res.setHeader('x-request-id', requestId);

    const startedAt = process.hrtime.bigint();
    logger.info(
      {
        event: 'http.request.start',
        requestId,
        method: req.method,
        path: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('user-agent'),
      },
      'request.start',
    );

    res.on('finish', () => {
      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      logger.info(
        {
          event: 'http.request.finish',
          requestId,
          method: req.method,
          path: req.originalUrl,
          statusCode: res.statusCode,
          durationMs: Number(durationMs.toFixed(2)),
        },
        'request.finish',
      );
    });

    next();
  };
}

function normalizeRequestId(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null;
  }
  const candidate = rawValue.trim();
  if (!candidate || candidate.length > 128) {
    return null;
  }
  const safe = candidate.replace(/[^a-zA-Z0-9._:-]/g, '');
  return safe || null;
}
