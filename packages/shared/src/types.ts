/**
 * Core types for PlayingPack
 */

// Request state machine states
export type RequestState =
  | 'LOOKUP' // Checking for cached tape
  | 'PAUSED' // Request paused before LLM call, waiting for user approval
  | 'CONNECT' // Opening upstream connection
  | 'STREAMING' // Piping chunks through
  | 'TOOL_CALL' // Tool call detected, waiting for user decision
  | 'FLUSH' // Resuming with real data
  | 'INJECT' // Sending mock data
  | 'REPLAY' // Playing back cached tape
  | 'COMPLETE' // Request finished
  | 'ERROR'; // Request errored

// Tape chunk - represents a single SSE event with timing
export interface TapeChunk {
  /** The raw SSE data string */
  c: string;
  /** Delay in ms since previous chunk */
  d: number;
}

// Tape metadata
export interface TapeMeta {
  /** Unique tape ID */
  id: string;
  /** SHA-256 hash of normalized request */
  hash: string;
  /** ISO timestamp when recorded */
  timestamp: string;
  /** Model used (e.g., "gpt-4") */
  model: string;
  /** Endpoint path */
  endpoint: string;
}

// The Tape - a recorded request/response pair
export interface Tape {
  meta: TapeMeta;
  request: {
    /** The full request body */
    body: unknown;
  };
  response: {
    /** HTTP status code */
    status: number;
    /** Response chunks with timing */
    chunks: TapeChunk[];
  };
}

// Tool call detected in stream
export interface ToolCall {
  /** Tool call index in the array */
  index: number;
  /** Tool call ID from OpenAI */
  id: string;
  /** Function name */
  name: string;
  /** Accumulated arguments JSON string */
  arguments: string;
}

// Active request session
export interface RequestSession {
  /** Unique request ID */
  id: string;
  /** Current state */
  state: RequestState;
  /** Request timestamp */
  timestamp: string;
  /** Completion timestamp */
  completedAt?: string;
  /** HTTP method */
  method: string;
  /** Request path */
  path: string;
  /** Request body (prompt) - sanitized */
  body: unknown;
  /** Model being used */
  model?: string;
  /** Detected tool calls */
  toolCalls: ToolCall[];
  /** Accumulated response content */
  responseContent: string;
  /** HTTP status code */
  statusCode?: number;
  /** Error message if any */
  error?: string;
  /** Whether the response was served from cache */
  cached?: boolean;
}

// WebSocket event: Intercept notification (after LLM response)
export interface InterceptEvent {
  type: 'intercept';
  requestId: string;
  toolCall: {
    name: string;
    arguments: string;
  };
  status: 'paused';
}

// WebSocket event: Pre-intercept notification (before LLM call)
export interface PreInterceptEvent {
  type: 'pre_intercept';
  requestId: string;
  request: {
    model: string;
    messages: unknown[];
  };
  hasCachedResponse: boolean;
  status: 'paused';
}

// WebSocket event: Request update
export interface RequestUpdateEvent {
  type: 'request_update';
  session: RequestSession;
}

// WebSocket event: Request complete
export interface RequestCompleteEvent {
  type: 'request_complete';
  requestId: string;
  statusCode: number;
  cached: boolean;
}

// Union of all WebSocket events
export type WSEvent =
  | InterceptEvent
  | PreInterceptEvent
  | RequestUpdateEvent
  | RequestCompleteEvent;

// Mock request payload from UI
export interface MockRequest {
  requestId: string;
  type: 'text' | 'error' | 'tool_result';
  content: string;
}

// Allow request payload from UI
export interface AllowRequest {
  requestId: string;
}

// Pre-intercept action types
export type PreInterceptAction = 'allow' | 'edit' | 'use_cache' | 'mock';

// Pre-intercept result from session manager
export interface PreInterceptResult {
  action: PreInterceptAction;
  editedBody?: Record<string, unknown>;
  mockContent?: string;
}

// Interceptor settings
export interface InterceptorSettings {
  /** Pause mode: "off" | "tool-calls" | "all" (default: off) */
  pause: PauseMode;
}

// Recording mode for VCR
export type RecordMode = 'auto' | 'off' | 'replay-only';

// Pause mode for interceptor
export type PauseMode = 'off' | 'tool-calls' | 'all';

// PlayingPack configuration
export interface PlayingPackConfig {
  /** Upstream API URL (default: https://api.openai.com) */
  upstream: string;
  /** Directory for tape storage (default: .playingpack/tapes) */
  tapesDir: string;
  /** Directory for log files (default: .playingpack/logs) */
  logsDir: string;
  /** Recording mode (default: auto) */
  record: RecordMode;
  /** Run without UI (default: false) */
  headless: boolean;
  /** Port to listen on (default: 4747) */
  port: number;
  /** Host to bind to (default: 0.0.0.0) */
  host: string;
  /** Pause mode: "off" | "tool-calls" | "all" (default: off) */
  pause: PauseMode;
}

// Server configuration (legacy, kept for compatibility)
export interface ServerConfig {
  port: number;
  host: string;
  upstreamUrl: string;
  tapesDir: string;
}

// User config input (partial, with defaults applied later)
export type PlayingPackUserConfig = Partial<PlayingPackConfig>;

/**
 * Helper function for creating type-safe configuration.
 * Provides autocomplete and validation for config files.
 *
 * @example
 * ```ts
 * // playingpack.config.ts
 * import { defineConfig } from 'playingpack';
 *
 * export default defineConfig({
 *   upstream: process.env.LLM_API_URL ?? 'https://api.openai.com',
 *   record: process.env.CI ? 'replay-only' : 'auto',
 *   headless: !!process.env.CI,
 * });
 * ```
 */
export function defineConfig(config: PlayingPackUserConfig): PlayingPackUserConfig {
  return config;
}

// TRPC router input/output types
export interface GetSessionsOutput {
  sessions: RequestSession[];
}

export interface GetSettingsOutput {
  settings: InterceptorSettings;
}

export interface UpdateSettingsInput {
  settings: Partial<InterceptorSettings>;
}
