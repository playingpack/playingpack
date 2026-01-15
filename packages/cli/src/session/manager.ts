import type {
  RequestSession,
  RequestState,
  ResponseSource,
  ToolCall,
  Settings,
  WSEvent,
  Point1Action,
  Point2Action,
} from '@playingpack/shared';
import { hashRequest } from '../cache/hasher.js';

/**
 * Callback for session state changes
 */
export type SessionCallback = (event: WSEvent) => void;

/**
 * SessionManager - Manages active request sessions and their state
 *
 * Simplified model with 4 states:
 * - pending: waiting for human action at intervention point 1
 * - processing: getting response (from LLM or cache)
 * - reviewing: waiting for human action at intervention point 2
 * - complete: done
 */
export class SessionManager {
  private sessions: Map<string, RequestSession> = new Map();
  private settings: Settings;
  private listeners: Set<SessionCallback> = new Set();

  // Resolvers for intervention points
  private point1Resolvers: Map<string, { resolve: (action: Point1Action) => void }> = new Map();
  private point2Resolvers: Map<string, { resolve: (action: Point2Action) => void }> = new Map();

  constructor(initialSettings?: Partial<Settings>) {
    this.settings = {
      cache: 'read-write',
      intervene: true,
      ...initialSettings,
    };
  }

  /**
   * Create a new session for an incoming request
   */
  createSession(id: string, body: unknown): RequestSession {
    const requestBody = body as Record<string, unknown>;
    const model = typeof requestBody?.model === 'string' ? requestBody.model : 'unknown';
    const messages = Array.isArray(requestBody?.messages) ? requestBody.messages : [];
    const stream = requestBody?.stream !== false; // Default to true per OpenAI spec

    const session: RequestSession = {
      id,
      state: this.settings.intervene ? 'pending' : 'processing',
      timestamp: new Date().toISOString(),
      request: {
        model,
        messages,
        stream,
        tools: requestBody?.tools as unknown[] | undefined,
        temperature: requestBody?.temperature as number | undefined,
        maxTokens: requestBody?.max_tokens as number | undefined,
        raw: body,
      },
      cacheKey: hashRequest(body),
      cacheAvailable: false,
    };

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
   * Get all sessions
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
   * Set session to processing state and record start time
   */
  setProcessing(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.state = 'processing';
      if (!session.processingStartedAt) {
        session.processingStartedAt = new Date().toISOString();
      }
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Set session to reviewing state
   */
  setReviewing(id: string): void {
    this.updateState(id, 'reviewing');
  }

  /**
   * Set whether a cached response is available
   */
  setCacheAvailable(id: string, available: boolean): void {
    const session = this.sessions.get(id);
    if (session) {
      session.cacheAvailable = available;
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Set the response source (where the response came from)
   */
  setResponseSource(id: string, source: ResponseSource): void {
    const session = this.sessions.get(id);
    if (session) {
      session.responseSource = source;
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Set response data
   */
  setResponse(id: string, status: number, content: string, toolCalls: ToolCall[] = []): void {
    const session = this.sessions.get(id);
    if (session) {
      session.response = { status, content, toolCalls };
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Add tool call to response
   */
  addToolCall(id: string, toolCall: ToolCall): void {
    const session = this.sessions.get(id);
    if (session) {
      if (!session.response) {
        session.response = { status: 200, content: '', toolCalls: [] };
      }
      session.response.toolCalls.push(toolCall);
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Append to response content
   */
  appendContent(id: string, content: string): void {
    const session = this.sessions.get(id);
    if (session) {
      if (!session.response) {
        session.response = { status: 200, content: '', toolCalls: [] };
      }
      session.response.content += content;
      // Don't emit on every append to reduce noise
    }
  }

  /**
   * Set finish reason on response
   */
  setFinishReason(id: string, reason: string): void {
    const session = this.sessions.get(id);
    if (session) {
      if (!session.response) {
        session.response = { status: 200, content: '', toolCalls: [] };
      }
      session.response.finishReason = reason;
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Set token usage on response
   */
  setUsage(
    id: string,
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
  ): void {
    const session = this.sessions.get(id);
    if (session) {
      if (!session.response) {
        session.response = { status: 200, content: '', toolCalls: [] };
      }
      session.response.usage = {
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      };
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Complete a session
   */
  complete(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.state = 'complete';
      session.completedAt = new Date().toISOString();
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Mark session as errored
   */
  error(id: string, errorMsg: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.state = 'complete';
      session.error = errorMsg;
      session.completedAt = new Date().toISOString();
      this.emit({ type: 'request_update', session });
    }
  }

  /**
   * Check if intervention is enabled
   */
  shouldIntervene(): boolean {
    return this.settings.intervene;
  }

  /**
   * Wait for human action at intervention point 1 (request arrived)
   * Returns the action the human chose
   */
  async waitForPoint1(id: string): Promise<Point1Action> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    // Already in pending state from createSession
    return new Promise((resolve) => {
      this.point1Resolvers.set(id, { resolve });
    });
  }

  /**
   * Wait for human action at intervention point 2 (response received)
   * Returns the action the human chose
   */
  async waitForPoint2(id: string): Promise<Point2Action> {
    const session = this.sessions.get(id);
    if (!session) {
      throw new Error(`Session ${id} not found`);
    }

    this.updateState(id, 'reviewing');

    return new Promise((resolve) => {
      this.point2Resolvers.set(id, { resolve });
    });
  }

  /**
   * Resolve point 1 action (called from UI/tRPC)
   */
  resolvePoint1(id: string, action: Point1Action): boolean {
    const resolver = this.point1Resolvers.get(id);
    if (resolver) {
      this.point1Resolvers.delete(id);
      this.setProcessing(id); // Use setProcessing to record start time
      resolver.resolve(action);
      return true;
    }
    return false;
  }

  /**
   * Resolve point 2 action (called from UI/tRPC)
   */
  resolvePoint2(id: string, action: Point2Action): boolean {
    const resolver = this.point2Resolvers.get(id);
    if (resolver) {
      this.point2Resolvers.delete(id);
      resolver.resolve(action);
      return true;
    }
    return false;
  }

  /**
   * Get current settings
   */
  getSettings(): Settings {
    return { ...this.settings };
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<Settings>): void {
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
        .filter(([_, s]) => s.state === 'complete')
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
    this.point1Resolvers.delete(id);
    this.point2Resolvers.delete(id);
  }
}

// Singleton instance
let sessionManager: SessionManager | null = null;

/**
 * Initialize the session manager with settings from config
 * Should be called once at startup
 */
export function initSessionManager(settings?: Partial<Settings>): SessionManager {
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
