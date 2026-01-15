import { useState } from 'react';
import type { RequestSession } from '@playingpack/shared';
import { wsManager } from '../lib/websocket';
import { trpc } from '../lib/trpc';
import { SourceBadge } from './SourceBadge';

interface RequestDetailProps {
  session: RequestSession;
}

export function RequestDetail({ session }: RequestDetailProps) {
  const [mockContent, setMockContent] = useState('');
  const [showMockInput, setShowMockInput] = useState(false);
  const [showRawRequest, setShowRawRequest] = useState(false);
  const [showRawResponse, setShowRawResponse] = useState(false);
  const [expandedMessages, setExpandedMessages] = useState<Set<number>>(new Set());

  const point1Mutation = trpc.point1Action.useMutation();
  const point2Mutation = trpc.point2Action.useMutation();

  // Point 1 handlers
  const handleCallLLM = () => {
    point1Mutation.mutate({ requestId: session.id, action: { action: 'llm' } });
    wsManager.sendPoint1Action(session.id, { action: 'llm' });
  };

  const handleUseCache = () => {
    point1Mutation.mutate({ requestId: session.id, action: { action: 'cache' } });
    wsManager.sendPoint1Action(session.id, { action: 'cache' });
  };

  const handleMock = () => {
    if (!showMockInput) {
      setShowMockInput(true);
      return;
    }
    point1Mutation.mutate({
      requestId: session.id,
      action: { action: 'mock', content: mockContent },
    });
    wsManager.sendPoint1Action(session.id, { action: 'mock', content: mockContent });
    setShowMockInput(false);
  };

  // Point 2 handlers
  const handleReturn = () => {
    point2Mutation.mutate({ requestId: session.id, action: { action: 'return' } });
    wsManager.sendPoint2Action(session.id, { action: 'return' });
  };

  const handleModify = () => {
    if (!showMockInput) {
      setShowMockInput(true);
      return;
    }
    point2Mutation.mutate({
      requestId: session.id,
      action: { action: 'modify', content: mockContent },
    });
    wsManager.sendPoint2Action(session.id, { action: 'modify', content: mockContent });
    setShowMockInput(false);
  };

  const duration = getDuration(session);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-pp-light">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <code className="text-sm text-gray-400">{session.id.slice(0, 8)}</code>
            <CopyButton text={session.id} size="sm" />
          </div>
          <StateBadge state={session.state} />
          {session.responseSource && <SourceBadge source={session.responseSource} />}
          {duration && (
            <span className="px-2 py-0.5 bg-blue-900/50 text-blue-400 text-xs rounded">
              {duration}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(session.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Intervention Point 1 */}
      {session.state === 'pending' && (
        <div className="p-4 bg-orange-950/30 border-b border-orange-900/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-orange-400">Intervention Point 1</span>
            <span className="text-xs text-gray-500">— Choose how to respond</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleCallLLM}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium transition-colors"
            >
              Call LLM
            </button>
            <button
              onClick={handleUseCache}
              disabled={!session.cacheAvailable}
              className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
                session.cacheAvailable
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-gray-800 text-gray-600 cursor-not-allowed'
              }`}
            >
              Use Cache
            </button>
            <button
              onClick={handleMock}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded font-medium transition-colors"
            >
              {showMockInput ? 'Send Mock' : 'Mock...'}
            </button>
          </div>

          {showMockInput && (
            <div className="mt-3">
              <textarea
                value={mockContent}
                onChange={(e) => setMockContent(e.target.value)}
                placeholder="Enter mock response content..."
                className="w-full h-24 p-3 bg-pp-darker border border-pp-light rounded text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-purple-500"
              />
              <p className="mt-1 text-xs text-gray-500">
                Prefix with <code className="text-purple-400">TOOL:function_name</code> for tool
                calls, or <code className="text-red-400">ERROR:</code> for errors
              </p>
            </div>
          )}
        </div>
      )}

      {/* Intervention Point 2 */}
      {session.state === 'reviewing' && (
        <div className="p-4 bg-amber-950/30 border-b border-amber-900/50">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-amber-400">Intervention Point 2</span>
            <span className="text-xs text-gray-500">— Review response before returning</span>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReturn}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded font-medium transition-colors"
            >
              Return Response
            </button>
            <button
              onClick={handleModify}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded font-medium transition-colors"
            >
              {showMockInput ? 'Send Modified' : 'Modify...'}
            </button>
          </div>

          {showMockInput && (
            <div className="mt-3">
              <textarea
                value={mockContent}
                onChange={(e) => setMockContent(e.target.value)}
                placeholder="Enter modified response content..."
                className="w-full h-24 p-3 bg-pp-darker border border-pp-light rounded text-sm text-gray-200 font-mono resize-none focus:outline-none focus:border-purple-500"
              />
            </div>
          )}
        </div>
      )}

      {/* Processing indicator */}
      {session.state === 'processing' && (
        <div className="p-4 bg-blue-950/30 border-b border-blue-900/50">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm text-blue-400">Getting response...</span>
          </div>
        </div>
      )}

      {/* Content - Side by Side */}
      <div className="flex-1 flex min-h-0">
        {/* Request Section (Left) */}
        <div className="flex-1 overflow-auto p-4 border-r border-pp-light">
          <div className="bg-pp-gray rounded">
            <div className="p-3 border-b border-pp-light">
              <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                Request
              </span>
            </div>
            <div className="p-3 space-y-3">
              {/* Summary row */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <Row label="Model" value={session.request.model} />
                <Row label="Stream" value={session.request.stream ? 'true' : 'false'} />
                {session.request.temperature !== undefined && (
                  <Row label="Temp" value={String(session.request.temperature)} />
                )}
                {session.request.maxTokens !== undefined && (
                  <Row label="Max tokens" value={String(session.request.maxTokens)} />
                )}
              </div>

              {/* Tools */}
              {session.request.tools && session.request.tools.length > 0 && (
                <CollapsibleSection
                  title={`Tools (${session.request.tools.length})`}
                  defaultOpen={false}
                  nested
                >
                  <div className="space-y-1">
                    {(session.request.tools as Array<{ function?: { name?: string } }>).map(
                      (tool, i) => (
                        <div key={i} className="text-xs text-purple-400 font-mono">
                          {tool.function?.name || `tool_${i}`}
                        </div>
                      )
                    )}
                  </div>
                </CollapsibleSection>
              )}

              {/* Messages */}
              {session.request.messages && session.request.messages.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-gray-500">
                      Messages ({session.request.messages.length})
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(session.request.messages as Array<ChatMessage>).map((msg, i) => (
                      <MessageDisplay
                        key={i}
                        msg={msg}
                        isExpanded={expandedMessages.has(i)}
                        onToggleExpand={() => {
                          const next = new Set(expandedMessages);
                          if (expandedMessages.has(i)) next.delete(i);
                          else next.add(i);
                          setExpandedMessages(next);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Raw JSON toggle */}
              <div className="pt-3 border-t border-pp-light">
                <button
                  onClick={() => setShowRawRequest(!showRawRequest)}
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  {showRawRequest ? 'Hide' : 'View'} Raw JSON
                </button>
                {showRawRequest && (
                  <div className="mt-2 relative">
                    <pre className="p-3 bg-pp-darker rounded text-xs text-gray-300 whitespace-pre-wrap max-h-96 overflow-auto">
                      {JSON.stringify(session.request.raw, null, 2)}
                    </pre>
                    <div className="absolute top-2 right-2">
                      <CopyButton text={JSON.stringify(session.request.raw, null, 2)} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Response Section (Right) */}
        <div className="flex-1 overflow-auto p-4">
          {session.response ? (
            <div className="bg-pp-gray rounded">
              <div className="p-3 border-b border-pp-light">
                <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">
                  Response
                </span>
              </div>
              <div className="p-3 space-y-3">
                {/* Summary row */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                  <Row label="Status" value={String(session.response.status)} />
                  {session.response.finishReason && (
                    <Row label="Finish" value={session.response.finishReason} />
                  )}
                </div>

                {/* Token usage */}
                {session.response.usage && <TokenDisplay usage={session.response.usage} />}

                {/* Content */}
                {session.response.content && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">Content</span>
                      <CopyButton text={session.response.content} size="xs" />
                    </div>
                    <pre className="p-3 bg-pp-darker rounded text-sm text-gray-200 whitespace-pre-wrap max-h-96 overflow-auto">
                      {session.response.content}
                    </pre>
                  </div>
                )}

                {/* Tool Calls */}
                {session.response.toolCalls && session.response.toolCalls.length > 0 && (
                  <div>
                    <div className="text-xs text-gray-500 mb-2">Tool Calls</div>
                    <div className="space-y-2">
                      {session.response.toolCalls.map((tc, i) => (
                        <div key={i} className="p-3 bg-pp-darker rounded">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-purple-400 font-medium">{tc.name}</span>
                              <code className="text-xs text-gray-500">{tc.id}</code>
                            </div>
                            <CopyButton text={formatJson(tc.arguments)} size="xs" />
                          </div>
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                            {formatJson(tc.arguments)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Raw JSON toggle */}
                <div className="pt-3 border-t border-pp-light">
                  <button
                    onClick={() => setShowRawResponse(!showRawResponse)}
                    className="text-xs text-gray-500 hover:text-gray-300"
                  >
                    {showRawResponse ? 'Hide' : 'View'} Raw JSON
                  </button>
                  {showRawResponse && (
                    <div className="mt-2 relative">
                      <pre className="p-3 bg-pp-darker rounded text-xs text-gray-300 whitespace-pre-wrap max-h-96 overflow-auto">
                        {JSON.stringify(session.response, null, 2)}
                      </pre>
                      <div className="absolute top-2 right-2">
                        <CopyButton text={JSON.stringify(session.response, null, 2)} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-pp-gray rounded p-6 text-center">
              <span className="text-gray-500 text-sm">
                {session.state === 'pending' && 'Waiting for action...'}
                {session.state === 'processing' && 'Processing request...'}
                {!session.response && session.state === 'complete' && 'No response'}
              </span>
            </div>
          )}

          {/* Error */}
          {session.error && (
            <div className="mt-4 p-3 bg-red-950/30 border border-red-900/50 rounded">
              <div className="text-xs text-red-400 font-medium mb-1">Error</div>
              <div className="text-sm text-red-300">{session.error}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Types
// ============================================================================

interface ChatMessage {
  role: string;
  content?: unknown;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: {
      name: string;
      arguments: string;
    };
  }>;
  tool_call_id?: string;
  name?: string;
}

// ============================================================================
// Helper Components
// ============================================================================

function MessageDisplay({
  msg,
  isExpanded,
  onToggleExpand,
}: {
  msg: ChatMessage;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const roleColors: Record<string, string> = {
    user: 'text-blue-400',
    assistant: 'text-green-400',
    system: 'text-yellow-400',
    tool: 'text-purple-400',
  };

  const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
  const content = formatMessageContent(msg.content);
  const isLong =
    content.length > 300 || (hasToolCalls && JSON.stringify(msg.tool_calls).length > 300);

  return (
    <div className="p-2 bg-pp-darker rounded text-xs">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${roleColors[msg.role] || 'text-gray-400'}`}>
            {msg.role}
          </span>
          {msg.role === 'tool' && msg.name && (
            <code className="text-purple-400 text-[10px]">{msg.name}</code>
          )}
          {msg.role === 'tool' && msg.tool_call_id && (
            <code className="text-gray-500 text-[10px]">{msg.tool_call_id.slice(0, 12)}...</code>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isLong && (
            <button onClick={onToggleExpand} className="text-gray-500 hover:text-gray-300 text-xs">
              {isExpanded ? 'Collapse' : 'Expand'}
            </button>
          )}
          <CopyButton text={JSON.stringify(msg, null, 2)} size="xs" />
        </div>
      </div>

      {/* Content */}
      {content && (
        <pre className="text-gray-300 whitespace-pre-wrap overflow-hidden">
          {isExpanded || !isLong ? content : content.slice(0, 300) + '...'}
        </pre>
      )}

      {/* Tool Calls (for assistant messages) */}
      {hasToolCalls && (
        <div className="mt-2 space-y-1">
          {msg.tool_calls!.map((tc, i) => (
            <div key={i} className="p-2 bg-pp-gray rounded border-l-2 border-purple-500">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-purple-400 font-medium">{tc.function.name}</span>
                <code className="text-gray-500 text-[10px]">{tc.id.slice(0, 12)}...</code>
              </div>
              <pre className="text-gray-400 whitespace-pre-wrap text-[10px]">
                {isExpanded
                  ? formatJson(tc.function.arguments)
                  : tc.function.arguments.slice(0, 100) +
                    (tc.function.arguments.length > 100 ? '...' : '')}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-orange-900/50', text: 'text-orange-400', label: 'Paused' },
    processing: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: 'Calling' },
    reviewing: { bg: 'bg-amber-900/50', text: 'text-amber-400', label: 'Review' },
    complete: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Done' },
    error: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Error' },
  };

  const { bg, text, label } = config[state] || config.processing;

  return <span className={`px-2 py-0.5 ${bg} ${text} text-xs rounded`}>{label}</span>;
}

function CollapsibleSection({
  title,
  defaultOpen = true,
  nested = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  nested?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={nested ? '' : 'bg-pp-gray rounded'}>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-2 w-full text-left ${nested ? 'py-1' : 'p-3'}`}
      >
        <span className={`text-gray-500 transition-transform text-xs ${open ? 'rotate-90' : ''}`}>
          ▶
        </span>
        <span
          className={`font-medium ${nested ? 'text-xs text-gray-400' : 'text-xs text-gray-400 uppercase tracking-wide'}`}
        >
          {title}
        </span>
      </button>
      {open && <div className={nested ? 'pl-4' : 'px-3 pb-3'}>{children}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-gray-500">{label}:</span>
      <span className="text-gray-200 font-mono">{value}</span>
    </div>
  );
}

function CopyButton({ text, size = 'sm' }: { text: string; size?: 'xs' | 'sm' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API might not be available
    }
  };

  const sizeClasses = size === 'xs' ? 'text-[10px] px-1' : 'text-xs px-1.5';

  return (
    <button
      onClick={handleCopy}
      className={`${sizeClasses} py-0.5 text-gray-500 hover:text-gray-300 hover:bg-pp-light rounded transition-colors`}
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}

function TokenDisplay({
  usage,
}: {
  usage: { promptTokens: number; completionTokens: number; totalTokens: number };
}) {
  // Rough GPT-4 pricing: $0.03/1K input, $0.06/1K output (adjust as needed)
  const cost = usage.promptTokens * 0.00003 + usage.completionTokens * 0.00006;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs p-2 bg-pp-darker rounded">
      <span className="text-gray-400">
        Prompt: <span className="text-gray-200">{usage.promptTokens.toLocaleString()}</span>
      </span>
      <span className="text-gray-400">
        Completion: <span className="text-gray-200">{usage.completionTokens.toLocaleString()}</span>
      </span>
      <span className="text-gray-400">
        Total: <span className="text-gray-200">{usage.totalTokens.toLocaleString()}</span>
      </span>
      <span className="text-gray-400">
        ~<span className="text-green-400">${cost.toFixed(4)}</span>
      </span>
    </div>
  );
}

// ============================================================================
// Helper Functions
// ============================================================================

function getDuration(session: RequestSession): string | null {
  if (!session.processingStartedAt || !session.completedAt) return null;
  const start = new Date(session.processingStartedAt).getTime();
  const end = new Date(session.completedAt).getTime();
  const ms = end - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

function formatMessageContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (content === null || content === undefined) return '';
  return JSON.stringify(content, null, 2);
}
