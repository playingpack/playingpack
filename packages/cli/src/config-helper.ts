/**
 * Configuration helper for PlayingPack
 * Users can import { defineConfig } from 'playingpack'
 */

/** Recording mode for VCR */
export type RecordMode = 'auto' | 'off' | 'replay-only';

/** Pause mode for interceptor */
export type PauseMode = 'off' | 'tool-calls' | 'all';

/** PlayingPack configuration options */
export interface PlayingPackUserConfig {
  /** Upstream API URL (default: https://api.openai.com) */
  upstream?: string;
  /** Directory for tape storage (default: .playingpack/tapes) */
  tapesDir?: string;
  /** Directory for log files (default: .playingpack/logs) */
  logsDir?: string;
  /** Recording mode (default: auto) */
  record?: RecordMode;
  /** Run without UI (default: false) */
  headless?: boolean;
  /** Port to listen on (default: 4747) */
  port?: number;
  /** Host to bind to (default: 0.0.0.0) */
  host?: string;
  /** Pause mode: "off" | "tool-calls" | "all" (default: off) */
  pause?: PauseMode;
}

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
