import type { FastifyRequest, FastifyReply } from 'fastify';
import { getSessionManager, type SessionManager } from '../interceptor/session-manager.js';

/**
 * TRPC Context
 */
export interface Context {
  sessionManager: SessionManager;
  req?: FastifyRequest;
  res?: FastifyReply;
}

/**
 * Create context for each request
 */
export function createContext(opts?: { req?: FastifyRequest; res?: FastifyReply }): Context {
  return {
    sessionManager: getSessionManager(),
    req: opts?.req,
    res: opts?.res,
  };
}
