import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { wsManager } from '../lib/websocket';
import { trpc } from '../lib/trpc';
import type { ExtendedSession } from '../stores/requestStore';

interface MockEditorProps {
  session: ExtendedSession;
}

const MOCK_TEMPLATES = {
  text: `Hello! This is a mocked response from PlayingPack.`,
  error: `ERROR: Service temporarily unavailable`,
  toolCall: `{
  "function": "get_weather",
  "arguments": {
    "location": "San Francisco",
    "unit": "celsius"
  }
}`,
};

export function MockEditor({ session }: MockEditorProps) {
  const [mockContent, setMockContent] = useState(MOCK_TEMPLATES.text);
  const [selectedTemplate, setSelectedTemplate] = useState<'text' | 'error' | 'toolCall'>('text');

  // Post-intercept mutations (after LLM response)
  const allowMutation = trpc.allowRequest.useMutation();
  const mockMutation = trpc.mockRequest.useMutation();

  // Pre-intercept mutations (before LLM call)
  const preAllowMutation = trpc.preInterceptAllow.useMutation();
  const preUseCacheMutation = trpc.preInterceptUseCache.useMutation();
  const preMockMutation = trpc.preInterceptMock.useMutation();

  // Post-intercept handlers
  const handleAllow = () => {
    allowMutation.mutate({ requestId: session.id });
    wsManager.allowRequest(session.id);
  };

  const handleMock = () => {
    mockMutation.mutate({
      requestId: session.id,
      type: selectedTemplate === 'error' ? 'error' : 'text',
      content: mockContent,
    });
    wsManager.mockRequest(session.id, mockContent);
  };

  // Pre-intercept handlers
  const handlePreAllow = () => {
    preAllowMutation.mutate({ requestId: session.id });
    wsManager.preInterceptAllow(session.id);
  };

  const handlePreUseCache = () => {
    preUseCacheMutation.mutate({ requestId: session.id });
    wsManager.preInterceptUseCache(session.id);
  };

  const handlePreMock = () => {
    preMockMutation.mutate({ requestId: session.id, mockContent });
    wsManager.preInterceptMock(session.id, mockContent);
  };

  const handleTemplateChange = (template: 'text' | 'error' | 'toolCall') => {
    setSelectedTemplate(template);
    setMockContent(MOCK_TEMPLATES[template]);
  };

  // Pre-intercept UI (before LLM call)
  if (session.state === 'PAUSED') {
    const hasCachedResponse = session.preInterceptInfo?.hasCachedResponse ?? false;

    return (
      <div className="flex-shrink-0 border-t border-pp-light bg-pp-darker">
        <div className="p-4 border-b border-pp-light">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-orange-400">Request Pending</span>
            </div>
            <div className="text-sm text-gray-400">Waiting to send to LLM</div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={handlePreAllow}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
            >
              Send to LLM
            </button>
            <button
              onClick={handlePreUseCache}
              disabled={!hasCachedResponse}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                hasCachedResponse
                  ? 'bg-teal-600 hover:bg-teal-700 text-white'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              title={hasCachedResponse ? 'Use cached response' : 'No cached response available'}
            >
              Use Cache
            </button>
            <button
              onClick={handlePreMock}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition-colors"
            >
              Mock Response
            </button>
          </div>

          {hasCachedResponse && (
            <div className="text-xs text-teal-400 mb-3">Cached response available</div>
          )}

          <div className="flex gap-2 mb-3">
            <span className="text-xs text-gray-500">Mock templates:</span>
            {(['text', 'error', 'toolCall'] as const).map((template) => (
              <button
                key={template}
                onClick={() => handleTemplateChange(template)}
                className={`
                  px-2 py-1 text-xs rounded transition-colors
                  ${
                    selectedTemplate === template
                      ? 'bg-blue-600 text-white'
                      : 'bg-pp-gray text-gray-400 hover:bg-pp-light'
                  }
                `}
              >
                {template === 'toolCall'
                  ? 'Tool Call'
                  : template.charAt(0).toUpperCase() + template.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="h-48">
          <Editor
            height="100%"
            defaultLanguage={selectedTemplate === 'toolCall' ? 'json' : 'plaintext'}
            value={mockContent}
            onChange={(value) => setMockContent(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'none',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              scrollbar: {
                vertical: 'auto',
                horizontal: 'hidden',
              },
            }}
          />
        </div>
      </div>
    );
  }

  // Post-intercept UI (after LLM response with tool call)
  if (session.state === 'TOOL_CALL') {
    return (
      <div className="flex-shrink-0 border-t border-pp-light bg-pp-darker">
        <div className="p-4 border-b border-pp-light">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-amber-400">Response Paused</span>
            </div>

            {session.toolCalls.length > 0 && (
              <div className="text-sm text-gray-400">
                Tool call: <span className="text-purple-400">{session.toolCalls[0]?.name}</span>
              </div>
            )}
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={handleAllow}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium transition-colors"
            >
              Allow & Continue
            </button>
            <button
              onClick={handleMock}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium transition-colors"
            >
              Send Mock Response
            </button>
          </div>

          <div className="flex gap-2 mb-3">
            <span className="text-xs text-gray-500">Templates:</span>
            {(['text', 'error', 'toolCall'] as const).map((template) => (
              <button
                key={template}
                onClick={() => handleTemplateChange(template)}
                className={`
                  px-2 py-1 text-xs rounded transition-colors
                  ${
                    selectedTemplate === template
                      ? 'bg-blue-600 text-white'
                      : 'bg-pp-gray text-gray-400 hover:bg-pp-light'
                  }
                `}
              >
                {template === 'toolCall'
                  ? 'Tool Call'
                  : template.charAt(0).toUpperCase() + template.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="h-64">
          <Editor
            height="100%"
            defaultLanguage={selectedTemplate === 'toolCall' ? 'json' : 'plaintext'}
            value={mockContent}
            onChange={(value) => setMockContent(value || '')}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'off',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 },
              renderLineHighlight: 'none',
              overviewRulerLanes: 0,
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              scrollbar: {
                vertical: 'auto',
                horizontal: 'hidden',
              },
            }}
          />
        </div>
      </div>
    );
  }

  // Inactive state - always show panel at bottom
  const statusConfig = {
    COMPLETE: { label: 'Request Completed', color: 'text-green-500', dot: 'bg-green-500' },
    STREAMING: {
      label: 'Streaming Response...',
      color: 'text-blue-400',
      dot: 'bg-blue-400 animate-pulse',
    },
    ERROR: { label: 'Request Error', color: 'text-red-500', dot: 'bg-red-500' },
    REPLAY: { label: 'Replaying from Cache', color: 'text-teal-400', dot: 'bg-teal-400' },
    LOOKUP: {
      label: 'Looking up Cache...',
      color: 'text-gray-400',
      dot: 'bg-gray-400 animate-pulse',
    },
    CONNECT: { label: 'Connecting...', color: 'text-gray-400', dot: 'bg-gray-400 animate-pulse' },
    FLUSH: {
      label: 'Flushing Response...',
      color: 'text-gray-400',
      dot: 'bg-gray-400 animate-pulse',
    },
    INJECT: {
      label: 'Injecting Mock...',
      color: 'text-purple-400',
      dot: 'bg-purple-400 animate-pulse',
    },
  } as const;

  const status = statusConfig[session.state as keyof typeof statusConfig] || {
    label: 'Processing...',
    color: 'text-gray-500',
    dot: 'bg-gray-500',
  };

  return (
    <div className="flex-shrink-0 border-t border-pp-light bg-pp-darker">
      <div className="p-4">
        <div className="flex items-center gap-2">
          <span className={`w-3 h-3 rounded-full ${status.dot}`} />
          <span className={`text-sm font-medium ${status.color}`}>{status.label}</span>
        </div>
        <p className="mt-2 text-xs text-gray-600">
          Actions available when request is paused for interception.
        </p>
      </div>
    </div>
  );
}
