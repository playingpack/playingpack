import { initTRPC } from '@trpc/server';
import { z } from 'zod';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import type { Context } from './context.js';
import { updateSettingsSchema, point1ActionSchema, point2ActionSchema } from '@playingpack/shared';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// Find package.json - works in both dev (src/trpc/) and prod (dist/)
function loadPackageJson(): { version: string } {
  // Try prod path first (../package.json from dist/index.js)
  try {
    return require(resolve(__dirname, '../package.json'));
  } catch {
    // Fall back to dev path (../../package.json from src/trpc/)
    return require(resolve(__dirname, '../../package.json'));
  }
}

const pkg = loadPackageJson();

const t = initTRPC.context<Context>().create();

export const appRouter = t.router({
  /**
   * Get all sessions
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
   * Get settings
   */
  getSettings: t.procedure.query(({ ctx }) => {
    return {
      settings: ctx.sessionManager.getSettings(),
      version: pkg.version,
    };
  }),

  /**
   * Update settings
   */
  updateSettings: t.procedure.input(updateSettingsSchema).mutation(({ ctx, input }) => {
    ctx.sessionManager.updateSettings(input.settings);
    return {
      settings: ctx.sessionManager.getSettings(),
    };
  }),

  /**
   * Resolve point 1 action (request arrived)
   * Actions: llm, cache, mock
   */
  point1Action: t.procedure
    .input(
      z.object({
        requestId: z.string(),
        action: point1ActionSchema,
      })
    )
    .mutation(({ ctx, input }) => {
      const success = ctx.sessionManager.resolvePoint1(input.requestId, input.action);
      return { success };
    }),

  /**
   * Resolve point 2 action (response received)
   * Actions: return, modify
   */
  point2Action: t.procedure
    .input(
      z.object({
        requestId: z.string(),
        action: point2ActionSchema,
      })
    )
    .mutation(({ ctx, input }) => {
      const success = ctx.sessionManager.resolvePoint2(input.requestId, input.action);
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
