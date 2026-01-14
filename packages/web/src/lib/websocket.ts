import type { WSEvent } from '@playingpack/shared';

type EventCallback = (event: WSEvent) => void;

/**
 * WebSocket connection manager
 */
class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private listeners: Set<EventCallback> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private reconnectTimer: number | null = null;

  constructor() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.url = `${protocol}//${window.location.host}/ws`;
  }

  /**
   * Connect to WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('[WS] Connected');
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WSEvent;
          this.notifyListeners(data);
        } catch (e) {
          console.error('[WS] Failed to parse message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('[WS] Disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[WS] Error:', error);
      };
    } catch (error) {
      console.error('[WS] Failed to connect:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Send message to server
   */
  send(message: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Allow a paused request
   */
  allowRequest(requestId: string): void {
    this.send({ type: 'allow', requestId });
  }

  /**
   * Mock a paused request
   */
  mockRequest(requestId: string, content: string): void {
    this.send({ type: 'mock', requestId, content });
  }

  // Pre-intercept actions (before LLM call)

  /**
   * Allow a pre-intercepted request to proceed to LLM
   */
  preInterceptAllow(requestId: string): void {
    this.send({ type: 'pre_allow', requestId });
  }

  /**
   * Edit and send a pre-intercepted request
   */
  preInterceptEdit(requestId: string, editedBody: Record<string, unknown>): void {
    this.send({ type: 'pre_edit', requestId, editedBody });
  }

  /**
   * Use cached response for a pre-intercepted request
   */
  preInterceptUseCache(requestId: string): void {
    this.send({ type: 'pre_use_cache', requestId });
  }

  /**
   * Mock response for a pre-intercepted request
   */
  preInterceptMock(requestId: string, mockContent: string): void {
    this.send({ type: 'pre_mock', requestId, mockContent });
  }

  /**
   * Subscribe to WebSocket events
   */
  subscribe(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  private notifyListeners(event: WSEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (e) {
        console.error('[WS] Listener error:', e);
      }
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('[WS] Max reconnect attempts reached');
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts);
    this.reconnectAttempts++;

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimer = window.setTimeout(() => {
      this.connect();
    }, delay);
  }
}

// Singleton instance
export const wsManager = new WebSocketManager();
