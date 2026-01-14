import { useState } from 'react';
import type { RequestSession } from '@playingpack/shared';
import { wsManager } from '../lib/websocket';
import { trpc } from '../lib/trpc';

interface RequestDetailProps {
  session: RequestSession;
}

export function RequestDetail({ session }: RequestDetailProps) {
  const [mockContent, setMockContent] = useState('');
  const [showMockInput, setShowMockInput] = useState(false);

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

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-pp-light">
        <div className="flex items-center gap-3">
          <code className="text-sm text-gray-500">{session.id.slice(0, 8)}</code>
          <StateBadge state={session.state} />
          {session.cacheHit && (
            <span className="px-2 py-0.5 bg-teal-900/50 text-teal-400 text-xs rounded">cached</span>
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
              disabled={!session.cacheHit}
              className={`px-4 py-2 text-sm rounded font-medium transition-colors ${
                session.cacheHit
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

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* Request Section */}
        <Section title="Request">
          <div className="space-y-2">
            <Row label="Model" value={session.request.model} />
            <Row label="Stream" value={session.request.stream ? 'true' : 'false'} />
          </div>

          {session.request.messages && session.request.messages.length > 0 && (
            <div className="mt-3">
              <div className="text-xs text-gray-500 mb-2">
                Messages ({session.request.messages.length})
              </div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {(session.request.messages as Array<{ role: string; content: string }>)
                  .slice(-3)
                  .map((msg, i) => (
                    <div key={i} className="p-2 bg-pp-darker rounded text-xs">
                      <span
                        className={`font-medium ${
                          msg.role === 'user'
                            ? 'text-blue-400'
                            : msg.role === 'assistant'
                              ? 'text-green-400'
                              : 'text-gray-400'
                        }`}
                      >
                        {msg.role}
                      </span>
                      <pre className="mt-1 text-gray-300 whitespace-pre-wrap overflow-hidden">
                        {typeof msg.content === 'string'
                          ? msg.content.slice(0, 500) + (msg.content.length > 500 ? '...' : '')
                          : JSON.stringify(msg.content, null, 2).slice(0, 500)}
                      </pre>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Section>

        {/* Response Section */}
        {session.response && (
          <Section title="Response" className="mt-4">
            {session.response.content && (
              <div>
                <div className="text-xs text-gray-500 mb-2">Content</div>
                <pre className="p-3 bg-pp-darker rounded text-sm text-gray-200 whitespace-pre-wrap max-h-48 overflow-auto">
                  {session.response.content}
                </pre>
              </div>
            )}

            {session.response.toolCalls && session.response.toolCalls.length > 0 && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-2">Tool Calls</div>
                <div className="space-y-2">
                  {session.response.toolCalls.map((tc, i) => (
                    <div key={i} className="p-3 bg-pp-darker rounded">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-purple-400 font-medium">{tc.name}</span>
                        <code className="text-xs text-gray-500">{tc.id}</code>
                      </div>
                      <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                        {formatJson(tc.arguments)}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const config: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-orange-900/50', text: 'text-orange-400', label: 'Pending' },
    processing: { bg: 'bg-blue-900/50', text: 'text-blue-400', label: 'Processing' },
    reviewing: { bg: 'bg-amber-900/50', text: 'text-amber-400', label: 'Reviewing' },
    complete: { bg: 'bg-green-900/50', text: 'text-green-400', label: 'Complete' },
    error: { bg: 'bg-red-900/50', text: 'text-red-400', label: 'Error' },
  };

  const { bg, text, label } = config[state] || config.processing;

  return <span className={`px-2 py-0.5 ${bg} ${text} text-xs rounded`}>{label}</span>;
}

function Section({
  title,
  children,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">{title}</h3>
      <div className="bg-pp-gray rounded p-3">{children}</div>
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

function formatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}
