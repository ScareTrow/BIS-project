"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isAxiosError } from 'axios';
import PhotoPreviews from '@/components/common/PhotoPreviews';
import { ALL_CATEGORIES, CATEGORY_META } from '@/lib/categories';
import AddressPicker from "@/components/common/AddressPicker";
import { apiClient, type ApplicationCategory, LocationPoint } from "@/lib/api";
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
type FieldErrors = Partial<Record<'location' | 'photos' | 'needs' | 'submit', string>>;

export default function NewApplicationPage() {
  const router = useRouter();
  const { user, authLoading, language, setShouldRefreshApplications } =
    useStore();
  const t = useTranslation(language);
  const [category, setCategory] = useState<ApplicationCategory>('food');
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
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const photoInput = useRef<HTMLInputElement>(null);
  const additional = useRef<HTMLDetailsElement>(null);
  const [showAdditional, setShowAdditional] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (authLoading) return;
    if (!user?.is_authenticated) router.push('/login?next=%2Fapplications%2Fnew');
  }, [authLoading, user?.is_authenticated, router]);
  useEffect(() => {
    if (!showAdditional) return;
    let active = true;
    communityApi.capabilities().then(items => {
      if (active) setCatalog(items);
    }).catch(() => {
      if (active) setFieldErrors(current => ({ ...current, needs: 'ui.action.error' }));
    });
    return () => { active = false; };
  }, [showAdditional]);

  async function submit({ description }: { description: string }) {
    setFieldErrors({});
    if (!user?.is_authenticated) {
      router.push('/login?next=%2Fapplications%2Fnew');
      return;
    }
    const destination = category === 'delivery' ? dropoff : location;
    if (!destination || (category === 'delivery' && !pickup)) {
      setFieldErrors({ location: t(category === 'delivery' ? 'request.create.deliveryError' : 'request.create.locationError') });
      return;
    }
    const filledNeeds = needs.filter(need => need.resource_name.trim() || need.unit.trim() ||
      (need.quantity_needed !== 1 && !Number.isNaN(need.quantity_needed)));
    if (filledNeeds.some(need => !need.resource_name.trim() || !need.unit.trim() || !Number.isFinite(need.quantity_needed) || need.quantity_needed <= 0)) {
      if (additional.current) additional.current.open = true;
      setFieldErrors({ needs: 'request.create.needsError' });
      return;
    }
    const photoError = validateRequestPhotos(photos, t);
    if (photoError) { setFieldErrors({ photos: photoError }); return; }
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
      const message = e instanceof Error && language === 'ru' ? e.message : t('ui.action.error');
      const status = isAxiosError(e) ? e.response?.status : undefined;
      const photoFailure = status === 413 || status === 415 ||
        (status === 400 && /файл|фото|jpeg|png|image/i.test(e instanceof Error ? e.message : ''));
      setFieldErrors(photoFailure ? { photos: message } : { submit: message });
    } finally {
      setBusy(false);
    }
  }
  if (authLoading)
    return <p className="container mx-auto p-6">{t('ui.loading')}</p>;
  if (!user?.is_authenticated) return null;
  return (
    <PageContainer width="form">
      <PageHeader title={t('request.create.title')} description={t('request.create.review')} />
      <form className="card space-y-5" onSubmit={handleSubmit(submit, () => setFieldErrors({}))} noValidate>
        <Select label={t('application.form.category')} value={category} onChange={setCategory}
          options={ALL_CATEGORIES.map(value => ({ value, label: t(CATEGORY_META[value].labelKey) }))} />
        {category === 'delivery' ? <div className="space-y-6">
          <AddressPicker title={t('request.delivery.pickup')} value={pickup} onChange={setPickup} />
          <label className="form-field">{t('request.create.pickupEntrance')}
            <input className="form-input" maxLength={200} value={pickupEntrance}
              onChange={event => setPickupEntrance(event.target.value)} />
          </label>
          <AddressPicker title={t('request.delivery.dropoff')} value={dropoff} onChange={setDropoff} allowCurrentLocation />
          <label className="form-field">{t('request.create.dropoffEntrance')}
            <input className="form-input" maxLength={200} value={dropoffEntrance}
              onChange={event => setDropoffEntrance(event.target.value)} />
          </label>
        </div> : <AddressPicker title={t('request.create.location')} value={location} onChange={setLocation} allowCurrentLocation />}
        {fieldErrors.location && <p role="alert" className="text-danger-dark">{fieldErrors.location}</p>}
        <Textarea id="request-description" label={t('request.create.description')} minLength={10} maxLength={1000}
          rows={4} error={errors.description?.message} {...register('description', {
            validate: value => (value.trim().length >= 10 && value.trim().length <= 1000) || t('request.create.descriptionError'),
          })} />
        <label className="form-field">
          {t('request.create.photos')}
          <input
            ref={photoInput}
            aria-invalid={Boolean(fieldErrors.photos)}
            aria-describedby={fieldErrors.photos ? 'request-photos-error' : undefined}
            className="form-file"
            type="file"
            multiple
            required
            accept="image/jpeg,image/png,.jpg,.jpeg,.jfif,.png"
            onChange={event => {
              setPhotos(Array.from(event.target.files || []));
              setFieldErrors(current => ({ ...current, photos: undefined }));
            }}
          />
        </label>
        {fieldErrors.photos && <p id="request-photos-error" role="alert" className="text-danger-dark">{fieldErrors.photos}</p>}
        <PhotoPreviews photos={photos} onRemove={index => {
          setPhotos(current => current.filter((_, currentIndex) => currentIndex !== index));
          if (photoInput.current) photoInput.current.value = '';
          setFieldErrors(current => ({ ...current, photos: undefined }));
        }} />
        <details ref={additional} className="space-y-3 rounded-md border p-3" onToggle={event => {
          if (event.currentTarget.open) setShowAdditional(true);
        }}>
          <summary className="cursor-pointer font-semibold">{t('request.create.additional')}</summary>
        {catalog.length > 0 && <CheckboxChipGroup label={t('request.create.capabilities')} value={ids} onChange={setIds}
          options={catalog.map(c => ({value: c.id, label: t(`capability.${c.code}`) === `capability.${c.code}` ? c.name : t(`capability.${c.code}`)}))} />}
        <fieldset className="space-y-3">
          <legend className="font-semibold">
            {t('request.create.quantities')}
          </legend>
          {needs.map((n, i) => (
            <div className="grid sm:grid-cols-4 gap-2" key={i}>
              <input
                className="form-input"
                aria-label={t('request.create.resource')}

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
                aria-label={t('request.create.unit')}

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
                aria-label={t('request.create.quantity')}
                type="number"
                min="0.001"
                step="0.001"
                value={Number.isNaN(n.quantity_needed) ? '' : n.quantity_needed}
                onChange={(e) =>
                  setNeeds(
                    needs.map((x, j) =>
                      j === i
                        ? { ...x, quantity_needed: e.target.valueAsNumber }
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
                {t('request.create.remove')}
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
            {t('request.create.addNeed')}
          </button>
        </fieldset>
        {fieldErrors.needs && <p role="alert" className="text-danger-dark">{t(fieldErrors.needs)}</p>}
        </details>
        {fieldErrors.submit && <p role="alert" className="text-danger-dark">{fieldErrors.submit}</p>}
        <Button type="submit" busy={busy}>{t('request.create.submit')}</Button>
      </form>
    </PageContainer>
  );
}
