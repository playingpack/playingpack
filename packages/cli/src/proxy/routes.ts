import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { RecordMode } from '@playingpack/shared';
import { getSessionManager } from '../interceptor/session-manager.js';
import { createSSEParser } from './sse-parser.js';
import { sendUpstream, streamToGenerator, redactApiKey } from './upstream.js';
import { TapeRecorder } from '../tape/recorder.js';
import { tapeExists, createPlayer } from '../tape/player.js';
import {
  generateMockTextStream,
  generateMockToolCallStream,
  generateErrorResponse,
  generateNonStreamingResponse,
  parseMockContent,
} from '../mock/generator.js';
import { logger } from '../logger.js';

export interface ProxyConfig {
  upstream: string;
  tapesDir: string;
  record: RecordMode;
}

// Module-level config (set via registerProxyRoutes)
let proxyConfig: ProxyConfig = {
  upstream: 'https://api.openai.com',
  tapesDir: '.playingpack/tapes',
  record: 'auto',
};

/**
 * Register proxy routes
 */
export function registerProxyRoutes(server: FastifyInstance, config?: ProxyConfig): void {
  if (config) {
    proxyConfig = config;
  }
  // OpenAI Chat Completions endpoint
  server.post('/v1/chat/completions', async (request, reply) => {
    await handleChatCompletions(request, reply);
  });

  // Health check
  server.get('/health', async (_request, reply) => {
    return reply.send({ status: 'ok' });
  });

  // Catch-all for other OpenAI endpoints (passthrough)
  server.all('/v1/*', async (request, reply) => {
    await handlePassthrough(request, reply);
  });
}

/**
 * Handle chat completions request
 */
