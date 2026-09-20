'use client';
import { create } from 'zustand';
import type { User } from './api';
import type { Language } from './i18n';

type SessionUser = Pick<User, 'id' | 'email' | 'first_name' | 'isAdmin'> & Partial<User>;
interface State {
  authLoading: boolean;
  setAuthLoading: (value: boolean) => void;
  user: SessionUser | null;
  setUser: (user: SessionUser | null) => void;
  language: Language;
  setLanguage: (language: Language) => void;
  viewMode: 'map' | 'list';
  setViewMode: (mode: 'map' | 'list') => void;
  shouldRefreshApplications: boolean;
  setShouldRefreshApplications: (value: boolean) => void;
}
export const useStore = create<State>(set => ({
  authLoading: true,
  setAuthLoading: authLoading => set({ authLoading }),
  user: null, setUser: user => set({ user }),
  language: 'ru',
  setLanguage: language => {
    if (typeof window !== 'undefined') localStorage.setItem('language', language);
    set({ language });
  },
  viewMode: 'map',
  setViewMode: viewMode => {
    if (typeof window !== 'undefined') localStorage.setItem('viewMode', viewMode);
    set({ viewMode });
  },
  shouldRefreshApplications: false,
  setShouldRefreshApplications: shouldRefreshApplications => set({ shouldRefreshApplications }),
}));

