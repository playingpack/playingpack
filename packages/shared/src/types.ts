/**
 * Core types for PlayingPack
 */

// Request state machine states
export type RequestState =
  | 'LOOKUP'      // Checking for cached tape
  | 'CONNECT'     // Opening upstream connection
  | 'STREAMING'   // Piping chunks through
  | 'INTERCEPT'   // Paused, waiting for user action
  | 'FLUSH'       // Resuming with real data
  | 'INJECT'      // Sending mock data
  | 'REPLAY'      // Playing back cached tape
  | 'COMPLETE'    // Request finished
  | 'ERROR';      // Request errored

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

// WebSocket event: Intercept notification
export interface InterceptEvent {
  type: 'intercept';
  requestId: string;
  toolCall: {
    name: string;
    arguments: string;
  };
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

// Interceptor settings
export interface InterceptorSettings {
  /** Whether pause mode is enabled */
  pauseEnabled: boolean;
  /** Whether to pause on all requests or only tool calls */
  pauseOnToolCalls: boolean;
}

// Recording mode for VCR
export type RecordMode = 'auto' | 'off' | 'replay-only';

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
  /** Port to listen on (default: 3000) */
  port: number;
  /** Host to bind to (default: 0.0.0.0) */
  host: string;
  /** Whether pause mode is enabled (default: false) */
  pauseEnabled: boolean;
  /** Whether to pause on all requests or only tool calls (default: true) */
  pauseOnToolCalls: boolean;
}

// Server configuration (legacy, kept for compatibility)
export interface ServerConfig {
  port: number;
  host: string;
  upstreamUrl: string;
  tapesDir: string;
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
