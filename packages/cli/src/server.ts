import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import getPort from 'get-port';
import type { PlayingPackConfig } from '@playingpack/shared';
import { appRouter, createContext } from './trpc/index.js';
import { registerProxyRoutes } from './proxy/routes.js';
import { registerStaticUI } from './static.js';
import { handleConnection } from './websocket/handler.js';
import { initLogger, logger } from './logger.js';
import { initSessionManager } from './session/manager.js';

/**
 * Create and start the PlayingPack server
 */
export async function startServer(config: PlayingPackConfig): Promise<{
  server: ReturnType<typeof Fastify>;
  port: number;
  host: string;
}> {
  const preferredPort = config.port;
  const host = config.host;

  // Initialize session manager with config settings
  initSessionManager({
    cache: config.cache,
    intervene: config.intervene,
  });

  // Initialize file logger
  await initLogger(config.logPath);
  await logger.info('Server starting', {
    upstream: config.upstream,
    cachePath: config.cachePath,
    cache: config.cache,
    intervene: config.intervene,
    headless: config.headless,
  });

  // Get available port
  const port = await getPort({ port: preferredPort });

  if (port !== preferredPort) {
    console.log(`  Port ${preferredPort} in use, using ${port}`);
  }

  // Create Fastify server
  const server = Fastify({
    logger: false,
    bodyLimit: 50 * 1024 * 1024, // 50MB limit for large context windows
  });

  // Register CORS
  await server.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register WebSocket
  await server.register(websocket);

  // WebSocket route
  server.get('/ws', { websocket: true }, (socket) => {
    handleConnection(socket);
  });

  // Register TRPC
  await server.register(fastifyTRPCPlugin, {
    prefix: '/api/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
    },
  });

  // Register proxy routes with config
  registerProxyRoutes(server, {
    upstream: config.upstream,
    cachePath: config.cachePath,
    cache: config.cache,
  });

  // Register static UI (unless headless mode)
  if (!config.headless) {
    await registerStaticUI(server);
  }

  // Start server
  await server.listen({ port, host });
  await logger.info('Server listening', { port, host });

  return { server, port, host };
}

/**
 * Graceful shutdown
 */
export async function stopServer(server: ReturnType<typeof Fastify>): Promise<void> {
  await server.close();
}
