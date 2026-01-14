import type { WebSocket } from 'ws';
import type { WSEvent } from '@playingpack/shared';
import { getSessionManager } from '../interceptor/session-manager.js';

/**
 * Connected WebSocket clients
 */
const clients: Set<WebSocket> = new Set();

/**
 * Handle new WebSocket connection
 */
export function handleConnection(socket: WebSocket): void {
  clients.add(socket);

  // Send initial state
  const sessionManager = getSessionManager();
  const sessions = sessionManager.getAllSessions();

  for (const session of sessions) {
    sendToClient(socket, { type: 'request_update', session });
  }

  // Subscribe to session events
  const unsubscribe = sessionManager.subscribe((event) => {
    sendToClient(socket, event);
  });

  // Handle client messages
  socket.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleClientMessage(socket, message);
    } catch {
      // Invalid message, ignore
    }
  });

  // Handle disconnect
  socket.on('close', () => {
    clients.delete(socket);
    unsubscribe();
  });

  socket.on('error', () => {
    clients.delete(socket);
    unsubscribe();
  });
}

/**
 * Handle message from client
 */
function handleClientMessage(socket: WebSocket, message: unknown): void {
  if (typeof message !== 'object' || message === null) {
    return;
  }

  const msg = message as Record<string, unknown>;
  const sessionManager = getSessionManager();

  switch (msg.type) {
    // Post-intercept actions (after LLM response)
    case 'allow':
      if (typeof msg.requestId === 'string') {
        sessionManager.allowRequest(msg.requestId);
      }
      break;

    case 'mock':
      if (typeof msg.requestId === 'string' && typeof msg.content === 'string') {
        sessionManager.mockRequest(msg.requestId, msg.content);
      }
      break;

    // Pre-intercept actions (before LLM call)
    case 'pre_allow':
      if (typeof msg.requestId === 'string') {
        sessionManager.preInterceptAllow(msg.requestId);
      }
      break;

    case 'pre_edit':
      if (typeof msg.requestId === 'string' && typeof msg.editedBody === 'object') {
        sessionManager.preInterceptEdit(msg.requestId, msg.editedBody as Record<string, unknown>);
      }
      break;

    case 'pre_use_cache':
      if (typeof msg.requestId === 'string') {
        sessionManager.preInterceptUseCache(msg.requestId);
      }
      break;

    case 'pre_mock':
      if (typeof msg.requestId === 'string' && typeof msg.mockContent === 'string') {
        sessionManager.preInterceptMock(msg.requestId, msg.mockContent);
      }
      break;

    case 'ping':
      sendToClient(socket, { type: 'pong' } as unknown as WSEvent);
      break;
  }
}

/**
 * Send event to a specific client
 */
function sendToClient(socket: WebSocket, event: WSEvent): void {
  if (socket.readyState === socket.OPEN) {
    try {
      socket.send(JSON.stringify(event));
    } catch {
      // Client disconnected
      clients.delete(socket);
    }
  }
}

/**
 * Broadcast event to all connected clients
 */
export function broadcast(event: WSEvent): void {
  const message = JSON.stringify(event);

  for (const client of clients) {
    if (client.readyState === client.OPEN) {
      try {
        client.send(message);
      } catch {
        clients.delete(client);
      }
    }
  }
}

/**
 * Get number of connected clients
 */
export function getClientCount(): number {
  return clients.size;
}

/**
 * Disconnect all clients
 */
export function disconnectAll(): void {
  for (const client of clients) {
    try {
      client.close();
    } catch {
      // Ignore errors
    }
  }
  clients.clear();
}
