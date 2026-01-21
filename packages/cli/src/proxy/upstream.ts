import type { IncomingHttpHeaders } from 'http';

const OPENAI_API_URL = 'https://api.openai.com';

/**
 * Options for upstream request
 */
export interface UpstreamOptions {
  method: string;
  path: string;
  headers: IncomingHttpHeaders;
  body: unknown;
  upstreamUrl?: string;
}

/**
 * Upstream response wrapper
 */
export interface UpstreamResponse {
  status: number;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  ok: boolean;
}

/**
 * Redact API key for logging
 */
export function redactApiKey(key: string): string {
  if (!key || key.length < 8) {
    return '****';
  }
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

/**
 * Filter headers to forward to upstream
 */
function filterHeaders(headers: IncomingHttpHeaders, stream: boolean = true): Headers {
  const filtered = new Headers();

  // Headers to forward
  const forwardHeaders = [
    'authorization',
    'content-type',
    'accept',
    'openai-organization',
    'openai-project',
    'user-agent',
  ];

  for (const name of forwardHeaders) {
    const value = headers[name];
    if (value) {
      const headerValue = Array.isArray(value) ? value[0] : value;
      if (headerValue) {
        filtered.set(name, headerValue);
      }
    }
  }

  // Set accept header based on stream parameter
  if (stream) {
    filtered.set('accept', 'text/event-stream');
  } else {
    filtered.set('accept', 'application/json');
  }

  return filtered;
}

/**
 * Send request to upstream (OpenAI)
 */
export async function sendUpstream(options: UpstreamOptions): Promise<UpstreamResponse> {
  const baseUrl = options.upstreamUrl || OPENAI_API_URL;
  const url = `${baseUrl}${options.path}`;

  // Extract stream parameter from body (proxy defaults to true for Accept header)
  const stream =
    typeof options.body === 'object' &&
    options.body !== null &&
    'stream' in options.body &&
    typeof (options.body as Record<string, unknown>).stream === 'boolean'
      ? (options.body as Record<string, unknown>).stream
      : true;

  const headers = filterHeaders(options.headers, stream as boolean);

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: JSON.stringify(options.body),
  });

  return {
    status: response.status,
    headers: response.headers,
    body: response.body,
    ok: response.ok,
  };
}

/**
 * Create an async generator from a ReadableStream
 */
export async function* streamToGenerator(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string, void, unknown> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      yield decoder.decode(value, { stream: true });
    }

    // Flush remaining bytes
    const remaining = decoder.decode();
    if (remaining) {
      yield remaining;
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Abort controller wrapper for upstream requests
 */
export class UpstreamConnection {
  private controller: AbortController;

  constructor() {
    this.controller = new AbortController();
  }

  /**
   * Get abort signal
   */
  get signal(): AbortSignal {
    return this.controller.signal;
  }

  /**
   * Abort the connection
   */
  abort(): void {
    this.controller.abort();
  }

  /**
   * Check if aborted
   */
  get aborted(): boolean {
    return this.controller.signal.aborted;
  }
}
