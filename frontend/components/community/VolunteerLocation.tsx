'use client';

import { useEffect, useState } from 'react';
import AddressPicker from '@/components/common/AddressPicker';
import { apiClient, LocationPoint } from '@/lib/api';


export default function VolunteerLocation() {
  const [point, setPoint] = useState<LocationPoint | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    apiClient.getVolunteerLocation().then(location => {
      if (location.latitude !== null && location.longitude !== null) setPoint({ latitude: location.latitude, longitude: location.longitude, address: 'Сохранённое местоположение' });
    }).catch(error => setMessage(error.message));
  }, []);
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
      {point && <button type="button" className="btn btn-outline" disabled={busy} onClick={clear}>Удалить местоположение</button>}
    </div>
    {editing && <>
      <AddressPicker title="Где вы можете помочь" value={point} onChange={setPoint} />
      <button type="button" className="btn btn-primary" disabled={busy || !point} onClick={save}>Сохранить местоположение</button>
    </>}
    {message && <p role="status">{message}</p>}
  </section>;
}
