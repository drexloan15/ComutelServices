import type { RuntimeConfig } from '../config/runtime-config';
import {
  PinoLoggerService,
  createPinoInstance,
  createPinoLoggerService,
  createRequestContextMiddleware,
} from './pino-logger';

describe('pino-logger', () => {
  const runtimeConfig: RuntimeConfig = {
    nodeEnv: 'test',
    isProduction: false,
    port: 3001,
    corsOrigins: ['http://localhost:3000'],
    corsCredentials: false,
    trustProxy: false,
    jwtAccessSecret: 'test_access_secret_32_chars_minimum_0001',
    jwtRefreshSecret: 'test_refresh_secret_32_chars_minimum_0001',
    jwtAccessTtl: '15m',
    jwtRefreshTtl: '7d',
    bootstrapAdminSecret: 'test_bootstrap_secret_32_chars_min_0001',
    refreshCookieEnabled: false,
    refreshCookieName: 'comutel_refresh_token',
    refreshCookieSecure: false,
    refreshCookieSameSite: 'lax',
    refreshCookiePath: '/api/auth',
    refreshCookieMaxAgeMs: 60_000,
    rateLimitWindowMs: 60_000,
    rateLimitMax: 100,
    authRateLimitWindowMs: 60_000,
    authRateLimitMax: 10,
    slaEngineAutoRunEnabled: false,
    slaEngineIntervalMs: 60_000,
    monitoringMetricsToken: undefined,
    logLevel: 'info',
  };

  it('createPinoInstance y createPinoLoggerService funcionan', () => {
    const logger = createPinoInstance(runtimeConfig);
    const loggerService = createPinoLoggerService(logger);

    expect(logger).toBeDefined();
    expect(loggerService).toBeInstanceOf(PinoLoggerService);
  });

  it('PinoLoggerService procesa error, objeto y string', () => {
    const loggerMock = {
      fatal: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      info: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
    };
    const service = new PinoLoggerService(loggerMock as never);

    service.error(new Error('boom'));
    service.log({ event: 'payload' });
    service.warn('warn-message');
    service.verbose('trace-message');
    service.fatal('fatal-message');

    expect(loggerMock.error).toHaveBeenCalled();
    expect(loggerMock.info).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: { event: 'payload' },
      }),
      'nestjs.log',
    );
    expect(loggerMock.warn).toHaveBeenCalledWith({}, 'warn-message');
    expect(loggerMock.trace).toHaveBeenCalledWith({}, 'trace-message');
    expect(loggerMock.fatal).toHaveBeenCalledWith({}, 'fatal-message');
  });

  it('request context middleware agrega x-request-id y registra inicio/fin', () => {
    const loggerMock = {
      info: jest.fn(),
    };
    const next = jest.fn();
    let finishHandler: (() => void) | undefined;

    const req = {
      method: 'GET',
      originalUrl: '/api/tickets/123',
      ip: '127.0.0.1',
      header: jest.fn().mockReturnValue('  req-123  '),
      get: jest.fn().mockReturnValue('jest-agent'),
    };
    const res = {
      statusCode: 200,
      setHeader: jest.fn(),
      on: jest.fn((event: string, callback: () => void) => {
        if (event === 'finish') {
          finishHandler = callback;
        }
      }),
    };

    const middleware = createRequestContextMiddleware(loggerMock as never);
    middleware(req as never, res as never, next);
    finishHandler?.();

    expect(next).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', 'req-123');
    expect(loggerMock.info).toHaveBeenCalledTimes(2);
  });
});
