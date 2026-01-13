import { create } from 'zustand';
import type { InterceptorSettings } from '@playingpack/shared';

interface InterceptorStore {
  settings: InterceptorSettings;
  connected: boolean;

  // Actions
  setSettings: (settings: InterceptorSettings) => void;
  updateSettings: (settings: Partial<InterceptorSettings>) => void;
  setConnected: (connected: boolean) => void;
  togglePause: () => void;
}

export const useInterceptorStore = create<InterceptorStore>((set) => ({
  settings: {
    pauseEnabled: false,
    pauseOnToolCalls: true,
  },
  connected: false,

  setSettings: (settings) => {
    set({ settings });
  },

  updateSettings: (updates) => {
    set((state) => ({
      settings: { ...state.settings, ...updates },
    }));
  },

  setConnected: (connected) => {
    set({ connected });
  },

  togglePause: () => {
    set((state) => ({
      settings: {
        ...state.settings,
        pauseEnabled: !state.settings.pauseEnabled,
      },
    }));
  },
}));
