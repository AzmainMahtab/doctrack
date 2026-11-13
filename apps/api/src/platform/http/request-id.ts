import type { RequestHandler } from 'express';
import { v7 as uuidv7 } from 'uuid';
import { requestContext } from '../logger/index.ts';

export const REQUEST_ID_HEADER = 'X-Request-Id';
const VALID_REQUEST_ID = /^[A-Za-z0-9-]{8,64}$/;

export const requestId = (): RequestHandler => (req, res, next) => {
  const incoming = req.get(REQUEST_ID_HEADER);
  const id = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : uuidv7();
  res.locals.requestId = id;
  res.setHeader(REQUEST_ID_HEADER, id);
  requestContext.run({ requestId: id }, next);
};
