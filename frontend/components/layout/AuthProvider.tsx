'use client';

import { useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, user } = useStore();

  useEffect(() => {
    // Загружаем текущего пользователя при монтировании
    const loadUser = async () => {
      try {
        const data = await apiClient.getCurrentUser();
        if (data.user) {
          setUser({
            id: data.user.id,
            email: data.user.email,
            first_name: data.user.first_name,
            last_name: data.user.last_name,
            isAdmin: data.user.isAdmin,
            is_authenticated: true,
          });
        }
      } catch (error) {
        // Пользователь не авторизован - это нормально
        setUser(null);
      }
    };

    if (!user) {
      loadUser();
    }
  }, []);

  return <>{children}</>;
}

