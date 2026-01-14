import type { WebSocket } from 'ws';
import type { WSEvent, WSMessage } from '@playingpack/shared';
import { wsMessageSchema } from '@playingpack/shared';
import { getSessionManager } from '../session/manager.js';

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
  // Validate message
  const result = wsMessageSchema.safeParse(message);
  if (!result.success) {
    // Handle ping separately (not in schema)
    if (
      typeof message === 'object' &&
      message !== null &&
      (message as Record<string, unknown>).type === 'ping'
    ) {
      sendToClient(socket, { type: 'request_update', session: null } as unknown as WSEvent);
      return;
    }
    return;
  }

  const msg = result.data as WSMessage;
  const sessionManager = getSessionManager();

  switch (msg.type) {
    case 'point1_action':
      sessionManager.resolvePoint1(msg.requestId, msg.action);
      break;

    case 'point2_action':
      sessionManager.resolvePoint2(msg.requestId, msg.action);
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
