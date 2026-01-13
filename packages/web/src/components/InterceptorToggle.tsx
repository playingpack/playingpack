import { useInterceptorStore } from '../stores/interceptorStore';
import { trpc } from '../lib/trpc';

export function InterceptorToggle() {
  const settings = useInterceptorStore((s) => s.settings);
  const setSettings = useInterceptorStore((s) => s.setSettings);
  const connected = useInterceptorStore((s) => s.connected);

  const updateMutation = trpc.updateSettings.useMutation({
    onSuccess: (data) => {
      setSettings(data.settings);
    },
  });

  const handleToggle = () => {
    const newSettings = { pauseEnabled: !settings.pauseEnabled };
    updateMutation.mutate({ settings: newSettings });
  };

  const handleToolCallsToggle = () => {
    const newSettings = { pauseOnToolCalls: !settings.pauseOnToolCalls };
    updateMutation.mutate({ settings: newSettings });
  };

  return (
    <div className="p-3 border-b border-pp-light">
      {!connected && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-red-500/10 border border-red-500/20 rounded">
          <span className="w-2 h-2 rounded-full bg-red-500" />
          <span className="text-xs text-red-400">Disconnected</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-medium text-gray-200">Pause Mode</div>
          <div className="text-xs text-gray-500">
            Intercept requests for inspection
          </div>
        </div>
        <button
          onClick={handleToggle}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors
            ${settings.pauseEnabled ? 'bg-blue-600' : 'bg-gray-600'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform
              ${settings.pauseEnabled ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>

      {settings.pauseEnabled && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-pp-light">
          <div>
            <div className="text-sm text-gray-300">Tool Calls Only</div>
            <div className="text-xs text-gray-500">
              Only pause when tool calls detected
            </div>
          </div>
          <button
            onClick={handleToolCallsToggle}
            className={`
              relative inline-flex h-5 w-9 items-center rounded-full transition-colors
              ${settings.pauseOnToolCalls ? 'bg-blue-600' : 'bg-gray-600'}
            `}
          >
            <span
              className={`
                inline-block h-3 w-3 transform rounded-full bg-white transition-transform
                ${settings.pauseOnToolCalls ? 'translate-x-5' : 'translate-x-1'}
              `}
            />
          </button>
        </div>
      )}
    </div>
  );
}
