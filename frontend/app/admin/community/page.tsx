"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const HeatMap = dynamic(() => import("@/components/community/HeatMap"), {
  ssr: false,
});
import { useStore } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";
import { communityApi, TriageRule, Analytics } from "@/lib/community-api";
export default function CommunityAdmin() {
  const { user, authLoading, language } = useStore();
  const t = useTranslation(language);
  const [rules, setRules] = useState<TriageRule[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    category: "",
    keyword: "",
    priority: "high",
    rule_order: 0,
    is_active: true,
  });
  useEffect(() => {
    if (user?.isAdmin)
      Promise.all([communityApi.rules(), communityApi.analytics()])
        .then(([r, a]) => {
          setRules(r);
          setAnalytics(a);
        })
        .catch((e) => setMessage(e.message));
  }, [user]);
  if (authLoading) return <p className="p-6">Загрузка...</p>;
  if (!user?.isAdmin)
    return <p className="p-6">Доступ разрешён только администратору.</p>;
  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      setRules(
        await communityApi.addRule({
          ...form,
          category: form.category || null,
          keyword: form.keyword || null,
        }),
      );
      setMessage("Правило сохранено");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="container mx-auto max-w-4xl p-6 space-y-6">
      <h1 className="text-3xl font-bold">
        Приоритеты и региональная потребность
      </h1>
      {message && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">{message}</p>}
      <section className="card space-y-5">
        <h2 className="text-xl font-semibold">Автоматические правила</h2>
        <p className="text-sm leading-relaxed text-gray-600">
          Правила применяются к новым заявкам. Они не понижают SOS и решения
          администратора.
        </p>
        {rules.map((r) => (
          <p key={r.id} className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm leading-relaxed">
            {t(`categories.${r.category || 'any'}`)} · {r.keyword || "Любое описание"}{" "}
            → {t(`priorities.${r.priority}`)} · Порядок {r.rule_order} ·{" "}
            {r.is_active ? "Включено" : "Выключено"}
          </p>
        ))}
        <form onSubmit={add} className="grid gap-5 sm:grid-cols-2">
          <label className="form-field">
            Категория
            <select
              className="form-select"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
            >
              {[
                "",
                "food",
                "clothing",
                "household",
                "delivery",
                "volunteering",
                "social_project",
                "medicine",
                "shelter",
                "emergency",
              ].map((c) => (
                <option key={c} value={c}>
                  {t(`categories.${c || 'any'}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Ключевое слово
            <input
              className="form-input"
              maxLength={160}
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            />
          </label>
          <label className="form-field">
            Приоритет
            <select
              className="form-select"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {["normal", "high", "sos"].map((p) => (
                <option key={p} value={p}>{t(`priorities.${p}`)}</option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Порядок
            <input
              className="form-input"
              type="number"
              value={form.rule_order}
              onChange={(e) =>
                setForm({ ...form, rule_order: Number(e.target.value) })
              }
            />
          </label>
          <button className="btn btn-primary justify-self-start sm:col-span-2" disabled={busy}>
            Добавить правило
          </button>
        </form>
      </section>
      <section className="card">
        <h2 className="text-xl font-semibold mb-3">
          Активные одобренные заявки по городам
        </h2>
        {analytics?.regions.length ? (
          analytics.regions.map((r) => (
            <p key={r.city} className="flex items-center justify-between gap-4 border-b border-gray-100 py-3 text-sm">
              <span>{r.city}</span><span className="font-semibold text-gray-900">{r.count}</span>
            </p>
          ))
        ) : (
          <p>Заявок пока нет.</p>
        )}
        <h3 className="font-semibold mt-6 mb-3">Тепловая карта потребности</h3>
        {analytics && <HeatMap points={analytics.heatmap} />}
        {analytics?.heatmap.map((p, i) => (
          <p key={i} className="mt-2 text-xs text-gray-500">
            {p.latitude}, {p.longitude}: {p.count} заявок
          </p>
        ))}
      </section>
    </main>
  );
}
