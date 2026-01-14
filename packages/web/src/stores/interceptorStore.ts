import { create } from 'zustand';
import type { Settings, CacheMode } from '@playingpack/shared';

interface SettingsStore {
  settings: Settings;
  connected: boolean;
  version: string | null;

  // Actions
  setSettings: (settings: Settings) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  setConnected: (connected: boolean) => void;
  setCacheMode: (mode: CacheMode) => void;
  setIntervene: (intervene: boolean) => void;
  setVersion: (version: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: {
    cache: 'read-write',
    intervene: true,
  },
  connected: false,
  version: null,

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

  setCacheMode: (mode) => {
    set((state) => ({
      settings: { ...state.settings, cache: mode },
    }));
  },

  setIntervene: (intervene) => {
    set((state) => ({
      settings: { ...state.settings, intervene },
    }));
  },

  setVersion: (version) => {
    set({ version });
  },
}));

// Keep old export name for backwards compatibility during migration
export const useInterceptorStore = useSettingsStore;
