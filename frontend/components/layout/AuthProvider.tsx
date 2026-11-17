'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setAuthLoading } = useStore();

  useEffect(() => {
    // Загружаем текущего пользователя при монтировании
    const loadUser = async () => {
      try {
        const data = await apiClient.getCurrentUser();
        if (data.user) {
          setUser({ ...data.user, is_authenticated: true });
        }
      } catch (error) {
        // Пользователь не авторизован - это нормально
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    };

    loadUser();
  }, []);

  return <>{children}</>;
}

