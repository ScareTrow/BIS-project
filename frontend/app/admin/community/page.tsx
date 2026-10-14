"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
const HeatMap = dynamic(() => import("@/components/community/HeatMap"), {
  ssr: false,
});
import { useStore } from "@/lib/store";
import { communityApi, TriageRule, Analytics } from "@/lib/community-api";
export default function CommunityAdmin() {
  const { user, authLoading } = useStore();
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
      {message && <p role="status">{message}</p>}
      <section className="card space-y-3">
        <h2 className="text-xl font-semibold">Автоматические правила</h2>
        <p>
          Правила применяются к новым заявкам. Они не понижают SOS и решения
          администратора.
        </p>
        {rules.map((r) => (
          <p key={r.id}>
            {r.category || "Любая категория"} · {r.keyword || "Любое описание"}{" "}
            → {r.priority} · Порядок {r.rule_order} ·{" "}
            {r.is_active ? "Включено" : "Выключено"}
          </p>
        ))}
        <form onSubmit={add} className="space-y-3">
          <label className="block">
            Категория
            <select
              className="border p-2 ml-2"
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
                  {c || "Любая"}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Ключевое слово
            <input
              className="border p-2 ml-2"
              maxLength={160}
              value={form.keyword}
              onChange={(e) => setForm({ ...form, keyword: e.target.value })}
            />
          </label>
          <label className="block">
            Приоритет
            <select
              className="border p-2 ml-2"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {["normal", "high", "sos"].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label className="block">
            Порядок
            <input
              className="border p-2 ml-2"
              type="number"
              value={form.rule_order}
              onChange={(e) =>
                setForm({ ...form, rule_order: Number(e.target.value) })
              }
            />
          </label>
          <button className="btn btn-primary" disabled={busy}>
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
            <p key={r.city}>
              {r.city}: {r.count}
            </p>
          ))
        ) : (
          <p>Заявок пока нет.</p>
        )}
        <h3 className="font-semibold mt-4">Тепловая карта потребности</h3>
        {analytics && <HeatMap points={analytics.heatmap} />}
        {analytics?.heatmap.map((p, i) => (
          <p key={i}>
            {p.latitude}, {p.longitude}: {p.count} заявок
          </p>
        ))}
      </section>
    </main>
  );
}
