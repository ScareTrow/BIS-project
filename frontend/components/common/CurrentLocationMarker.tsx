'use client';

import { CircleMarker, Tooltip } from 'react-leaflet';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import type { MapPosition } from './CurrentLocationControl';

export default function CurrentLocationMarker({ point }: { point: MapPosition }) {
  const t = useTranslation(useStore(state => state.language));
  return <CircleMarker center={point} radius={8} interactive={false}
    pathOptions={{ color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }}>
    <Tooltip permanent direction="top" offset={[0, -8]}>{t('location.youAreHere')}</Tooltip>
  </CircleMarker>;
}
