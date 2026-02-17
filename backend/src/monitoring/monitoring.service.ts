import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
  type LabelValues,
} from 'prom-client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MonitoringService {
  private readonly registry: Registry;
  private readonly requestCounter: Counter<'method' | 'route' | 'status_code'>;
  private readonly requestDuration: Histogram<
    'method' | 'route' | 'status_code'
  >;

  constructor(private readonly prisma: PrismaService) {
    this.registry = new Registry();
    collectDefaultMetrics({ register: this.registry, prefix: 'comutel_' });

    this.requestCounter = new Counter({
      name: 'comutel_http_requests_total',
      help: 'Total HTTP requests processed.',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.requestDuration = new Histogram({
      name: 'comutel_http_request_duration_seconds',
      help: 'HTTP request duration in seconds.',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.registry],
    });
  }

  createHttpMetricsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const startedAt = process.hrtime.bigint();

      res.on('finish', () => {
        const durationSeconds =
          Number(process.hrtime.bigint() - startedAt) / 1_000_000_000;
        const labels: LabelValues<'method' | 'route' | 'status_code'> = {
          method: req.method,
          route: this.normalizeRouteLabel(req),
          status_code: String(res.statusCode),
        };

        this.requestCounter.inc(labels);
        this.requestDuration.observe(labels, durationSeconds);
      });

      next();
    };
  }

  getLiveness() {
    return {
      status: 'ok',
      checks: {
        process: 'up',
      },
      timestamp: new Date().toISOString(),
    };
  }

  async getReadiness() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        checks: {
          database: 'up',
        },
        timestamp: new Date().toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        checks: {
          database: 'down',
        },
      });
    }
  }

  getMetricsContentType() {
    return this.registry.contentType;
  }

  async getMetrics() {
    return this.registry.metrics();
  }

  private normalizeRouteLabel(req: Request) {
    const routePath = `${req.baseUrl || ''}${req.path || ''}`;

    return routePath
      .replace(
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        ':id',
      )
      .replace(/\b\d+\b/g, ':n');
  }
}
