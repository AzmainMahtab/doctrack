import { describe, expect, it } from 'vitest';
import { toOpenApiPath } from './define-route.ts';
import { buildTestApp } from './test-app.ts';
import request from 'supertest';

const ALLOWED_UNDOCUMENTED = new Set<string>();

describe('OpenAPI contract', () => {
  it('is an OpenAPI 3.1 document', () => {
    const { document } = buildTestApp();
    expect(document.openapi).toBe('3.1.0');
    expect(document.info.title).toBe('Doctor Tracker API');
  });

  it('documents every defined route and nothing else', () => {
    const { document, routes } = buildTestApp();
    const defined = routes.map((r) => `${r.spec.method} ${toOpenApiPath(r.spec.path)}`).sort();
    const documented = Object.entries(document.paths ?? {})
      .flatMap(([path, item]) =>
        Object.keys(item as object)
          .filter((k) => ['get', 'post', 'put', 'patch', 'delete'].includes(k))
          .map((method) => `${method} ${path}`),
      )
      .sort();
    expect(documented).toEqual(defined);
  });

  it('mounts every defined route on the router and nothing outside the registry', () => {
    const { router, routes } = buildTestApp();
    const mounted = router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys((layer.route as unknown as { methods: Record<string, boolean> }).methods).map(
          (method) => `${method} ${(layer.route as unknown as { path: string }).path}`,
        ),
      )
      .filter((entry) => !ALLOWED_UNDOCUMENTED.has(entry))
      .sort();
    const defined = routes.map((r) => `${r.spec.method} ${r.spec.path}`).sort();
    expect(mounted).toEqual(defined);
  });

  it('references the Problem schema for error responses', () => {
    const { document } = buildTestApp();
    const schemas = document.components?.schemas ?? {};
    expect(schemas).toHaveProperty('Problem');
    type Operation = {
      responses: Record<string, { content?: Record<string, { schema: { $ref: string } }> }>;
    };
    const op = (document.paths?.['/things/{id}'] as unknown as Record<string, Operation>)
      .post as Operation;
    expect(op.responses['422']?.content?.['application/problem+json']?.schema.$ref).toBe(
      '#/components/schemas/Problem',
    );
    expect(op.responses['401']).toBeDefined();
    expect(op.responses['429']).toBeDefined();
  });

  it('serves the document and Swagger UI', async () => {
    const { app } = buildTestApp();
    const json = await request(app).get('/openapi.json');
    expect(json.status).toBe(200);
    expect(json.body.paths['/health']).toBeDefined();
    const docs = await request(app).get('/docs/');
    expect(docs.status).toBe(200);
    expect(docs.text).toContain('swagger-ui');
  });
});
