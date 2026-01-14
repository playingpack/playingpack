import { create } from 'zustand';
import type { RequestSession, WSEvent } from '@playingpack/shared';

// Extended session with pre-intercept info
export interface ExtendedSession extends RequestSession {
  preInterceptInfo?: {
    hasCachedResponse: boolean;
    model: string;
  };
}

interface RequestStore {
  sessions: Map<string, ExtendedSession>;
  selectedId: string | null;

  // Actions
  setSession: (session: ExtendedSession) => void;
  removeSession: (id: string) => void;
  clearSessions: () => void;
  selectSession: (id: string | null) => void;
  handleWSEvent: (event: WSEvent) => void;

  // Getters
  getSession: (id: string) => ExtendedSession | undefined;
  getSortedSessions: () => ExtendedSession[];
  getSelectedSession: () => ExtendedSession | undefined;
}

export const useRequestStore = create<RequestStore>((set, get) => ({
  sessions: new Map(),
  selectedId: null,

  setSession: (session) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.set(session.id, session);
      return { sessions };
    });
  },

  removeSession: (id) => {
    set((state) => {
      const sessions = new Map(state.sessions);
      sessions.delete(id);
      return {
        sessions,
        selectedId: state.selectedId === id ? null : state.selectedId,
      };
    });
  },

  clearSessions: () => {
    set({ sessions: new Map(), selectedId: null });
  },

  selectSession: (id) => {
    set({ selectedId: id });
  },

  handleWSEvent: (event) => {
    const { setSession } = get();

    switch (event.type) {
      case 'request_update':
        setSession(event.session);
        break;

      case 'intercept': {
        const session = get().sessions.get(event.requestId);
        if (session) {
          setSession({
            ...session,
            state: 'TOOL_CALL',
          });
        }
        break;
      }

      case 'pre_intercept': {
        const session = get().sessions.get(event.requestId);
        if (session) {
          setSession({
            ...session,
            state: 'PAUSED',
            preInterceptInfo: {
              hasCachedResponse: event.hasCachedResponse,
              model: event.request.model,
            },
          });
        }
        break;
      }

      case 'request_complete': {
        const completedSession = get().sessions.get(event.requestId);
        if (completedSession) {
          setSession({
            ...completedSession,
            cached: event.cached,
          });
        }
        break;
      }
    }
  },

  getSession: (id) => {
    return get().sessions.get(id);
  },

  getSortedSessions: () => {
    const sessions = Array.from(get().sessions.values());
    // Sort by timestamp descending (newest first)
    return sessions.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  },

  getSelectedSession: () => {
    const { selectedId, sessions } = get();
    return selectedId ? sessions.get(selectedId) : undefined;
  },
}));
