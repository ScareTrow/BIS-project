'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export default function TelegramLink({ guest = false, telegramId, onLinked }: {
  guest?: boolean;
  telegramId?: string | null;
  onLinked?: (telegramId: string) => void;
}) {
  const [linkedId, setLinkedId] = useState(telegramId || '');
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [started, setStarted] = useState(false);
  const [expires, setExpires] = useState<number | null>(null);
  const onLinkedRef = useRef(onLinked);
  onLinkedRef.current = onLinked;
  const { language, setUser } = useStore();
  const t = useTranslation(language);
  const linked = Boolean(telegramId || linkedId);
  const showLink = guest || linked;

  useEffect(() => {
    if (!showLink) return;
    let active = true;
    setUrl('');
    setError(false);
    apiClient.getTelegramBotInfo().then(info => {
      if (active) setUrl(info.bot_url || '');
    }).catch(() => { if (active) setError(true); });
    return () => { active = false; };
  }, [showLink]);

  useEffect(() => {
    if (!expires) return;
    const timeout = window.setTimeout(() => {
      setUrl('');
      setExpires(null);
    }, Math.max(0, expires - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [expires]);

  useEffect(() => {
    if (guest || linked || !started) return;
    let active = true;
    let checking = false;
    async function refresh() {
      if (checking || document.visibilityState !== 'visible') return;
      checking = true;
      try {
        const { user } = await apiClient.getSession();
        if (active && user.telegram_id) {
          setLinkedId(user.telegram_id);
          setExpires(null);
          setUser({ ...user, is_authenticated: true });
          onLinkedRef.current?.(user.telegram_id);
        }
      } catch {
        // The next return to this page retries the session check.
      } finally {
        checking = false;
      }
    }
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [guest, linked, started, setUser]);

  async function createLink() {
    setBusy(true);
    setError(false);
    try {
      const info = await apiClient.createTelegramLink();
      setUrl(info.bot_url);
      setExpires(Date.now() + info.expires_in * 1000);
      setStarted(true);
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }

  return <div className="mt-3 space-y-2">
    {linked && <p role="status" className="text-sm font-medium text-green-700">{t('telegram.linked')}</p>}
    {!showLink && !url && <Button variant="secondary" busy={busy} onClick={createLink}>{t('telegram.link')}</Button>}
    {url && <a href={url} target="_blank" rel="noopener noreferrer"
      className={guest ? 'text-sm font-medium text-blue-600 underline hover:text-blue-800' : 'btn btn-outline inline-flex items-center justify-center'}>
      {t('telegram.openBot')}
    </a>}
    {error && <p role="alert" className="text-sm text-danger-dark">{t('telegram.linkError')}</p>}
    {guest && <p className="text-xs text-gray-600">{t('telegram.guestHint')}</p>}
    {!guest && !linked && url && <p className="text-xs text-gray-600">{t('telegram.linkHint')}</p>}
  </div>;
}
