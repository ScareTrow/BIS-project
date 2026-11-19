'use client';

import { mapTiles } from '@/lib/mapTiles';

import { useEffect, useRef } from 'react';
import { TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import MapContainer from './LeafletMap';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import LeafletIconFix from './LeafletIconFix';
import CurrentLocationMarker from './CurrentLocationMarker';
import type { MapPosition } from './CurrentLocationControl';

interface ApplicationMapProps {
  center: [number, number];
  onLocationSelect: (lat: number, lng: number) => void;
  selected?: boolean;
  userPosition?: MapPosition;
}

function LocationMarker({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  const markerRef = useRef<L.Marker>(null);

  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationSelect(lat, lng);
      
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      }
    },
  });

  return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  
  return null;
}

// Глобальная инициализация иконок Leaflet (выполняется один раз при загрузке модуля)
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

export default function ApplicationMap({ center, onLocationSelect, selected = true, userPosition }: ApplicationMapProps) {
  const markerRef = useRef<L.Marker>(null);

  useEffect(() => {
    // Дополнительная инициализация на случай, если глобальная не сработала
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  }, []);

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.setLatLng(center);
    }
  }, [center]);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200" style={{ height: '360px', width: '100%' }}>
    <MapContainer
      center={center}
      zoom={10}
      style={{ height: '100%', width: '100%', maxWidth: '100%' }}
      className="w-full h-full"
    >
      <LeafletIconFix />
      <MapUpdater center={center} />
      <TileLayer {...mapTiles} />
      {selected && <Marker
        position={center} 
        ref={markerRef}
        icon={new L.Icon.Default({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
        })}
      />}
      <LocationMarker onLocationSelect={onLocationSelect} />
      {userPosition && <CurrentLocationMarker point={userPosition} />}
    </MapContainer>
    </div>
  );
}

