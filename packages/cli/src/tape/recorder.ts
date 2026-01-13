import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import type { Tape, TapeChunk } from '@playingpack/shared';
import { hashRequest } from './hasher.js';

const DEFAULT_TAPES_DIR = '.playingpack/tapes';

/**
 * TapeRecorder - Records SSE responses to disk for replay
 */
export class TapeRecorder {
  private tapesDir: string;
  private chunks: TapeChunk[] = [];
  private lastChunkTime: number = 0;
  private requestBody: unknown;
  private model: string = 'unknown';
  private endpoint: string;
  private hash: string = '';

  constructor(tapesDir: string = DEFAULT_TAPES_DIR) {
    this.tapesDir = tapesDir;
    this.endpoint = '/v1/chat/completions';
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
      c: data,
      d: delay,
    });

    this.lastChunkTime = now;
  }

  /**
   * Finalize and save the tape to disk
   */
  async save(statusCode: number = 200): Promise<string> {
    const tape: Tape = {
      meta: {
        id: crypto.randomUUID(),
        hash: this.hash,
        timestamp: new Date().toISOString(),
        model: this.model,
        endpoint: this.endpoint,
      },
      request: {
        body: this.requestBody,
      },
      response: {
        status: statusCode,
        chunks: this.chunks,
      },
    };

    const filePath = this.getTapePath();

    // Ensure directory exists
    await mkdir(dirname(filePath), { recursive: true });

    // Write tape to disk
    await writeFile(filePath, JSON.stringify(tape, null, 2), 'utf-8');

    return filePath;
  }

  /**
   * Get the file path for this tape
   */
  getTapePath(): string {
    return join(this.tapesDir, `${this.hash}.json`);
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
 * Create a new tape recorder
 */
export function createRecorder(tapesDir?: string): TapeRecorder {
  return new TapeRecorder(tapesDir);
}
