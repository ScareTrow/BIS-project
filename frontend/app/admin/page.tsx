'use client';

import { ADMIN_COUNTS_EVENT, PageHeader, Spinner, useCategoryLabel, useRequireAdmin } from '@/components/admin/shared';
import { apiClient } from '@/lib/api';
import {
  AlertTriangle, ArrowRight, CheckCircle, ClipboardCheck,
  TrendingUp, Users, XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

type AdminStats = Awaited<ReturnType<typeof apiClient.getAdminStats>>;

const percent = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 100) : 0);

export default function AdminPage() {
  const ready = useRequireAdmin();
  const categoryLabel = useCategoryLabel();
  const [counts, setCounts] = useState<Awaited<ReturnType<typeof apiClient.getAdminCounts>> | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    const load = () => apiClient.getAdminCounts().then(data => { if (active) setCounts(data); })
      .catch(() => { if (active) setError(true); });
    void load();
    window.addEventListener(ADMIN_COUNTS_EVENT, load);
    return () => { active = false; window.removeEventListener(ADMIN_COUNTS_EVENT, load); };
  }, [ready]);

  if (!ready) return <Spinner />;
  if (error) return <p className="text-red-700">Не удалось загрузить статистику. Обновите страницу.</p>;
  if (!counts) return <Spinner />;

  const maxCategory = Math.max(1, ...(stats?.category_stats || []).map((c) => c.count));
  const categories = [...(stats?.category_stats || [])].sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader title="Обзор" description="Главное на сегодня: что ждёт вашего решения и как работает платформа." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <StatCard label="SOS ждут проверки" value={counts.pending_sos} tone="red"
          icon={<AlertTriangle className="h-5 w-5" />} href="/admin/applications?status=pending" />
        <StatCard label="Пункты помощи ждут проверки" value={counts.pending_resources} tone="yellow" href="/admin/resources" />
      </div>
      {counts.pending_applications > 0 ? (
        <Link
          href="/admin/applications?status=pending"
          className="group mb-8 flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border-2 border-yellow-300 bg-yellow-50 p-5 hover:bg-yellow-100 transition-colors"
        >
          <ClipboardCheck className="w-10 h-10 text-yellow-600 shrink-0" />
          <div className="flex-1">
            <p className="text-lg font-bold text-gray-900">
              {counts.pending_applications} {plural(counts.pending_applications, 'заявка ждёт', 'заявки ждут', 'заявок ждут')} проверки
            </p>
            <p className="text-gray-700 text-sm">Пока заявка не одобрена, волонтёры её не видят. Начните с них.</p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-lg bg-yellow-500 px-4 py-2 font-semibold text-white group-hover:bg-yellow-600">
            Перейти к проверке <ArrowRight className="w-4 h-4" />
          </span>
        </Link>
      ) : (
        <div className="mb-8 flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 p-5">
          <CheckCircle className="w-8 h-8 text-green-600" />
          <p className="font-medium text-green-900">Все заявки проверены — новых задач нет.</p>
        </div>
      )}

      <details className="rounded-xl border border-gray-200 bg-white p-4" onToggle={event => {
        if (event.currentTarget.open && !stats) void apiClient.getAdminStats().then(setStats).catch(() => setError(true));
      }}>
        <summary className="cursor-pointer font-semibold">Статистика заявок и активности</summary>
        {stats && <div className="mt-4">
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Заявки</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Всего" value={stats.total_applications} href="/admin/applications?status=all" />
        <StatCard label="Ждут проверки" value={counts.pending_applications} tone="yellow" href="/admin/applications?status=pending" />
        <StatCard
          label="Одобрено" value={stats.approved_applications} tone="green" href="/admin/applications?status=approved"
          hint={`${percent(stats.approved_applications, stats.total_applications)}% от всех`}
          icon={<CheckCircle className="w-5 h-5" />}
        />
        <StatCard label="Отклонено" value={stats.rejected_applications} tone="red" href="/admin/applications?status=rejected" icon={<XCircle className="w-5 h-5" />} />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Активность</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Откликов волонтёров" value={stats.total_responses} icon={<TrendingUp className="w-5 h-5" />} />
        <StatCard label="Волонтёров помогли" value={stats.volunteers_count} tone="green" icon={<Users className="w-5 h-5" />} />
        <StatCard
          label="Ложных заявок" value={stats.false_calls_count} tone="red" icon={<AlertTriangle className="w-5 h-5" />}
          hint={`${percent(stats.false_calls_count, stats.total_applications)}% от всех`}
        />
      </div>

      {/* 3. Категории */}
      {categories.length > 0 && (
        <section className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Заявки по категориям</h2>
          <ul className="space-y-3">
            {categories.map((c) => (
              <li key={c.category}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-700">{categoryLabel(c.category)}</span>
                  <span className="font-semibold text-gray-900">{c.count}</span>
                </div>
                <div className="h-3 rounded-full bg-gray-100">
                  <div className="h-3 rounded-full bg-blue-500" style={{ width: `${(c.count / maxCategory) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

        </div>}
      </details>
    </>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

const TONES = {
  gray: 'text-gray-900',
  yellow: 'text-yellow-600',
  green: 'text-green-600',
  red: 'text-red-600',
};

function StatCard({ label, value, hint, tone = 'gray', href, icon }: {
  label: string; value: number; hint?: string; tone?: keyof typeof TONES; href?: string; icon?: ReactNode;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{label}</span>
        <span className={TONES[tone]}>{icon}</span>
      </div>
      <p className={`mt-1 text-3xl font-bold ${TONES[tone]}`}>{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-1">{hint}</p>}
    </>
  );
  const cls = 'block bg-white rounded-xl border border-gray-200 p-4';
  return href ? <Link href={href} className={`${cls} hover:border-blue-300 hover:shadow-sm transition`}>{body}</Link> : <div className={cls}>{body}</div>;
}
