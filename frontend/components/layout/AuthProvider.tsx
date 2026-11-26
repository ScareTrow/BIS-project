'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthLoading } = useStore();

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      try {
        const data = await apiClient.getSession();
        if (active && data.user) {
          setUser({ ...data.user, is_authenticated: true });
        }
      } catch {
        if (active) setUser(null);
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void loadUser();
    return () => { active = false; };
  }, [setUser, setAuthLoading]);

  return <>{children}</>;
}

