import { readFile } from 'fs/promises';
import { join } from 'path';
import { playingPackConfigSchema } from '@playingpack/shared';
import type { PlayingPackConfig, RecordMode } from '@playingpack/shared';

const CONFIG_FILES = [
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
  port: 3000,
  host: '0.0.0.0',
  pauseEnabled: false,
  pauseOnToolCalls: true,
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
 * Load configuration from file
 */
async function loadConfigFile(cwd: string): Promise<Partial<PlayingPackConfig>> {
  for (const filename of CONFIG_FILES) {
    const filepath = join(cwd, filename);
    try {
      const content = await readFile(filepath, 'utf-8');
      const parsed = JSON.parse(stripJsonComments(content));
      const validated = playingPackConfigSchema.parse(parsed);
      console.log(`  Config loaded from ${filename}`);
      return validated;
    } catch (error) {
      // File doesn't exist or is invalid, try next
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        // Only warn if file exists but is invalid
        const isParseError = error instanceof SyntaxError ||
          (error as Error).name === 'ZodError';
        if (isParseError) {
          console.warn(`  Warning: Invalid config in ${filename}:`, (error as Error).message);
        }
      }
    }
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
