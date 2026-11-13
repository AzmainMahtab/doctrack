import { pino, type Logger } from 'pino';
import type { AppConfig } from '../config/index.ts';
import { requestContext } from './request-context.ts';

export type { Logger };

export function createLogger(config: Pick<AppConfig, 'env' | 'logLevel'>, name = 'api'): Logger {
  return pino({
    name,
    level: config.env === 'test' ? 'silent' : config.logLevel,
    mixin: () => {
      const requestId = requestContext.requestId();
      return requestId ? { requestId } : {};
    },
    redact: { paths: ['req.headers.cookie', 'req.headers.authorization'], censor: '[redacted]' },
    ...(config.env === 'development'
      ? { transport: { target: 'pino-pretty', options: { colorize: true } } }
      : {}),
  });
}
