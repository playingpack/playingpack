/**
 * Generates synthetic OpenAI-compatible SSE streams for mocking responses
 */

/**
 * Generate a unique mock ID
 */
function generateMockId(): string {
  return `chatcmpl-mock-${Date.now()}`;
}

/**
 * Split content into chunks for realistic streaming
 */
function splitIntoTokens(content: string, chunkSize: number = 4): string[] {
  const tokens: string[] = [];
  for (let i = 0; i < content.length; i += chunkSize) {
    tokens.push(content.slice(i, i + chunkSize));
  }
  return tokens;
}

/**
 * Create an SSE data frame
 */
function createSSEFrame(data: string): string {
  return `data: ${data}\n\n`;
}

/**
 * Create an OpenAI-compatible chunk
 */
function createChunk(
  id: string,
  model: string,
  content: string | null,
  finishReason: string | null = null
): string {
  const chunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: content !== null ? { content } : {},
        finish_reason: finishReason,
      },
    ],
  };
  return JSON.stringify(chunk);
}

/**
 * Create an OpenAI-compatible tool call chunk
 */
function createToolCallChunk(
  id: string,
  model: string,
  toolCallId: string,
  functionName: string,
  argumentsChunk: string,
  isFirst: boolean = false,
  finishReason: string | null = null
): string {
  const toolCall: Record<string, unknown> = {
    index: 0,
  };

  if (isFirst) {
    toolCall.id = toolCallId;
    toolCall.type = 'function';
    toolCall.function = { name: functionName, arguments: argumentsChunk };
  } else {
    toolCall.function = { arguments: argumentsChunk };
  }

  const chunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { tool_calls: [toolCall] },
        finish_reason: finishReason,
      },
    ],
  };
  return JSON.stringify(chunk);
}

/**
 * Generate mock stream options
 */
export interface MockStreamOptions {
  model?: string;
  delayMs?: number;
}

/**
 * Generate a mock text response stream
 */
export async function* generateMockTextStream(
  content: string,
  options: MockStreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const { model = 'gpt-4', delayMs = 20 } = options;
  const id = generateMockId();
  const tokens = splitIntoTokens(content);

  // Initial chunk with role
  const initialChunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', content: '' },
        finish_reason: null,
      },
    ],
  };
  yield createSSEFrame(JSON.stringify(initialChunk));

  // Content chunks
  for (const token of tokens) {
    if (delayMs > 0) {
      await delay(delayMs);
    }
    yield createSSEFrame(createChunk(id, model, token));
  }

  // Final chunk
  yield createSSEFrame(createChunk(id, model, null, 'stop'));

  // Done marker
  yield createSSEFrame('[DONE]');
}

/**
 * Generate a mock tool call response stream
 */
export async function* generateMockToolCallStream(
  functionName: string,
  args: string,
  options: MockStreamOptions = {}
): AsyncGenerator<string, void, unknown> {
  const { model = 'gpt-4', delayMs = 10 } = options;
  const id = generateMockId();
  const toolCallId = `call_mock_${Date.now()}`;
  const argChunks = splitIntoTokens(args, 10);

  // Initial chunk with role
  const initialChunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { role: 'assistant', content: null },
        finish_reason: null,
      },
    ],
  };
  yield createSSEFrame(JSON.stringify(initialChunk));

  // First tool call chunk with name
  yield createSSEFrame(
    createToolCallChunk(id, model, toolCallId, functionName, argChunks[0] || '', true)
  );

  // Remaining argument chunks
  for (let i = 1; i < argChunks.length; i++) {
    if (delayMs > 0) {
      await delay(delayMs);
    }
    yield createSSEFrame(
      createToolCallChunk(id, model, toolCallId, functionName, argChunks[i] || '')
    );
  }

  // Final chunk
  const finalChunk = {
    id,
    object: 'chat.completion.chunk',
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: 'tool_calls',
      },
    ],
  };
  yield createSSEFrame(JSON.stringify(finalChunk));

  // Done marker
  yield createSSEFrame('[DONE]');
}

/**
 * Generate an error response (non-streaming JSON)
 */
export function generateErrorResponse(
  message: string,
  type: string = 'invalid_request_error',
  code: string | null = null
): string {
  return JSON.stringify({
    error: {
      message,
      type,
      param: null,
      code,
    },
  });
}

/**
 * Parse mock content and determine type
 */
export function parseMockContent(content: string): {
  type: 'text' | 'tool_call' | 'error';
  content: string;
  functionName?: string;
} {
  const trimmed = content.trim();

  // Check if it's an error mock
  if (trimmed.startsWith('ERROR:')) {
    return {
      type: 'error',
      content: trimmed.slice(6).trim(),
    };
  }

  // Check if it's a tool call mock (JSON with function name)
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && 'function' in parsed) {
      return {
        type: 'tool_call',
        functionName: parsed.function,
        content: JSON.stringify(parsed.arguments || {}),
      };
    }
  } catch {
    // Not JSON, treat as text
  }

  return {
    type: 'text',
    content: trimmed,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
