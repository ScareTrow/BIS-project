'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, CircleCheck, CircleX, HandHeart, Star } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import type { Notification } from '@/lib/api';
import { ActionFeedback } from '@/components/ui/ActionFeedback';

const icons: Record<string, typeof Bell> = {
  application_approved: CircleCheck, application_rejected: CircleX, new_response: HandHeart,
  response_accepted: CircleCheck, response_rejected: CircleX, application_resolved: CircleCheck, rating_received: Star,
};

export default function NotificationsDropdown({ notifications, onClose, onMarkRead, onMarkAllRead }: {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}) {
  const language = useStore(state => state.language);
  const t = useTranslation(language);
  const [error, setError] = useState(false);
  const mark = (action: () => Promise<void>) => {
    setError(false);
    void action().catch(() => setError(true));
  };
  return <section aria-label={t('notifications.title')} className="absolute -right-24 z-50 mt-2 flex max-h-96 w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border bg-white shadow-sm sm:right-0">
    <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
      <h3 className="font-semibold text-gray-900">{t('notifications.title')}</h3>
      <button type="button" onClick={() => mark(onMarkAllRead)} disabled={!notifications.some(item => !item.is_read)}
        className="inline-flex items-center gap-2 text-sm text-primary hover:underline disabled:text-gray-500">
        <CheckCheck aria-hidden="true" className="h-4 w-4" />{t('notifications.readAll')}
      </button>
    </div>
    <ActionFeedback error message={error ? t('ui.action.error') : undefined} />
    <ul className="divide-y overflow-y-auto">
      {!notifications.length && <li className="p-6 text-center text-gray-600">{t('notifications.empty')}</li>}
      {notifications.map(item => {
        const Icon = icons[item.notification_type] || Bell;
        const content = <>
          <Icon aria-hidden="true" className="mt-1 h-4 w-4 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{item.title}</span>
            <span className="mt-1 block break-words text-sm text-gray-600">{item.message}</span>
            <time dateTime={item.created_at} className="mt-1 block text-xs text-gray-600">
              {new Date(item.created_at).toLocaleString(language === 'en' ? 'en-GB' : language === 'kk' ? 'kk-KZ' : 'ru-RU')}
            </time>
          </span>
        </>;
        const classes = 'flex w-full items-start gap-3 p-4 text-left hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';
        const read = () => { if (!item.is_read) mark(() => onMarkRead(item.id)); };
        return <li key={item.id} className={!item.is_read ? 'bg-primary-light' : ''}>
          {item.related_application_id
            ? <Link href={`/applications/${item.related_application_id}`} className={classes} onClick={() => { read(); onClose(); }}>{content}</Link>
            : <button type="button" className={classes} onClick={read}>{content}</button>}
        </li>;
      })}
    </ul>
  </section>;
}
