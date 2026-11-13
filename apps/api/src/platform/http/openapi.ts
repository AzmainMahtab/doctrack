import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { ProblemSchema, type z } from '@doctrack/contracts';
import { toOpenApiPath, type RouteDefinition } from './define-route.ts';

const problemContent = { 'application/problem+json': { schema: ProblemSchema } };

const problemResponse = (description: string) => ({ description, content: problemContent });

export function buildOpenApiDocument(routes: readonly RouteDefinition[], version: string) {
  const registry = new OpenAPIRegistry();
  registry.register('Problem', ProblemSchema);

  for (const { spec } of routes) {
    const hasInput = Boolean(spec.request?.params || spec.request?.query || spec.request?.body);
    const responses: Record<
      string,
      | ReturnType<typeof problemResponse>
      | { description: string; content?: Record<string, { schema: z.ZodType }> }
    > = {};

    for (const [status, response] of Object.entries(spec.responses)) {
      responses[status] = response.schema
        ? {
            description: response.description,
            content: { 'application/json': { schema: response.schema } },
          }
        : { description: response.description };
    }
    if (hasInput) responses['422'] ??= problemResponse('Validation failed');
    if (!spec.public) {
      responses['401'] ??= problemResponse('Missing, invalid, expired or revoked token');
      responses['403'] ??= problemResponse('Missing permission');
    }
    responses['429'] ??= problemResponse('Rate limit exceeded');
    responses['500'] ??= problemResponse('Unexpected failure');

    registry.registerPath({
      method: spec.method,
      path: toOpenApiPath(spec.path),
      summary: spec.summary,
      tags: spec.tags,
      request: {
        ...(spec.request?.params ? { params: spec.request.params as z.ZodObject } : {}),
        ...(spec.request?.query ? { query: spec.request.query as z.ZodObject } : {}),
        ...(spec.request?.body
          ? { body: { content: { 'application/json': { schema: spec.request.body } } } }
          : {}),
      },
      responses,
    });
  }

  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Doctor Tracker API',
      version,
      description:
        'REST API for doctors, patients and dashboard analytics. Success bodies are `{ data, meta? }`; errors are RFC 9457 Problem Details.',
    },
    servers: [{ url: '/' }],
  });
}
