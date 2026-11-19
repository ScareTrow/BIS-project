"use client";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import AddressPicker from "@/components/common/AddressPicker";
import { LocationPoint } from "@/lib/api";
import { communityApi, Resource, Confirmation } from "@/lib/community-api";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";
import CategoryBadge from "@/components/common/CategoryBadge";
import { Select } from "@/components/ui/Select";
import { PageHeader } from "@/components/ui/PageHeader";
const categories = ['medicine', 'shelter', 'food', 'clothing', 'household', 'delivery', 'volunteering', 'social_project', 'emergency'] as const;
const ResourceMap = dynamic(
  () => import("@/components/community/ResourceMap"),
  { ssr: false },
);
export default function ResourcesPage() {
  const { user, language } = useStore();
  const t = useTranslation(language);
  const [resources, setResources] = useState<Resource[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    city: "",
    category: "food" as Resource["category"],
  });
  async function load() {
    try {
      setResources(await communityApi.resources(categoryFilter));
      if (user?.is_authenticated)
        setConfirmations(await communityApi.confirmations());
      else setConfirmations([]);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Ошибка загрузки");
    }
  }
  useEffect(() => {
    load();
    if (user?.city) setForm(f => ({ ...f, city: user.city! }));
  }, [categoryFilter, user]);
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
      <PageHeader title={t('resources.title')} description={t('resources.description')} />
      <div className="max-w-sm"><Select label={t('resources.type')} value={categoryFilter} onChange={setCategoryFilter}
        options={[{ value: '', label: t('resources.allTypes') }, ...categories.map(value => ({
          value, label: t(value === 'medicine' ? 'resources.medicine' : value === 'shelter' ? 'resources.shelters' : `category.${value}`),
        }))]} /></div>
      <ResourceMap resources={resources} />
      {message && <p role="status">{message}</p>}
      {!resources.length && <p>Ресурсов выбранного типа пока нет.</p>}
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
            {r.address && <p className="text-sm text-gray-600">{r.address}</p>}
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
                  <div className="flex flex-wrap gap-3">
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
                      className="btn btn-outline"
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
          className="card space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!location) { setMessage('Найдите адрес ресурса или выберите место на карте'); return; }
            perform(() => communityApi.createResource({ ...form, ...location }));
          }}
        >
          <h2 className="text-xl font-semibold">
            Предложить ресурс / добавить точку помощи
          </h2>
          <label className="form-field">
            Название
            <input
              className="form-input"
              required
              maxLength={160}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="form-field">
            Описание
            <textarea
              className="form-textarea"
              maxLength={5000}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </label>
          <label className="form-field">
            Город
            <input
              className="form-input"
              required
              maxLength={200}
              readOnly={!!user?.city}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </label>
          <Select label={t('application.form.category')} value={form.category}
            onChange={category => setForm({ ...form, category })}
            options={categories.map(value => ({ value, label: t(`category.${value}`) }))} />
          <AddressPicker title="Где находится ресурс" city={form.city} value={location} onChange={setLocation} />
          <button disabled={busy} className="btn btn-primary">
            Добавить ресурс
          </button>
        </form>
      )}
    </main>
  );
}
