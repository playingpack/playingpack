import { useEffect } from 'react';
import { Header } from './Header';
import { RequestList } from './RequestList';
import { RequestDetail } from './RequestDetail';
import { useRequestStore } from '../stores/requestStore';
import { useSettingsStore } from '../stores/interceptorStore';
import { wsManager } from '../lib/websocket';
import { trpc } from '../lib/trpc';

export function Layout() {
  const selectedSession = useRequestStore((s) => s.getSelectedSession());
  const handleWSEvent = useRequestStore((s) => s.handleWSEvent);
  const setConnected = useSettingsStore((s) => s.setConnected);
  const setSettings = useSettingsStore((s) => s.setSettings);
  const setVersion = useSettingsStore((s) => s.setVersion);

  // Fetch initial settings
  const settingsQuery = trpc.getSettings.useQuery();

  // Update settings when query succeeds
  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data.settings);
      if (settingsQuery.data.version) {
        setVersion(settingsQuery.data.version);
      }
    }
  }, [settingsQuery.data, setSettings, setVersion]);

  // Connect to WebSocket
  useEffect(() => {
    wsManager.connect();

    const unsubscribe = wsManager.subscribe((event) => {
      handleWSEvent(event);
    });

    // Check connection status periodically
    const checkConnection = setInterval(() => {
      setConnected(wsManager.isConnected());
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(checkConnection);
      wsManager.disconnect();
    };
  }, [handleWSEvent, setConnected]);

  return (
    <div className="flex flex-col h-screen bg-pp-dark">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar - Request List */}
        <div className="w-72 flex-shrink-0 border-r border-pp-light flex flex-col bg-pp-darker">
          <div className="p-3 border-b border-pp-light">
            <div className="text-xs text-gray-500">
              Requests
              <span className="ml-2 text-gray-600">
                Point agent to <code className="text-gray-400">localhost:4747/v1</code>
              </span>
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            <RequestList />
          </div>
        </div>

        {/* Right Panel - Request Detail */}
        <div className="flex-1 flex flex-col overflow-hidden bg-pp-dark">
          {selectedSession ? (
            <RequestDetail session={selectedSession} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pp-gray flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
                    />
                  </svg>
                </div>
                <h2 className="text-lg font-medium text-gray-400 mb-2">Select a request</h2>
                <p className="text-sm text-gray-600">
                  Click a request to inspect details. When{' '}
                  <span className="text-orange-400">Intervene</span> is enabled, requests will pause
                  for your action.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
