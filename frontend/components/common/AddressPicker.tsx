'use client';

import { useEffect, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import { getCityByName } from '@/lib/kazakhstanCities';
import { apiClient, LocationPoint } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';

const LocationMap = dynamic(() => import('./ApplicationMap'), { ssr: false });

export default function AddressPicker({ title, city = '', value, onChange }: {
  title?: string;
  city?: string;
  value: LocationPoint | null;
  onChange: (point: LocationPoint | null) => void;
}) {
  const id = useId();
  const language = useStore(state => state.language);
  const t = useTranslation(language);
  const sectionTitle = title || t('location.title');
  const lookupVersion = useRef(0);
  useEffect(() => () => { lookupVersion.current++; }, []);
  const profileCity = useStore(state => state.user?.city);
  const region = city || profileCity || '';
  const cityPoint = getCityByName(region);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationPoint[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function search() {
    if (busy) return;
    if (query.trim().length < 3) { setMessage(t('location.searchShort')); return; }
    setBusy(true); setMessage(''); setResults([]);
    try {
      const points = await apiClient.searchLocations(query.trim(), region);
      setResults(points);
      if (!points.length) setMessage(t('location.searchEmpty'));
    } catch (error) {
      setMessage(error instanceof Error && language === 'ru' ? error.message : t('ui.action.error'));
    } finally { setBusy(false); }
  }

  return <section className="min-w-0 space-y-3" aria-label={sectionTitle}>
    <h3 className="font-semibold text-gray-900">{sectionTitle}</h3>
    <label htmlFor={id} className="form-field">{t('location.searchLabel')}</label>
    <div className="flex flex-col gap-2 sm:flex-row">
      <input id={id} className="form-input" value={query} maxLength={200}
        placeholder={region ? `${t('location.searchPlaceholder')} · ${region}` : t('location.searchPlaceholder')}
        onChange={event => { lookupVersion.current++; setQuery(event.target.value); setResults([]); onChange(null); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); search(); } }} />
      <button type="button" className="btn btn-outline shrink-0" disabled={busy} onClick={search}>
        {busy ? t('ui.loading') : t('location.search')}
      </button>
    </div>
    {!!results.length && <ul className="overflow-hidden rounded-lg border border-gray-200 divide-y divide-gray-100">
      {results.map((point, index) => <li key={index}>
        <button type="button" className="w-full break-words p-3 text-left text-sm text-gray-700 hover:bg-blue-50 focus-visible:bg-blue-50"
          onClick={() => { lookupVersion.current++; onChange(point); setResults([]); setMessage(''); }}>
          {point.address}
        </button>
      </li>)}
    </ul>}
    {message && <p role="status" className="text-sm text-gray-600">{message}</p>}
    {value && <p className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-900">{t('location.selected', { address: value.address || t('location.selectedPoint') })}</p>}
    <LocationMap selected={value !== null}
      center={value ? [value.latitude, value.longitude] : cityPoint ? [cityPoint.lat, cityPoint.lng] : [43.222, 76.8512]}
      onLocationSelect={(latitude, longitude) => {
        const revision = ++lookupVersion.current;
        onChange({ latitude, longitude, address: '' });
        apiClient.reverseLocation(latitude, longitude).then(place => {
          if (place.address && lookupVersion.current === revision) onChange(place);
        }).catch(() => { /* The selected point is usable without an address. */ });
      }} />
  </section>;
}
