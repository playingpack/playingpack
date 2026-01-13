import type { RequestState } from '@playingpack/shared';

interface StatusBadgeProps {
  state: RequestState;
  statusCode?: number;
  cached?: boolean;
}

export function StatusBadge({ state, statusCode, cached }: StatusBadgeProps) {
  const getStatusInfo = (): { label: string; className: string } => {
    switch (state) {
      case 'LOOKUP':
        return { label: 'LOOKUP', className: 'bg-gray-500/10 text-gray-300 border border-gray-500/30' };
      case 'CONNECT':
        return { label: 'CONNECT', className: 'bg-blue-500/10 text-blue-400 border border-blue-500/30' };
      case 'STREAMING':
        return { label: 'STREAM', className: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30' };
      case 'INTERCEPT':
        return { label: 'PAUSED', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse' };
      case 'FLUSH':
        return { label: 'FLUSH', className: 'bg-green-500/10 text-green-400 border border-green-500/30' };
      case 'INJECT':
        return { label: 'MOCK', className: 'bg-purple-500/10 text-purple-400 border border-purple-500/30' };
      case 'REPLAY':
        return { label: 'CACHE', className: 'bg-teal-500/10 text-teal-400 border border-teal-500/30' };
      case 'COMPLETE':
        if (cached) {
          return { label: 'CACHED', className: 'bg-teal-500/10 text-teal-400 border border-teal-500/30' };
        }
        if (statusCode && statusCode >= 400) {
          return { label: `${statusCode}`, className: 'bg-red-500/10 text-red-400 border border-red-500/30' };
        }
        return { label: `${statusCode || 200}`, className: 'bg-green-500/10 text-green-400 border border-green-500/30' };
      case 'ERROR':
        return { label: 'ERROR', className: 'bg-red-500/10 text-red-400 border border-red-500/30' };
      default:
        return { label: state, className: 'bg-gray-500/10 text-gray-300 border border-gray-500/30' };
    }
  };

  const { label, className } = getStatusInfo();

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${className}`}
    >
      {label}
    </span>
  );
}
