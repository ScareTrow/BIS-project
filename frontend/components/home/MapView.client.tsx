'use client';

import { mapTiles } from '@/lib/mapTiles';

import CategoryBadge from '@/components/common/CategoryBadge';
import { Application, ApplicationCategory } from '@/lib/api';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { communityApi, Resource } from '@/lib/community-api';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import { CircleMarker, Popup, TileLayer, useMap } from 'react-leaflet';
import MapContainer from '@/components/common/LeafletMap';
import ApplicationMarker from './ApplicationMarker';
import MapResizeHandler from './MapResizeHandler';
import MapInitializer from './MapInitializer';

interface MapViewProps {
  applications: Application[];
  center?: [number, number];
  city?: string;
}

type CategoryFilter = ApplicationCategory | 'all';

// Компонент для обновления центра карты
function MapCenterController({ center }: { center?: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom() || 10);
    }
  }, [center, map]);

  return null;
}

export default function MapView({ applications, center, city }: MapViewProps) {
  const t = useTranslation(useStore(state => state.language));
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceError, setResourceError] = useState(false);
  useEffect(() => {
    let active = true;
    setResourceError(false);
    setResources([]);
    communityApi.resources(undefined, city).then(items => { if (active) setResources(items); })
      .catch(() => { if (active) setResourceError(true); });
    return () => { active = false; };
  }, [city]);

  // React Leaflet автоматически обновит маркеры при изменении пропса applications
  // Не нужно обновлять mapKey, так как это вызывает полную перерисовку карты и ошибки

  const filteredApplications = selectedCategory === 'all'
    ? applications
    : applications.filter(app => app.category === selectedCategory);

  const handleCategoryClick = (category: CategoryFilter) => {
    setSelectedCategory(selectedCategory === category ? 'all' : category);
  };

  const categories: { key: CategoryFilter; category: ApplicationCategory }[] = ['food','clothing','household','delivery','volunteering','social_project','medicine','shelter','emergency'].map(c=>({key:c as ApplicationCategory,category:c as ApplicationCategory}));

  return (
    <div className="w-full max-w-full overflow-hidden">
      {resourceError && <p role="alert">{t('resources.loadError')}</p>}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm text-gray-600 font-semibold">{t('home.categoryFilters')}</span>
          {categories.map(({ key, category }) => (
            <button
              key={key}
              onClick={() => handleCategoryClick(key)}
              className={`transition-all duration-200 ${
                selectedCategory === key
                  ? 'ring-2 ring-blue-500 ring-offset-2 scale-105'
                  : 'hover:scale-105'
              }`}
            >
              <CategoryBadge category={category} />
            </button>
          ))}
        </div>
      </div>

      <div
        className="relative isolate h-[420px] w-full overflow-hidden rounded-lg border bg-white sm:h-[560px]"
      >
        <div
          className="w-full h-full relative overflow-hidden"
          style={{
            width: '100%',
            height: '100%',
            position: 'relative',
            maxWidth: '100%'
          }}
        >
            <MapContainer
              center={center || [43.2220, 76.8512]}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              className="map-container"
            >
              <MapResizeHandler />
              <MapInitializer />
              <MapCenterController center={center} />
              <TileLayer {...mapTiles} />
              {resources.map(resource => <CircleMarker key={`resource-${resource.id}`} center={[resource.latitude, resource.longitude]} radius={10}
                pathOptions={{ color: resource.availability === 'available' ? '#15803d' : '#a16207' }}>
                <Popup>
                  <strong>{resource.name}</strong>
                  <p>{t(`resources.${resource.availability}`)}</p>
                  <Link href={`/resources#resource-${resource.id}`}>{t('common.more')}</Link>
                </Popup>
              </CircleMarker>)}
              {filteredApplications.map((app) => (
                <ApplicationMarker key={app.id} application={app} />
              ))}
            </MapContainer>
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.7;
          }
        }
      `}</style>
    </div>
  );
}

