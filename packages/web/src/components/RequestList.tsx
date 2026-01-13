import { useRequestStore } from '../stores/requestStore';
import { RequestItem } from './RequestItem';

export function RequestList() {
  const sessions = useRequestStore((s) => s.getSortedSessions());
  const selectedId = useRequestStore((s) => s.selectedId);
  const selectSession = useRequestStore((s) => s.selectSession);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-gray-500">
        <svg
          className="w-12 h-12 mb-4 opacity-50"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <p className="text-sm">No requests yet</p>
        <p className="text-xs mt-1">
          Point your AI agent to{' '}
          <code className="bg-pp-gray px-1 rounded">
            localhost:{window.location.port || '4747'}/v1
          </code>
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto h-full">
      {sessions.map((session) => (
        <RequestItem
          key={session.id}
          session={session}
          selected={session.id === selectedId}
          onClick={() => selectSession(session.id)}
        />
      ))}
    </div>
  );
}
