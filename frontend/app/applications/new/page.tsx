"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiClient } from "@/lib/api";
import { communityApi, Capability, NeedInput } from "@/lib/community-api";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";
const LocationMap = dynamic(
  () => import("@/components/common/ApplicationMap"),
  { ssr: false },
);
const categories = [
  "food",
  "clothing",
  "household",
  "delivery",
  "volunteering",
  "social_project",
  "medicine",
  "shelter",
  "emergency",
];

export default function NewApplicationPage() {
  const router = useRouter();
  const { user, authLoading, language, setShouldRefreshApplications } =
    useStore();
  const t = useTranslation(language);
  const [form, setForm] = useState({
    description: "",
    needed_help: "",
    city: "",
    category: "food",
    latitude: 43.222,
    longitude: 76.8512,
    priority: "normal",
  });
  const [catalog, setCatalog] = useState<Capability[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  const [needs, setNeeds] = useState<NeedInput[]>([]);
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (authLoading) return;
    if (!user?.is_authenticated) {
      router.push("/login");
      return;
    }
    setForm((f) => ({ ...f, city: user.city || "" }));
    communityApi
      .capabilities()
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, [authLoading, user, router]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!user?.is_authenticated) {
      router.push("/login");
      return;
    }
    if (!form.city.trim() || !form.description.trim()) {
      setError("Укажите город и описание");
      return;
    }
    if (photos.some((f) => f.size === 0 || f.size > 50 * 1024 * 1024)) {
      setError("Файл должен быть непустым, не больше 50 MiB");
      return;
    }
    const fields = { ...form, capability_ids: ids, needs, expires_days: 7 };
    setBusy(true);
    try {
      let result;
      if (photos.length) {
        const data = new FormData();
        Object.entries(fields).forEach(([key, value]) =>
          data.append(
            key,
            typeof value === "object" ? JSON.stringify(value) : String(value),
          ),
        );
        photos.forEach((f) => data.append("media_files", f));
        result = await apiClient.createApplication(data);
      } else {
        result = await apiClient.createApplication(fields);
      }
      setShouldRefreshApplications(true);
      router.push(`/applications/${result.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить заявку");
    } finally {
      setBusy(false);
    }
  }
  if (authLoading)
    return <p className="container mx-auto p-6">Загрузка аккаунта...</p>;
  if (!user?.is_authenticated) return null;
  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">Попросить помощь</h1>
      <p className="mb-6">
        Продукты, вещи, бытовые задачи, волонтёрство и социальные инициативы.
        SOS — для срочной помощи.
      </p>
      <form className="card space-y-5" onSubmit={submit}>
        <label className="block">
          Город
          <input
            className="block border rounded p-2 w-full"
            required
            maxLength={200}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </label>
        <label className="block">
          {t("application.form.category")}
          <select
            className="block border rounded p-2 w-full"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c} value={c}>
                {t(`categories.${c}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          Опишите ситуацию
          <textarea
            className="block border rounded p-2 w-full"
            required
            maxLength={5000}
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="block">
          Какая помощь нужна
          <textarea
            className="block border rounded p-2 w-full"
            maxLength={5000}
            value={form.needed_help}
            onChange={(e) => setForm({ ...form, needed_help: e.target.value })}
          />
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={form.priority === "sos"}
            onChange={(e) =>
              setForm({
                ...form,
                priority: e.target.checked ? "sos" : "normal",
              })
            }
          />
          Срочная помощь — SOS
        </label>
        <p className="text-sm text-gray-600">
          Заявка, включая SOS, появится публично после проверки администратором.
        </p>
        <LocationMap
          center={[form.latitude, form.longitude]}
          onLocationSelect={(latitude: number, longitude: number) =>
            setForm((f) => ({ ...f, latitude, longitude }))
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <label>
            Широта
            <input
              className="block border p-2 w-full"
              type="number"
              min={-90}
              max={90}
              step="any"
              required
              value={form.latitude}
              onChange={(e) =>
                setForm({ ...form, latitude: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Долгота
            <input
              className="block border p-2 w-full"
              type="number"
              min={-180}
              max={180}
              step="any"
              required
              value={form.longitude}
              onChange={(e) =>
                setForm({ ...form, longitude: Number(e.target.value) })
              }
            />
          </label>
        </div>
        <fieldset>
          <legend className="font-semibold mb-2">
            Какие возможности нужны помощнику?
          </legend>
          <div className="grid sm:grid-cols-2 gap-3">
            {catalog.map((c) => (
              <label className="flex gap-2" key={c.id}>
                <input
                  type="checkbox"
                  checked={ids.includes(c.id)}
                  onChange={(e) =>
                    setIds(
                      e.target.checked
                        ? [...ids, c.id]
                        : ids.filter((id) => id !== c.id),
                    )
                  }
                />
                {c.name}
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="space-y-3">
          <legend className="font-semibold">
            Конкретные ресурсы и количество (необязательно)
          </legend>
          {needs.map((n, i) => (
            <div className="grid sm:grid-cols-4 gap-2" key={i}>
              <input
                className="border p-2 min-w-0"
                aria-label="Название ресурса"
                placeholder="Продуктовые наборы"
                required
                maxLength={160}
                value={n.resource_name}
                onChange={(e) =>
                  setNeeds(
                    needs.map((x, j) =>
                      j === i ? { ...x, resource_name: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                className="border p-2 min-w-0"
                aria-label="Единица измерения"
                placeholder="набор"
                required
                maxLength={32}
                value={n.unit}
                onChange={(e) =>
                  setNeeds(
                    needs.map((x, j) =>
                      j === i ? { ...x, unit: e.target.value } : x,
                    ),
                  )
                }
              />
              <input
                className="border p-2 min-w-0"
                aria-label="Необходимое количество"
                type="number"
                min="0.001"
                step="0.001"
                required
                value={n.quantity_needed}
                onChange={(e) =>
                  setNeeds(
                    needs.map((x, j) =>
                      j === i
                        ? { ...x, quantity_needed: Number(e.target.value) }
                        : x,
                    ),
                  )
                }
              />
              <button
                type="button"
                onClick={() => setNeeds(needs.filter((_, j) => j !== i))}
              >
                Убрать
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-blue-700 underline"
            disabled={needs.length >= 30}
            onClick={() =>
              setNeeds([
                ...needs,
                { resource_name: "", unit: "", quantity_needed: 1 },
              ])
            }
          >
            Добавить потребность
          </button>
        </fieldset>
        <label className="block">
          Фото (необязательно)
          <input
            className="block mt-2"
            type="file"
            multiple
            accept="image/*"
            onChange={(e) => setPhotos(Array.from(e.target.files || []))}
          />
        </label>
        {photos.length > 0 && <p>{photos.map((f) => f.name).join(", ")}</p>}
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {busy ? "Отправка..." : "Отправить на проверку"}
        </button>
      </form>
    </main>
  );
}
