import { describe, it, expect } from 'vitest';
import { normalizeBody, hashRequest, shortHash } from '../tape/hasher.js';

describe('normalizeBody', () => {
  it('should sort object keys alphabetically', () => {
    const input = { z: 1, a: 2, m: 3 };
    const result = normalizeBody(input);
    expect(Object.keys(result as object)).toEqual(['a', 'm', 'z']);
  });

  it('should remove stream flag', () => {
    const input = { model: 'gpt-4', stream: true, messages: [] };
    const result = normalizeBody(input) as Record<string, unknown>;
    expect(result.stream).toBeUndefined();
    expect(result.model).toBe('gpt-4');
  });

  it('should remove request_id and timestamp', () => {
    const input = {
      model: 'gpt-4',
      request_id: '123',
      timestamp: '2024-01-01',
      messages: [],
    };
    const result = normalizeBody(input) as Record<string, unknown>;
    expect(result.request_id).toBeUndefined();
    expect(result.timestamp).toBeUndefined();
    expect(result.model).toBe('gpt-4');
  });

  it('should handle nested objects', () => {
    const input = {
      outer: { z: 1, a: 2 },
      model: 'gpt-4',
    };
    const result = normalizeBody(input) as Record<string, unknown>;
    const outer = result.outer as Record<string, unknown>;
    expect(Object.keys(outer)).toEqual(['a', 'z']);
  });

  it('should handle arrays', () => {
    const input = {
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
    };
    const result = normalizeBody(input) as Record<string, unknown>;
    expect(Array.isArray(result.messages)).toBe(true);
    expect((result.messages as unknown[]).length).toBe(2);
  });

  it('should handle null and undefined', () => {
    expect(normalizeBody(null)).toBeNull();
    expect(normalizeBody(undefined)).toBeNull();
  });

  it('should handle primitive values', () => {
    expect(normalizeBody('string')).toBe('string');
    expect(normalizeBody(42)).toBe(42);
    expect(normalizeBody(true)).toBe(true);
  });
});

describe('hashRequest', () => {
  it('should return consistent hash for same input', () => {
    const input = { model: 'gpt-4', messages: [{ role: 'user', content: 'hello' }] };
    const hash1 = hashRequest(input);
    const hash2 = hashRequest(input);
    expect(hash1).toBe(hash2);
  });

  it('should return same hash regardless of key order', () => {
    const input1 = { model: 'gpt-4', messages: [] };
    const input2 = { messages: [], model: 'gpt-4' };
    expect(hashRequest(input1)).toBe(hashRequest(input2));
  });

  it('should return same hash with or without stream flag', () => {
    const input1 = { model: 'gpt-4', messages: [], stream: true };
    const input2 = { model: 'gpt-4', messages: [], stream: false };
    const input3 = { model: 'gpt-4', messages: [] };

    const hash1 = hashRequest(input1);
    const hash2 = hashRequest(input2);
    const hash3 = hashRequest(input3);

    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('should return different hash for different content', () => {
    const input1 = { model: 'gpt-4', messages: [{ role: 'user', content: 'hello' }] };
    const input2 = { model: 'gpt-4', messages: [{ role: 'user', content: 'goodbye' }] };
    expect(hashRequest(input1)).not.toBe(hashRequest(input2));
  });

  it('should return 64-character hex string', () => {
    const hash = hashRequest({ test: true });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('shortHash', () => {
  it('should return first 8 characters', () => {
    const hash = 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
    expect(shortHash(hash)).toBe('abcdef12');
  });
});
