'use client';

import { useEffect, useState } from 'react';
import AddressPicker from '@/components/common/AddressPicker';
import { apiClient, LocationPoint } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';


export default function VolunteerLocation() {
  const [point, setPoint] = useState<LocationPoint | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [tracking, setTracking] = useState(false);
  const [trackingError, setTrackingError] = useState(false);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const t = useTranslation(useStore(state => state.language));
  useEffect(() => {
    apiClient.getVolunteerLocation().then(location => {
      if (location.latitude !== null && location.longitude !== null) setPoint({ latitude: location.latitude, longitude: location.longitude, address: 'Сохранённое местоположение' });
    }).catch(error => setMessage(error.message));
  }, []);
  useEffect(() => {
    if (!tracking || !navigator.geolocation?.watchPosition) return;
    let active = true;
    let watch: number | undefined;
    let pending = false;
    let latest: { latitude: number; longitude: number; time: number } | undefined;
    function stop() {
      if (watch !== undefined) navigator.geolocation.clearWatch(watch);
      watch = undefined;
    }
    function syncVisibility() {
      if (document.hidden) { stop(); return; }
      if (watch !== undefined) return;
      watch = navigator.geolocation.watchPosition(async ({ coords }) => {
        if (!active || document.hidden || pending) return;
        const { latitude, longitude } = coords;
        const time = Date.now();
        if (latest) {
          const longitudeScale = Math.cos((latest.latitude + latitude) * Math.PI / 360);
          const distance = Math.hypot(latitude - latest.latitude, (longitude - latest.longitude) * longitudeScale) * 111195;
          if (time - latest.time < 30000 || distance < 100) return;
        }
        pending = true;
        setTrackingBusy(true);
        try {
          await apiClient.saveVolunteerLocation(latitude, longitude);
          latest = { latitude, longitude, time };
          setPoint({ latitude, longitude, address: '' });
          setTrackingError(false);
        } catch {
          if (active) setTrackingError(true);
        } finally {
          pending = false;
          setTrackingBusy(false);
        }
      }, () => { if (active) { setTrackingError(true); setTracking(false); } }, { timeout: 8000, maximumAge: 0 });
    }
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => {
      active = false;
      stop();
      document.removeEventListener('visibilitychange', syncVisibility);
    };
  }, [tracking]);
  function locate() {
    if (!navigator.geolocation) { setMessage('Выберите точку на карте'); setEditing(true); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(position => {
      setPoint({ latitude: position.coords.latitude, longitude: position.coords.longitude, address: 'Текущая геопозиция' });
      setEditing(true); setBusy(false); setMessage('Нажмите «Сохранить местоположение».');
    }, () => {
      setEditing(true); setBusy(false); setMessage('Геолокация недоступна. Выберите точку на карте.');
    }, { timeout: 8000, maximumAge: 0 });
  }
  async function save() {
    if (!point) { setMessage('Выберите точку на карте'); return; }
    setBusy(true);
    try {
      await apiClient.saveVolunteerLocation(point.latitude, point.longitude);
      setMessage('Местоположение сохранено'); setEditing(false);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось сохранить'); }
    finally { setBusy(false); }
  }
  async function clear() {
    setBusy(true);
    try {
      await apiClient.clearVolunteerLocation(); setPoint(null); setEditing(false);
      setMessage('Местоположение удалено. Оповещения о ближайших заявках отключены.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Не удалось удалить'); }
    finally { setBusy(false); }
  }
  return <section className="border-t pt-4 space-y-3">
    <h3 className="font-semibold">Оповещения о помощи рядом</h3>
    <p>Привяжите Telegram и сохраните точку, чтобы получать заявки в радиусе 10 км. Эти оповещения учитывают расстояние до заявки. Точка не показывается в публичном профиле.</p>
    <p>{point ? 'Местоположение указано' : 'Местоположение не указано'}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="btn btn-outline" disabled={busy} onClick={locate}>Определить местоположение</button>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setEditing(true)}>Выбрать местоположение</button>
      {point && <button type="button" className="btn btn-outline" disabled={busy || tracking || trackingBusy} onClick={clear}>Удалить местоположение</button>}
    </div>
    <label className="flex items-center gap-2 text-sm">
      <input className="form-checkbox" type="checkbox" checked={tracking} disabled={busy}
        onChange={event => {
          const enabled = event.target.checked;
          const supported = !!navigator.geolocation?.watchPosition;
          setTracking(enabled && supported);
          setTrackingError(enabled && !supported);
        }} />
      {t('profile.track')}
    </label>
    {trackingError && <p role="alert" className="text-danger-dark text-sm">{t('profile.trackError')}</p>}
    {editing && <>
      <AddressPicker title="Где вы можете помочь" value={point} onChange={setPoint} />
      <button type="button" className="btn btn-primary" disabled={busy || !point} onClick={save}>Сохранить местоположение</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
