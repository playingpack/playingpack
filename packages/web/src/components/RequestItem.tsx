import type { RequestSession } from '@playingpack/shared';
import { StatusBadge } from './StatusBadge';

interface RequestItemProps {
  session: RequestSession;
  selected: boolean;
  onClick: () => void;
}

export function RequestItem({ session, selected, onClick }: RequestItemProps) {
  const time = new Date(session.timestamp).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const shortId = session.id.slice(0, 8);

  // Determine left border color based on state
  const getBorderClass = () => {
    if (session.state === 'INTERCEPT') return 'border-l-amber-500';
    if (selected) return 'border-l-blue-500';
    return 'border-l-transparent';
  };

  return (
    <div
      className={`
        p-3 border-b border-pp-light cursor-pointer transition-all border-l-2
        ${getBorderClass()}
        ${selected ? 'bg-pp-gray' : 'hover:bg-pp-gray/50'}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 font-mono">{shortId}</span>
        <StatusBadge
          state={session.state}
          statusCode={session.statusCode}
          cached={session.cached}
        />
      </div>

      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400">{time}</span>
        <span className="text-sm text-gray-200 truncate">{session.model || 'unknown'}</span>
      </div>

      {session.toolCalls.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {session.toolCalls.map((tc, i) => (
            <span
              key={i}
              className="text-[10px] px-1.5 py-0.5 bg-purple-500/10 text-purple-400 rounded border border-purple-500/20"
            >
              {tc.name}
            </span>
          ))}
        </div>
      )}

      {session.error && <div className="text-xs text-red-400 mt-1 truncate">{session.error}</div>}
    </div>
  );
}
