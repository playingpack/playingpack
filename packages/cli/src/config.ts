import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { createJiti } from 'jiti';
import { playingPackConfigSchema } from '@playingpack/shared';
import type { PlayingPackConfig, PlayingPackUserConfig, RecordMode } from '@playingpack/shared';

// JS/TS config files (preferred, in order of priority)
const JS_CONFIG_FILES = [
  'playingpack.config.ts',
  'playingpack.config.mts',
  'playingpack.config.js',
  'playingpack.config.mjs',
];

// Legacy JSON config files (still supported)
const JSON_CONFIG_FILES = [
  'playingpack.config.jsonc',
  'playingpack.config.json',
  '.playingpackrc.json',
  '.playingpackrc',
];

const DEFAULT_CONFIG: PlayingPackConfig = {
  upstream: 'https://api.openai.com',
  tapesDir: '.playingpack/tapes',
  logsDir: '.playingpack/logs',
  record: 'auto',
  headless: false,
  port: 4747,
  host: '0.0.0.0',
  pause: 'off',
};

/**
 * Strip JSON comments (JSONC support)
 */
function stripJsonComments(content: string): string {
  // Remove block comments /* */
  let result = content.replace(/\/\*[\s\S]*?\*\//g, '');
  // Remove line comments // (but not in strings)
  result = result.replace(/(?<!["'])\/\/.*$/gm, '');
  return result;
}

/**
 * Load JS/TS config file using jiti
 */
async function loadJsConfig(
  cwd: string
): Promise<{ config: Partial<PlayingPackConfig>; filename: string } | null> {
  for (const filename of JS_CONFIG_FILES) {
    const filepath = join(cwd, filename);
    if (!existsSync(filepath)) {
      continue;
    }

    try {
      // Create jiti instance for loading TS/ESM files
      const jiti = createJiti(import.meta.url, {
        interopDefault: true,
      });

      const loaded = (await jiti.import(filepath)) as
        | { default?: PlayingPackUserConfig }
        | PlayingPackUserConfig;

      // Handle both default export and direct export
      const configData =
        loaded && typeof loaded === 'object' && 'default' in loaded ? loaded.default : loaded;

      if (!configData || typeof configData !== 'object') {
        console.warn(`  Warning: ${filename} must export a config object`);
        continue;
      }

      const validated = playingPackConfigSchema.parse(configData);
      return { config: validated, filename };
    } catch (error) {
      console.warn(`  Warning: Error loading ${filename}:`, (error as Error).message);
    }
  }
  return null;
}

/**
 * Load JSON config file
 */
async function loadJsonConfig(
  cwd: string
): Promise<{ config: Partial<PlayingPackConfig>; filename: string } | null> {
  for (const filename of JSON_CONFIG_FILES) {
    const filepath = join(cwd, filename);
    try {
      const content = await readFile(filepath, 'utf-8');
      const parsed = JSON.parse(stripJsonComments(content));
      const validated = playingPackConfigSchema.parse(parsed);
      return { config: validated, filename };
    } catch (error) {
      // File doesn't exist or is invalid, try next
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Only warn if file exists but is invalid
        const isParseError = error instanceof SyntaxError || (error as Error).name === 'ZodError';
        if (isParseError) {
          console.warn(`  Warning: Invalid config in ${filename}:`, (error as Error).message);
        }
      }
    }
  }
  return null;
}

/**
 * Load configuration from file (JS/TS preferred, JSON as fallback)
 */
async function loadConfigFile(cwd: string): Promise<Partial<PlayingPackConfig>> {
  // Try JS/TS configs first (preferred)
  const jsResult = await loadJsConfig(cwd);
  if (jsResult) {
    console.log(`  Config loaded from ${jsResult.filename}`);
    return jsResult.config;
  }

  // Fall back to JSON configs
  const jsonResult = await loadJsonConfig(cwd);
  if (jsonResult) {
    console.log(`  Config loaded from ${jsonResult.filename}`);
    return jsonResult.config;
  }

  return {};
}

export interface CLIOptions {
  port?: number;
  host?: string;
  ui?: boolean; // Commander uses --no-ui which sets ui: false
  upstream?: string;
  tapesDir?: string;
  record?: RecordMode;
}

/**
 * Load configuration with CLI overrides
 * Priority: CLI flags > config file > defaults
 */
export async function loadConfig(cliOptions: CLIOptions = {}): Promise<PlayingPackConfig> {
  const cwd = process.cwd();
  const fileConfig = await loadConfigFile(cwd);

  // Merge: defaults < file < cli
  const config: PlayingPackConfig = {
    ...DEFAULT_CONFIG,
    ...fileConfig,
  };

  // Apply CLI overrides
  if (cliOptions.port !== undefined) {
    config.port = cliOptions.port;
  }
  if (cliOptions.host !== undefined) {
    config.host = cliOptions.host;
  }
  if (cliOptions.ui !== undefined) {
    config.headless = !cliOptions.ui;
  }
  if (cliOptions.upstream !== undefined) {
    config.upstream = cliOptions.upstream;
  }
  if (cliOptions.tapesDir !== undefined) {
    config.tapesDir = cliOptions.tapesDir;
  }
  if (cliOptions.record !== undefined) {
    config.record = cliOptions.record;
  }

  return config;
}

export { DEFAULT_CONFIG };
export type { PlayingPackConfig };
