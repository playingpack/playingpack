import type { PauseMode } from '@playingpack/shared';
import { useInterceptorStore } from '../stores/interceptorStore';
import { trpc } from '../lib/trpc';

const PAUSE_MODES: { value: PauseMode; label: string; description: string }[] = [
  { value: 'off', label: 'Off', description: 'No interception' },
  { value: 'tool-calls', label: 'Tools', description: 'Pause on tool calls' },
  { value: 'all', label: 'All', description: 'Pause all requests' },
];

export function InterceptorToggle() {
  const settings = useInterceptorStore((s) => s.settings);
  const setSettings = useInterceptorStore((s) => s.setSettings);
  const connected = useInterceptorStore((s) => s.connected);

  const updateMutation = trpc.updateSettings.useMutation({
    onSuccess: (data) => {
      setSettings(data.settings);
    },
  });

  const handleModeChange = (mode: PauseMode) => {
    updateMutation.mutate({ settings: { pause: mode } });
  };

  return (
    <div className="p-3 border-b border-pp-light">
      {!connected && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-red-400">Disconnected</span>
        </div>
      )}

      <div className="mb-2">
        <div className="text-sm font-medium text-gray-200">Pause Mode</div>
        <div className="text-xs text-gray-500">
          {PAUSE_MODES.find((m) => m.value === settings.pause)?.description}
        </div>
      </div>

      <div className="flex rounded-lg bg-pp-gray p-1">
        {PAUSE_MODES.map((mode) => (
          <button
            key={mode.value}
            onClick={() => handleModeChange(mode.value)}
            className={`
              flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors
              ${
                settings.pause === mode.value
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:text-gray-200'
              }
            `}
          >
            {mode.label}
          </button>
        ))}
      </div>
    </div>
  );
}
