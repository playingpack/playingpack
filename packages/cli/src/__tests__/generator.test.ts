import { describe, it, expect } from 'vitest';
import {
  generateMockTextStream,
  generateMockToolCallStream,
  generateErrorResponse,
  generateNonStreamingResponse,
  parseMockContent,
} from '../mock/generator.js';

describe('generateMockTextStream', () => {
  it('should generate valid SSE stream', async () => {
    const chunks: string[] = [];

    for await (const chunk of generateMockTextStream('Hello', { delayMs: 0 })) {
      chunks.push(chunk);
    }

    // Should have initial chunk, content chunks, final chunk, and [DONE]
    expect(chunks.length).toBeGreaterThan(2);

    // First chunk should have role
    expect(chunks[0]).toContain('data:');
    expect(chunks[0]).toContain('"role":"assistant"');

    // Last chunk should be [DONE]
    expect(chunks[chunks.length - 1]).toBe('data: [DONE]\n\n');
  });

  it('should split content into tokens', async () => {
    const chunks: string[] = [];
    const content = 'Hello World!'; // 12 chars = 3 tokens of 4 chars

    for await (const chunk of generateMockTextStream(content, { delayMs: 0 })) {
      chunks.push(chunk);
    }

    // Should have: initial, 3 content chunks, final, [DONE]
    // Content chunks: "Hell", "o Wo", "rld!"
    const contentChunks = chunks.filter((c) => c.includes('"delta"') && c.includes('"content"'));

    // Initial chunk has empty content, so we have 4 content chunks total
    expect(contentChunks.length).toBe(4);
  });

  it('should include model in chunks', async () => {
    const chunks: string[] = [];

    for await (const chunk of generateMockTextStream('Hi', { model: 'gpt-4-turbo', delayMs: 0 })) {
      chunks.push(chunk);
    }

    expect(chunks[0]).toContain('"model":"gpt-4-turbo"');
  });
});

describe('generateMockToolCallStream', () => {
  it('should generate valid tool call SSE stream', async () => {
    const chunks: string[] = [];

    for await (const chunk of generateMockToolCallStream('get_weather', '{"location":"SF"}', {
      delayMs: 0,
    })) {
      chunks.push(chunk);
    }

    // Should have tool call chunks
    const toolCallChunks = chunks.filter((c) => c.includes('tool_calls'));
    expect(toolCallChunks.length).toBeGreaterThan(0);

    // First tool call chunk should have function name
    expect(toolCallChunks[0]).toContain('"name":"get_weather"');

    // Last chunk should be [DONE]
    expect(chunks[chunks.length - 1]).toBe('data: [DONE]\n\n');
  });

  it('should include finish_reason tool_calls', async () => {
    const chunks: string[] = [];

    for await (const chunk of generateMockToolCallStream('func', '{}', { delayMs: 0 })) {
      chunks.push(chunk);
    }

    // Second to last chunk should have finish_reason
    const secondToLast = chunks[chunks.length - 2];
    expect(secondToLast).toContain('"finish_reason":"tool_calls"');
  });
});

describe('generateErrorResponse', () => {
  it('should generate OpenAI-compatible error JSON', () => {
    const response = generateErrorResponse('Invalid API key', 'authentication_error');
    const parsed = JSON.parse(response);

    expect(parsed.error).toBeDefined();
    expect(parsed.error.message).toBe('Invalid API key');
    expect(parsed.error.type).toBe('authentication_error');
  });

  it('should use default error type', () => {
    const response = generateErrorResponse('Something went wrong');
    const parsed = JSON.parse(response);

    expect(parsed.error.type).toBe('invalid_request_error');
  });

  it('should include code if provided', () => {
    const response = generateErrorResponse(
      'Rate limited',
      'rate_limit_error',
      'rate_limit_exceeded'
    );
    const parsed = JSON.parse(response);

    expect(parsed.error.code).toBe('rate_limit_exceeded');
  });
});

describe('generateNonStreamingResponse', () => {
  it('should generate valid non-streaming text response', () => {
    const response = generateNonStreamingResponse('Hello world') as {
      id: string;
      object: string;
      choices: Array<{
        message: { role: string; content: string | null };
        finish_reason: string;
      }>;
    };

    expect(response.id).toContain('chatcmpl-mock-');
    expect(response.object).toBe('chat.completion');
    expect(response.choices).toHaveLength(1);
    expect(response.choices[0].message.role).toBe('assistant');
    expect(response.choices[0].message.content).toBe('Hello world');
    expect(response.choices[0].finish_reason).toBe('stop');
  });

  it('should generate valid non-streaming tool call response', () => {
    const toolCalls = [
      {
        id: 'call_123',
        type: 'function' as const,
        function: {
          name: 'get_weather',
          arguments: '{"location":"SF"}',
        },
      },
    ];

    const response = generateNonStreamingResponse(null, toolCalls) as {
      choices: Array<{
        message: {
          role: string;
          content: string | null;
          tool_calls?: typeof toolCalls;
        };
        finish_reason: string;
      }>;
    };

    expect(response.choices[0].message.content).toBeNull();
    expect(response.choices[0].message.tool_calls).toHaveLength(1);
    expect(response.choices[0].message.tool_calls?.[0].function.name).toBe('get_weather');
    expect(response.choices[0].finish_reason).toBe('tool_calls');
  });

  it('should include usage object', () => {
    const response = generateNonStreamingResponse('Hello') as {
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    };

    expect(response.usage).toBeDefined();
    expect(response.usage.prompt_tokens).toBe(0);
    expect(response.usage.completion_tokens).toBe(0);
    expect(response.usage.total_tokens).toBe(0);
  });

  it('should use provided model', () => {
    const response = generateNonStreamingResponse('Hello', undefined, 'gpt-4-turbo') as {
      model: string;
    };

    expect(response.model).toBe('gpt-4-turbo');
  });
});

describe('parseMockContent', () => {
  it('should parse text content', () => {
    const result = parseMockContent('Hello world');

    expect(result.type).toBe('text');
    expect(result.content).toBe('Hello world');
  });

  it('should parse error content', () => {
    const result = parseMockContent('ERROR: Service unavailable');

    expect(result.type).toBe('error');
    expect(result.content).toBe('Service unavailable');
  });

  it('should parse tool call JSON', () => {
    const result = parseMockContent(
      JSON.stringify({
        function: 'get_weather',
        arguments: { location: 'SF' },
      })
    );

    expect(result.type).toBe('tool_call');
    expect(result.functionName).toBe('get_weather');
    expect(result.content).toBe('{"location":"SF"}');
  });

  it('should treat invalid JSON as text', () => {
    const result = parseMockContent('{ not valid json }');

    expect(result.type).toBe('text');
    expect(result.content).toBe('{ not valid json }');
  });

  it('should treat JSON without function key as text', () => {
    const result = parseMockContent('{"key": "value"}');

    expect(result.type).toBe('text');
  });

  it('should trim whitespace', () => {
    const result = parseMockContent('  Hello  ');

    expect(result.content).toBe('Hello');
  });
});
