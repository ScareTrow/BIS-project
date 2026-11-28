'use client';

import { InlineConfirm } from '@/components/ui/ActionFeedback';
import PhotoGallery from '@/components/common/PhotoGallery';

import {
  EmptyState, NoticeBar, PageHeader, Pill, PRIORITY_LEVELS, refreshAdminCounts, SearchInput,
  Spinner, StatusBadge, Tabs, useCategoryLabel, useNotice, useRequireAdmin,
} from '@/components/admin/shared';
import { apiClient, Application } from '@/lib/api';
import { AlertTriangle, Calendar, CheckCircle, Eye, FileText, MapPin, MessageSquare, User, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

interface AdminApplication extends Application {
  moderation_status?: string;
  user?: { id: number; first_name: string; last_name?: string; email: string };
  responses_count?: number;
}

type StatusFilter = 'pending' | 'approved' | 'rejected' | 'all';

const TABS: { value: StatusFilter; label: string; hint: string }[] = [
  { value: 'pending', label: 'Ждут проверки', hint: 'Новые заявки и SOS, опубликованные без проверки. Одобрите — и их увидят волонтёры.' },
  { value: 'approved', label: 'Одобренные', hint: 'Видны волонтёрам. Если заявка оказалась обманом — пометьте её как ложную.' },
  { value: 'rejected', label: 'Отклонённые', hint: 'Не прошли проверку. Автор получил объяснение причины.' },
  { value: 'all', label: 'Все', hint: 'Все заявки в системе.' },
];

const isStatus = (v: string | null): v is StatusFilter => TABS.some((t) => t.value === v);

/** Можно ли сейчас принять решение по заявке (новая, или SOS, опубликованный без проверки). */
const needsDecision = (app: AdminApplication) =>
  app.moderation_status === 'pending' || (app.is_sos && !app.moderated_at && app.moderation_status === 'approved');

function AdminApplicationsPageContent() {
  const ready = useRequireAdmin();
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryLabel = useCategoryLabel();
  const statusParam = searchParams.get('status');
  const status: StatusFilter = isStatus(statusParam) ? statusParam : 'pending';

  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [term, setTerm] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [priorities, setPriorities] = useState<Record<number, number>>({});
  const pageSize = 30;
  const [rejecting, setRejecting] = useState<{ id: number; reason: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useNotice();

  useEffect(() => {
    const timer = window.setTimeout(() => setTerm(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(async (offset = 0, active: () => boolean = () => true) => {
    if (offset) setLoadingMore(true);
    else setLoading(true);
    try {
      const rows = await apiClient.getAdminApplications(status, { q: term, offset, limit: pageSize + 1 });
      if (!active()) return;
      setHasMore(rows.length > pageSize);
      setApplications(current => offset ? [...current, ...rows.slice(0, pageSize)] : rows.slice(0, pageSize));
    } catch {
      if (active()) setNotice({ kind: 'error', text: 'Не удалось загрузить заявки. Обновите страницу.' });
    } finally {
      if (active()) { setLoading(false); setLoadingMore(false); }
    }
  }, [status, term, setNotice, pageSize]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void load(0, () => active);
    return () => { active = false; };
  }, [ready, load]);

  const run = async (id: number, action: () => Promise<unknown>, success: string, failure: string) => {
    setBusyId(id);
    try {
      await action();
      setNotice({ kind: 'success', text: success });
      refreshAdminCounts();
      await load();
    } catch {
      setNotice({ kind: 'error', text: failure });
    } finally {
      setBusyId(null);
    }
  };

  const approve = (id: number) =>
    run(id, () => apiClient.approveApplication(id), `Заявка #${id} одобрена — волонтёры её видят.`, 'Не удалось одобрить заявку.');

  const submitReject = () => {
    if (!rejecting) return;
    const reason = rejecting.reason.trim();
    if (!reason || reason.length > 1000) {
      setNotice({ kind: 'error', text: 'Укажите причину отклонения (от 1 до 1000 символов).' });
      return;
    }
    const id = rejecting.id;
    setRejecting(null);
    run(id, () => apiClient.rejectApplication(id, reason), `Заявка #${id} отклонена, автор получит объяснение.`, 'Не удалось отклонить заявку.');
  };

  const markFalse = (id: number) => {
    return run(id, () => apiClient.markFalseApplication(id), `Заявка #${id} помечена как ложная.`, 'Не удалось пометить заявку.');
  };

  const setPriority = (id: number, priority: number) =>
    run(id, () => apiClient.setApplicationPriority(id, priority), `Приоритет заявки #${id}: ${priority}.`, 'Не удалось изменить приоритет.');

  const changeTab = (next: StatusFilter) => {
    setQuery('');
    setTerm('');
    setPriorities({});
    setRejecting(null);
    router.push(`/admin/applications?status=${next}`);
  };

  if (!ready) return <Spinner />;

  const tab = TABS.find((t) => t.value === status)!;

  return (
    <>
      <PageHeader title="Проверка заявок" description={tab.hint} />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        <Tabs value={status} onChange={changeTab} items={TABS} />
        <SearchInput value={query} onChange={setQuery} placeholder="Поиск: текст, автор, город или #номер" />
      </div>

      {loading ? (
        <Spinner />
      ) : applications.length === 0 ? (
        <EmptyState
          icon={<FileText className="w-12 h-12" />}
          title={query ? 'Ничего не найдено' : status === 'pending' ? 'Все заявки проверены' : 'Заявок нет'}
          hint={query ? 'Попробуйте изменить запрос.' : undefined}
        />
      ) : (
        <ul className="space-y-4">
          {applications.map((app) => {
            const busy = busyId === app.id;
            return (
              <li key={app.id} className={`bg-white rounded-xl border p-5 ${app.is_sos ? 'border-red-300' : 'border-gray-200'} ${busy ? 'opacity-60' : ''}`}>
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="font-bold text-gray-900">#{app.id}</span>
                  <StatusBadge status={app.moderation_status || app.status} />
                  <Pill className="bg-blue-50 text-blue-800 border-blue-200">{categoryLabel(app.category)}</Pill>
                  {app.is_sos && (
                    <Pill className="bg-red-600 text-white border-red-600"><AlertTriangle className="w-3 h-3" />SOS</Pill>
                  )}
                  {app.is_sos && !app.moderated_at && (
                    <Pill className="bg-yellow-50 text-yellow-900 border-yellow-300">Уже опубликована, нужна проверка</Pill>
                  )}
                  {app.is_false_call && <Pill className="bg-orange-100 text-orange-800 border-orange-300">Ложная</Pill>}
                </div>

                <p className="text-gray-800 mb-3 whitespace-pre-line line-clamp-3">{app.description}</p>

                <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-600 mb-4">
                  {app.user && (
                    <Link href={`/admin/users/${app.user.id}`} className="flex items-center gap-1 hover:text-blue-700 hover:underline">
                      <User className="w-4 h-4" />{app.user.first_name} {app.user.last_name || ''}
                    </Link>
                  )}
                  {(app.address || app.city) && <span className="flex items-center gap-1"><MapPin className="w-4 h-4 shrink-0" />{app.address || app.city}</span>}
                  {app.date && <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(app.date).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                  {!!app.responses_count && <span className="flex items-center gap-1"><MessageSquare className="w-4 h-4" />{app.responses_count} откликов</span>}
                </div>

                {!!app.media_files?.length && <PhotoGallery className="mb-4 flex flex-wrap gap-2"
                  photos={app.media_files.slice(0, 3).map((media, index) => ({
                    src: '/api/uploads/' + encodeURIComponent(media.file_path), alt: 'Фото заявки ' + (index + 1),
                  }))} />}

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t border-gray-100 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <Link href={`/applications/${app.public_id || app.id}`} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                      <Eye className="w-4 h-4" />Открыть
                    </Link>
                    {needsDecision(app) && (
                      <>
                        <button disabled={busy} onClick={() => approve(app.id)} className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                          <CheckCircle className="w-4 h-4" />Одобрить
                        </button>
                        <button disabled={busy} onClick={() => setRejecting({ id: app.id, reason: '' })} className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                          <XCircle className="w-4 h-4" />Отклонить…
                        </button>
                      </>
                    )}
                    {app.moderation_status === 'approved' && !app.is_false_call && (
                      <InlineConfirm disabled={busy} danger prompt={`Пометить заявку #${app.id} как ложную? Это снизит доверие к автору.`} onConfirm={() => markFalse(app.id)}>
                        <AlertTriangle className="w-4 h-4" />Это ложная заявка
                      </InlineConfirm>
                    )}
                  </div>

                  {app.moderation_status !== 'rejected' && (
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        Приоритет
                        <select disabled={busy} value={priorities[app.id] ?? app.priority ?? 0}
                          onChange={event => setPriorities(current => ({ ...current, [app.id]: Number(event.target.value) }))}
                          className="rounded-lg border border-gray-300 px-2 py-1.5">
                          {PRIORITY_LEVELS.map(level => <option key={level.value} value={level.value}>{level.label}</option>)}
                        </select>
                      </label>
                      {priorities[app.id] !== undefined && priorities[app.id] !== app.priority &&
                        <InlineConfirm disabled={busy} prompt={'Изменить приоритет на ' + priorities[app.id] + '?'}
                          onConfirm={() => setPriority(app.id, priorities[app.id])}>Сохранить приоритет</InlineConfirm>}
                    </div>
                  )}
                </div>

                {rejecting?.id === app.id && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4">
                    <label className="block text-sm font-medium text-red-900 mb-2">
                      Почему заявка отклонена? Автор увидит этот текст.
                    </label>
                    <textarea
                      autoFocus
                      rows={3}
                      maxLength={1000}
                      value={rejecting.reason}
                      onChange={(e) => setRejecting({ id: app.id, reason: e.target.value })}
                      placeholder="Например: не хватает подробностей — укажите, что именно нужно и к какому сроку"
                      className="w-full rounded-lg border border-red-200 px-3 py-2"
                    />
                    <div className="mt-2 flex items-center gap-2">
                      <button disabled={!rejecting.reason.trim()} onClick={submitReject} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700">
                        Отклонить заявку
                      </button>
                      <button onClick={() => setRejecting(null)} className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-white">
                        Отмена
                      </button>
                      <span className="ml-auto text-xs text-gray-500">{rejecting.reason.length}/1000</span>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!loading && hasMore && <button type="button" disabled={loadingMore} className="btn btn-secondary mt-4"
        onClick={() => load(applications.length)}>Показать ещё</button>}
    </>
  );
}

export default function AdminApplicationsPage() {
  return <Suspense fallback={<Spinner />}><AdminApplicationsPageContent /></Suspense>;
}
