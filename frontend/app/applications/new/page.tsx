"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { apiClient } from "@/lib/api";
import { communityApi, Capability, NeedInput } from "@/lib/community-api";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";
import { validateRequestPhotos } from "@/lib/requestValidation";
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
    latitude: "",
    longitude: "",
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
    if (!form.latitude || !form.longitude) {
      setError("Выберите точку на карте или укажите координаты");
      return;
    }
    if (form.description.trim().length < 10 || form.description.trim().length > 1000) {
      setError("Описание должно содержать от 10 до 1000 символов");
      return;
    }
    const photoError = validateRequestPhotos(photos);
    if (photoError) { setError(photoError); return; }
    const fields = { ...form, latitude: Number(form.latitude), longitude: Number(form.longitude), capability_ids: ids, needs, expires_days: 7 };
    setBusy(true);
    try {
      const data = new FormData();
      Object.entries(fields).forEach(([key, value]) =>
        data.append(key, typeof value === "object" ? JSON.stringify(value) : String(value)));
      photos.forEach((f) => data.append("media_files", f));
      const result = await apiClient.createApplication(data);
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
        <label className="form-field">
          Город
          <input
            className="form-input"
            required
            maxLength={200}
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
          />
        </label>
        <label className="form-field">
          {t("application.form.category")}
          <select
            className="form-select"
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
        <label className="form-field">
          Опишите ситуацию
          <textarea
            className="form-textarea"
            required
            minLength={10}
            maxLength={1000}
            rows={4}
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </label>
        <label className="form-field">
          Какая помощь нужна
          <textarea
            className="form-textarea"
            maxLength={5000}
            value={form.needed_help}
            onChange={(e) => setForm({ ...form, needed_help: e.target.value })}
          />
        </label>
        <label className="flex items-start gap-3 text-sm text-gray-700">
          <input className="form-checkbox"
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
          Обычная заявка появится после проверки. SOS публикуется сразу; не более трёх SOS в час.
        </p>
        <LocationMap
          selected={form.latitude !== '' && form.longitude !== ''}
          center={[form.latitude === '' ? 43.222 : Number(form.latitude), form.longitude === '' ? 76.8512 : Number(form.longitude)]}
          onLocationSelect={(latitude: number, longitude: number) =>
            setForm((f) => ({ ...f, latitude: String(latitude), longitude: String(longitude) }))
          }
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="form-field">
            Широта
            <input
              className="form-input"
              type="number"
              min={-90}
              max={90}
              step="any"
              required
              value={form.latitude}
              onChange={(e) =>
                setForm({ ...form, latitude: e.target.value })
              }
            />
          </label>
          <label className="form-field">
            Долгота
            <input
              className="form-input"
              type="number"
              min={-180}
              max={180}
              step="any"
              required
              value={form.longitude}
              onChange={(e) =>
                setForm({ ...form, longitude: e.target.value })
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
              <label className="flex items-start gap-3 text-sm text-gray-700" key={c.id}>
                <input className="form-checkbox"
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
                className="form-input"
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
                className="form-input"
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
                className="form-input"
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
                className="btn btn-outline"
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
        <label className="form-field">
          Фото: от 1 до 3, JPEG/PNG, до 10 МБ каждое
          <input
            className="form-file"
            type="file"
            multiple
            required
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
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
          {busy ? "Отправка..." : form.priority === 'sos' ? 'Опубликовать SOS' : "Отправить на проверку"}
        </button>
      </form>
    </main>
  );
}
