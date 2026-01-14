import { createHash } from 'crypto';

/**
 * Normalizes a request body for consistent hashing.
 * - Sorts object keys alphabetically
 * - Removes the 'stream' flag (we treat stream/non-stream as same request)
 * - Removes timestamps and request IDs
 */
export function normalizeBody(body: unknown): unknown {
  if (body === null || body === undefined) {
    return null;
  }

  if (Array.isArray(body)) {
    return body.map(normalizeBody);
  }

  if (typeof body === 'object') {
    const obj = body as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};

    // Get keys, filter out non-deterministic fields, sort
    const keys = Object.keys(obj)
      .filter((key) => !['stream', 'request_id', 'timestamp'].includes(key))
      .sort();

    for (const key of keys) {
      sorted[key] = normalizeBody(obj[key]);
    }

    return sorted;
  }

  return body;
}

/**
 * Computes a SHA-256 hash of the normalized request body.
 * Returns a hex string that can be used as a filename.
 */
export function hashRequest(body: unknown): string {
  const normalized = normalizeBody(body);
  const json = JSON.stringify(normalized);
  return createHash('sha256').update(json).digest('hex');
}

/**
 * Generates a short hash for display purposes (first 8 chars).
 */
export function shortHash(hash: string): string {
  return hash.substring(0, 8);
}
