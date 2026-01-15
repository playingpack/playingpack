import type { RequestState } from '@playingpack/shared';

interface StatusBadgeProps {
  state: RequestState;
}

/**
 * StatusBadge - Shows the lifecycle state of a request
 *
 * Labels:
 * - PAUSED: waiting for human action at intervention point 1
 * - CALLING: getting response from LLM or cache
 * - REVIEW: waiting for human action at intervention point 2
 * - DONE: request complete
 */
export function StatusBadge({ state }: StatusBadgeProps) {
  const getStatusInfo = (): { label: string; className: string } => {
    switch (state) {
      case 'pending':
        return {
          label: 'PAUSED',
          className: 'bg-orange-500/10 text-orange-400 border border-orange-500/30 animate-pulse',
        };
      case 'processing':
        return {
          label: 'CALLING',
          className: 'bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse',
        };
      case 'reviewing':
        return {
          label: 'REVIEW',
          className: 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse',
        };
      case 'complete':
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
