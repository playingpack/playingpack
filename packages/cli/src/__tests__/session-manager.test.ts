import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionManager, getSessionManager, resetSessionManager } from '../session/manager.js';

describe('SessionManager', () => {
  let manager: SessionManager;

  beforeEach(() => {
    resetSessionManager();
    manager = new SessionManager();
  });

  describe('createSession', () => {
    it('should create a new session with pending state (intervene on by default)', () => {
      const session = manager.createSession('test-id', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

      expect(session.id).toBe('test-id');
      expect(session.state).toBe('pending'); // Default: intervene is true
      expect(session.request.model).toBe('gpt-4');
      expect(session.request.stream).toBe(true);
      expect(session.cacheHit).toBe(false);
    });

    it('should create a new session with processing state when intervene is off', () => {
      manager.updateSettings({ intervene: false });
      const session = manager.createSession('test-id', {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        stream: true,
      });

      expect(session.id).toBe('test-id');
      expect(session.state).toBe('processing'); // Intervene is false
    });

    it('should emit request_update event', () => {
      const callback = vi.fn();
      manager.subscribe(callback);

      manager.createSession('test-id', { model: 'gpt-4' });

      expect(callback).toHaveBeenCalledWith(expect.objectContaining({ type: 'request_update' }));
    });
  });

  describe('getSession', () => {
    it('should return session by id', () => {
      manager.createSession('test-id', { model: 'gpt-4' });
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
      manager.createSession('id-1', { model: 'gpt-4' });
      manager.createSession('id-2', { model: 'gpt-4' });

      const sessions = manager.getAllSessions();
      expect(sessions).toHaveLength(2);
    });
  });

  describe('state transitions', () => {
    it('should transition to processing state', () => {
      manager.createSession('test-id', { model: 'gpt-4' });
      manager.setProcessing('test-id');

      const session = manager.getSession('test-id');
      expect(session?.state).toBe('processing');
    });

    it('should transition to reviewing state', () => {
      manager.createSession('test-id', { model: 'gpt-4' });
      manager.setReviewing('test-id');

      const session = manager.getSession('test-id');
      expect(session?.state).toBe('reviewing');
    });

    it('should transition to complete state', () => {
      manager.createSession('test-id', { model: 'gpt-4' });
      manager.complete('test-id');

      const session = manager.getSession('test-id');
      expect(session?.state).toBe('complete');
    });

    it('should mark session as errored (complete with error field)', () => {
      manager.createSession('test-id', { model: 'gpt-4' });
      manager.error('test-id', 'Something went wrong');

      const session = manager.getSession('test-id');
      expect(session?.state).toBe('complete');
      expect(session?.error).toBe('Something went wrong');
    });
  });

  describe('cache management', () => {
    it('should set cache hit status', () => {
      manager.createSession('test-id', { model: 'gpt-4' });
      manager.setCacheHit('test-id', true);

      const session = manager.getSession('test-id');
      expect(session?.cacheHit).toBe(true);
    });
  });

  describe('response content', () => {
    it('should append content to response', () => {
      manager.createSession('test-id', { model: 'gpt-4' });
      manager.appendContent('test-id', 'Hello');
      manager.appendContent('test-id', ' World');

      const session = manager.getSession('test-id');
      expect(session?.response?.content).toBe('Hello World');
    });

    it('should add tool calls', () => {
      manager.createSession('test-id', { model: 'gpt-4' });
      manager.addToolCall('test-id', {
        id: 'call_123',
        name: 'get_weather',
        arguments: '{"location": "SF"}',
      });

      const session = manager.getSession('test-id');
      expect(session?.response?.toolCalls).toHaveLength(1);
      expect(session?.response?.toolCalls?.[0]?.name).toBe('get_weather');
    });
  });

  describe('intervention settings', () => {
    it('should return false for shouldIntervene when intervene is false', () => {
      manager.updateSettings({ intervene: false });
      expect(manager.shouldIntervene()).toBe(false);
    });

    it('should return true for shouldIntervene when intervene is true', () => {
      manager.updateSettings({ intervene: true });
      expect(manager.shouldIntervene()).toBe(true);
    });
  });

  describe('Point 1 intervention', () => {
    it('should wait for and resolve Point 1 action', async () => {
      manager.createSession('test-id', { model: 'gpt-4' });

      const waitPromise = manager.waitForPoint1('test-id');

      // Simulate user action
      setTimeout(() => {
        manager.resolvePoint1('test-id', { action: 'llm' });
      }, 10);

      const result = await waitPromise;
      expect(result.action).toBe('llm');
    });

    it('should handle cache action', async () => {
      manager.createSession('test-id', { model: 'gpt-4' });

      const waitPromise = manager.waitForPoint1('test-id');

      setTimeout(() => {
        manager.resolvePoint1('test-id', { action: 'cache' });
      }, 10);

      const result = await waitPromise;
      expect(result.action).toBe('cache');
    });

    it('should handle mock action with content', async () => {
      manager.createSession('test-id', { model: 'gpt-4' });

      const waitPromise = manager.waitForPoint1('test-id');

      setTimeout(() => {
        manager.resolvePoint1('test-id', { action: 'mock', content: 'Mocked!' });
      }, 10);

      const result = await waitPromise;
      expect(result.action).toBe('mock');
      expect((result as { action: 'mock'; content: string }).content).toBe('Mocked!');
    });
  });

  describe('Point 2 intervention', () => {
    it('should wait for and resolve Point 2 action', async () => {
      manager.createSession('test-id', { model: 'gpt-4' });

      const waitPromise = manager.waitForPoint2('test-id');

      setTimeout(() => {
        manager.resolvePoint2('test-id', { action: 'return' });
      }, 10);

      const result = await waitPromise;
      expect(result.action).toBe('return');
    });

    it('should handle modify action', async () => {
      manager.createSession('test-id', { model: 'gpt-4' });

      const waitPromise = manager.waitForPoint2('test-id');

      setTimeout(() => {
        manager.resolvePoint2('test-id', { action: 'modify', content: 'Modified!' });
      }, 10);

      const result = await waitPromise;
      expect(result.action).toBe('modify');
      expect((result as { action: 'modify'; content: string }).content).toBe('Modified!');
    });
  });

  describe('settings', () => {
    it('should get and update settings', () => {
      const defaultSettings = manager.getSettings();
      expect(defaultSettings.cache).toBe('read-write');
      expect(defaultSettings.intervene).toBe(true);

      manager.updateSettings({ cache: 'read', intervene: false });

      const newSettings = manager.getSettings();
      expect(newSettings.cache).toBe('read');
      expect(newSettings.intervene).toBe(false);
    });
  });

  describe('subscribe', () => {
    it('should allow subscribing and unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = manager.subscribe(callback);

      manager.createSession('test-id', { model: 'gpt-4' });
      expect(callback).toHaveBeenCalled();

      callback.mockClear();
      unsubscribe();

      manager.createSession('test-id-2', { model: 'gpt-4' });
      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('cleanup', () => {
    it('should remove old completed sessions', () => {
      // Create 110 sessions
      for (let i = 0; i < 110; i++) {
        manager.createSession(`id-${i}`, { model: 'gpt-4' });
        manager.complete(`id-${i}`);
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
