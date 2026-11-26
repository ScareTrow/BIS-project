'use client';

import { LocateFixed } from 'lucide-react';
import type { useCurrentLocation } from '@/components/common/CurrentLocationControl';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export default function MapLocateButton({ tracking, toggle, unavailable }: ReturnType<typeof useCurrentLocation>) {
  const t = useTranslation(useStore(state => state.language));
  const label = t(tracking ? 'location.hideSelf' : 'location.showSelf');

  return <>
    <Button variant={tracking ? 'primary' : 'secondary'} className="absolute bottom-8 right-3 z-[1000] w-11 !rounded-full !p-0 shadow-md"
      onClick={toggle} aria-pressed={tracking} aria-label={label} title={label}>
      <LocateFixed className="h-5 w-5" aria-hidden="true" />
    </Button>
    {unavailable && <p role="status" className="absolute bottom-8 left-3 right-16 z-[1000] w-fit rounded-md bg-white px-3 py-2 text-sm text-gray-900 shadow-md">
      {t('location.unavailable')}
    </p>}
  </>;
}
