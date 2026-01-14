import { mkdir, writeFile, readFile, access } from 'fs/promises';
import { dirname, join } from 'path';
import type { CachedResponse, CacheChunk } from '@playingpack/shared';
import { hashRequest } from './hasher.js';

const DEFAULT_CACHE_PATH = '.playingpack/cache';

/**
 * Check if a cached response exists for the given request body
 */
export async function cacheExists(
  requestBody: unknown,
  cachePath: string = DEFAULT_CACHE_PATH
): Promise<boolean> {
  const hash = hashRequest(requestBody);
  const filePath = join(cachePath, `${hash}.json`);

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a cached response from disk
 */
export async function loadCache(
  requestBody: unknown,
  cachePath: string = DEFAULT_CACHE_PATH
): Promise<CachedResponse | null> {
  const hash = hashRequest(requestBody);
  const filePath = join(cachePath, `${hash}.json`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as CachedResponse;
  } catch {
    return null;
  }
}

/**
 * Load a cached response by hash directly
 */
export async function loadCacheByHash(
  hash: string,
  cachePath: string = DEFAULT_CACHE_PATH
): Promise<CachedResponse | null> {
  const filePath = join(cachePath, `${hash}.json`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as CachedResponse;
  } catch {
    return null;
  }
}

/**
 * CacheRecorder - Records SSE responses to disk
 */
export class CacheRecorder {
  private cachePath: string;
  private chunks: CacheChunk[] = [];
  private lastChunkTime: number = 0;
  private requestBody: unknown;
  private model: string = 'unknown';
  private hash: string = '';

  constructor(cachePath: string = DEFAULT_CACHE_PATH) {
    this.cachePath = cachePath;
  }

  /**
   * Initialize recording for a new request
   */
  start(requestBody: unknown): void {
    this.requestBody = requestBody;
    this.chunks = [];
    this.lastChunkTime = Date.now();
    this.hash = hashRequest(requestBody);

    // Extract model from request
    if (typeof requestBody === 'object' && requestBody !== null) {
      const body = requestBody as Record<string, unknown>;
      if (typeof body.model === 'string') {
        this.model = body.model;
      }
    }
  }

  /**
   * Record a chunk with timing information
   */
  recordChunk(data: string): void {
    const now = Date.now();
    const delay = this.chunks.length === 0 ? 0 : now - this.lastChunkTime;

    this.chunks.push({
      data,
      delay,
    });

    this.lastChunkTime = now;
  }

  /**
   * Finalize and save to disk
   */
  async save(statusCode: number = 200): Promise<string> {
    const cached: CachedResponse = {
      hash: this.hash,
      timestamp: new Date().toISOString(),
      request: {
        model: this.model,
        messages: ((this.requestBody as Record<string, unknown>)?.messages as unknown[]) ?? [],
      },
      response: {
        status: statusCode,
        chunks: this.chunks,
      },
    };

    const filePath = this.getCachePath();

    // Ensure directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Write to disk
    await writeFile(filePath, JSON.stringify(cached, null, 2), 'utf-8');

    return filePath;
  }

  /**
   * Get the file path for this cache entry
   */
  getCachePath(): string {
    return join(this.cachePath, `${this.hash}.json`);
  }

  /**
   * Get the hash of the current request
   */
  getHash(): string {
    return this.hash;
  }

  /**
   * Get number of recorded chunks
   */
  getChunkCount(): number {
    return this.chunks.length;
  }
}

/**
 * CachePlayer - Replays cached SSE responses with original timing
 */
export class CachePlayer {
  private cached: CachedResponse;
  private aborted: boolean = false;

  constructor(cached: CachedResponse) {
    this.cached = cached;
  }

  /**
   * Get HTTP status code
   */
  getStatus(): number {
    return this.cached.response.status;
  }

  /**
   * Get the hash
   */
  getHash(): string {
    return this.cached.hash;
  }

  /**
   * Abort playback
   */
  abort(): void {
    this.aborted = true;
  }

  /**
   * Replay chunks with timing as an async generator
   */
  async *replay(): AsyncGenerator<string, void, unknown> {
    this.aborted = false;

    const chunks = this.cached.response.chunks ?? [];

    for (const chunk of chunks) {
      if (this.aborted) {
        break;
      }

      // Wait for the recorded delay
      if (chunk.delay > 0) {
        await this.delay(chunk.delay);
      }

      if (this.aborted) {
        break;
      }

      yield chunk.data;
    }
  }

  /**
   * Replay all chunks immediately (no timing)
   */
  async *replayFast(): AsyncGenerator<string, void, unknown> {
    const chunks = this.cached.response.chunks ?? [];

    for (const chunk of chunks) {
      if (this.aborted) {
        break;
      }
      yield chunk.data;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a cache recorder
 */
export function createRecorder(cachePath?: string): CacheRecorder {
  return new CacheRecorder(cachePath);
}

/**
 * Create a cache player for the given request
 */
export async function createPlayer(
  requestBody: unknown,
  cachePath?: string
): Promise<CachePlayer | null> {
  const cached = await loadCache(requestBody, cachePath);
  if (!cached) {
    return null;
  }
  return new CachePlayer(cached);
}
