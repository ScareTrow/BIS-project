'use client';

import { useId, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import { getCityByName } from '@/lib/kazakhstanCities';
import { apiClient, LocationPoint } from '@/lib/api';

const LocationMap = dynamic(() => import('./ApplicationMap'), { ssr: false });

export default function AddressPicker({ title = 'Местоположение', city = '', value, onChange }: {
  title?: string;
  city?: string;
  value: LocationPoint | null;
  onChange: (point: LocationPoint | null) => void;
}) {
  const id = useId();
  const profileCity = useStore(state => state.user?.city);
  const region = city || profileCity || '';
  const cityPoint = getCityByName(region);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function search() {
    if (busy) return;
    if (query.trim().length < 3) { setMessage('Введите хотя бы 3 символа адреса или названия здания'); return; }
    setBusy(true); setMessage(''); setResults([]);
    try {
      const points = await apiClient.searchLocations(query.trim(), region);
      setResults(points);
      if (!points.length) setMessage('Место не найдено. Уточните адрес и город или выберите точку на карте.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Не удалось найти адрес');
    } finally { setBusy(false); }
  }

  return <section className="min-w-0 space-y-3" aria-label={title}>
    <h3 className="font-semibold text-gray-900">{title}</h3>
    <label htmlFor={id} className="form-field">Адрес или название здания</label>
    <div className="flex flex-col gap-2 sm:flex-row">
      <input id={id} className="form-input" value={query} maxLength={200}
        placeholder={region ? `Улица, дом или здание · ${region}` : 'Улица, дом или название здания'}
        onChange={event => { setQuery(event.target.value); setResults([]); onChange(null); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} />
      <button type="button" className="btn btn-outline shrink-0" disabled={busy} onClick={search}>
        {busy ? 'Ищем…' : 'Найти'}
      </button>
    </div>
    {!!results.length && <ul className="overflow-hidden rounded-lg border border-gray-200 divide-y divide-gray-100">
      {results.map((point, index) => <li key={index}>
        <button type="button" className="w-full break-words p-3 text-left text-sm text-gray-700 hover:bg-blue-50 focus-visible:bg-blue-50"
          onClick={() => { onChange(point); setResults([]); setMessage(''); }}>
          {point.address}
        </button>
      </li>)}
    </ul>}
    {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
    {value && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">Выбрано: {value.address}</p>}
    <LocationMap selected={value !== null}
      center={value ? [value.latitude, value.longitude] : cityPoint ? [cityPoint.lat, cityPoint.lng] : [43.222, 76.8512]}
      onLocationSelect={(latitude, longitude) => onChange({ latitude, longitude, address: value?.address || query.trim() || 'Точка, выбранная на карте' })} />
    <p className="text-xs text-gray-500">Выберите найденное место или уточните точку на карте. Данные адресов — <a
      href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a>.</p>
  </section>;
}
