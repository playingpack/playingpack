import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  SessionManager,
  getSessionManager,
  resetSessionManager,
} from '../interceptor/session-manager.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    resetSessionManager();
    manager = new SessionManager();
  });

  describe('createSession', () => {
    it('should create a new session', () => {
      const session = manager.createSession('test-id', 'POST', '/v1/chat/completions', {
        model: 'gpt-4',
        messages: [],
      });

      expect(session.id).toBe('test-id');
      expect(session.method).toBe('POST');
      expect(session.path).toBe('/v1/chat/completions');
      expect(session.state).toBe('LOOKUP');
      expect(session.model).toBe('gpt-4');
      expect(session.toolCalls).toEqual([]);
      expect(session.responseContent).toBe('');
    });

    it('should emit request_update event', () => {
      const callback = vi.fn();
      manager.subscribe(callback);

      manager.createSession('test-id', 'POST', '/v1/chat/completions', {});

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'request_update' }));
    });
  });

  describe('getSession', () => {
    it('should return session by id', () => {
      manager.createSession('test-id', 'POST', '/path', {});
      const session = manager.getSession('test-id');
      expect(session?.id).toBe('test-id');
    });

    it('should return undefined for non-existent session', () => {
      const session = manager.getSession('non-existent');
      expect(session).toBeUndefined();
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions', () => {
      manager.createSession('id-1', 'POST', '/path', {});
      manager.createSession('id-2', 'POST', '/path', {});

      const sessions = manager.getAllSessions();
      expect(sessions).toHaveLength(2);
    });
  });

  describe('updateState', () => {
    it('should update session state', () => {
      manager.createSession('test-id', 'POST', '/path', {});
      manager.updateState('test-id', 'STREAMING');

      const session = manager.getSession('test-id');
      expect(session?.state).toBe('STREAMING');
    });
  });

  describe('addToolCall', () => {
    it('should add tool call to session', () => {
      manager.createSession('test-id', 'POST', '/path', {});
      manager.addToolCall('test-id', {
        index: 0,
        id: 'call_123',
        name: 'get_weather',
        arguments: '{}',
      });

      const session = manager.getSession('test-id');
      expect(session?.toolCalls).toHaveLength(1);
      expect(session?.toolCalls[0]?.name).toBe('get_weather');
    });
  });

  describe('complete', () => {
    it('should mark session as complete', () => {
      const callback = vi.fn();
      manager.subscribe(callback);

      manager.createSession('test-id', 'POST', '/path', {});
      manager.complete('test-id', 200, false);

      const session = manager.getSession('test-id');
      expect(session?.state).toBe('COMPLETE');
      expect(session?.statusCode).toBe(200);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'request_complete',
          requestId: 'test-id',
          statusCode: 200,
          cached: false,
        })
      );
    });
  });

  describe('error', () => {
    it('should mark session as errored', () => {
      manager.createSession('test-id', 'POST', '/path', {});
      manager.error('test-id', 'Connection failed');

      const session = manager.getSession('test-id');
      expect(session?.state).toBe('ERROR');
      expect(session?.error).toBe('Connection failed');
    });
  });

  describe('shouldIntercept', () => {
    it('should return false when pause is disabled', () => {
      manager.createSession('test-id', 'POST', '/path', {});
      expect(manager.shouldIntercept('test-id')).toBe(false);
    });

    it('should return true when pause is tool-calls and tool call detected', () => {
      manager.updateSettings({ pause: 'tool-calls' });
      manager.createSession('test-id', 'POST', '/path', {});
      manager.addToolCall('test-id', {
        index: 0,
        id: 'call_123',
        name: 'func',
        arguments: '{}',
      });

      expect(manager.shouldIntercept('test-id')).toBe(true);
    });

    it('should return false when pause is tool-calls and no tool calls', () => {
      manager.updateSettings({ pause: 'tool-calls' });
      manager.createSession('test-id', 'POST', '/path', {});

      expect(manager.shouldIntercept('test-id')).toBe(false);
    });

    it('should return true for all requests when pause is all', () => {
      manager.updateSettings({ pause: 'all' });
      manager.createSession('test-id', 'POST', '/path', {});

      expect(manager.shouldIntercept('test-id')).toBe(true);
    });
  });

  describe('intercept and allowRequest', () => {
    it('should pause and resume with allow', async () => {
      manager.updateSettings({ pause: 'all' });
      manager.createSession('test-id', 'POST', '/path', {});

      const interceptPromise = manager.intercept('test-id');

      // Simulate user clicking allow
      setTimeout(() => {
        manager.allowRequest('test-id');
      }, 10);

      const result = await interceptPromise;
      expect(result.action).toBe('allow');
    });
  });

  describe('intercept and mockRequest', () => {
    it('should pause and resume with mock', async () => {
      manager.updateSettings({ pause: 'all' });
      manager.createSession('test-id', 'POST', '/path', {});

      const interceptPromise = manager.intercept('test-id');

      // Simulate user clicking mock
      setTimeout(() => {
        manager.mockRequest('test-id', 'Mocked content');
      }, 10);

      const result = await interceptPromise;
      expect(result.action).toBe('mock');
      expect(result.mockContent).toBe('Mocked content');
    });
  });

  describe('settings', () => {
    it('should get and update settings', () => {
      expect(manager.getSettings()).toEqual({
        pause: 'off',
      });

      manager.updateSettings({ pause: 'tool-calls' });

      expect(manager.getSettings()).toEqual({
        pause: 'tool-calls',
      });
    });
  });

  describe('subscribe', () => {
    it('should allow subscribing and unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe(callback);

      manager.createSession('test-id', 'POST', '/path', {});
      expect(callback).toHaveBeenCalled();

      callback.mockClear();
      unsubscribe();

      manager.createSession('test-id-2', 'POST', '/path', {});
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove old completed sessions', () => {
      // Create 110 sessions
      for (let i = 0; i < 110; i++) {
        manager.createSession(`id-${i}`, 'POST', '/path', {});
        manager.complete(`id-${i}`, 200, false);
      }

      manager.cleanup();

      // Should keep latest 100
      expect(manager.getAllSessions().length).toBeLessThanOrEqual(100);
    });
  });
});

describe('getSessionManager', () => {
  beforeEach(() => {
    resetSessionManager();
  });

  it('should return singleton instance', () => {
    const manager1 = getSessionManager();
    const manager2 = getSessionManager();
    expect(manager1).toBe(manager2);
  });
});
