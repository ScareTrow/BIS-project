'use client';

import AddressPicker from '@/components/common/AddressPicker';
import { useEffect, useState } from 'react';
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
  const [error, setError] = useState('');
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
      setPoint({ latitude: position.coords.latitude, longitude: position.coords.longitude, address: '' });
      setMessage('sos.located');
    }, () => {
      if (mounted) { setEditingLocation(true); setMessage('sos.denied'); }
    }, { timeout: 8000, maximumAge: 0, enableHighAccuracy: true });
    return () => { mounted = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!point) { setError(t('request.create.locationError')); return; }
    const photoError = validateRequestPhotos(photos, t);
    if (photoError) { setError(photoError); return; }
    const data = new FormData();
    data.append('latitude', String(point.latitude));
    data.append('longitude', String(point.longitude));
    data.append('address', point.address);
    photos.forEach(photo => data.append('media_files', photo));
    setBusy(true);
    try {
      const result = await apiClient.createSOS(data);
      onCreated(result.id!, [point.latitude, point.longitude]);
    } catch (failure) {
      setError(failure instanceof Error && /^Лимит SOS/.test(failure.message) ? t('sos.limit') :
        failure instanceof Error && language === 'ru' ? failure.message : t('ui.action.error'));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="sos-title">
      <form onSubmit={submit} noValidate className="bg-white rounded-lg p-6 max-w-xl mx-auto space-y-4">
        <div className="flex justify-between gap-4">
          <h2 id="sos-title" className="text-2xl font-bold text-danger-dark">{t('sos.title')}</h2>
          <button type="button" autoFocus disabled={busy} onClick={onClose} className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">{t('ui.close')}</button>
        </div>
        <p>{t('sos.description')}</p>
        <p role="status">{t(message)}</p>
        {point && !editingLocation && <button type="button" className="text-primary underline" onClick={() => setEditingLocation(true)}>{t('sos.editLocation')}</button>}
        {editingLocation && <AddressPicker title={t('request.create.location')} value={point} onChange={place => {
          setPoint(place);
          setMessage(place ? 'sos.selected' : 'request.create.locationError');
        }} />}
        <label className="form-field">{t('request.create.photos')}
          <input type="file" multiple accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="form-file" onChange={event => setPhotos(Array.from(event.target.files ?? []))} />
        </label>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button type="submit" className="btn bg-red-600 text-white" disabled={busy || !point}>
          {busy ? t('ui.loading') : t('sos.send')}
        </button>
      </form>
    </div>
  );
}
