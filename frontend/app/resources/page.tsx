'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import AddressPicker from '@/components/common/AddressPicker';
import { CurrentLocationControl, useCurrentLocation } from '@/components/common/CurrentLocationControl';
import { ActionFeedback } from '@/components/ui/ActionFeedback';
import { Button, buttonClassName } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Textarea } from '@/components/ui/Input';
import { PageContainer } from '@/components/ui/PageContainer';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionTitle } from '@/components/ui/SectionTitle';
import { Select } from '@/components/ui/Select';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { LocationPoint } from '@/lib/api';
import { communityApi, type Resource, type Confirmation } from '@/lib/community-api';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { validateRequestPhotos } from '@/lib/requestValidation';

const categories = ['medicine', 'shelter', 'food', 'clothing', 'household', 'delivery', 'volunteering', 'social_project', 'emergency'] as const;

export default function ResourcesPage() {
  const { user, language, authLoading } = useStore();
  const t = useTranslation(language);
  const [offers, setOffers] = useState<Resource[]>([]);
  const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [point, setPoint] = useState<LocationPoint | null>(null);
  const [category, setCategory] = useState<Resource['category']>('food');
  const [city, setCity] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error?: boolean }>({ message: '' });
  const [loadError, setLoadError] = useState(false);
  const currentLocation = useCurrentLocation();
  const authenticated = !!user?.is_authenticated;

  useEffect(() => {
    setOffers([]);
    setConfirmations([]);
    if (!authenticated) return;
    let active = true;
    Promise.all([communityApi.myResources(), communityApi.confirmations()]).then(([resources, reminders]) => {
      if (!active) return;
      setOffers(current => {
        const loadedIds = new Set(resources.map(resource => resource.id));
        return [...current.filter(resource => !loadedIds.has(resource.id)), ...resources];
      });
      setConfirmations(reminders);
      setLoadError(false);
    }).catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [authenticated, user?.id]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!point) {
      setFeedback({ message: t('request.create.locationError'), error: true });
      return;
    }
    const data = new FormData(form);
    const files = data.getAll('media_files').filter((file): file is File => file instanceof File && !!file.name);
    const photoError = files.length ? validateRequestPhotos(files, t) : null;
    if (photoError) { setFeedback({ message: photoError, error: true }); return; }
    data.delete('media_files');
    files.forEach(file => data.append('media_files', file));
    data.set('category', category);
    data.set('latitude', String(point.latitude));
    data.set('longitude', String(point.longitude));
    data.set('address', point.address);
    setBusy(true);
    setFeedback({ message: '' });
    try {
      const resource = await communityApi.createResource(data);
      setOffers(current => [resource, ...current.filter(item => item.id !== resource.id)]);
      form.reset();
      setPoint(null);
      setCategory('food');
      setFeedback({ message: t('resources.submitted') });
    } catch (error) {
      setFeedback({ message: error instanceof Error && language === 'ru' ? error.message : t('ui.action.error'), error: true });
    } finally {
      setBusy(false);
    }
  }

  async function answer(id: number, availability: 'available' | 'unavailable') {
    setBusy(true);
    setFeedback({ message: '' });
    try {
      await communityApi.confirm(id, availability);
      const resourceId = confirmations.find(item => item.id === id)?.resource_id;
      setConfirmations(items => items.filter(item => item.id !== id));
      setOffers(items => items.map(resource => resource.id === resourceId ? { ...resource, availability } : resource));
    } catch {
      setFeedback({ message: t('ui.action.error'), error: true });
    } finally {
      setBusy(false);
    }
  }

  return <PageContainer width="form">
    <PageHeader title={t('resources.offerTitle')} description={t('resources.offerDescription')} />
    <Link href="/#request-map" className="text-primary underline">{t('resources.onMap')}</Link>
    {authLoading ? <p role="status">{t('ui.loading')}</p> : authenticated ? <>
      <Card>
        <form className="space-y-5" onSubmit={submit}>
          <Input id="resource-name" name="name" label={t('resources.name')} required maxLength={160} />
          <Textarea id="resource-description" name="description" label={t('resources.offerBody')} rows={3} maxLength={5000} />
          <Input id="resource-city" name="city" label={t('home.city')} value={user?.city || city}
            onChange={event => setCity(event.target.value)} readOnly={!!user?.city} required maxLength={200} />
          <Select label={t('application.form.category')} value={category} onChange={setCategory}
            options={categories.map(value => ({ value, label: t(`category.${value}`) }))} />
          <CurrentLocationControl {...currentLocation} />
          <AddressPicker title={t('resources.where')} city={user?.city || city} value={point} onChange={setPoint}
            userPosition={currentLocation.fix?.point} userCenter={currentLocation.fix?.initial} />
          <label className="form-field">{t('resources.optionalPhotos')}
            <input type="file" name="media_files" className="form-file" multiple accept="image/jpeg,image/png,.jpg,.jpeg,.png" />
          </label>
          <Button type="submit" busy={busy}>{t('request.create.submit')}</Button>
        </form>
        <ActionFeedback {...feedback} />
      </Card>
      {loadError && <ActionFeedback message={t('resources.loadError')} error />}
      {offers.length > 0 && <section className="space-y-3">
        <SectionTitle>{t('resources.myOffers')}</SectionTitle>
        {offers.map(resource => <Card key={resource.id} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{resource.name}</h3>
            <StatusBadge status={resource.moderation_status || 'approved'} />
          </div>
          {resource.rejection_reason && <p className="whitespace-pre-wrap break-words text-sm text-gray-700">{resource.rejection_reason}</p>}
          {resource.moderation_status === 'approved' && confirmations.filter(item =>
            item.resource_id === resource.id && !item.answer && Date.parse(item.expires_at) > Date.now()
          ).map(item => <div key={item.id} className="space-y-2 border-t pt-2">
            <p>{t('resources.confirmAvailability')}</p>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" disabled={busy} onClick={() => answer(item.id, 'available')}>{t('resources.available')}</Button>
              <Button size="sm" variant="secondary" disabled={busy}
                onClick={() => answer(item.id, 'unavailable')}>{t('resources.unavailable')}</Button>
            </div>
          </div>)}
        </Card>)}
      </section>}
    </> : <Card className="space-y-3">
      <p>{t('resources.signInHint')}</p>
      <Link href="/login?next=%2Fresources" className={buttonClassName()}>{t('nav.login')}</Link>
    </Card>}
  </PageContainer>;
}