async function handleChatCompletions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionManager = getSessionManager();
  const requestId = crypto.randomUUID();
  const body = request.body as Record<string, unknown>;

  // Extract stream parameter (default true per OpenAI spec)
  const clientStream = body.stream !== false;

  // Log request (redact API key)
  const authHeader = request.headers.authorization || '';
  console.log(`[${requestId.slice(0, 8)}] POST /v1/chat/completions`);
  console.log(`  Model: ${body.model || 'unknown'}`);
  console.log(`  Stream: ${clientStream}`);
  console.log(`  Auth: ${redactApiKey(authHeader.replace('Bearer ', ''))}`);

  logger.info('Request received', {
    requestId,
    path: '/v1/chat/completions',
    model: body.model,
    stream: clientStream,
  });

  // Create session
  sessionManager.createSession(requestId, 'POST', '/v1/chat/completions', body);

  // State 0: LOOKUP - Check for cached tape
  sessionManager.updateState(requestId, 'LOOKUP');

  // Check record mode
  const shouldCheckTape = proxyConfig.record !== 'off';
  const shouldRecord = proxyConfig.record === 'auto';
  const replayOnly = proxyConfig.record === 'replay-only';

  const hasTape = shouldCheckTape && (await tapeExists(body, proxyConfig.tapesDir));

  if (hasTape) {
    // State 6: REPLAY - Play cached response
    console.log(`  [CACHE HIT] Replaying from tape`);
    logger.info('Cache hit', { requestId, model: body.model });
    await replayFromTape(request, reply, requestId, body, clientStream);
    return;
  }

  // In replay-only mode, fail if no tape exists
  if (replayOnly) {
    console.log(`  [REPLAY-ONLY] No tape found, rejecting request`);
    sessionManager.error(requestId, 'No tape found (replay-only mode)');
    reply.code(404).send({
      error: {
        message: 'No recorded tape found for this request (replay-only mode)',
        type: 'tape_not_found',
      },
    });
    return;
  }

  console.log(`  [CACHE MISS] Forwarding to upstream`);
  logger.info('Cache miss', { requestId, model: body.model });

  // State 1: CONNECT - Connect to upstream
  sessionManager.updateState(requestId, 'CONNECT');

  try {
    const response = await sendUpstream({
      method: 'POST',
      path: '/v1/chat/completions',
      headers: request.headers,
      body,
      upstreamUrl: proxyConfig.upstream,
    });

    if (!response.ok || !response.body) {
      // Handle error response
      sessionManager.error(requestId, `Upstream error: ${response.status}`);
      reply
        .code(response.status)
        .header('content-type', 'application/json')
        .send(await streamToString(response.body));
      return;
    }

    // Route to appropriate handler based on streaming mode
    if (clientStream) {
      // State 2: STREAMING - Stream response
      await streamResponse(request, reply, requestId, response, body, shouldRecord);
    } else {
      // Handle non-streaming response
      await handleNonStreamingResponse(request, reply, requestId, response, body, shouldRecord);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  [ERROR] ${message}`);
    logger.error('Request failed', { requestId, error: message });
    sessionManager.error(requestId, message);
    reply.code(500).send({ error: { message, type: 'proxy_error' } });
  }
}

/**
 * Stream response from upstream
 */
async function streamResponse(
  _request: FastifyRequest,
  reply: FastifyReply,
  requestId: string,
  response: { status: number; headers: Headers; body: ReadableStream<Uint8Array> | null },
  requestBody: unknown,
  shouldRecord: boolean
): Promise<void> {
  const sessionManager = getSessionManager();
  const recorder = shouldRecord ? new TapeRecorder(proxyConfig.tapesDir) : null;
  recorder?.start(requestBody);

  sessionManager.updateState(requestId, 'STREAMING');

  // SSE parser for detecting tool calls
  const parser = createSSEParser({
    onToolCall: (toolCall) => {
      sessionManager.addToolCall(requestId, toolCall);
      console.log(`  [TOOL CALL] ${toolCall.name}`);
    },
    onContent: (content) => {
      sessionManager.updateContent(requestId, content);
    },
  });

  if (!response.body) {
    reply.raw.end();
    return;
  }

  // Buffer the entire response first
  const buffer: string[] = [];
  const stream = streamToGenerator(response.body);

  for await (const chunk of stream) {
    // Parse the chunk for tool calls
    parser.feed(chunk);

    // Record for tape
    recorder?.recordChunk(chunk);

    // Buffer all chunks
    buffer.push(chunk);
  }

  // Store assembled message for display
  const assembledMessage = parser.getAssembledMessage();
  sessionManager.setRawResponse(requestId, JSON.stringify(assembledMessage, null, 2));

  // Save tape (do this before intercept so we have complete response recorded)
  if (recorder) {
    try {
      const tapePath = await recorder.save(response.status);
      console.log(`  [TAPE] Saved to ${tapePath}`);
    } catch (error) {
      console.error(`  [TAPE ERROR] Failed to save tape:`, error);
    }
  }

  // After stream completes, check if we should intercept
  if (sessionManager.shouldIntercept(requestId)) {
    console.log(`  [INTERCEPT] Pausing for user action`);

    // Wait for user action
    const interceptResult = await sessionManager.intercept(requestId);

    console.log(`  [ACTION] ${interceptResult.action}`);

    if (interceptResult.action === 'mock') {
      // State 5: INJECT - Send mock response instead
      await sendMockResponse(reply, requestId, interceptResult.mockContent || '', true);
      return;
    }
  }

  // Set up SSE headers and send buffered response
  reply
    .code(response.status)
    .header('content-type', 'text/event-stream')
    .header('cache-control', 'no-cache')
    .header('connection', 'keep-alive');

  // Flush all buffered chunks to client
  for (const chunk of buffer) {
    reply.raw.write(chunk);
  }

  // Complete session
  sessionManager.complete(requestId, response.status, false);
  logger.info('Request completed', { requestId, status: response.status, cached: false });

  reply.raw.end();
}

/**
 * Handle non-streaming response from upstream
 */
async function handleNonStreamingResponse(
  _request: FastifyRequest,
  reply: FastifyReply,
  requestId: string,
  response: { status: number; headers: Headers; body: ReadableStream<Uint8Array> | null },
  requestBody: unknown,
  shouldRecord: boolean
): Promise<void> {
  const sessionManager = getSessionManager();
  const recorder = shouldRecord ? new TapeRecorder(proxyConfig.tapesDir) : null;
  recorder?.start(requestBody);

  sessionManager.updateState(requestId, 'STREAMING');

  if (!response.body) {
    reply.code(response.status).header('content-type', 'application/json').send('');
    return;
  }

  // Read the entire JSON response
  const jsonResponse = await streamToString(response.body);

  // Record for tape (as raw JSON)
  recorder?.recordChunk(jsonResponse);

  // Parse response to extract content and tool calls for session manager
  try {
    const parsed = JSON.parse(jsonResponse) as {
      choices?: Array<{
        message?: {
          content?: string | null;
          tool_calls?: Array<{
            id: string;
            type: string;
            function: { name: string; arguments: string };
          }>;
        };
        finish_reason?: string;
      }>;
    };

    if (parsed.choices?.[0]?.message) {
      const message = parsed.choices[0].message;
      if (message.content) {
        sessionManager.updateContent(requestId, message.content);
      }
      if (message.tool_calls) {
        for (const tc of message.tool_calls) {
          sessionManager.addToolCall(requestId, {
            index: 0,
            id: tc.id,
            name: tc.function.name,
            arguments: tc.function.arguments,
          });
          console.log(`  [TOOL CALL] ${tc.function.name}`);
        }
      }
    }

    sessionManager.setRawResponse(requestId, JSON.stringify(parsed, null, 2));
  } catch {
    // If parsing fails, still store raw response
    sessionManager.setRawResponse(requestId, jsonResponse);
  }

  // Save tape
  if (recorder) {
    try {
      const tapePath = await recorder.save(response.status);
      console.log(`  [TAPE] Saved to ${tapePath}`);
    } catch (error) {
      console.error(`  [TAPE ERROR] Failed to save tape:`, error);
    }
  }

  // Check if we should intercept
  if (sessionManager.shouldIntercept(requestId)) {
    console.log(`  [INTERCEPT] Pausing for user action`);

    const interceptResult = await sessionManager.intercept(requestId);
    console.log(`  [ACTION] ${interceptResult.action}`);

    if (interceptResult.action === 'mock') {
      await sendMockResponse(reply, requestId, interceptResult.mockContent || '', false);
      return;
    }
  }

  // Send JSON response
  reply.code(response.status).header('content-type', 'application/json').send(jsonResponse);

  sessionManager.complete(requestId, response.status, false);
  logger.info('Request completed', { requestId, status: response.status, cached: false });
}

/**
 * Replay response from tape
 */
async function replayFromTape(
  _request: FastifyRequest,
  reply: FastifyReply,
  requestId: string,
  requestBody: unknown,
  clientStream: boolean
): Promise<void> {
  const sessionManager = getSessionManager();
  sessionManager.updateState(requestId, 'REPLAY');

  const player = await createPlayer(requestBody, proxyConfig.tapesDir);

  if (!player) {
    sessionManager.error(requestId, 'Failed to load tape');
    reply.code(500).send({ error: { message: 'Tape not found', type: 'proxy_error' } });
    return;
  }

  if (clientStream) {
    // Streaming replay - SSE format
    reply
      .code(player.getStatus())
      .header('content-type', 'text/event-stream')
      .header('cache-control', 'no-cache')
      .header('connection', 'keep-alive')
      .header('x-playingpack-cached', 'true');

    // SSE parser for extracting content and tool calls
    const parser = createSSEParser({
      onToolCall: (toolCall) => {
        sessionManager.addToolCall(requestId, toolCall);
        console.log(`  [TOOL CALL] ${toolCall.name}`);
      },
      onContent: (content) => {
        sessionManager.updateContent(requestId, content);
      },
    });

    // Replay with timing
    for await (const chunk of player.replay()) {
      parser.feed(chunk);
      reply.raw.write(chunk);
    }

    // Store assembled message for display
    const assembledMessage = parser.getAssembledMessage();
    sessionManager.setRawResponse(requestId, JSON.stringify(assembledMessage, null, 2));

    sessionManager.complete(requestId, player.getStatus(), true);
    logger.info('Request completed', { requestId, status: player.getStatus(), cached: true });
    reply.raw.end();
  } else {
    // Non-streaming replay - JSON format
    // Collect all chunks into single response (tape stores raw JSON for non-streaming)
    let jsonResponse = '';
    for await (const chunk of player.replay()) {
      jsonResponse += chunk;
    }

    // Parse for session manager
    try {
      const parsed = JSON.parse(jsonResponse) as {
        choices?: Array<{
          message?: {
            content?: string | null;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
          };
        }>;
      };

      if (parsed.choices?.[0]?.message) {
        const message = parsed.choices[0].message;
        if (message.content) {
          sessionManager.updateContent(requestId, message.content);
        }
        if (message.tool_calls) {
          for (const tc of message.tool_calls) {
            sessionManager.addToolCall(requestId, {
              index: 0,
              id: tc.id,
              name: tc.function.name,
              arguments: tc.function.arguments,
            });
            console.log(`  [TOOL CALL] ${tc.function.name}`);
          }
        }
      }
      sessionManager.setRawResponse(requestId, JSON.stringify(parsed, null, 2));
    } catch {
      sessionManager.setRawResponse(requestId, jsonResponse);
    }

    reply
      .code(player.getStatus())
      .header('content-type', 'application/json')
      .header('x-playingpack-cached', 'true')
      .send(jsonResponse);

    sessionManager.complete(requestId, player.getStatus(), true);
    logger.info('Request completed', { requestId, status: player.getStatus(), cached: true });
  }
}

/**
 * Send mock response
 */
async function sendMockResponse(
  reply: FastifyReply,
  requestId: string,
  mockContent: string,
  clientStream: boolean = true
): Promise<void> {
  const sessionManager = getSessionManager();
  const parsed = parseMockContent(mockContent);

  if (parsed.type === 'error') {
    // Send error response (same format for both streaming and non-streaming)
    reply
      .code(400)
      .header('content-type', 'application/json')
      .send(generateErrorResponse(parsed.content));
    sessionManager.complete(requestId, 400, false);
    return;
  }

  if (clientStream) {
    // Send streamed SSE response
    reply
      .code(200)
      .header('content-type', 'text/event-stream')
      .header('cache-control', 'no-cache')
      .header('connection', 'keep-alive')
      .header('x-playingpack-mocked', 'true');

    const generator =
      parsed.type === 'tool_call'
        ? generateMockToolCallStream(parsed.functionName || 'mock_function', parsed.content)
        : generateMockTextStream(parsed.content);

    for await (const chunk of generator) {
      reply.raw.write(chunk);
    }

    sessionManager.complete(requestId, 200, false);
    reply.raw.end();
  } else {
    // Send non-streaming JSON response
    const toolCalls =
      parsed.type === 'tool_call'
        ? [
            {
              id: `call_mock_${Date.now()}`,
              type: 'function' as const,
              function: {
                name: parsed.functionName || 'mock_function',
                arguments: parsed.content,
              },
            },
          ]
        : undefined;

    const content = parsed.type === 'text' ? parsed.content : null;
    const response = generateNonStreamingResponse(content, toolCalls);

    reply
      .code(200)
      .header('content-type', 'application/json')
      .header('x-playingpack-mocked', 'true')
      .send(JSON.stringify(response));

    sessionManager.complete(requestId, 200, false);
  }
}

/**
 * Handle passthrough for non-chat endpoints
 */
async function handlePassthrough(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  try {
    const response = await sendUpstream({
      method: request.method,
      path: request.url,
      headers: request.headers,
      body: request.body,
      upstreamUrl: proxyConfig.upstream,
    });

    reply.code(response.status);

    // Forward headers
    response.headers.forEach((value, key) => {
      if (!['content-encoding', 'transfer-encoding'].includes(key.toLowerCase())) {
        reply.header(key, value);
      }
    });

    if (response.body) {
      const content = await streamToString(response.body);
      reply.send(content);
    } else {
      reply.send();
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    reply.code(500).send({ error: { message, type: 'proxy_error' } });
  }
}

/**
 * Convert ReadableStream to string
 */
async function streamToString(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) {
    return '';
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += decoder.decode(value, { stream: true });
  }

  return result;
}
