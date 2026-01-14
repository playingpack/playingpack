import { z } from 'zod';

// =============================================================================
// Configuration Schemas
// =============================================================================

/** Cache mode schema */
export const cacheModeSchema = z.enum(['off', 'read', 'read-write']);

/** PlayingPack config schema */
export const playingPackConfigSchema = z.object({
  // Core settings
  cache: cacheModeSchema.optional(),
  intervene: z.boolean().optional(),

  // Infrastructure settings
  upstream: z.string().url().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  host: z.string().optional(),
  cachePath: z.string().optional(),
  logPath: z.string().optional(),
  headless: z.boolean().optional(),
});

/** Runtime settings schema */
export const settingsSchema = z.object({
  cache: cacheModeSchema,
  intervene: z.boolean(),
});

/** Partial settings for updates */
export const updateSettingsSchema = z.object({
  settings: settingsSchema.partial(),
});

// =============================================================================
// OpenAI Request Schema
// =============================================================================

/** OpenAI Chat Completion request schema */
export const chatCompletionRequestSchema = z
  .object({
    model: z.string(),
    messages: z.array(
      z.object({
        role: z.enum(['system', 'user', 'assistant', 'tool']),
        content: z.union([z.string(), z.null(), z.array(z.any())]).optional(),
        name: z.string().optional(),
        tool_calls: z.array(z.any()).optional(),
        tool_call_id: z.string().optional(),
      })
    ),
    temperature: z.number().optional(),
    top_p: z.number().optional(),
    n: z.number().optional(),
    stream: z.boolean().optional(),
    stop: z.union([z.string(), z.array(z.string())]).optional(),
    max_tokens: z.number().optional(),
    presence_penalty: z.number().optional(),
    frequency_penalty: z.number().optional(),
    logit_bias: z.record(z.number()).optional(),
    user: z.string().optional(),
    tools: z
      .array(
        z.object({
          type: z.literal('function'),
          function: z.object({
            name: z.string(),
            description: z.string().optional(),
            parameters: z.any().optional(),
          }),
        })
      )
      .optional(),
    tool_choice: z
      .union([
        z.literal('none'),
        z.literal('auto'),
        z.literal('required'),
        z.object({
          type: z.literal('function'),
          function: z.object({ name: z.string() }),
        }),
      ])
      .optional(),
    response_format: z
      .object({
        type: z.enum(['text', 'json_object']),
      })
      .optional(),
    seed: z.number().optional(),
  })
  .passthrough(); // Allow additional properties

// =============================================================================
// Cache Schemas
// =============================================================================

/** Cache chunk schema */
export const cacheChunkSchema = z.object({
  data: z.string(),
  delay: z.number(),
});

/** Cached response schema */
export const cachedResponseSchema = z.object({
  hash: z.string(),
  timestamp: z.string(),
  request: z.object({
    model: z.string(),
    messages: z.array(z.unknown()),
  }),
  response: z.object({
    status: z.number(),
    body: z.unknown().optional(),
    chunks: z.array(cacheChunkSchema).optional(),
  }),
});

// =============================================================================
// Action Schemas
// =============================================================================

/** Point 1 action schema */
export const point1ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('llm') }),
  z.object({ action: z.literal('cache') }),
  z.object({ action: z.literal('mock'), content: z.string() }),
]);

/** Point 2 action schema */
export const point2ActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('return') }),
  z.object({ action: z.literal('modify'), content: z.string() }),
]);

/** Point 1 action message schema (for WebSocket) */
export const point1ActionMessageSchema = z.object({
  type: z.literal('point1_action'),
  requestId: z.string(),
  action: point1ActionSchema,
});

/** Point 2 action message schema (for WebSocket) */
export const point2ActionMessageSchema = z.object({
  type: z.literal('point2_action'),
  requestId: z.string(),
  action: point2ActionSchema,
});

/** WebSocket message schema (client -> server) */
export const wsMessageSchema = z.discriminatedUnion('type', [
  point1ActionMessageSchema,
  point2ActionMessageSchema,
]);

// =============================================================================
// Type Exports
// =============================================================================

export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;
export type CachedResponseInput = z.infer<typeof cachedResponseSchema>;
export type Point1ActionInput = z.infer<typeof point1ActionSchema>;
export type Point2ActionInput = z.infer<typeof point2ActionSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type PlayingPackConfigInput = z.infer<typeof playingPackConfigSchema>;
