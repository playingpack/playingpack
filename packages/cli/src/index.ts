#!/usr/bin/env node

import { program } from 'commander';
import open from 'open';
import type { CacheMode } from '@playingpack/shared';
import { startServer } from './server.js';
import { loadConfig } from './config.js';

const VERSION = '1.0.0';

program
  .name('playingpack')
  .description('Chrome DevTools for AI Agents - Debug and test your AI agent LLM calls')
  .version(VERSION);

program
  .command('start')
  .description('Start the PlayingPack proxy server')
  .option('-p, --port <port>', 'Port to listen on')
  .option('-h, --host <host>', 'Host to bind to')
  .option('--no-ui', 'Run without UI (headless mode for CI/CD)')
  .option('--upstream <url>', 'Upstream API URL (default: https://api.openai.com)')
  .option('--cache-path <path>', 'Directory for cached responses (default: .playingpack/cache)')
  .option('--cache <mode>', 'Cache mode: off, read, read-write (default: read-write)')
  .option('--no-intervene', 'Disable intervention mode (no pausing for human actions)')
  .action(async (options) => {
    console.log();
    console.log('  ╔═══════════════════════════════════════════════════════════╗');
    console.log('  ║                                                           ║');
    console.log('  ║   PlayingPack - Debug your AI Agents                      ║');
    console.log('  ║                                                           ║');
    console.log('  ╚═══════════════════════════════════════════════════════════╝');
    console.log();

    try {
      // Load config from file, then apply CLI overrides
      const config = await loadConfig({
        port: options.port ? parseInt(options.port, 10) : undefined,
        host: options.host,
        ui: options.ui,
        upstream: options.upstream,
        cachePath: options.cachePath,
        cache: options.cache as CacheMode | undefined,
        intervene: options.intervene,
      });

      const { port, host } = await startServer(config);

      const localUrl = `http://localhost:${port}`;
      const networkUrl = host === '0.0.0.0' ? `http://<your-ip>:${port}` : `http://${host}:${port}`;

      console.log();
      console.log('  ┌─────────────────────────────────────────────────────────┐');
      console.log('  │  Server running!                                        │');
      console.log('  │                                                         │');
      console.log(`  │  Local:    ${localUrl.padEnd(44)}│`);
      console.log(`  │  Network:  ${networkUrl.padEnd(44)}│`);
      console.log('  │                                                         │');
      console.log('  │  Settings:                                              │');
      console.log(`  │    Cache:     ${config.cache.padEnd(41)}│`);
      console.log(`  │    Intervene: ${String(config.intervene).padEnd(41)}│`);
      console.log('  │                                                         │');
      console.log('  │  To use with your AI agent, set:                        │');
      console.log(`  │  baseURL = "${localUrl}/v1"`.padEnd(60) + '│');
      console.log('  └─────────────────────────────────────────────────────────┘');
      console.log();

      // Open browser if not headless
      if (!config.headless) {
        console.log('  Opening dashboard in browser...');
        await open(localUrl);
      } else {
        console.log('  Running in headless mode (no UI)');
      }

      console.log();
      console.log('  Waiting for requests...');
      console.log();

      // Handle graceful shutdown
      const shutdown = async () => {
        console.log('\n  Shutting down...');
        process.exit(0);
      };

      process.on('SIGINT', shutdown);
      process.on('SIGTERM', shutdown);
    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Show version')
  .action(() => {
    console.log(`playingpack v${VERSION}`);
  });

// Default command
if (process.argv.length === 2) {
  program.parse(['node', 'playingpack', 'start']);
} else {
  program.parse();
}
