/**
 * Heartbeat interval in milliseconds
 */
const HEARTBEAT_INTERVAL = 15000; // 15 seconds

/**
 * SSE keep-alive comment
 */
const KEEPALIVE_COMMENT = ': keep-alive\n\n';

/**
 * HeartbeatManager - Sends keep-alive pings to prevent client timeout
 */
export class HeartbeatManager {
  private intervalId: NodeJS.Timeout | null = null;
  private writer: (data: string) => void;
  private running: boolean = false;

  constructor(writer: (data: string) => void) {
    this.writer = writer;
  }

  /**
   * Start sending heartbeats
   */
  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.intervalId = setInterval(() => {
      if (this.running) {
        try {
          this.writer(KEEPALIVE_COMMENT);
        } catch {
          // Client disconnected, stop heartbeat
          this.stop();
        }
      }
    }, HEARTBEAT_INTERVAL);
  }

  /**
   * Stop sending heartbeats
   */
  stop(): void {
    this.running = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Check if heartbeat is running
   */
  isRunning(): boolean {
    return this.running;
  }
}

/**
 * Create a heartbeat manager
 */
export function createHeartbeat(writer: (data: string) => void): HeartbeatManager {
  return new HeartbeatManager(writer);
}
