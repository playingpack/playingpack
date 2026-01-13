import { useState } from 'react';
import type { RequestSession } from '@playingpack/shared';
import { StatusBadge } from './StatusBadge';

interface InspectorProps {
  session: RequestSession;
}

type Tab = 'request' | 'response' | 'tools';

export function Inspector({ session }: InspectorProps) {
  const [activeTab, setActiveTab] = useState<Tab>('request');

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'request', label: 'Request' },
    { id: 'response', label: 'Response' },
    { id: 'tools', label: 'Tools', count: session.toolCalls.length },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-pp-light">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-gray-400">
              {session.id.slice(0, 8)}
            </span>
            <StatusBadge state={session.state} statusCode={session.statusCode} cached={session.cached} />
          </div>
          <span className="text-xs text-gray-500">
            {new Date(session.timestamp).toLocaleString()}
          </span>
        </div>
        <div className="text-sm">
          <span className="text-gray-500">{session.method}</span>
          <span className="ml-2 text-gray-300">{session.path}</span>
          {session.model && (
            <span className="ml-2 px-2 py-0.5 bg-pp-gray rounded text-xs text-gray-400">
              {session.model}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-pp-light bg-pp-darker">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              px-4 py-2 text-sm font-medium transition-colors
              ${activeTab === tab.id
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-gray-500 hover:text-gray-300'
              }
            `}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 bg-purple-900/50 text-purple-300 rounded text-xs">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'request' && (
          <JsonViewer data={session.body} />
        )}
        {activeTab === 'response' && (
          <div className="space-y-4">
            {session.responseContent ? (
              <div className="bg-pp-gray rounded p-4">
                <div className="text-xs text-gray-500 mb-2">Content</div>
                <pre className="text-sm text-gray-200 whitespace-pre-wrap">
                  {session.responseContent}
                </pre>
              </div>
            ) : (
              <div className="text-gray-500 text-sm">No response content yet</div>
            )}
          </div>
        )}
        {activeTab === 'tools' && (
          <div className="space-y-4">
            {session.toolCalls.length === 0 ? (
              <div className="text-gray-500 text-sm">No tool calls detected</div>
            ) : (
              session.toolCalls.map((tc, i) => (
                <div key={i} className="bg-pp-gray rounded p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-purple-400 font-medium">{tc.name}</span>
                    <span className="text-xs text-gray-500">id: {tc.id}</span>
                  </div>
                  <div className="text-xs text-gray-500 mb-1">Arguments</div>
                  <JsonViewer data={tryParseJson(tc.arguments)} />
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface JsonViewerProps {
  data: unknown;
}

function JsonViewer({ data }: JsonViewerProps) {
  const formatted = JSON.stringify(data, null, 2);

  return (
    <pre className="text-sm font-mono overflow-auto bg-pp-darker rounded p-4">
      <code>{formatJson(formatted)}</code>
    </pre>
  );
}

function formatJson(json: string): React.ReactNode {
  return json.split('\n').map((line, i) => (
    <div key={i}>
      {line
        .replace(/"([^"]+)":/g, '<key>"$1"</key>:')
        .replace(/: "([^"]*)"/g, ': <string>"$1"</string>')
        .replace(/: (\d+)/g, ': <number>$1</number>')
        .replace(/: (true|false)/g, ': <boolean>$1</boolean>')
        .replace(/: (null)/g, ': <null>$1</null>')
        .split(/(<[^>]+>[^<]*<\/[^>]+>)/)
        .map((part, j) => {
          if (part.startsWith('<key>')) {
            return <span key={j} className="json-key">{part.slice(5, -6)}</span>;
          }
          if (part.startsWith('<string>')) {
            return <span key={j} className="json-string">{part.slice(8, -9)}</span>;
          }
          if (part.startsWith('<number>')) {
            return <span key={j} className="json-number">{part.slice(8, -9)}</span>;
          }
          if (part.startsWith('<boolean>')) {
            return <span key={j} className="json-boolean">{part.slice(9, -10)}</span>;
          }
          if (part.startsWith('<null>')) {
            return <span key={j} className="json-null">{part.slice(6, -7)}</span>;
          }
          return part;
        })}
    </div>
  ));
}

function tryParseJson(str: string): unknown {
  try {
    return JSON.parse(str);
  } catch {
    return str;
  }
}
