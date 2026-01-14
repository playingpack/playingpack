import { z } from 'zod';

// OpenAI Chat Completion request schema
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

// Mock request schema
export const mockRequestSchema = z.object({
  requestId: z.string(),
  type: z.enum(['text', 'error', 'tool_result']),
  content: z.string(),
});

// Allow request schema
export const allowRequestSchema = z.object({
  requestId: z.string(),
});

// Pre-intercept action schemas
export const preInterceptAllowSchema = z.object({
  requestId: z.string(),
});

export const preInterceptEditSchema = z.object({
  requestId: z.string(),
  editedBody: z.record(z.unknown()),
});

export const preInterceptUseCacheSchema = z.object({
  requestId: z.string(),
});

export const preInterceptMockSchema = z.object({
  requestId: z.string(),
  mockContent: z.string(),
});

// Interceptor settings schema
export const interceptorSettingsSchema = z.object({
  pause: z.enum(['off', 'tool-calls', 'all']),
});

// Partial interceptor settings for updates
export const updateSettingsSchema = z.object({
  settings: interceptorSettingsSchema.partial(),
});

// Tape schema for validation
export const tapeChunkSchema = z.object({
  c: z.string(),
  d: z.number(),
});

export const tapeMetaSchema = z.object({
  id: z.string(),
  hash: z.string(),
  timestamp: z.string(),
  model: z.string(),
  endpoint: z.string(),
});

export const tapeSchema = z.object({
  meta: tapeMetaSchema,
  request: z.object({
    body: z.unknown(),
  }),
  response: z.object({
    status: z.number(),
    chunks: z.array(tapeChunkSchema),
  }),
});

// Recording mode schema
export const recordModeSchema = z.enum(['auto', 'off', 'replay-only']);

// Pause mode schema
export const pauseModeSchema = z.enum(['off', 'tool-calls', 'all']);

// PlayingPack config schema
export const playingPackConfigSchema = z.object({
  upstream: z.string().url().optional(),
  tapesDir: z.string().optional(),
  logsDir: z.string().optional(),
  record: recordModeSchema.optional(),
  headless: z.boolean().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  host: z.string().optional(),
  pause: pauseModeSchema.optional(),
});

// Type exports from schemas
export type ChatCompletionRequest = z.infer<typeof chatCompletionRequestSchema>;
export type MockRequestInput = z.infer<typeof mockRequestSchema>;
export type AllowRequestInput = z.infer<typeof allowRequestSchema>;
export type PreInterceptAllowInput = z.infer<typeof preInterceptAllowSchema>;
export type PreInterceptEditInput = z.infer<typeof preInterceptEditSchema>;
export type PreInterceptUseCacheInput = z.infer<typeof preInterceptUseCacheSchema>;
export type PreInterceptMockInput = z.infer<typeof preInterceptMockSchema>;
export type InterceptorSettingsInput = z.infer<typeof interceptorSettingsSchema>;
export type TapeInput = z.infer<typeof tapeSchema>;
export type PlayingPackConfigInput = z.infer<typeof playingPackConfigSchema>;
