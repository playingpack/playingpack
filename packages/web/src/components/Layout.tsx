import { useEffect } from 'react';
import { RequestList } from './RequestList';
import { InterceptorToggle } from './InterceptorToggle';
import { Inspector } from './Inspector';
import { MockEditor } from './MockEditor';
import { useRequestStore } from '../stores/requestStore';
import { useInterceptorStore } from '../stores/interceptorStore';
import { wsManager } from '../lib/websocket';
import { trpc } from '../lib/trpc';

export function Layout() {
  const selectedSession = useRequestStore((s) => s.getSelectedSession());
  const handleWSEvent = useRequestStore((s) => s.handleWSEvent);
  const setConnected = useInterceptorStore((s) => s.setConnected);
  const setSettings = useInterceptorStore((s) => s.setSettings);

  // Fetch initial settings
  const settingsQuery = trpc.getSettings.useQuery();

  // Update settings when query succeeds
  useEffect(() => {
    if (settingsQuery.data) {
      setSettings(settingsQuery.data.settings);
    }
  }, [settingsQuery.data, setSettings]);

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
    <div className="flex h-screen bg-pp-dark">
      {/* Left Sidebar - Request List */}
      <div className="w-80 flex-shrink-0 border-r border-pp-light flex flex-col bg-pp-darker">
        {/* Header */}
        <div className="h-14 border-b border-pp-light flex items-center justify-between px-4">
          <h1 className="text-lg font-bold tracking-tight text-white">
            Playing<span className="text-pp-accent">Pack</span>
          </h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-pp-accent animate-pulse" />
            <span className="text-xs font-mono text-gray-500">:3000</span>
          </div>
        </div>

        {/* Interceptor Toggle */}
        <InterceptorToggle />

        {/* Request List */}
        <div className="flex-1 overflow-hidden">
          <RequestList />
        </div>
      </div>

      {/* Main Content - Inspector */}
      <div className="flex-1 flex flex-col overflow-hidden bg-pp-dark">
        {selectedSession ? (
          <>
            <Inspector session={selectedSession} />
            <MockEditor session={selectedSession} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <svg
                className="w-16 h-16 mx-auto mb-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h2 className="text-xl font-medium text-gray-400 mb-2">
                Select a request
              </h2>
              <p className="text-sm text-gray-600 max-w-md">
                Click on a request in the sidebar to inspect its details,
                or wait for new requests to come in.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
