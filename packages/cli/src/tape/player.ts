import { readFile, access } from 'fs/promises';
import { join } from 'path';
import type { Tape } from '@playingpack/shared';
import { hashRequest } from './hasher.js';

const DEFAULT_TAPES_DIR = '.playingpack/tapes';

/**
 * Check if a tape exists for the given request body
 */
export async function tapeExists(
  requestBody: unknown,
  tapesDir: string = DEFAULT_TAPES_DIR
): Promise<boolean> {
  const hash = hashRequest(requestBody);
  const filePath = join(tapesDir, `${hash}.json`);

  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load a tape from disk
 */
export async function loadTape(
  requestBody: unknown,
  tapesDir: string = DEFAULT_TAPES_DIR
): Promise<Tape | null> {
  const hash = hashRequest(requestBody);
  const filePath = join(tapesDir, `${hash}.json`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as Tape;
  } catch {
    return null;
  }
}

/**
 * Load a tape by hash directly
 */
export async function loadTapeByHash(
  hash: string,
  tapesDir: string = DEFAULT_TAPES_DIR
): Promise<Tape | null> {
  const filePath = join(tapesDir, `${hash}.json`);

  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content) as Tape;
  } catch {
    return null;
  }
}

/**
 * TapePlayer - Replays recorded SSE responses with original timing
 */
export class TapePlayer {
  private tape: Tape;
  private currentIndex: number = 0;
  private aborted: boolean = false;

  constructor(tape: Tape) {
    this.tape = tape;
  }

  /**
   * Get tape metadata
   */
  getMeta() {
    return this.tape.meta;
  }

  /**
   * Get HTTP status code
   */
  getStatus(): number {
    return this.tape.response.status;
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
    this.currentIndex = 0;
    this.aborted = false;

    for (const chunk of this.tape.response.chunks) {
      if (this.aborted) {
        break;
      }

      // Wait for the recorded delay
      if (chunk.d > 0) {
        await this.delay(chunk.d);
      }

      if (this.aborted) {
        break;
      }

      yield chunk.c;
      this.currentIndex++;
    }
  }

  /**
   * Replay all chunks immediately (no timing)
   */
  async *replayFast(): AsyncGenerator<string, void, unknown> {
    for (const chunk of this.tape.response.chunks) {
      if (this.aborted) {
        break;
      }
      yield chunk.c;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Create a tape player for the given request
 */
export async function createPlayer(
  requestBody: unknown,
  tapesDir?: string
): Promise<TapePlayer | null> {
  const tape = await loadTape(requestBody, tapesDir);
  if (!tape) {
    return null;
  }
  return new TapePlayer(tape);
}
