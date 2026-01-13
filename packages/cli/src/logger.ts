import { appendFile, mkdir } from 'fs/promises';
import { join } from 'path';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

let logsDir: string | null = null;
let currentLogFile: string | null = null;

/**
 * Initialize the logger with a directory
 */
export async function initLogger(dir: string): Promise<void> {
  logsDir = dir;
  await mkdir(logsDir, { recursive: true });

  // Create log file with date-based name
  const date = new Date().toISOString().split('T')[0];
  currentLogFile = join(logsDir, `server-${date}.log`);
}

/**
 * Format a log entry as a string
 */
function formatEntry(entry: LogEntry): string {
  const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
  if (entry.data !== undefined) {
    return `${base} ${JSON.stringify(entry.data)}\n`;
  }
  return `${base}\n`;
}

/**
 * Write a log entry to file
 */
async function writeLog(level: LogLevel, message: string, data?: unknown): Promise<void> {
  if (!currentLogFile) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  };

  try {
    await appendFile(currentLogFile, formatEntry(entry));
  } catch {
    // Silently fail if we can't write logs
  }
}

export const logger = {
  info: (message: string, data?: unknown) => writeLog('info', message, data),
  warn: (message: string, data?: unknown) => writeLog('warn', message, data),
  error: (message: string, data?: unknown) => writeLog('error', message, data),
  debug: (message: string, data?: unknown) => writeLog('debug', message, data),
};
