"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AddressPicker from "@/components/common/AddressPicker";
import { apiClient, LocationPoint } from "@/lib/api";
import { communityApi, Capability, NeedInput } from "@/lib/community-api";
import { useStore } from "@/lib/store";
import { useTranslation } from "@/lib/i18n";
import { validateRequestPhotos } from "@/lib/requestValidation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { PageContainer } from "@/components/ui/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { CheckboxChipGroup } from "@/components/ui/CheckboxChipGroup";
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
  const [category, setCategory] = useState("food");
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { description: "" } });
  const [location, setLocation] = useState<LocationPoint | null>(null);
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [dropoff, setDropoff] = useState<LocationPoint | null>(null);
  const [pickupEntrance, setPickupEntrance] = useState('');
  const [dropoffEntrance, setDropoffEntrance] = useState('');
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
    communityApi
      .capabilities()
      .then(setCatalog)
      .catch((e) => setError(e.message));
  }, [authLoading, user, router]);
  async function submit({ description }: { description: string }) {
    setError("");
    if (!user?.is_authenticated) {
      router.push("/login");
      return;
    }
    const destination = category === 'delivery' ? dropoff : location;
    if (!destination || (category === 'delivery' && !pickup)) {
      setError(t(category === 'delivery' ? 'request.create.deliveryError' : 'request.create.locationError'));
      return;
    }
    const filledNeeds = needs.filter(need => need.resource_name.trim() || need.unit.trim() || ![0, 1].includes(need.quantity_needed));
    if (filledNeeds.some(need => !need.resource_name.trim() || !need.unit.trim() || !Number.isFinite(need.quantity_needed) || need.quantity_needed <= 0)) {
      setError(t('request.create.needsError'));
      return;
    }
    const photoError = validateRequestPhotos(photos, t);
    if (photoError) { setError(photoError); return; }
    const fields = { description: description.trim(), category, latitude: destination.latitude, longitude: destination.longitude, address: destination.address,
      ...(pickup && category === 'delivery' ? { delivery_details: { pickup: { ...pickup, entrance: pickupEntrance }, dropoff: { ...destination, entrance: dropoffEntrance } } } : {}),
      capability_ids: ids, needs: filledNeeds, expires_days: 7 };
    setBusy(true);
    try {
      const data = new FormData();
      Object.entries(fields).forEach(([key, value]) =>
        data.append(key, typeof value === "object" ? JSON.stringify(value) : String(value)));
      photos.forEach((f) => data.append("media_files", f));
      const result = await apiClient.createApplication(data);
      setShouldRefreshApplications(true);
      router.push(`/applications/${result.public_id || result.id}`);
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
    <PageContainer width="form">
      <PageHeader title={t('request.create.title')} description={t('request.create.review')} />
      <form className="card space-y-5" onSubmit={handleSubmit(submit, () => setError(''))} noValidate>
        <Textarea id="request-description" label={t('request.create.description')} minLength={10} maxLength={1000}
          rows={4} error={errors.description?.message} {...register('description', {
            validate: value => (value.trim().length >= 10 && value.trim().length <= 1000) || t('request.create.descriptionError'),
          })} />
        <Select label={t('application.form.category')} value={category} onChange={setCategory}
          options={categories.map(value => ({ value, label: t(`category.${value}`) }))} />
        {category === 'delivery' ? <div className="space-y-6">
          <AddressPicker title="Откуда забрать" value={pickup} onChange={setPickup} />
          <label className="form-field">Подъезд / вход для получения
            <input className="form-input" maxLength={200} value={pickupEntrance} placeholder="Например: вход со двора, подъезд 2"
              onChange={event => setPickupEntrance(event.target.value)} />
          </label>
          <AddressPicker title="Куда доставить" value={dropoff} onChange={setDropoff} />
          <label className="form-field">Подъезд / вход для доставки
            <input className="form-input" maxLength={200} value={dropoffEntrance} placeholder="Например: главный вход, позвонить у двери"
              onChange={event => setDropoffEntrance(event.target.value)} />
          </label>
        </div> : <AddressPicker title={t('request.create.location')} value={location} onChange={setLocation} />}
        {catalog.length > 0 && <CheckboxChipGroup label={t('request.create.capabilities')} value={ids} onChange={setIds}
          options={catalog.map(c => ({value: c.id, label: t(`capability.${c.code}`) === `capability.${c.code}` ? c.name : t(`capability.${c.code}`)}))} />}
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
          {t('request.create.photos')}
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
        <Button type="submit" busy={busy}>{t('request.create.submit')}</Button>
      </form>
    </PageContainer>
  );
}
