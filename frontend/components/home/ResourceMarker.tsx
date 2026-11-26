'use client';

import L from 'leaflet';
import { MapPinned } from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Marker, Popup } from 'react-leaflet';
import type { Resource } from '@/lib/community-api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export function ResourceSymbol({ available }: { available: boolean }) {
  return <span className={available ? 'resource-marker resource-marker-available' : 'resource-marker'}>
    <MapPinned size={17} aria-hidden="true" />
  </span>;
}

const resourceIcons = [false, true].map(available => L.divIcon({
  className: 'resource-marker-icon',
  html: renderToStaticMarkup(<ResourceSymbol available={available} />),
  iconSize: [28, 28],
  iconAnchor: [14, 14],
  popupAnchor: [0, -14],
}));

export default function ResourceMarker({ resource }: { resource: Resource }) {
  const t = useTranslation(useStore(state => state.language));
  return <Marker position={[resource.latitude, resource.longitude]} icon={resourceIcons[Number(resource.availability === 'available')]}
    title={resource.name}>
    <Popup>
      <strong>{resource.name}</strong>
      <p>{t(`resources.${resource.availability}`)}</p>
      {resource.address && <p>{resource.address}</p>}
      {resource.description && <p className="max-h-28 overflow-y-auto break-words">{resource.description}</p>}
      {resource.photos?.[0] && <a href={resource.photos[0]} target="_blank" rel="noreferrer">
        <img src={resource.photos[0]} alt={t('resources.photo')} className="max-h-28 w-full rounded object-contain" />
      </a>}
    </Popup>
  </Marker>;
}
