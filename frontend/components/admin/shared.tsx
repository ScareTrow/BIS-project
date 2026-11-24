'use client';

import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { AlertTriangle, CheckCircle, Info, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

/**
 * Единая проверка доступа для всех страниц админки.
 * Ждёт восстановления сессии (AuthProvider), затем:
 *  - гостя отправляет на /login,
 *  - обычного пользователя — на главную.
 * Возвращает true, когда страницу можно показывать.
 */
export function useRequireAdmin(): boolean {
  const router = useRouter();
  const { user, authLoading } = useStore();

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
    else if (!user.isAdmin) router.push('/');
  }, [user, authLoading, router]);

  return !authLoading && !!user?.isAdmin;
}

/** Событие, которое страницы шлют после модерации, чтобы обновить счётчик в меню. */
export const ADMIN_COUNTS_EVENT = 'admin:refresh-counts';
export const refreshAdminCounts = () => window.dispatchEvent(new Event(ADMIN_COUNTS_EVENT));

/* ---------- Человекочитаемые подписи ---------- */

export const ALL_CATEGORIES = [
  'food', 'clothing', 'household', 'delivery', 'volunteering',
  'social_project', 'medicine', 'shelter', 'emergency',
] as const;

export function useCategoryLabel() {
  const { language } = useStore();
  const t = useTranslation(language);
  return (category: string | null | undefined) => {
    if (!category) return 'Любая категория';
    const key = `categories.${category}`;
    const label = t(key);
    return label === key ? category : label;
  };
}

export const MODERATION_STATUS: Record<string, { label: string; className: string }> = {
  pending: { label: 'Ждёт проверки', className: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
  approved: { label: 'Одобрена', className: 'bg-green-100 text-green-800 border-green-300' },
  rejected: { label: 'Отклонена', className: 'bg-red-100 text-red-800 border-red-300' },
};

export function StatusBadge({ status }: { status?: string }) {
  const cfg = MODERATION_STATUS[status || ''] || { label: status || '—', className: 'bg-gray-100 text-gray-700 border-gray-300' };
  return <Pill className={cfg.className}>{cfg.label}</Pill>;
}

/** Ручной приоритет заявки (0–5), как его хранит сервер. */
export const PRIORITY_LEVELS = [
  { value: 0, label: '0 — обычный' },
  { value: 1, label: '1 — низкий+' },
  { value: 2, label: '2 — средний' },
  { value: 3, label: '3 — высокий' },
  { value: 4, label: '4 — очень высокий' },
  { value: 5, label: '5 — срочно (как SOS)' },
];

/** Приоритеты автоматических правил. */
export const TRIAGE_PRIORITY: Record<string, string> = {
  normal: 'Обычный',
  high: 'Высокий',
  sos: 'Срочный (SOS)',
};

export const NEWS_TYPES: Record<string, string> = {
  general: 'Общее',
  stats: 'Статистика',
  location: 'Местоположение',
  safety: 'Безопасность',
  volunteers: 'Волонтёры',
};

export const USER_BADGES: Record<string, string> = {
  verified_help_source: '✓ Проверенный источник помощи',
  reliable_volunteer: '❤ Надёжный волонтёр',
};

/* ---------- Мелкие UI-кирпичики ---------- */

export function Pill({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {children}
    </span>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center items-center py-24" role="status" aria-label="Загрузка">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-blue-600" />
    </div>
  );
}

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-gray-600 mt-1 max-w-2xl">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-300 p-10 text-center">
      <div className="mx-auto mb-3 w-fit text-gray-400">{icon}</div>
      <p className="text-gray-800 font-medium">{title}</p>
      {hint && <p className="text-gray-500 text-sm mt-1">{hint}</p>}
    </div>
  );
}

export type Notice = { kind: 'success' | 'error' | 'info'; text: string } | null;

/** Сообщение о результате действия вместо alert(). Само исчезает через 5 секунд. */
export function useNotice() {
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(id);
  }, [notice]);
  return [notice, setNotice] as const;
}

export function NoticeBar({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  if (!notice) return null;
  const styles = {
    success: 'bg-green-50 border-green-300 text-green-800',
    error: 'bg-red-50 border-red-300 text-red-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
  }[notice.kind];
  const Icon = notice.kind === 'success' ? CheckCircle : notice.kind === 'error' ? AlertTriangle : Info;
  return (
    <div role="status" className={`mb-4 flex items-start gap-2 rounded-lg border px-4 py-3 ${styles}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <p className="flex-1">{notice.text}</p>
      <button onClick={onClose} aria-label="Закрыть" className="opacity-60 hover:opacity-100">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="w-full sm:max-w-sm px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
    />
  );
}

export function Tabs<T extends string>({
  value, onChange, items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string; count?: number }[];
}) {
  return (
    <div role="tablist" className="flex flex-wrap gap-2">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
              active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            {item.label}
            {item.count !== undefined && (
              <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${active ? 'bg-white/20' : 'bg-gray-100'}`}>{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function Avatar({ src, firstName, lastName, size = 40 }: { src?: string | null; firstName: string; lastName?: string | null; size?: number }) {
  const style = { width: size, height: size };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/uploads/${src}`} alt={firstName} style={style} className="rounded-full object-cover shrink-0" />;
  }
  return (
    <div style={style} className="rounded-full bg-blue-100 flex items-center justify-center shrink-0">
      <span className="text-blue-700 font-bold" style={{ fontSize: size / 2.6 }}>
        {(firstName?.[0] || '?').toUpperCase()}{lastName?.[0]?.toUpperCase() || ''}
      </span>
    </div>
  );
}
