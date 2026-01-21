import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { CacheMode } from '@playingpack/shared';
import { getSessionManager } from '../session/manager.js';
import { createSSEParser } from './sse-parser.js';
import { sendUpstream, streamToGenerator, redactApiKey } from './upstream.js';
import { CacheRecorder, cacheExists, createPlayer } from '../cache/index.js';
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
  cachePath: string;
  cache: CacheMode;
}

// Module-level config (set via registerProxyRoutes)
let proxyConfig: ProxyConfig = {
  upstream: 'https://api.openai.com',
  cachePath: '.playingpack/cache',
  cache: 'read-write',
};

/**
 * Register proxy routes
 */
export function registerProxyRoutes(server: FastifyInstance, config?: Partial<ProxyConfig>): void {
  if (config) {
    proxyConfig = { ...proxyConfig, ...config };
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
 *
 * Flow:
 * 1. Request arrives
 * 2. [Intervention Point 1] - if intervene enabled, wait for human action
 * 3. Get response (from cache or LLM based on action/settings)
 * 4. [Intervention Point 2] - if intervene enabled, wait for human action
 * 5. Return response to agent
 */
async function handleChatCompletions(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const sessionManager = getSessionManager();
  const requestId = crypto.randomUUID();
  const body = request.body as Record<string, unknown>;

  // Extract stream parameter (proxy defaults to true for internal handling)
  const clientStream = body.stream !== false;

  // Log request
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
  sessionManager.createSession(requestId, body);

  // Check cache status
  const shouldReadCache = proxyConfig.cache !== 'off';
  const shouldWriteCache = proxyConfig.cache === 'read-write';
  const cacheOnly = proxyConfig.cache === 'read';

  const hasCache = shouldReadCache && (await cacheExists(body, proxyConfig.cachePath));
  sessionManager.setCacheAvailable(requestId, hasCache);

  // =========================================================================
  // INTERVENTION POINT 1: Request arrived
  // =========================================================================
  let responseSource: 'llm' | 'cache' | 'mock' = hasCache ? 'cache' : 'llm';
  let mockContent: string | undefined;

  if (sessionManager.shouldIntervene()) {
    console.log(`  [POINT 1] Waiting for human action (cache: ${hasCache ? 'yes' : 'no'})`);

    const action = await sessionManager.waitForPoint1(requestId);

    switch (action.action) {
      case 'cache':
        responseSource = 'cache';
        console.log(`  [ACTION] Use cache`);
        break;
      case 'llm':
        responseSource = 'llm';
        console.log(`  [ACTION] Call LLM`);
        break;
      case 'mock':
        responseSource = 'mock';
        mockContent = action.content;
        console.log(`  [ACTION] Mock response`);
        break;
    }
  } else {
    // Auto mode: use cache if available, otherwise LLM
    if (hasCache) {
      console.log(`  [AUTO] Using cached response`);
      responseSource = 'cache';
    } else {
      console.log(`  [AUTO] Calling LLM`);
      responseSource = 'llm';
    }
  }

  // =========================================================================
  // GET RESPONSE (buffered - not sent to client yet)
  // =========================================================================
  try {
    let responseData:
      | { content: string; status: number; cached?: boolean; mocked?: boolean }
      | undefined;

    switch (responseSource) {
      case 'cache': {
        if (!hasCache) {
          throw new Error('Cache requested but no cached response available');
        }
        const cacheData = await getFromCache(request, reply, requestId, body, clientStream);
        responseData = { ...cacheData, cached: true };
        break;
      }

      case 'llm':
        if (cacheOnly) {
          // In read-only cache mode, fail if no cache
          console.log(`  [ERROR] Cache-only mode but no cache available`);
          sessionManager.error(requestId, 'No cached response (cache: read mode)');
          reply.code(404).send({
            error: {
              message: 'No cached response found (cache mode: read)',
              type: 'cache_not_found',
            },
          });
          return;
        }
        responseData = await getFromLLM(
          request,
          reply,
          requestId,
          body,
          clientStream,
          shouldWriteCache
        );
        break;

      case 'mock':
        responseData = await generateMockResponseData(
          reply,
          requestId,
          mockContent || '',
          clientStream
        );
        break;
    }

    // =========================================================================
    // INTERVENTION POINT 2: Response received (wait before sending to client)
    // =========================================================================
    if (sessionManager.shouldIntervene() && responseData) {
      console.log(`  [POINT 2] Waiting for human action`);

      const action = await sessionManager.waitForPoint2(requestId);

      switch (action.action) {
        case 'return':
          console.log(`  [ACTION] Return as-is`);
          break;
        case 'modify':
          console.log(`  [ACTION] Modify response`);
          if (action.content) {
            // Replace response with modified content
            const modifiedData = await generateMockResponseData(
              reply,
              requestId,
              action.content,
              clientStream
            );
            responseData = modifiedData;
          }
          break;
      }
    }

    // Send the buffered response to client
    if (responseData) {
      sendBufferedResponse(reply, responseData, clientStream);
    }

    // Set response source and complete the session
    sessionManager.setResponseSource(requestId, responseSource);
    sessionManager.complete(requestId);
    logger.info('Request completed', { requestId, source: responseSource });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`  [ERROR] ${message}`);
    logger.error('Request failed', { requestId, error: message });
    sessionManager.error(requestId, message);

    if (!reply.sent) {
      reply.code(500).send({ error: { message, type: 'proxy_error' } });
    }
  }
}

/**
 * Get response from cache (buffered - does not send to client)
 */
async function getFromCache(
  _request: FastifyRequest,
  _reply: FastifyReply,
  requestId: string,
  requestBody: unknown,
  _clientStream: boolean
): Promise<{ content: string; status: number }> {
  const sessionManager = getSessionManager();

  const player = await createPlayer(requestBody, proxyConfig.cachePath);
  if (!player) {
    throw new Error('Failed to load cached response');
  }

  // SSE parser for extracting content and tool calls
  const parser = createSSEParser({
    onToolCall: (toolCall) => {
      sessionManager.addToolCall(requestId, toolCall);
      console.log(`  [TOOL CALL] ${toolCall.name}`);
    },
    onContent: (content) => {
      sessionManager.appendContent(requestId, content);
    },
  });

  // Buffer the response (don't send yet - wait for intervention point 2)
  let fullContent = '';
  for await (const chunk of player.replay()) {
    parser.feed(chunk);
    fullContent += chunk;
  }

  return { content: fullContent, status: player.getStatus(), cached: true } as {
    content: string;
    status: number;
  };
}

/**
 * Get response from LLM (buffered - does not send to client)
 */
async function getFromLLM(
  request: FastifyRequest,
  _reply: FastifyReply,
  requestId: string,
  requestBody: unknown,
  _clientStream: boolean,
  shouldWriteCache: boolean
): Promise<{ content: string; status: number }> {
  const sessionManager = getSessionManager();
  const body = requestBody as Record<string, unknown>;

  // Inject stream_options to get token usage in streaming responses
  // Only allowed when stream is explicitly true (OpenAI defaults stream to false)
  const bodyWithUsage =
    body.stream === true
      ? {
          ...body,
          stream_options: {
            ...(typeof body.stream_options === 'object' && body.stream_options !== null
              ? body.stream_options
              : {}),
            include_usage: true,
          },
        }
      : body;

  const response = await sendUpstream({
    method: 'POST',
    path: '/v1/chat/completions',
    headers: request.headers,
    body: bodyWithUsage,
    upstreamUrl: proxyConfig.upstream,
  });

  if (!response.ok || !response.body) {
    const errorBody = response.body ? await streamToString(response.body) : '';
    return { content: errorBody, status: response.status };
  }

  // Set up recorder if we should cache
  const recorder = shouldWriteCache ? new CacheRecorder(proxyConfig.cachePath) : null;
  recorder?.start(requestBody);

  // SSE parser for detecting tool calls, finish reason, and usage
  const parser = createSSEParser({
    onToolCall: (toolCall) => {
      sessionManager.addToolCall(requestId, toolCall);
      console.log(`  [TOOL CALL] ${toolCall.name}`);
    },
    onContent: (content) => {
      sessionManager.appendContent(requestId, content);
    },
    onFinishReason: (reason) => {
      sessionManager.setFinishReason(requestId, reason);
    },
    onUsage: (usage) => {
      sessionManager.setUsage(requestId, usage);
      console.log(`  [USAGE] ${usage.prompt_tokens} prompt, ${usage.completion_tokens} completion`);
    },
  });

  // Buffer the full response (don't send yet - wait for intervention point 2)
  let fullContent = '';
  const stream = streamToGenerator(response.body);

  for await (const chunk of stream) {
    parser.feed(chunk);
    recorder?.recordChunk(chunk);
    fullContent += chunk;
  }

  // Save to cache
  if (recorder) {
    try {
      const cachePath = await recorder.save(response.status);
      console.log(`  [CACHE] Saved to ${cachePath}`);
    } catch (error) {
      console.error(`  [CACHE ERROR] Failed to save:`, error);
    }
  }

  return { content: fullContent, status: response.status };
}

/**
 * Generate mock response (buffered - does not send to client)
 */
async function generateMockResponseData(
  _reply: FastifyReply,
  _requestId: string,
  mockContent: string,
  clientStream: boolean = true
): Promise<{ content: string; status: number; mocked: boolean }> {
  const parsed = parseMockContent(mockContent);

  if (parsed.type === 'error') {
    const errorResponse = generateErrorResponse(parsed.content);
    return { content: errorResponse, status: 400, mocked: true };
  }

  if (clientStream) {
    const generator =
      parsed.type === 'tool_call'
        ? generateMockToolCallStream(parsed.functionName || 'mock_function', parsed.content)
        : generateMockTextStream(parsed.content);

    let fullContent = '';
    for await (const chunk of generator) {
      fullContent += chunk;
    }

    return { content: fullContent, status: 200, mocked: true };
  } else {
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
    const jsonResponse = JSON.stringify(response);

    return { content: jsonResponse, status: 200, mocked: true };
  }
}

/**
 * Send buffered response to client
 */
function sendBufferedResponse(
  reply: FastifyReply,
  responseData: { content: string; status: number; cached?: boolean; mocked?: boolean },
  clientStream: boolean
): void {
  const headers: Record<string, string> = {};

  if (responseData.cached) {
    headers['x-playingpack-cached'] = 'true';
  }
  if (responseData.mocked) {
    headers['x-playingpack-mocked'] = 'true';
  }

  if (clientStream && responseData.content.includes('data: ')) {
    // SSE streaming response
    reply
      .code(responseData.status)
      .header('content-type', 'text/event-stream')
      .header('cache-control', 'no-cache')
      .header('connection', 'keep-alive');

    for (const [key, value] of Object.entries(headers)) {
      reply.header(key, value);
    }

    reply.raw.write(responseData.content);
    reply.raw.end();
  } else {
    // JSON response
    reply.code(responseData.status).header('content-type', 'application/json');

    for (const [key, value] of Object.entries(headers)) {
      reply.header(key, value);
    }

    reply.send(responseData.content);
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
