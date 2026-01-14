import type { RequestState } from '@playingpack/shared';

interface StatusBadgeProps {
  state: RequestState;
  cacheHit?: boolean;
}

export function StatusBadge({ state, cacheHit }: StatusBadgeProps) {
  const getStatusInfo = (): { label: string; className: string } => {
    switch (state) {
      case 'pending':
        return {
          label: 'WAITING',
          className: 'bg-orange-500/10 text-orange-400 border border-orange-500/30 animate-pulse',
        };
      case 'processing':
        return {
          label: 'PROCESSING',
          className: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
        };
      case 'reviewing':
        return {
          label: 'REVIEW',
          className: 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse',
        };
      case 'complete':
        if (cacheHit) {
          return {
            label: 'CACHED',
            className: 'bg-teal-500/10 text-teal-400 border border-teal-500/30',
          };
        }
        return {
          label: 'DONE',
          className: 'bg-green-500/10 text-green-400 border border-green-500/30',
        };
      default:
        return {
          label: state,
          className: 'bg-gray-500/10 text-gray-300 border border-gray-500/30',
        };
    }
  };

  const { label, className } = getStatusInfo();

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}
