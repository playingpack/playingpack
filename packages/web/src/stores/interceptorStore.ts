import { create } from 'zustand';
import type { InterceptorSettings, PauseMode } from '@playingpack/shared';

interface InterceptorStore {
  settings: InterceptorSettings;
  connected: boolean;

  // Actions
  setSettings: (settings: InterceptorSettings) => void;
  updateSettings: (settings: Partial<InterceptorSettings>) => void;
  setConnected: (connected: boolean) => void;
  setPauseMode: (mode: PauseMode) => void;
}

export const useInterceptorStore = create<InterceptorStore>((set) => ({
  settings: {
    pause: 'off',
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

  setPauseMode: (mode) => {
    set((state) => ({
      settings: { ...state.settings, pause: mode },
    }));
  },
}));
