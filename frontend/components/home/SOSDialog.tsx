'use client';

import AddressPicker from '@/components/common/AddressPicker';
import { useEffect, useState } from 'react';
import { apiClient, LocationPoint } from '@/lib/api';


export default function SOSDialog({ onClose, onCreated }: {
  onClose: () => void;
  onCreated: (id: number, point: [number, number]) => void;
}) {
  const [point, setPoint] = useState<LocationPoint | null>(null);
  const [editingLocation, setEditingLocation] = useState(false);
  const [message, setMessage] = useState('Определяем местоположение…');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (!navigator.geolocation) {
      setEditingLocation(true); setMessage('Геолокация недоступна. Найдите адрес или выберите точку на карте.');
      return;
    }
    navigator.geolocation.getCurrentPosition(position => {
      if (!mounted) return;
      setPoint({ latitude: position.coords.latitude, longitude: position.coords.longitude, address: 'Текущая геопозиция' });
      setMessage('Местоположение определено. Можно отправить SOS.');
    }, () => {
      if (mounted) { setEditingLocation(true); setMessage('Не удалось определить местоположение. Найдите адрес или выберите точку на карте.'); }
    }, { timeout: 8000, maximumAge: 0, enableHighAccuracy: true });
    return () => { mounted = false; };
  }, []);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError('');
    if (!point) { setError('Выберите точку на карте'); return; }
    const data = new FormData();
    data.append('latitude', String(point.latitude));
    data.append('longitude', String(point.longitude));
    data.append('address', point.address);
    setBusy(true);
    try {
      const result = await apiClient.createSOS(data);
      onCreated(result.id!, [point.latitude, point.longitude]);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Не удалось отправить SOS');
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[2000] bg-black/50 overflow-y-auto p-4" role="dialog" aria-modal="true" aria-labelledby="sos-title">
      <form onSubmit={submit} className="bg-white rounded-lg p-6 max-w-xl mx-auto space-y-4">
        <div className="flex justify-between gap-4">
          <h2 id="sos-title" className="text-2xl font-bold text-red-700">Экстренный SOS</h2>
          <button type="button" autoFocus disabled={busy} onClick={onClose} className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" aria-label="Закрыть SOS">Закрыть</button>
        </div>
        <p>SOS появится на карте сразу. Волонтёры в радиусе 10 км получат оповещение. Не более трёх SOS за час.</p>
        <p role="status">{message}</p>
        {point && !editingLocation && <button type="button" className="text-blue-700 underline" onClick={() => setEditingLocation(true)}>Уточнить местоположение</button>}
        {editingLocation && <AddressPicker title="Где нужна срочная помощь" value={point} onChange={place => {
          setPoint(place);
          setMessage(place ? 'Место выбрано. Подтвердите отправку SOS.' : 'Найдите адрес или выберите место на карте.');
        }} />}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button type="submit" className="btn bg-red-600 text-white" disabled={busy || !point}>
          {busy ? 'Отправка…' : 'Подтвердить и отправить SOS'}
        </button>
      </form>
    </div>
  );
}
