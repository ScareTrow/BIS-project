'use client';

import { Application } from '@/lib/api';
import dynamic from 'next/dynamic';

const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

interface MapViewProps {
  applications: Application[];
}

export default function MapView({ applications }: MapViewProps) {

  return (
    <div className="w-full">
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm text-gray-600 font-semibold">Легенда:</span>
          <span className="badge badge-success">Продукты</span>
          <span className="badge badge-danger">Медицина</span>
          <span className="badge badge-primary">Убежище</span>
          <span className="badge badge-warning">Экстренная помощь</span>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden" style={{ height: '600px' }}>
        <div className="w-full h-full flex items-center justify-center text-gray-500">
          <p>Карта загружается...</p>
        </div>
      </div>
    </div>
  );
}

