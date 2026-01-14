/**
 * Core types for PlayingPack
 *
 * Simple model:
 * - Cache: system remembers responses
 * - Intervene: human can inspect/modify at two points in the request/response flow
 */

// =============================================================================
// Configuration
// =============================================================================

/** Cache mode - how the system handles cached responses */
export type CacheMode = 'off' | 'read' | 'read-write';

/** PlayingPack configuration */
export interface PlayingPackConfig {
  // Core settings
  /** Cache mode: 'off' | 'read' | 'read-write' (default: 'read-write') */
  cache: CacheMode;
  /** Whether to pause for human intervention (default: false) */
  intervene: boolean;

  // Infrastructure settings
  /** Upstream API URL (default: 'https://api.openai.com') */
  upstream: string;
  /** Port to listen on (default: 4747) */
  port: number;
  /** Host to bind to (default: '0.0.0.0') */
  host: string;
  /** Directory for cached responses (default: '.playingpack/cache') */
  cachePath: string;
  /** Directory for log files (default: '.playingpack/logs') */
  logPath: string;
  /** Run without opening browser (default: false) */
  headless: boolean;
}

/** User config input (partial, with defaults applied later) */
export type PlayingPackUserConfig = Partial<PlayingPackConfig>;

/**
 * Helper function for creating type-safe configuration.
 *
 * @example
 * ```ts
 * // playingpack.config.ts
 * import { defineConfig } from 'playingpack';
 *
 * export default defineConfig({
 *   cache: process.env.CI ? 'read' : 'read-write',
 *   headless: !!process.env.CI,
 * });
 * ```
 */
export function defineConfig(config: PlayingPackUserConfig): PlayingPackUserConfig {
  return config;
}

/** Runtime settings (can be changed via UI) */
export interface Settings {
  cache: CacheMode;
  intervene: boolean;
}

// =============================================================================
// Request Session
// =============================================================================

/**
 * Request lifecycle state (simplified to 4 states)
 *
 * Flow:
 * - pending: waiting for human action at intervention point 1
 * - processing: getting response (from LLM or cache)
 * - reviewing: waiting for human action at intervention point 2
 * - complete: done
 */
export type RequestState = 'pending' | 'processing' | 'reviewing' | 'complete';

/** Tool call detected in response */
export interface ToolCall {
  /** Tool call ID from OpenAI */
  id: string;
  /** Function name */
  name: string;
  /** Arguments JSON string */
  arguments: string;
}

/** Active request session */
export interface RequestSession {
  /** Unique request ID */
  id: string;
  /** Current state */
  state: RequestState;
  /** Request timestamp */
  timestamp: string;
  /** Completion timestamp */
  completedAt?: string;

  /** Request info */
  request: {
    model: string;
    messages: unknown[];
    stream: boolean;
  };

  /** Cache info */
  cacheKey: string;
  cacheHit: boolean;

  /** Response info (populated after response received) */
  response?: {
    status: number;
    content: string;
    toolCalls: ToolCall[];
  };

  /** Error message if any */
  error?: string;
}

// =============================================================================
// Cached Response
// =============================================================================

/** A chunk of SSE data with timing */
export interface CacheChunk {
  /** The raw SSE data string */
  data: string;
  /** Delay in ms since previous chunk */
  delay: number;
}

/** A cached response */
export interface CachedResponse {
  /** SHA-256 hash of normalized request (used as filename) */
  hash: string;
  /** ISO timestamp when cached */
  timestamp: string;

  /** The request that was made */
  request: {
    model: string;
    messages: unknown[];
  };

  /** The response that was received */
  response: {
    status: number;
    /** For non-streaming responses */
    body?: unknown;
    /** For streaming responses - chunks with timing */
    chunks?: CacheChunk[];
  };
}

// =============================================================================
// Human Actions (Intervention Points)
// =============================================================================

/**
 * Point 1 Action - what to do when request arrives
 *
 * - llm: call the upstream LLM
 * - cache: use cached response (if available)
 * - mock: use provided mock response
 */
export type Point1Action =
  | { action: 'llm' }
  | { action: 'cache' }
  | { action: 'mock'; content: string };

/**
 * Point 2 Action - what to do with the response
 *
 * - return: send response to agent as-is
 * - modify: modify the response before sending
 */
export type Point2Action = { action: 'return' } | { action: 'modify'; content: string };

// =============================================================================
// WebSocket Events
// =============================================================================

/** WebSocket event: request state changed */
export interface RequestUpdateEvent {
  type: 'request_update';
  session: RequestSession;
}

/** Union of all WebSocket events (server -> client) */
export type WSEvent = RequestUpdateEvent;

/** WebSocket message: point 1 action (client -> server) */
export interface Point1ActionMessage {
  type: 'point1_action';
  requestId: string;
  action: Point1Action;
}

/** WebSocket message: point 2 action (client -> server) */
export interface Point2ActionMessage {
  type: 'point2_action';
  requestId: string;
  action: Point2Action;
}

/** Union of all WebSocket messages (client -> server) */
export type WSMessage = Point1ActionMessage | Point2ActionMessage;

// =============================================================================
// tRPC Types
// =============================================================================

export interface GetSessionsOutput {
  sessions: RequestSession[];
}

export interface GetSettingsOutput {
  settings: Settings;
}

export interface UpdateSettingsInput {
  settings: Partial<Settings>;
}
