'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { apiClient } from '@/lib/api';

const LocationMap = dynamic(() => import('@/components/common/ApplicationMap'), { ssr: false });

export default function VolunteerLocation() {
  const [point, setPoint] = useState<[number, number] | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    apiClient.getVolunteerLocation().then(location => {
      if (location.latitude !== null && location.longitude !== null) setPoint([location.latitude, location.longitude]);
    }).catch(error => setMessage(error.message));
  }, []);
  function locate() {
    if (!navigator.geolocation) { setMessage('Выберите точку на карте'); setEditing(true); return; }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(position => {
      setPoint([position.coords.latitude, position.coords.longitude]);
      setEditing(true); setBusy(false); setMessage('Нажмите «Сохранить местоположение».');
    }, () => {
      setEditing(true); setBusy(false); setMessage('Геолокация недоступна. Выберите точку на карте.');
    }, { timeout: 8000, maximumAge: 0 });
  }
  async function save() {
    if (!point) { setMessage('Выберите точку на карте'); return; }
    setBusy(true);
    try {
      await apiClient.saveVolunteerLocation(...point);
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
    <p>{point ? `Точка: ${point[0].toFixed(5)}, ${point[1].toFixed(5)}` : 'Местоположение не указано'}</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" className="btn btn-outline" disabled={busy} onClick={locate}>Определить местоположение</button>
      <button type="button" className="btn btn-outline" disabled={busy} onClick={() => setEditing(true)}>Выбрать на карте</button>
      {point && <button type="button" className="btn btn-outline" disabled={busy} onClick={clear}>Удалить местоположение</button>}
    </div>
    {editing && <>
      <LocationMap selected={point !== null} center={point || [43.222, 76.8512]} onLocationSelect={(latitude, longitude) => setPoint([latitude, longitude])} />
      <button type="button" className="btn btn-primary" disabled={busy || !point} onClick={save}>Сохранить местоположение</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
