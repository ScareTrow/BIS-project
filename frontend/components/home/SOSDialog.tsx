'use client';

import AddressPicker from '@/components/common/AddressPicker';
import PhotoPreviews from '@/components/common/PhotoPreviews';
import { Textarea } from '@/components/ui/Input';
import { isAxiosError } from 'axios';
import { useEffect, useRef, useState } from 'react';
import { apiClient, LocationPoint } from '@/lib/api';
import { validateRequestPhotos } from '@/lib/requestValidation';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';


export default function SOSDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: number, point: [number, number]) => void;
}) {
  const [point, setPoint] = useState<LocationPoint | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [message, setMessage] = useState('sos.locating');
  const [errors, setErrors] = useState<Partial<Record<'photos' | 'location' | 'submit', string>>>({});
  const [description, setDescription] = useState('');
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement;
    if (element.showModal) element.showModal();
    else element.open = true;
    return () => {
      if (element.close) element.close();
      else element.open = false;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, []);
  const [busy, setBusy] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const language = useStore(state => state.language);
  const t = useTranslation(language);

  useEffect(() => {
    let mounted = true;
    if (!navigator.geolocation) {
      setEditingLocation(true); setMessage('sos.denied');
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      if (!mounted) return;
      setPoint(current => current || { latitude: position.coords.latitude, longitude: position.coords.longitude, address: '' });
      setMessage('sos.located');
    }, () => {
      if (mounted) { setEditingLocation(true); setMessage('sos.denied'); }
    }, { timeout: 8000, maximumAge: 0, enableHighAccuracy: true });
    return () => { mounted = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setErrors({});
    if (!point) { setErrors({ location: t('request.create.locationError') }); return; }
    const photoError = validateRequestPhotos(photos, t);
    if (photoError) { setErrors({ photos: photoError }); return; }
    const data = new FormData();
    data.append('latitude', String(point.latitude));
    data.append('longitude', String(point.longitude));
    data.append('address', point.address);
    if (description.trim()) data.append('description', description.trim());
    photos.forEach(photo => data.append('media_files', photo));
    setBusy(true);
    try {
      const result = await apiClient.createSOS(data);
      onCreated(result.id!, [point.latitude, point.longitude]);
    } catch (failure) {
      const status = isAxiosError(failure) ? failure.response?.status : undefined;
      const message = status === 429 || (failure instanceof Error && /^Лимит SOS/.test(failure.message))
        ? t('sos.limit')
        : failure instanceof Error && language === 'ru' ? failure.message : t('ui.action.error');
      const photoFailure = status === 413 || status === 415 ||
        (status === 400 && /файл|фото|jpeg|png|image/i.test(failure instanceof Error ? failure.message : ''));
      setErrors(photoFailure ? { photos: message } : { submit: message });
      setBusy(false);
    }
  }

  return (
    <dialog ref={dialog} aria-labelledby="sos-title"
      className="z-[2000] m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-lg bg-white backdrop:bg-black/50"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={submit} noValidate className="bg-white rounded-lg p-6 max-w-xl mx-auto space-y-4">
        <div className="flex justify-between gap-4">
          <h2 id="sos-title" className="text-2xl font-bold text-danger-dark">{t('sos.title')}</h2>
          <button type="button" autoFocus disabled={busy} onClick={onClose} className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t('ui.close')}</button>
        </div>
        <label className="form-field">{t('request.create.photos')}
          <span className="btn btn-secondary relative w-fit cursor-pointer focus-within:ring-2 focus-within:ring-primary">
            {t('sos.takePhoto')}
            <input type="file" multiple accept="image/*" capture="environment"
              className="absolute inset-0 w-full cursor-pointer opacity-0"
              aria-invalid={Boolean(errors.photos)} aria-describedby={errors.photos ? 'sos-photo-error' : undefined}
              onChange={event => {
                setPhotos(Array.from(event.target.files ?? []));
                setErrors(current => ({ ...current, photos: undefined }));
              }} />
          </span>
        </label>
        {errors.photos && <p id="sos-photo-error" role="alert" className="text-danger-dark">{errors.photos}</p>}
        <PhotoPreviews photos={photos} />
        <p role="status">{t(message)}</p>
        {point && !editingLocation && <button type="button" className="text-primary underline" onClick={() => setEditingLocation(true)}>{t('sos.editLocation')}</button>}
        {editingLocation && <AddressPicker title={t('request.create.location')} value={point} onChange={place => {
          setPoint(place);
          setMessage(place ? 'sos.selected' : 'request.create.locationError');
          setErrors(current => ({ ...current, location: undefined }));
        }} />}
        {errors.location && <p role="alert" className="text-danger-dark">{errors.location}</p>}
        <Textarea id="sos-description" label={t('sos.whatHappened')} rows={2} maxLength={1000}
          value={description} placeholder={t('sos.descriptionPlaceholder')} onChange={event => setDescription(event.target.value)} />
        <p>{t('sos.description')}</p>
        {errors.submit && <p role="alert" className="text-danger-dark">{errors.submit}</p>}
        <button type="submit" className="btn bg-red-600 text-white" disabled={busy || !point}>
          {busy ? t('ui.loading') : t('sos.send')}
        </button>
      </form>
    </dialog>
  );
}
