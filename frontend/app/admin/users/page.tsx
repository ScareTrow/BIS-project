'use client';

import {
  Avatar, EmptyState, NoticeBar, PageHeader, Pill, SearchInput, Spinner, Tabs,
  USER_BADGES, useNotice, useRequireAdmin,
} from '@/components/admin/shared';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { Ban, ChevronRight, Shield, Star, Users } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

type AdminUser = Awaited<ReturnType<typeof apiClient.getAdminUsers>>[number] & {
  blocked_until?: string | null;
  rating_count?: number;
  badge?: string | null;
};

type Filter = 'all' | 'admins' | 'blocked' | 'suspicious';

export default function AdminUsersPage() {
  const ready = useRequireAdmin();
  const { user } = useStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [notice, setNotice] = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await apiClient.getAdminUsers());
    } catch {
      setNotice({ kind: 'error', text: 'Не удалось загрузить пользователей.' });
    } finally {
      setLoading(false);
    }
  }, [setNotice]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const counts = useMemo(() => ({
    all: users.length,
    admins: users.filter((u) => u.isAdmin).length,
    blocked: users.filter((u) => u.is_blocked).length,
    suspicious: users.filter((u) => u.false_calls_count > 0).length,
  }), [users]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users
      .filter((u) =>
        filter === 'admins' ? u.isAdmin
          : filter === 'blocked' ? u.is_blocked
            : filter === 'suspicious' ? u.false_calls_count > 0
              : true)
      .filter((u) => !q || [u.first_name, u.last_name, u.email, u.city, `#${u.id}`].some((f) => f?.toLowerCase().includes(q)));
  }, [users, filter, query]);

  const makeAdmin = async (u: AdminUser) => {
    if (!confirm(`Назначить ${u.first_name} администратором? Он получит доступ к этой панели.`)) return;
    try {
      await apiClient.makeAdmin(u.id);
      setNotice({ kind: 'success', text: `${u.first_name} теперь администратор.` });
      await load();
    } catch {
      setNotice({ kind: 'error', text: 'Не удалось назначить администратора.' });
    }
  };

  if (!ready) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Пользователи"
        description="Найдите человека, чтобы посмотреть его заявки и рейтинг. Блокировка и удаление — на странице пользователя."
      />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'Все', count: counts.all },
            { value: 'admins', label: 'Администраторы', count: counts.admins },
            { value: 'blocked', label: 'Заблокированные', count: counts.blocked },
            { value: 'suspicious', label: 'С ложными заявками', count: counts.suspicious },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Поиск: имя, email, город" />
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Users className="w-12 h-12" />} title="Никого не найдено" hint={query ? 'Попробуйте изменить запрос.' : undefined} />
      ) : (
        <ul className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {visible.map((u) => (
            <li key={u.id} className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-gray-50">
              <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                <Avatar src={u.avatar} firstName={u.first_name} lastName={u.last_name} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{u.first_name} {u.last_name || ''}</span>
                    {u.is_super_admin ? (
                      <Pill className="bg-purple-100 text-purple-800 border-purple-300"><Shield className="w-3 h-3" />Супер-админ</Pill>
                    ) : u.isAdmin && (
                      <Pill className="bg-purple-50 text-purple-700 border-purple-200"><Shield className="w-3 h-3" />Админ</Pill>
                    )}
                    {u.is_blocked && (
                      <Pill className="bg-red-100 text-red-800 border-red-300">
                        <Ban className="w-3 h-3" />Заблокирован{u.blocked_until ? ` до ${new Date(u.blocked_until).toLocaleDateString('ru-RU')}` : ''}
                      </Pill>
                    )}
                    {u.badge && <Pill className="bg-yellow-50 text-yellow-800 border-yellow-300">{USER_BADGES[u.badge] || u.badge}</Pill>}
                  </div>
                  <p className="text-sm text-gray-500 truncate">{u.email}{u.city ? ` · ${u.city}` : ''}</p>
                </div>
              </Link>

              <dl className="grid grid-cols-4 gap-4 text-center text-sm sm:w-auto">
                <Metric label="Заявок" value={u.total_applications} />
                <Metric label="Помог" value={u.help_given} className="text-green-700" />
                <Metric label="Ложных" value={u.false_calls_count} className={u.false_calls_count ? 'text-red-700' : 'text-gray-400'} />
                <div>
                  <dt className="text-xs text-gray-500">Рейтинг</dt>
                  <dd className="font-semibold flex items-center justify-center gap-0.5">
                    {u.rating_count ? (<><Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />{u.average_rating.toFixed(1)}</>) : <span className="text-gray-400">—</span>}
                  </dd>
                </div>
              </dl>

              <div className="flex items-center gap-2 sm:justify-end">
                {!u.isAdmin && user?.is_super_admin && (
                  <button onClick={() => makeAdmin(u)} className="rounded-lg border border-purple-300 px-3 py-1.5 text-sm text-purple-700 hover:bg-purple-50">
                    Сделать админом
                  </button>
                )}
                <Link href={`/admin/users/${u.id}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-white">
                  Подробнее<ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Metric({ label, value, className = 'text-gray-900' }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className={`font-semibold ${className}`}>{value}</dd>
    </div>
  );
}
