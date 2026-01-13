import { describe, it, expect, vi } from 'vitest';
import { SSEStreamParser, createSSEParser, parseSSEResponse } from '../proxy/sse-parser.js';

describe('SSEStreamParser', () => {
  it('should parse content chunks', () => {
    const onContent = vi.fn();
    const parser = new SSEStreamParser({ onContent });

    const chunk = JSON.stringify({
      id: 'test-1',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        delta: { content: 'Hello' },
        finish_reason: null,
      }],
    });

    parser.feed(`data: ${chunk}\n\n`);

    expect(onContent).toHaveBeenCalledWith('Hello');
    expect(parser.getContent()).toBe('Hello');
  });

  it('should accumulate multiple content chunks', () => {
    const parser = new SSEStreamParser();

    const chunks = ['Hello', ' ', 'World', '!'];

    for (const content of chunks) {
      const chunk = JSON.stringify({
        id: 'test-1',
        object: 'chat.completion.chunk',
        created: Date.now(),
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: { content },
          finish_reason: null,
        }],
      });
      parser.feed(`data: ${chunk}\n\n`);
    }

    expect(parser.getContent()).toBe('Hello World!');
  });

  it('should detect tool calls', () => {
    const onToolCall = vi.fn();
    const parser = new SSEStreamParser({ onToolCall });

    const chunk = JSON.stringify({
      id: 'test-1',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"loc',
            },
          }],
        },
        finish_reason: null,
      }],
    });

    parser.feed(`data: ${chunk}\n\n`);

    expect(onToolCall).toHaveBeenCalledWith({
      index: 0,
      id: 'call_123',
      name: 'get_weather',
      arguments: '{"loc',
    });
    expect(parser.hasToolCalls()).toBe(true);
  });

  it('should accumulate tool call arguments', () => {
    const onToolCallUpdate = vi.fn();
    const parser = new SSEStreamParser({ onToolCallUpdate });

    // First chunk with tool call start
    const chunk1 = JSON.stringify({
      id: 'test-1',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            id: 'call_123',
            type: 'function',
            function: {
              name: 'get_weather',
              arguments: '{"loc',
            },
          }],
        },
        finish_reason: null,
      }],
    });

    // Second chunk with more arguments
    const chunk2 = JSON.stringify({
      id: 'test-1',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        delta: {
          tool_calls: [{
            index: 0,
            function: {
              arguments: 'ation":"SF"}',
            },
          }],
        },
        finish_reason: null,
      }],
    });

    parser.feed(`data: ${chunk1}\n\n`);
    parser.feed(`data: ${chunk2}\n\n`);

    const toolCalls = parser.getToolCalls();
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]?.arguments).toBe('{"location":"SF"}');
    expect(onToolCallUpdate).toHaveBeenCalledWith(0, 'ation":"SF"}');
  });

  it('should handle [DONE] marker', () => {
    const onDone = vi.fn();
    const parser = new SSEStreamParser({ onDone });

    parser.feed('data: [DONE]\n\n');

    expect(onDone).toHaveBeenCalled();
  });

  it('should handle multiple tool calls', () => {
    const parser = new SSEStreamParser();

    const chunk = JSON.stringify({
      id: 'test-1',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        delta: {
          tool_calls: [
            {
              index: 0,
              id: 'call_1',
              type: 'function',
              function: { name: 'func1', arguments: '{}' },
            },
            {
              index: 1,
              id: 'call_2',
              type: 'function',
              function: { name: 'func2', arguments: '{}' },
            },
          ],
        },
        finish_reason: null,
      }],
    });

    parser.feed(`data: ${chunk}\n\n`);

    const toolCalls = parser.getToolCalls();
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0]?.name).toBe('func1');
    expect(toolCalls[1]?.name).toBe('func2');
  });

  it('should reset state', () => {
    const parser = new SSEStreamParser();

    const chunk = JSON.stringify({
      id: 'test-1',
      object: 'chat.completion.chunk',
      created: Date.now(),
      model: 'gpt-4',
      choices: [{
        index: 0,
        delta: { content: 'Hello' },
        finish_reason: null,
      }],
    });

    parser.feed(`data: ${chunk}\n\n`);
    expect(parser.getContent()).toBe('Hello');

    parser.reset();
    expect(parser.getContent()).toBe('');
    expect(parser.hasToolCalls()).toBe(false);
  });
});

describe('createSSEParser', () => {
  it('should create a parser instance', () => {
    const parser = createSSEParser();
    expect(parser).toBeInstanceOf(SSEStreamParser);
  });
});

describe('parseSSEResponse', () => {
  it('should parse complete response', () => {
    const data = `data: {"id":"test","object":"chat.completion.chunk","created":1234,"model":"gpt-4","choices":[{"index":0,"delta":{"content":"Hi"},"finish_reason":null}]}\n\ndata: [DONE]\n\n`;

    const result = parseSSEResponse(data);
    expect(result.content).toBe('Hi');
    expect(result.toolCalls).toHaveLength(0);
  });
});
