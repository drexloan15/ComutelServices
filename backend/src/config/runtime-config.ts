export type NodeEnv = 'development' | 'test' | 'production';

export type RuntimeConfig = {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  corsOrigins: string[];
  corsCredentials: boolean;
  trustProxy: boolean;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessTtl: string;
  jwtRefreshTtl: string;
  bootstrapAdminSecret: string;
  refreshCookieEnabled: boolean;
  refreshCookieName: string;
  refreshCookieSecure: boolean;
  refreshCookieSameSite: 'lax' | 'strict' | 'none';
  refreshCookieDomain?: string;
  refreshCookiePath: string;
  refreshCookieMaxAgeMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  authRateLimitWindowMs: number;
  authRateLimitMax: number;
  slaEngineAutoRunEnabled: boolean;
  slaEngineIntervalMs: number;
  monitoringMetricsToken?: string;
  logLevel: 'fatal' | 'error' | 'warn' | 'info' | 'debug' | 'trace';
};

const INSECURE_SECRET_VALUES = new Set([
  'change_this_access_secret',
  'change_this_refresh_secret',
  'change_this_bootstrap_admin_secret',
  'dev_access_secret',
  'dev_refresh_secret',
  'dev_bootstrap_admin_secret',
  'changeme',
  'secret',
  'password',
]);

let cachedConfig: RuntimeConfig | null = null;

export function getRuntimeConfig(): RuntimeConfig {
  if (cachedConfig) {
    return cachedConfig;
  }

  const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
  const isProduction = nodeEnv === 'production';

  const jwtAccessSecret = requireEnv('JWT_ACCESS_SECRET');
  const jwtRefreshSecret = requireEnv('JWT_REFRESH_SECRET');
  const bootstrapAdminSecret = requireEnv('BOOTSTRAP_ADMIN_SECRET');

  assertSecretStrength('JWT_ACCESS_SECRET', jwtAccessSecret, isProduction);
  assertSecretStrength('JWT_REFRESH_SECRET', jwtRefreshSecret, isProduction);
  assertSecretStrength(
    'BOOTSTRAP_ADMIN_SECRET',
    bootstrapAdminSecret,
    isProduction,
  );

  const refreshCookieEnabled = parseBoolean(
    process.env.AUTH_REFRESH_COOKIE_ENABLED,
    false,
  );
  const refreshCookieSecure = parseBoolean(
    process.env.AUTH_REFRESH_COOKIE_SECURE,
    isProduction,
  );
  const refreshCookieSameSite = parseSameSite(
    process.env.AUTH_REFRESH_COOKIE_SAME_SITE,
    isProduction ? 'strict' : 'lax',
  );

  if (refreshCookieSameSite === 'none' && !refreshCookieSecure) {
    throw new Error(
      'AUTH_REFRESH_COOKIE_SAME_SITE=none requiere AUTH_REFRESH_COOKIE_SECURE=true.',
    );
  }

  cachedConfig = {
    nodeEnv,
    isProduction,
    port: parsePort(process.env.PORT, 3001),
    corsOrigins: parseCorsOrigins(
      process.env.CORS_ORIGINS ?? process.env.CORS_ORIGIN,
      isProduction,
    ),
    corsCredentials:
      refreshCookieEnabled || parseBoolean(process.env.CORS_CREDENTIALS, false),
    trustProxy: parseBoolean(process.env.TRUST_PROXY, false),
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessTtl: process.env.JWT_ACCESS_TTL?.trim() || '15m',
    jwtRefreshTtl: process.env.JWT_REFRESH_TTL?.trim() || '7d',
    bootstrapAdminSecret,
    refreshCookieEnabled,
    refreshCookieName:
      process.env.AUTH_REFRESH_COOKIE_NAME?.trim() || 'comutel_refresh_token',
    refreshCookieSecure,
    refreshCookieSameSite,
    refreshCookieDomain: process.env.AUTH_REFRESH_COOKIE_DOMAIN?.trim(),
    refreshCookiePath:
      process.env.AUTH_REFRESH_COOKIE_PATH?.trim() || '/api/auth',
    refreshCookieMaxAgeMs:
      parsePositiveInt(process.env.AUTH_REFRESH_COOKIE_MAX_AGE_MS, 0) ||
      parseDurationMs(process.env.JWT_REFRESH_TTL, 7 * 24 * 60 * 60 * 1000),
    rateLimitWindowMs: parsePositiveInt(
      process.env.RATE_LIMIT_WINDOW_MS,
      60_000,
    ),
    rateLimitMax: parsePositiveInt(process.env.RATE_LIMIT_MAX, 120),
    authRateLimitWindowMs: parsePositiveInt(
      process.env.AUTH_RATE_LIMIT_WINDOW_MS,
      60_000,
    ),
    authRateLimitMax: parsePositiveInt(process.env.AUTH_RATE_LIMIT_MAX, 10),
    slaEngineAutoRunEnabled: parseBoolean(
      process.env.SLA_ENGINE_AUTORUN_ENABLED,
      true,
    ),
    slaEngineIntervalMs: parsePositiveInt(
      process.env.SLA_ENGINE_INTERVAL_MS,
      60_000,
    ),
    monitoringMetricsToken: process.env.MONITORING_METRICS_TOKEN?.trim(),
    logLevel: parseLogLevel(process.env.LOG_LEVEL, 'info'),
  };

  return cachedConfig;
}

