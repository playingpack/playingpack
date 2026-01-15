import type { ResponseSource } from '@playingpack/shared';

interface SourceBadgeProps {
  source: ResponseSource;
}

/**
 * SourceBadge - Shows where the response came from
 *
 * Labels:
 * - LLM: fresh response from upstream LLM
 * - CACHE: served from cached response
 * - MOCK: manually mocked/injected response
 */
export function SourceBadge({ source }: SourceBadgeProps) {
  const getSourceInfo = (): { label: string; className: string } => {
    switch (source) {
      case 'llm':
        return {
          label: 'LLM',
          className: 'bg-blue-500/10 text-blue-400 border border-blue-500/30',
        };
      case 'cache':
        return {
          label: 'CACHE',
          className: 'bg-teal-500/10 text-teal-400 border border-teal-500/30',
        };
      case 'mock':
        return {
          label: 'MOCK',
          className: 'bg-purple-500/10 text-purple-400 border border-purple-500/30',
        };
      default:
        return {
          label: source,
          className: 'bg-gray-500/10 text-gray-300 border border-gray-500/30',
        };
    }
  };

  const { label, className } = getSourceInfo();

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${className}`}>
      {label}
    </span>
  );
}
