'use client';

import CategoryBadge from '@/components/common/CategoryBadge';
import { Application, ApplicationCategory } from '@/lib/api';
import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { communityApi, Resource } from '@/lib/community-api';
import { useMap } from 'react-leaflet';
const CircleMarker = dynamic(()=>import('react-leaflet').then(mod=>mod.CircleMarker),{ssr:false});
const Popup = dynamic(()=>import('react-leaflet').then(mod=>mod.Popup),{ssr:false});

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const ApplicationMarker = dynamic(
  () => import('./ApplicationMarker'),
  { ssr: false }
);
const MapResizeHandler = dynamic(
  () => import('./MapResizeHandler'),
  { ssr: false }
);
const MapInitializer = dynamic(
  () => import('./MapInitializer'),
  { ssr: false }
);

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
    if (center && center[0] && center[1]) {
      map.setView(center, map.getZoom() || 10);
    }
  }, [center, map]);
  
  return null;
}

export default function MapView({ applications, center, city }: MapViewProps) {
  const [isClient, setIsClient] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('all');
  const [mapKey, setMapKey] = useState(0);
  const [resources, setResources] = useState<Resource[]>([]);
  const [showResources, setShowResources] = useState(true);
  const [resourceError, setResourceError] = useState('');
  useEffect(() => { communityApi.resources(city).then(setResources).catch(e=>setResourceError(e.message)); },[city]);

  useEffect(() => {
    setIsClient(true);
    // Принудительное обновление карты только при монтировании
    setMapKey(prev => prev + 1);
  }, []);

  // React Leaflet автоматически обновит маркеры при изменении пропса applications
  // Не нужно обновлять mapKey, так как это вызывает полную перерисовку карты и ошибки

  const filteredApplications = selectedCategory === 'all' 
    ? applications 
    : applications.filter(app => app.category === selectedCategory);

  const handleCategoryClick = (category: CategoryFilter) => {
    setSelectedCategory(selectedCategory === category ? 'all' : category);
  };

  if (!isClient) {
    return (
      <div className="w-full">
        <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '600px' }}>
          <div className="w-full h-full flex items-center justify-center text-gray-500">
            <p>Загрузка карты...</p>
          </div>
        </div>
      </div>
    );
  }

  const categories: { key: CategoryFilter; category: ApplicationCategory }[] = ['food','clothing','household','delivery','volunteering','social_project','medicine','shelter','emergency'].map(c=>({key:c as ApplicationCategory,category:c as ApplicationCategory}));

  return (
    <div className="w-full max-w-full overflow-hidden">
      {resourceError && <p role="alert">Не удалось загрузить ресурсы: {resourceError}</p>}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-wrap gap-2 items-center">
          <label className="flex gap-2"><input type="checkbox" checked={showResources} onChange={e=>setShowResources(e.target.checked)} />Ресурсы (круглые метки)</label>
          <span className="text-sm text-gray-600 font-semibold">Категории заявок:</span>
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
        className="bg-white rounded-lg shadow-md w-full relative overflow-hidden"
        style={{ height: '600px', position: 'relative', isolation: 'isolate' }}
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
          {isClient && (
            <MapContainer
              key={mapKey}
              center={center || [43.2220, 76.8512]}
              zoom={10}
              style={{ height: '100%', width: '100%' }}
              className="map-container"
            >
              <MapResizeHandler />
              <MapInitializer />
              <MapCenterController center={center} />
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {showResources && resources.map(r=><CircleMarker key={`resource-${r.id}`} center={[r.latitude,r.longitude]} radius={10} pathOptions={{color:r.availability==='available'?'#15803d':'#a16207'}}><Popup><strong>{r.name}</strong><p>{r.availability==='available'?'Доступен':r.availability==='outdated'?'Информация устарела':'Недоступен'}</p><Link href={`/resources#resource-${r.id}`}>Подробнее о ресурсе</Link></Popup></CircleMarker>)}
              {filteredApplications.map((app) => (
                <ApplicationMarker key={app.id} application={app} />
              ))}
            </MapContainer>
          )}
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

