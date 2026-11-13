import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import type { AppConfig } from '../config/index.ts';
import type { Logger } from '../logger/index.ts';
import { errorHandler, notFoundHandler } from './error-handler.ts';
import { mountRoutes, type RouteDefinition } from './define-route.ts';
import { buildOpenApiDocument } from './openapi.ts';
import { requestId } from './request-id.ts';

export interface AppOptions {
  config: Pick<AppConfig, 'trustProxyHops'>;
  logger: Logger;
  routes: readonly RouteDefinition[];
  version: string;
}

export interface BuiltApp {
  app: Express;
  router: Router;
  document: ReturnType<typeof buildOpenApiDocument>;
}

export function createApp(options: AppOptions): BuiltApp {
  const { config, logger, routes, version } = options;
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxyHops);
  app.set('etag', false);

  app.use(requestId());

  const document = buildOpenApiDocument(routes, version);
  app.get('/openapi.json', (_req, res) => {
    res.json(document);
  });
  app.use(
    '/docs',
    helmet({ contentSecurityPolicy: false }),
    swaggerUi.serve,
    swaggerUi.setup(document, { customSiteTitle: 'Doctor Tracker API' }),
  );

  app.use(helmet());
  app.use((req, res, next) => {
    const started = process.hrtime.bigint();
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
      logger.info(
        {
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(durationMs),
        },
        'request',
      );
    });
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  const router = Router();
  mountRoutes(router, routes);
  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler(logger));

  return { app, router, document };
}
