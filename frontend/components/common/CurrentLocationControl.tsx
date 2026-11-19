'use client';

import { LocateFixed } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export type MapPosition = [number, number];

export function useCurrentLocation() {
  const [tracking, setTracking] = useState(false);
  const [fix, setFix] = useState<{ point: MapPosition; initial: MapPosition } | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!tracking) return;
    const api = navigator.geolocation;
    if (!api) {
      setUnavailable(true);
      setTracking(false);
      return;
    }
    let active = true;
    const watch = api.watchPosition(({ coords }) => {
      if (!active) return;
      const point: MapPosition = [coords.latitude, coords.longitude];
      setUnavailable(false);
      setFix(previous => ({ point, initial: previous?.initial || point }));
    }, () => {
      if (!active) return;
      setUnavailable(true);
      setTracking(false);
      setFix(null);
    }, { timeout: 10000, maximumAge: 0, enableHighAccuracy: true });
    return () => { active = false; api.clearWatch(watch); };
  }, [tracking]);

  function toggle() {
    setUnavailable(false);
    setFix(null);
    setTracking(value => !value);
  }
  return { fix, toggle, tracking, unavailable };
}

export function CurrentLocationControl({ toggle, tracking, unavailable }: ReturnType<typeof useCurrentLocation>) {
  const t = useTranslation(useStore(state => state.language));
  return <div className="space-y-2">
    <Button size="sm" variant="secondary" onClick={toggle} aria-pressed={tracking}>
      <LocateFixed className="h-4 w-4" aria-hidden="true" />
      {t(tracking ? 'location.hideSelf' : 'location.showSelf')}
    </Button>
    {unavailable && <p role="status" className="text-sm text-gray-600">{t('location.unavailable')}</p>}
  </div>;
}
