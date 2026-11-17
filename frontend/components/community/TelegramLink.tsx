'use client';

import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';

export default function TelegramLink({ guest = false, telegramId, onLinked }: {
  guest?: boolean;
  telegramId?: string | null;
  onLinked?: (telegramId: string) => void;
}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [linked, setLinked] = useState(telegramId || '');
  const onLinkedRef = useRef(onLinked);
  onLinkedRef.current = onLinked;
  const { setUser } = useStore();

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const info = guest || telegramId
          ? await apiClient.getTelegramBotInfo()
          : await apiClient.createTelegramLink();
        if (active) { setUrl(info.bot_url || ''); setError(''); }
      } catch {
        if (active) setError('Не удалось получить ссылку на бота. Обновите страницу и попробуйте снова.');
      }
    }
    load();
    const timer = !guest && !telegramId ? setInterval(load, 9 * 60 * 1000) : undefined;
    return () => { active = false; if (timer) clearInterval(timer); };
  }, [guest, telegramId]);

  useEffect(() => {
    if (guest) return;
    async function refresh() {
      if (document.visibilityState !== 'visible') return;
      try {
        const { user } = await apiClient.getCurrentUser();
        if (user.telegram_id) {
          setLinked(user.telegram_id);
          setUser({ ...user, is_authenticated: true });
          onLinkedRef.current?.(user.telegram_id);
        }
      } catch { /* Keep the form intact if the server is temporarily unavailable. */ }
    }
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [guest, setUser]);

  return <div className="mt-3 space-y-2">
    {linked && <p role="status" className="text-sm font-medium text-green-700">Telegram привязан. ID: {linked}</p>}
    {url && <a href={url} target="_blank" rel="noopener noreferrer"
      className={guest ? 'text-sm font-medium text-blue-600 underline hover:text-blue-800' : 'btn btn-outline inline-flex items-center justify-center'}>
      {guest || linked ? 'Открыть Telegram-бота' : 'Привязать Telegram'}
    </a>}
    {!url && !error && <p className="text-sm text-gray-500">Получаем ссылку на бота…</p>}
    {error && <p role="status" className="text-sm text-red-700">{error}</p>}
    <p className="text-xs leading-relaxed text-gray-500">{guest
      ? 'Сначала завершите регистрацию. Затем в профиле нажмите «Привязать Telegram» и Start в боте — ID заполнится автоматически.'
      : linked ? 'Уведомления будут приходить в этот Telegram-аккаунт.'
      : 'Откройте бота по этой ссылке и нажмите Start. После возвращения на сайт Telegram ID заполнится автоматически.'}</p>
  </div>;
}