export function resetRuntimeConfigCacheForTests() {
  cachedConfig = null;
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} es requerido para iniciar el backend.`);
  }
  return value;
}

function parseNodeEnv(value?: string): NodeEnv {
  if (value === 'production') return 'production';
  if (value === 'test') return 'test';
  return 'development';
}

function assertSecretStrength(
  key: string,
  value: string,
  strict: boolean,
): void {
  if (!strict) {
    return;
  }

  const normalized = value.toLowerCase();
  if (INSECURE_SECRET_VALUES.has(normalized)) {
    throw new Error(`${key} no puede usar valores por defecto en produccion.`);
  }
  if (value.length < 32) {
    throw new Error(`${key} debe tener al menos 32 caracteres en produccion.`);
  }
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true;
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false;
  }
  return fallback;
}

function parsePort(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }
  return fallback;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (Number.isInteger(parsed) && parsed > 0) {
    return parsed;
  }
  return fallback;
}

function parseDurationMs(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim().toLowerCase();
  const direct = Number(normalized);
  if (Number.isFinite(direct) && direct > 0) {
    return direct;
  }

  const match = normalized.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    return fallback;
  }

  const amount = Number(match[1]);
  const unit = match[2];
  if (!Number.isFinite(amount) || amount <= 0) {
    return fallback;
  }

  switch (unit) {
    case 'ms':
      return amount;
    case 's':
      return amount * 1_000;
    case 'm':
      return amount * 60_000;
    case 'h':
      return amount * 3_600_000;
    case 'd':
      return amount * 86_400_000;
    default:
      return fallback;
  }
}

function parseCorsOrigins(raw: string | undefined, strict: boolean): string[] {
  if (!raw || raw.trim().length === 0) {
    if (strict) {
      throw new Error(
        'CORS_ORIGINS es requerido en produccion y no puede estar vacio.',
      );
    }
    return ['http://localhost:3000'];
  }

  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (origins.length === 0) {
    throw new Error('CORS_ORIGINS no contiene origins validos.');
  }

  for (const origin of origins) {
    if (origin === '*' || origin.includes('*')) {
      throw new Error('CORS_ORIGINS no permite wildcard (*).');
    }
    try {
      const url = new URL(origin);
      if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error();
      }
    } catch {
      throw new Error(`Origin CORS invalido: ${origin}`);
    }
  }

  return origins;
}

function parseSameSite(
  value: string | undefined,
  fallback: 'lax' | 'strict' | 'none',
): 'lax' | 'strict' | 'none' {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'lax' ||
    normalized === 'strict' ||
    normalized === 'none'
  ) {
    return normalized;
  }
  return fallback;
}

function parseLogLevel(
  value: string | undefined,
  fallback: RuntimeConfig['logLevel'],
): RuntimeConfig['logLevel'] {
  const normalized = value?.trim().toLowerCase();
  if (
    normalized === 'fatal' ||
    normalized === 'error' ||
    normalized === 'warn' ||
    normalized === 'info' ||
    normalized === 'debug' ||
    normalized === 'trace'
  ) {
    return normalized;
  }
  return fallback;
}
