#!/usr/bin/env node

import { program } from 'commander';
import type { RecordMode } from '@playingpack/shared';
import { startServer } from './server.js';
import { loadConfig } from './config.js';

const VERSION = '1.0.0';

program
  .name('playingpack')
  .description('Chrome DevTools for AI Agents - Local reverse proxy and debugger')
  .version(VERSION);

program
  .command('start')
  .description('Start the PlayingPack proxy server')
  .option('-p, --port <port>', 'Port to listen on')
  .option('-h, --host <host>', 'Host to bind to')
  .option('--no-ui', 'Run without UI server (headless mode for CI/CD)')
  .option('--upstream <url>', 'Upstream API URL (default: https://api.openai.com)')
  .option('--tapes-dir <path>', 'Directory for tape storage (default: .playingpack/tapes)')
  .option('--record <mode>', 'Recording mode: auto, off, replay-only (default: auto)')
  .action(async (options) => {
    console.log();
    console.log('  ╔═══════════════════════════════════════════════════════════╗');
    console.log('  ║                                                           ║');
    console.log('  ║   ▓▓▓▓  PlayingPack - The Flight Simulator  ▓▓▓▓          ║');
    console.log('  ║   Chrome DevTools for AI Agents                           ║');
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
        tapesDir: options.tapesDir,
        record: options.record as RecordMode | undefined,
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
      console.log('  │  To use with your AI agent, set:                        │');
      console.log(`  │  baseURL = "${localUrl}/v1"`.padEnd(60) + '│');
      if (!config.headless) {
        console.log('  │                                                         │');
        console.log('  │  Dashboard: Open the local URL in your browser          │');
      }
      console.log('  └─────────────────────────────────────────────────────────┘');
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
