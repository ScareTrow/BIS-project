'use client';

import { useEffect, useState } from 'react';
import { TileLayer, useMap } from 'react-leaflet';
import CategoryBadge from '@/components/common/CategoryBadge';
import type { MapPosition, useCurrentLocation } from '@/components/common/CurrentLocationControl';
import CurrentLocationMarker from '@/components/common/CurrentLocationMarker';
import LeafletMap from '@/components/common/LeafletMap';
import type { Application, ApplicationCategory } from '@/lib/api';
import { ALL_CATEGORIES } from '@/lib/categories';
import { communityApi, type Resource } from '@/lib/community-api';
import { useTranslation } from '@/lib/i18n';
import { mapTiles } from '@/lib/mapTiles';
import { useStore } from '@/lib/store';
import ApplicationMarker from './ApplicationMarker';
import MapLocateButton from './MapLocateButton';
import MapResizeHandler from './MapResizeHandler';
import ResourceMarker, { ResourceSymbol } from './ResourceMarker';

type CategoryFilter = ApplicationCategory | 'all';

interface MapViewProps {
  applications: Application[];
  center?: MapPosition;
  city?: string;
  location?: ReturnType<typeof useCurrentLocation>;
  selectedCategory: CategoryFilter;
  onCategoryChange: (category: CategoryFilter) => void;
  showResources: boolean;
  onShowResourcesChange: (show: boolean) => void;
}

function MapCenterController({ center }: { center?: MapPosition }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

function FlyToUser({ point }: { point?: MapPosition }) {
  const map = useMap();
  useEffect(() => {
    if (!point) return;
    const zoom = Math.max(map.getZoom(), 14);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) map.setView(point, zoom);
    else map.flyTo(point, zoom);
  }, [map, point]);
  return null;
}

export default function MapView({ applications, center, city, location, selectedCategory, onCategoryChange, showResources, onShowResourcesChange }: MapViewProps) {
  const t = useTranslation(useStore(state => state.language));
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceError, setResourceError] = useState(false);

  useEffect(() => {
    if (!showResources) return;
    const controller = new AbortController();
    setResourceError(false);
    setResources([]);
    communityApi.resources(undefined, city, controller.signal).then(items => {
      if (!controller.signal.aborted) setResources(items);
    }).catch(() => {
      if (!controller.signal.aborted) setResourceError(true);
    });
    return () => controller.abort();
  }, [city, showResources]);

  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-semibold text-gray-600">{t('home.categoryFilters')}</span>
      {ALL_CATEGORIES.map(category => (
        <button key={category} type="button" aria-pressed={selectedCategory === category}
          onClick={() => onCategoryChange(selectedCategory === category ? 'all' : category)}
          className={selectedCategory === category ? 'rounded-full ring-2 ring-blue-500 ring-offset-2' : 'rounded-full hover:shadow-sm'}>
          <CategoryBadge category={category} />
        </button>
      ))}
    </div>
    <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-gray-800">
      <input type="checkbox" checked={showResources} onChange={event => onShowResourcesChange(event.target.checked)} />
      {t('resources.points')}
    </label>
    {showResources && <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
      <li className="flex items-center gap-2"><ResourceSymbol available />{t('resources.available')}</li>
      <li className="flex items-center gap-2"><ResourceSymbol available={false} />{t('resources.outdated')}</li>
    </ul>}
    {showResources && resourceError && <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-danger-dark">{t('resources.loadError')}</p>}
    <div className="relative isolate h-[420px] w-full overflow-hidden rounded-lg border bg-white sm:h-[560px]">
      <LeafletMap center={center || [43.2220, 76.8512]} zoom={10}
        style={{ height: '100%', width: '100%' }} className="map-container">
        <MapResizeHandler />
        <MapCenterController center={center} />
        <FlyToUser point={location?.fix?.initial} />
        <TileLayer {...mapTiles} />
        {showResources && resources.map(resource => <ResourceMarker key={resource.id} resource={resource} />)}
        {applications.map(application => <ApplicationMarker key={application.id} application={application} />)}
        {location?.fix && <CurrentLocationMarker point={location.fix.point} />}
      </LeafletMap>
      {location && <MapLocateButton {...location} />}
    </div>
  </div>;
}
