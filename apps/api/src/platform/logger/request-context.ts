import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

export const requestContext = {
  run: <T>(context: RequestContext, work: () => T): T => storage.run(context, work),
  get: (): RequestContext | undefined => storage.getStore(),
  requestId: (): string | undefined => storage.getStore()?.requestId,
};
