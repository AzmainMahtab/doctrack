import { z } from '../openapi.ts';

export const PageMetaSchema = z
  .object({
    page: z.number().int().min(1),
    limit: z.number().int().min(1).max(100),
    total: z.number().int().min(0),
    totalPages: z.number().int().min(0),
  })
  .openapi('PageMeta');

export type PageMeta = z.infer<typeof PageMetaSchema>;

export const PageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const single = <T extends z.ZodType>(schema: T) => z.object({ data: schema });

export const list = <T extends z.ZodType>(schema: T) =>
  z.object({ data: z.array(schema), meta: PageMetaSchema });
