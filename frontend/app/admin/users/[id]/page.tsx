'use client';

import { InlineConfirm } from '@/components/ui/ActionFeedback';

import {
  Avatar, EmptyState, NoticeBar, Pill, Spinner, StatusBadge, USER_BADGES,
  useCategoryLabel, useNotice, useRequireAdmin,
} from '@/components/admin/shared';
import { apiClient } from '@/lib/api';
import { AlertTriangle, ArrowLeft, Ban, Calendar, FileText, Mail, MapPin, Shield, Star, Trash2, Unlock } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

type UserDetail = Awaited<ReturnType<typeof apiClient.getUser>> & {
  blocked_until?: string | null;
  blocked_reason?: string | null;
  rating_count?: number;
  badge?: string | null;
};

interface RecentApplication {
  id: number;
  description: string;
  category: string;
  is_sos: boolean;
  is_false_call: boolean;
  date: string;
  moderation_status?: string;
}

const BLOCK_PRESETS = [1, 7, 30, 365];

export default function AdminUserDetailPage() {
  const ready = useRequireAdmin();
  const router = useRouter();
  const params = useParams();
  const userId = Number(params.id);
  const categoryLabel = useCategoryLabel();
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [apps, setApps] = useState<RecentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [blockDays, setBlockDays] = useState(7);
  const [blockReason, setBlockReason] = useState('');
  const [deleteEmail, setDeleteEmail] = useState('');
  const [notice, setNotice] = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setDetail(await apiClient.getUser(userId));
      try {
        const all = await apiClient.getAdminApplications('all');
        setApps(
          all
            .filter((a) => a.user_id === userId)
            .slice(0, 10)
            .map((a) => {
              const full = a as typeof a & { full_description?: string };
              return {
                id: a.id, description: full.full_description || a.description, category: a.category,
                is_sos: a.is_sos, is_false_call: a.is_false_call, date: a.date, moderation_status: a.moderation_status,
              };
            }),
        );
      } catch {
        /* список заявок — второстепенный, профиль показываем и без него */
      }
    } catch {
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (ready && userId) load();
  }, [ready, userId, load]);

  const act = async (action: () => Promise<unknown>, success: string, failure: string) => {
    try {
      await action();
      setNotice({ kind: 'success', text: success });
      await load();
    } catch {
      setNotice({ kind: 'error', text: failure });
    }
  };

  if (!ready || loading) return <Spinner />;
  if (!detail) {
    return (
      <>
        <BackLink />
        <EmptyState icon={<AlertTriangle className="w-12 h-12" />} title="Пользователь не найден" />
      </>
    );
  }

  const fullName = `${detail.first_name} ${detail.last_name || ''}`.trim();

  const block = () => {
    return act(() => apiClient.blockUser(detail.id, blockDays, blockReason.trim()), `${fullName} заблокирован на ${blockDays} дн.`, 'Не удалось заблокировать пользователя.')
      .then(() => setBlockReason(''));
  };

  const unblock = () =>
    act(() => apiClient.unblockUser(detail.id), `${fullName} разблокирован.`, 'Не удалось разблокировать пользователя.');

  const remove = async () => {
    if (deleteEmail.trim().toLowerCase() !== detail.email.toLowerCase()) {
      setNotice({ kind: 'error', text: 'Email не совпал — пользователь не удалён.' });
      return;
    }
    try {
      await apiClient.deleteUser(detail.id);
      router.push('/admin/users');
    } catch {
      setNotice({ kind: 'error', text: 'Не удалось удалить пользователя.' });
    }
  };

  return (
    <>
      <BackLink />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      {/* Шапка профиля */}
      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6 flex flex-col sm:flex-row gap-5 sm:items-center">
        <Avatar src={detail.avatar} firstName={detail.first_name} lastName={detail.last_name} size={80} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>
            {detail.is_super_admin ? (
              <Pill className="bg-purple-100 text-purple-800 border-purple-300"><Shield className="w-3 h-3" />Супер-администратор</Pill>
            ) : detail.isAdmin ? (
              <Pill className="bg-purple-50 text-purple-700 border-purple-200"><Shield className="w-3 h-3" />Администратор</Pill>
            ) : null}
            {detail.badge && <Pill className="bg-yellow-50 text-yellow-800 border-yellow-300">{USER_BADGES[detail.badge] || detail.badge}</Pill>}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600">
            <span className="flex items-center gap-1"><Mail className="w-4 h-4" />{detail.email}</span>
            {detail.city && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{detail.city}</span>}
            <span className="flex items-center gap-1">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              {detail.rating_count ? `${detail.average_rating.toFixed(1)} из 5 (${detail.rating_count} оценок)` : 'Оценок пока нет'}
            </span>
          </div>
        </div>
      </section>

      {detail.is_blocked && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900">
          <p className="font-semibold flex items-center gap-2">
            <Ban className="w-5 h-5" />
            Заблокирован{detail.blocked_until ? ` до ${new Date(detail.blocked_until).toLocaleDateString('ru-RU')}` : ''}
          </p>
          {detail.blocked_reason && <p className="mt-1 text-sm">Причина: {detail.blocked_reason}</p>}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Активность</h2>
            <dl className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <Stat label="Создал заявок" value={detail.total_applications} />
              <Stat label="Из них решено" value={detail.resolved_applications} className="text-green-700" />
              <Stat label="Ложных заявок" value={detail.false_calls_count} className={detail.false_calls_count ? 'text-red-700' : 'text-gray-900'} />
              <Stat label="Откликнулся на заявки" value={detail.help_total} />
              <Stat label="Реально помог" value={detail.help_given} className="text-blue-700" />
              <Stat label="Получил оценок" value={detail.rating_count ?? 0} />
            </dl>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Последние заявки</h2>
            {apps.length ? (
              <ul className="divide-y divide-gray-100">
                {apps.map((a) => (
                  <li key={a.id} className="py-3 flex gap-4 items-start">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900">#{a.id}</span>
                        <StatusBadge status={a.moderation_status} />
                        <Pill className="bg-blue-50 text-blue-800 border-blue-200">{categoryLabel(a.category)}</Pill>
                        {a.is_sos && <Pill className="bg-red-600 text-white border-red-600">SOS</Pill>}
                        {a.is_false_call && <Pill className="bg-orange-100 text-orange-800 border-orange-300">Ложная</Pill>}
                      </div>
                      <p className="text-gray-700 text-sm line-clamp-2">{a.description}</p>
                      {a.date && (
                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />{new Date(a.date).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                        </p>
                      )}
                    </div>
                    <Link href={`/applications/${a.id}`} className="shrink-0 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">Открыть</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-gray-500 flex items-center gap-2"><FileText className="w-4 h-4" />Заявок нет</p>
            )}
          </section>

          {!!detail.received_ratings?.length && (
            <section className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Отзывы о пользователе</h2>
              <ul className="space-y-3">
                {detail.received_ratings.map((r) => (
                  <li key={r.id} className="text-sm">
                    <span className="font-medium text-gray-900">{r.rater?.first_name} {r.rater?.last_name || ''}</span>
                    <span className="ml-2 text-yellow-600">{'★'.repeat(r.rating_value)}{'☆'.repeat(Math.max(0, 5 - r.rating_value))}</span>
                    <span className="ml-2 text-gray-400">{new Date(r.created_at).toLocaleDateString('ru-RU')}</span>
                    {r.comment && <p className="text-gray-700 mt-0.5">{r.comment}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Управление */}
        <aside className="space-y-6">
          {detail.is_super_admin ? (
            <section className="bg-white rounded-xl border border-gray-200 p-6 text-sm text-gray-600">
              Супер-администратора нельзя заблокировать или удалить.
            </section>
          ) : (
            <>
              <section className="bg-white rounded-xl border border-gray-200 p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">Доступ к платформе</h2>
                {detail.is_blocked ? (
                  <>
                    <p className="text-sm text-gray-600 mb-4">Пользователь не может создавать заявки и откликаться.</p>
                    <button onClick={unblock} className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700">
                      <Unlock className="w-4 h-4" />Разблокировать
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">Временно запретить пользователю пользоваться платформой.</p>
                    <p className="text-sm font-medium text-gray-700 mb-2">На сколько дней</p>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {BLOCK_PRESETS.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setBlockDays(d)}
                          className={`rounded-lg border px-3 py-1.5 text-sm ${blockDays === d ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                        >
                          {d === 365 ? 'Год' : `${d} дн.`}
                        </button>
                      ))}
                      <input
                        type="number" min={1} max={365} value={blockDays}
                        aria-label="Свой срок, дней"
                        onChange={(e) => setBlockDays(Math.min(365, Math.max(1, parseInt(e.target.value) || 1)))}
                        className="w-20 rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 mt-3" htmlFor="block-reason">Причина (увидит пользователь)</label>
                    <textarea
                      id="block-reason" rows={3} value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Например: повторные ложные заявки"
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mb-3"
                    />
                    <InlineConfirm danger prompt={`Заблокировать ${fullName} на ${blockDays} дн.?`} onConfirm={block}>
                      <Ban className="w-4 h-4" />Заблокировать на {blockDays} дн.
                    </InlineConfirm>
                  </>
                )}
              </section>

              <section className="rounded-xl border border-red-300 bg-red-50/40 p-6">
                <h2 className="text-lg font-semibold text-red-800 mb-1">Опасная зона</h2>
                <p className="text-sm text-gray-700 mb-4">Удаление стирает аккаунт и все данные пользователя без возможности восстановления. Обычно достаточно блокировки.</p>
                <label className="block text-sm text-red-800">
                  Для удаления введите email {detail.email}
                  <input type="email" value={deleteEmail} onChange={event => setDeleteEmail(event.target.value)} className="mt-1 mb-2 w-full rounded-lg border border-gray-300 px-3 py-2" />
                </label>
                <button disabled={deleteEmail.trim().toLowerCase() !== detail.email.toLowerCase()} onClick={remove} className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-600 px-4 py-2 font-semibold text-red-700 hover:bg-red-600 hover:text-white">
                  <Trash2 className="w-4 h-4" />Удалить пользователя
                </button>
              </section>
            </>
          )}
        </aside>
      </div>
    </>
  );
}

function BackLink() {
  return (
    <Link href="/admin/users" className="inline-flex items-center text-sm text-blue-700 hover:underline mb-4">
      <ArrowLeft className="w-4 h-4 mr-1" />Все пользователи
    </Link>
  );
}

function Stat({ label, value, className = 'text-gray-900' }: { label: string; value: number; className?: string }) {
  return (
    <div>
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className={`text-2xl font-bold ${className}`}>{value}</dd>
    </div>
  );
}
