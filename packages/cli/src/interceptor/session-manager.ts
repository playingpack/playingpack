import type {
  RequestSession,
  RequestState,
  ToolCall,
  InterceptorSettings,
  WSEvent,
} from '@playingpack/shared';

/**
 * Callback for session state changes
 */
export type SessionCallback = (event: WSEvent) => void;

/**
 * SessionManager - Manages active request sessions and their state
 */
export class SessionManager {
  private sessions: Map<string, RequestSession> = new Map();
  private settings: InterceptorSettings;
  private listeners: Set<SessionCallback> = new Set();
  private pendingResolvers: Map<string, {
    resolve: (action: 'allow' | 'mock') => void;
    mockContent?: string;
  }> = new Map();

  constructor(initialSettings?: Partial<InterceptorSettings>) {
    this.settings = {
      pauseEnabled: false,
      pauseOnToolCalls: true,
      ...initialSettings,
    };
  }

  /**
   * Create a new session for an incoming request
   */
  createSession(
    id: string,
    method: string,
    path: string,
    body: unknown
  ): RequestSession {
    const session: RequestSession = {
      id,
      state: 'LOOKUP',
      timestamp: new Date().toISOString(),
      method,
      path,
      body,
      toolCalls: [],
      responseContent: '',
    };

    // Extract model from body
    if (typeof body === 'object' && body !== null) {
      const b = body as Record<string, unknown>;
      if (typeof b.model === 'string') {
        session.model = b.model;
      }
    }

    this.sessions.set(id, session);
    this.emit({ type: 'request_update', session });

    return session;
  }

  /**
   * Get a session by ID
   */
  getSession(id: string): RequestSession | undefined {
    return this.sessions.get(id);
  }

  /**
   * Get all active sessions
   */
  getAllSessions(): RequestSession[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Update session state
   */
  updateState(id: string, state: RequestState): void {
    const session = this.sessions.get(id);
    if (session) {
      session.state = state;
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Add tool call to session
   */
  addToolCall(id: string, toolCall: ToolCall): void {
    const session = this.sessions.get(id);
    if (session) {
      session.toolCalls.push(toolCall);
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Update response content
   */
  updateContent(id: string, content: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.responseContent += content;
      // Don't emit on every content update to reduce noise
    }
  }

  /**
   * Set raw response content (overwrites existing)
   */
  setRawResponse(id: string, rawResponse: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.responseContent = rawResponse;
    }
  }

  /**
   * Complete a session
   */
  complete(id: string, statusCode: number, cached: boolean): void {
    const session = this.sessions.get(id);
    if (session) {
      session.state = 'COMPLETE';
      session.statusCode = statusCode;
      this.emit({ type: 'request_update', session });
      this.emit({ type: 'request_complete', requestId: id, statusCode, cached });
    }
  }

  /**
   * Mark session as errored
   */
  error(id: string, error: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.state = 'ERROR';
      session.error = error;
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Check if we should intercept this session
   */
  shouldIntercept(id: string): boolean {
    if (!this.settings.pauseEnabled) {
      return false;
    }

    const session = this.sessions.get(id);
    if (!session) {
      return false;
    }

    // If pauseOnToolCalls is true, only pause when tool calls are detected
    if (this.settings.pauseOnToolCalls) {
      return session.toolCalls.length > 0;
    }

    // Otherwise, pause all requests
    return true;
  }

  /**
   * Enter intercept state and wait for user action
   */
  async intercept(id: string): Promise<{ action: 'allow' | 'mock'; mockContent?: string }> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    this.updateState(id, 'INTERCEPT');

    // Emit intercept event
    if (session.toolCalls.length > 0) {
      const toolCall = session.toolCalls[0];
      this.emit({
        type: 'intercept',
        requestId: id,
        toolCall: {
          name: toolCall?.name || 'unknown',
          arguments: toolCall?.arguments || '{}',
        },
        status: 'paused',
      });
    }

    // Wait for user action
    return new Promise((resolve) => {
      this.pendingResolvers.set(id, { resolve: (action) => {
        const resolver = this.pendingResolvers.get(id);
        this.pendingResolvers.delete(id);
        resolve({ action, mockContent: resolver?.mockContent });
      }});
    });
  }

  /**
   * Allow a paused request to continue
   */
  allowRequest(id: string): boolean {
    const resolver = this.pendingResolvers.get(id);
    if (resolver) {
      this.updateState(id, 'FLUSH');
      resolver.resolve('allow');
      return true;
    }
    return false;
  }

  /**
   * Mock a paused request
   */
  mockRequest(id: string, content: string): boolean {
    const resolver = this.pendingResolvers.get(id);
    if (resolver) {
      resolver.mockContent = content;
      this.updateState(id, 'INJECT');
      resolver.resolve('mock');
      return true;
    }
    return false;
  }

  /**
   * Get interceptor settings
   */
  getSettings(): InterceptorSettings {
    return { ...this.settings };
  }

  /**
   * Update interceptor settings
   */
  updateSettings(settings: Partial<InterceptorSettings>): void {
    this.settings = { ...this.settings, ...settings };
  }

  /**
   * Subscribe to session events
   */
  subscribe(callback: SessionCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: WSEvent): void {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }

  /**
   * Clean up old sessions (keep last 100)
   */
  cleanup(): void {
    const sessions = Array.from(this.sessions.entries());
    if (sessions.length > 100) {
      const toRemove = sessions
        .filter(([_, s]) => s.state === 'COMPLETE' || s.state === 'ERROR')
        .slice(0, sessions.length - 100);

      for (const [id] of toRemove) {
        this.sessions.delete(id);
      }
    }
  }

  /**
   * Remove a session
   */
  removeSession(id: string): void {
    this.sessions.delete(id);
    this.pendingResolvers.delete(id);
  }
}

// Singleton instance
let sessionManager: SessionManager | null = null;

/**
 * Initialize the session manager with settings from config
 * Should be called once at startup before any getSessionManager() calls
 */
export function initSessionManager(settings?: Partial<InterceptorSettings>): SessionManager {
  sessionManager = new SessionManager(settings);
  return sessionManager;
}

/**
 * Get the session manager instance
 */
export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new SessionManager();
  }
  return sessionManager;
}

/**
 * Reset session manager (for testing)
 */
export function resetSessionManager(): void {
  sessionManager = null;
}
