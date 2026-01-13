import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import type { Context } from './context.js';
import { mockRequestSchema, allowRequestSchema, updateSettingsSchema } from '@playingpack/shared';

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
  getSession: t.procedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
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
  updateSettings: t.procedure
    .input(updateSettingsSchema)
    .mutation(({ ctx, input }) => {
      ctx.sessionManager.updateSettings(input.settings);
      return {
        settings: ctx.sessionManager.getSettings(),
      };
    }),

  /**
   * Allow a paused request to continue
   */
  allowRequest: t.procedure
    .input(allowRequestSchema)
    .mutation(({ ctx, input }) => {
      const success = ctx.sessionManager.allowRequest(input.requestId);
      return { success };
    }),

  /**
   * Mock a paused request
   */
  mockRequest: t.procedure
    .input(mockRequestSchema)
    .mutation(({ ctx, input }) => {
      const success = ctx.sessionManager.mockRequest(input.requestId, input.content);
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
