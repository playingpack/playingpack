import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { access } from 'fs/promises';
import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get the path to the UI public directory
 */
export function getUIRoot(): string {
  // In production, __dirname is /node_modules/playingpack/dist
  // The UI is in /node_modules/playingpack/public
  return join(__dirname, '../public');
}

/**
 * Check if the UI is available
 */
export async function isUIAvailable(): Promise<boolean> {
  try {
    await access(join(getUIRoot(), 'index.html'));
    return true;
  } catch {
    return false;
  }
}

/**
 * Register static file serving for the UI
 */
export async function registerStaticUI(server: FastifyInstance): Promise<boolean> {
  const uiRoot = getUIRoot();
  const available = await isUIAvailable();

  if (!available) {
    console.log('  UI not available (development mode)');
    console.log(`  Run the UI separately: cd packages/web && pnpm dev`);
    return false;
  }

  // Register static file plugin
  await server.register(fastifyStatic, {
    root: uiRoot,
    prefix: '/',
    wildcard: false, // Allow API routes to pass through
  });

  // SPA fallback: serve index.html for non-API routes
  server.setNotFoundHandler((request, reply) => {
    // Don't serve UI for API routes
    if (request.url.startsWith('/v1') || request.url.startsWith('/api') || request.url.startsWith('/ws')) {
      return reply.code(404).send({ error: 'Not Found' });
    }

    // Serve index.html for all other routes (SPA)
    return reply.sendFile('index.html');
  });

  console.log('  UI available at root path');
  return true;
}
