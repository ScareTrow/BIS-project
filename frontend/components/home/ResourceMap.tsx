'use client';

import { TileLayer } from 'react-leaflet';
import LeafletMap from '@/components/common/LeafletMap';
import type { Resource } from '@/lib/community-api';
import { getCityByName } from '@/lib/kazakhstanCities';
import { mapTiles } from '@/lib/mapTiles';
import ResourceMarker from './ResourceMarker';

export default function ResourceMap({ resources, city }: { resources: Resource[]; city: string }) {
  const center = getCityByName(city);
  const first = resources[0];
  const position: [number, number] = center ? [center.lat, center.lng] : first ? [first.latitude, first.longitude] : [43.222, 76.8512];
  return <div className="relative isolate h-[300px] overflow-hidden rounded-lg border">
    <LeafletMap center={position} zoom={11} className="h-full w-full">
      <TileLayer {...mapTiles} />
      {resources.map(resource => <ResourceMarker key={resource.id} resource={resource} />)}
    </LeafletMap>
  </div>;
}
