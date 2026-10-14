"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { communityApi, Resource, Confirmation } from "@/lib/community-api";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";
import CategoryBadge from "@/components/common/CategoryBadge";
const ResourceMap = dynamic(
  () => import("@/components/community/ResourceMap"),
  { ssr: false },
);
export default function ResourcesPage() {
  const { user, language } = useStore();
  const t = useTranslation(language);
  const [resources, setResources] = useState<Resource[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [city, setCity] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    city: "",
    category: "food" as Resource["category"],
    latitude: 43.222,
    longitude: 76.8512,
  });
  async function load() {
    try {
      setResources(await communityApi.resources(city));
      if (user?.is_authenticated)
        setConfirmations(await communityApi.confirmations());
      else setConfirmations([]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }
  useEffect(() => {
    load();
  }, [city, user]);
  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setMessage("");
    try {
      await action();
      await load();
      setMessage("Изменения сохранены");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }
  const labels: Record<string, string> = {
    available: "Доступен",
    unavailable: "Недоступен",
    outdated: "Информация устарела",
  };
  return (
    <main className="container mx-auto max-w-5xl px-4 py-8 space-y-6">
      <h1 className="text-3xl font-bold">Ресурсы рядом</h1>
      <p>
        Здесь предлагают ресурсы и показывают точки помощи. Просьбы о помощи
        находятся в заявках.
      </p>
      <label className="block">
        Фильтр по городу
        <input
          className="border p-2 ml-3"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </label>
      <ResourceMap resources={resources} />
      {message && <p role="status">{message}</p>}
      {!resources.length && <p>В выбранном городе пока нет ресурсов.</p>}
      <div className="grid md:grid-cols-2 gap-4">
        {resources.map((r) => (
          <article
            id={`resource-${r.id}`}
            className="card space-y-3"
            key={r.id}
          >
            <h2 className="text-xl font-semibold">{r.name}</h2>
            <CategoryBadge category={r.category} />
            <p>{r.description}</p>
            <p>
              {r.city} · {labels[r.availability]}
            </p>
            <p className="text-sm">
              Подтверждено:{" "}
              {r.last_confirmed_at
                ? new Date(r.last_confirmed_at).toLocaleString()
                : "Пока нет подтверждения"}
            </p>
            {(user?.id === r.owner_id || user?.isAdmin) && (
              <button
                className="text-blue-700 underline"
                disabled={busy}
                onClick={() => perform(() => communityApi.remind(r.id))}
              >
                Запросить подтверждение
              </button>
            )}
            {confirmations
              .filter(
                (c) =>
                  c.resource_id === r.id &&
                  !c.answer &&
                  new Date(c.expires_at) > new Date(),
              )
              .map((c) => (
                <div key={c.id} className="border-t pt-3 space-y-2">
                  <p>
                    Ресурс ещё доступен? Ответьте до{" "}
                    {new Date(c.expires_at).toLocaleString()}.
                  </p>
                  <div className="flex gap-3">
                    <button
                      disabled={busy}
                      className="btn btn-primary"
                      onClick={() =>
                        perform(() => communityApi.confirm(c.id, "available"))
                      }
                    >
                      Доступен
                    </button>
                    <button
                      disabled={busy}
                      className="border px-3"
                      onClick={() =>
                        perform(() => communityApi.confirm(c.id, "unavailable"))
                      }
                    >
                      Недоступен
                    </button>
                  </div>
                </div>
              ))}
          </article>
        ))}
      </div>
      {user?.is_authenticated && (
        <form
          className="card space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            perform(() => communityApi.createResource(form));
          }}
        >
          <h2 className="text-xl font-semibold">
            Предложить ресурс / добавить точку помощи
          </h2>
          <label className="block">
            Название
            <input
              className="border p-2 block w-full"
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="block">
            Описание
            <textarea
              className="border p-2 block w-full"
              maxLength={5000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="block">
            Город
            <input
              className="border p-2 block w-full"
              required
              maxLength={200}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <label className="block">
            Категория
            <select
              className="border p-2 block"
              value={form.category}
              onChange={(e) =>
                setForm({
                  ...form,
                  category: e.target.value as Resource["category"],
                })
              }
            >
              {[
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
                  {t(`categories.${c}`)}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-3">
            <label>
              Широта
              <input
                className="border p-2 block w-full"
                required
                type="number"
                step="any"
                min={-90}
                max={90}
                value={form.latitude}
                onChange={(e) =>
                  setForm({ ...form, latitude: Number(e.target.value) })
                }
              />
            </label>
            <label>
              Долгота
              <input
                className="border p-2 block w-full"
                required
                type="number"
                step="any"
                min={-180}
                max={180}
                value={form.longitude}
                onChange={(e) =>
                  setForm({ ...form, longitude: Number(e.target.value) })
                }
              />
            </label>
          </div>
          <button disabled={busy} className="btn btn-primary">
            Добавить ресурс
          </button>
        </form>
      )}
    </main>
  );
}
