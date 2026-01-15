import { createParser, type ParsedEvent, type ReconnectInterval } from 'eventsource-parser';
import type { ToolCall } from '@playingpack/shared';

/**
 * Internal tool call with index for tracking during streaming
 */
interface InternalToolCall extends ToolCall {
  index: number;
}

/**
 * OpenAI SSE chunk delta structure
 */
interface ChunkDelta {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: string;
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

/**
 * OpenAI usage data (included when stream_options.include_usage is true)
 */
export interface SSEUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * OpenAI SSE chunk structure
 */
interface SSEChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: ChunkDelta;
    finish_reason: string | null;
  }>;
  usage?: SSEUsage;
}

/**
 * Callback types for SSE parsing events
 */
export interface SSECallbacks {
  onContent?: (content: string) => void;
  onToolCall?: (toolCall: ToolCall) => void;
  onToolCallUpdate?: (index: number, argumentChunk: string) => void;
  onFinishReason?: (reason: string) => void;
  onUsage?: (usage: SSEUsage) => void;
  onDone?: () => void;
  onError?: (error: Error) => void;
}

/**
 * SSEStreamParser - Parses OpenAI streaming responses
 * Detects content, tool calls, and stream completion
 */
export class SSEStreamParser {
  private callbacks: SSECallbacks;
  private toolCalls: Map<number, InternalToolCall> = new Map();
  private accumulatedContent: string = '';
  private finishReason: string | null = null;
  private usage: SSEUsage | null = null;
  private parser: ReturnType<typeof createParser>;

  constructor(callbacks: SSECallbacks = {}) {
    this.callbacks = callbacks;

    this.parser = createParser((event: ParsedEvent | ReconnectInterval) => {
      if (event.type === 'event') {
        this.handleEvent(event.data);
      }
    });
  }

  /**
   * Feed raw SSE data to the parser
   */
  feed(data: string): void {
    this.parser.feed(data);
  }

  /**
   * Get accumulated content
   */
  getContent(): string {
    return this.accumulatedContent;
  }

  /**
   * Get all detected tool calls
   */
  getToolCalls(): ToolCall[] {
    return Array.from(this.toolCalls.values());
  }

  /**
   * Check if any tool calls were detected
   */
  hasToolCalls(): boolean {
    return this.toolCalls.size > 0;
  }

  /**
   * Get the finish reason from the response
   */
  getFinishReason(): string | null {
    return this.finishReason;
  }

  /**
   * Get token usage from the response
   */
  getUsage(): SSEUsage | null {
    return this.usage;
  }

  /**
   * Get the assembled message object (OpenAI format)
   */
  getAssembledMessage(): {
    role: 'assistant';
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: 'function';
      function: {
        name: string;
        arguments: string;
      };
    }>;
  } {
    const toolCalls = this.getToolCalls();

    if (toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: null,
        tool_calls: toolCalls.map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: {
            name: tc.name,
            arguments: tc.arguments,
          },
        })),
      };
    }

    return {
      role: 'assistant',
      content: this.accumulatedContent || null,
    };
  }

  /**
   * Reset parser state
   */
  reset(): void {
    this.toolCalls.clear();
    this.accumulatedContent = '';
    this.finishReason = null;
    this.usage = null;
    this.parser.reset();
  }

  private handleEvent(data: string): void {
    // Handle stream end
    if (data === '[DONE]') {
      this.callbacks.onDone?.();
      return;
    }

    try {
      const chunk = JSON.parse(data) as SSEChunk;

      for (const choice of chunk.choices) {
        const delta = choice.delta;

        // Handle content
        if (delta.content) {
          this.accumulatedContent += delta.content;
          this.callbacks.onContent?.(delta.content);
        }

        // Handle tool calls
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = this.toolCalls.get(tc.index);

            if (!existing) {
              // New tool call
              const toolCall: InternalToolCall = {
                index: tc.index,
                id: tc.id || '',
                name: tc.function?.name || '',
                arguments: tc.function?.arguments || '',
              };
              this.toolCalls.set(tc.index, toolCall);
              this.callbacks.onToolCall?.(toolCall);
            } else {
              // Update existing tool call
              if (tc.function?.arguments) {
                existing.arguments += tc.function.arguments;
                this.callbacks.onToolCallUpdate?.(tc.index, tc.function.arguments);
              }
            }
          }
        }

        // Handle finish reason (appears in final chunk)
        if (choice.finish_reason && !this.finishReason) {
          this.finishReason = choice.finish_reason;
          this.callbacks.onFinishReason?.(choice.finish_reason);
        }
      }

      // Handle usage (appears in final chunk when stream_options.include_usage is true)
      if (chunk.usage && !this.usage) {
        this.usage = chunk.usage;
        this.callbacks.onUsage?.(chunk.usage);
      }
    } catch (error) {
      this.callbacks.onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Create a new SSE parser
 */
export function createSSEParser(callbacks?: SSECallbacks): SSEStreamParser {
  return new SSEStreamParser(callbacks);
}

/**
 * Parse a complete SSE response
 */
export function parseSSEResponse(data: string): {
  content: string;
  toolCalls: ToolCall[];
  finishReason: string | null;
  usage: SSEUsage | null;
} {
  const parser = new SSEStreamParser();
  parser.feed(data);

  return {
    content: parser.getContent(),
    toolCalls: parser.getToolCalls(),
    finishReason: parser.getFinishReason(),
    usage: parser.getUsage(),
  };
}
