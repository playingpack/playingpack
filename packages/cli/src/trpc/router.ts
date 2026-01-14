import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { Context } from './context.js';
import {
  mockRequestSchema,
  allowRequestSchema,
  updateSettingsSchema,
  preInterceptAllowSchema,
  preInterceptEditSchema,
  preInterceptUseCacheSchema,
  preInterceptMockSchema,
} from '@playingpack/shared';

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  /**
   * Get all active sessions
   */
  getSessions: t.procedure.query(({ ctx }) => {
    return {
      sessions: ctx.sessionManager.getAllSessions(),
    };
  }),

  /**
   * Get a specific session
   */
  getSession: t.procedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    const session = ctx.sessionManager.getSession(input.id);
    return { session: session || null };
  }),

  /**
   * Get interceptor settings
   */
  getSettings: t.procedure.query(({ ctx }) => {
    return {
      settings: ctx.sessionManager.getSettings(),
    };
  }),

  /**
   * Update interceptor settings
   */
  updateSettings: t.procedure.input(updateSettingsSchema).mutation(({ ctx, input }) => {
    ctx.sessionManager.updateSettings(input.settings);
    return {
      settings: ctx.sessionManager.getSettings(),
    };
  }),

  /**
   * Allow a paused request to continue
   */
  allowRequest: t.procedure.input(allowRequestSchema).mutation(({ ctx, input }) => {
    const success = ctx.sessionManager.allowRequest(input.requestId);
    return { success };
  }),

  /**
   * Mock a paused request
   */
  mockRequest: t.procedure.input(mockRequestSchema).mutation(({ ctx, input }) => {
    const success = ctx.sessionManager.mockRequest(input.requestId, input.content);
    return { success };
  }),

  /**
   * Allow a pre-intercepted request to proceed (before LLM call)
   */
  preInterceptAllow: t.procedure.input(preInterceptAllowSchema).mutation(({ ctx, input }) => {
    const success = ctx.sessionManager.preInterceptAllow(input.requestId);
    return { success };
  }),

  /**
   * Edit and send a pre-intercepted request
   */
  preInterceptEdit: t.procedure.input(preInterceptEditSchema).mutation(({ ctx, input }) => {
    const success = ctx.sessionManager.preInterceptEdit(input.requestId, input.editedBody);
    return { success };
  }),

  /**
   * Use cached response for a pre-intercepted request
   */
  preInterceptUseCache: t.procedure.input(preInterceptUseCacheSchema).mutation(({ ctx, input }) => {
    const success = ctx.sessionManager.preInterceptUseCache(input.requestId);
    return { success };
  }),

  /**
   * Mock response for a pre-intercepted request (without calling LLM)
   */
  preInterceptMock: t.procedure.input(preInterceptMockSchema).mutation(({ ctx, input }) => {
    const success = ctx.sessionManager.preInterceptMock(input.requestId, input.mockContent);
    return { success };
  }),

  /**
   * Health check
   */
  health: t.procedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),
});

export type AppRouter = typeof appRouter;
