import { useState } from 'react';
import Editor from '@monaco-editor/react';
import type { RequestSession } from '@playingpack/shared';
import { wsManager } from '../lib/websocket';
import { trpc } from '../lib/trpc';

interface MockEditorProps {
  session: RequestSession;
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

  const allowMutation = trpc.allowRequest.useMutation();
  const mockMutation = trpc.mockRequest.useMutation();

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

  const handleTemplateChange = (template: 'text' | 'error' | 'toolCall') => {
    setSelectedTemplate(template);
    setMockContent(MOCK_TEMPLATES[template]);
  };

  if (session.state !== 'INTERCEPT') {
    return null;
  }

  return (
    <div className="border-t border-pp-light bg-pp-darker">
      <div className="p-4 border-b border-pp-light">
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
            <span className="text-sm font-medium text-amber-400">Request Paused</span>
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
