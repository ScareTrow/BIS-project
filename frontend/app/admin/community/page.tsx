"use client";

import {
  ALL_CATEGORIES, EmptyState, NoticeBar, PageHeader, Pill, Spinner, TRIAGE_PRIORITY,
  useCategoryLabel, useNotice, useRequireAdmin,
} from "@/components/admin/shared";
import { Analytics, communityApi, TriageRule } from "@/lib/community-api";
import { InlineConfirm } from "@/components/ui/ActionFeedback";
import { MapPin, SlidersHorizontal } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const HeatMap = dynamic(() => import("@/components/community/HeatMap"), { ssr: false });

const EMPTY_RULE = { category: "", keyword: "", priority: "high", rule_order: 0, is_active: true };

export default function CommunityAdmin() {
  const ready = useRequireAdmin();
  const categoryLabel = useCategoryLabel();
  const [rules, setRules] = useState<TriageRule[] | null>(null);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [form, setForm] = useState(EMPTY_RULE);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useNotice();

  useEffect(() => {
    if (!ready) return;
    Promise.all([communityApi.rules(), communityApi.analytics()])
      .then(([r, a]) => {
        setRules(r);
        setAnalytics(a);
      })
      .catch((e) => setNotice({ kind: "error", text: e instanceof Error ? e.message : "Не удалось загрузить данные." }));
  }, [ready, setNotice]);

  if (!ready) return <Spinner />;

  const appliesToAll = !form.category && !form.keyword.trim();

  async function add() {
    setBusy(true);
    try {
      setRules(await communityApi.addRule({ ...form, category: form.category || null, keyword: form.keyword.trim() || null }));
      setNotice({ kind: "success", text: "Правило добавлено. Оно применится к новым заявкам." });
      setForm(EMPTY_RULE);
    } catch (err) {
      setNotice({ kind: "error", text: err instanceof Error ? err.message : "Не удалось сохранить правило." });
    } finally {
      setBusy(false);
    }
  }

  const regions = [...(analytics?.regions || [])].sort((a, b) => b.count - a.count);
  const maxRegion = Math.max(1, ...regions.map((r) => r.count));

  return (
    <>
      <PageHeader
        title="Правила и аналитика"
        description="Автоматически поднимайте важные заявки выше и смотрите, в каких городах нужна помощь."
      />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      <section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900">Автоматический приоритет</h2>
        <p className="text-sm text-gray-600 mt-1 mb-4">
          Если новая заявка подходит под правило, её приоритет повышается. Правила никогда не понижают SOS
          и не меняют приоритет, который администратор поставил вручную.
        </p>

        {rules === null ? (
          <Spinner />
        ) : rules.length === 0 ? (
          <EmptyState icon={<SlidersHorizontal className="w-10 h-10" />} title="Правил пока нет" hint="Добавьте первое правило ниже." />
        ) : (
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm">
              <thead className="text-left text-gray-500 border-b">
                <tr>
                  <th className="py-2 pr-4 font-medium">Если категория</th>
                  <th className="py-2 pr-4 font-medium">и в тексте есть</th>
                  <th className="py-2 pr-4 font-medium">то приоритет</th>
                  <th className="py-2 pr-4 font-medium" title="При совпадении нескольких правил первым проверяется меньший номер">Очерёдность</th>
                  <th className="py-2 font-medium">Состояние</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4">{categoryLabel(r.category)}</td>
                    <td className="py-2 pr-4">{r.keyword ? <code className="rounded bg-gray-100 px-1.5">{r.keyword}</code> : <span className="text-gray-400">любой текст</span>}</td>
                    <td className="py-2 pr-4 font-medium">{TRIAGE_PRIORITY[r.priority] || r.priority}</td>
                    <td className="py-2 pr-4">{r.rule_order}</td>
                    <td className="py-2">
                      {r.is_active
                        ? <Pill className="bg-green-100 text-green-800 border-green-300">Включено</Pill>
                        : <Pill className="bg-gray-100 text-gray-600 border-gray-300">Выключено</Pill>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <form onSubmit={(event) => {
          event.preventDefault();
          if (!appliesToAll && !busy) void add();
        }} className="rounded-lg bg-gray-50 border border-gray-200 p-4">
          <h3 className="font-medium text-gray-900 mb-3">Новое правило</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <label className="text-sm text-gray-700">
              Категория
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2" value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}>
                <option value="">Любая</option>
                {ALL_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              Ключевое слово в тексте
              <input className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2" maxLength={160}
                placeholder="например: инсулин" value={form.keyword}
                onChange={(e) => setForm({ ...form, keyword: e.target.value })} />
            </label>
            <label className="text-sm text-gray-700">
              Поставить приоритет
              <select className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2" value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}>
                {Object.entries(TRIAGE_PRIORITY).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-700">
              Очерёдность
              <input className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-2" type="number" value={form.rule_order}
                onChange={(e) => setForm({ ...form, rule_order: Number(e.target.value) })} />
              <span className="text-xs text-gray-500">меньше — проверяется раньше</span>
            </label>
          </div>
          {appliesToAll ? (
            <div className="mt-4">
              <InlineConfirm disabled={busy} prompt="Без категории и ключевого слова правило сработает на все новые заявки. Продолжить?" onConfirm={add}>
                Добавить правило
              </InlineConfirm>
            </div>
          ) : (
            <button className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50" disabled={busy}>
              Добавить правило
            </button>
          )}
        </form>
      </section>

      <section className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900">Где нужна помощь</h2>
        <p className="text-sm text-gray-600 mt-1 mb-4">Активные одобренные заявки по городам.</p>

        {!analytics ? (
          <Spinner />
        ) : regions.length === 0 ? (
          <EmptyState icon={<MapPin className="w-10 h-10" />} title="Активных заявок пока нет" />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ul className="space-y-2">
              {regions.map((r) => (
                <li key={r.city}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-700">{r.city || "Город не указан"}</span>
                    <span className="font-semibold">{r.count}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-100">
                    <div className="h-2.5 rounded-full bg-blue-500" style={{ width: `${(r.count / maxRegion) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <div>
              <HeatMap points={analytics.heatmap} />
              <details className="mt-2 text-sm text-gray-600">
                <summary className="cursor-pointer">Показать точки карты списком</summary>
                <ul className="mt-2 space-y-0.5">
                  {analytics.heatmap.map((p, i) => (
                    <li key={i}>{p.latitude}, {p.longitude}: {p.count} заявок</li>
                  ))}
                </ul>
              </details>
            </div>
          </div>
        )}
      </section>
    </>
  );
}
