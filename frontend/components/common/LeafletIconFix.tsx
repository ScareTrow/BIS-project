'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { initLeafletIcons } from '@/lib/leaflet-icons';

// Компонент для исправления иконок Leaflet
// Должен быть первым дочерним элементом MapContainer
export default function LeafletIconFix() {
  const map = useMap();

  useEffect(() => {
    // Инициализация иконок Leaflet
    initLeafletIcons(L);
    
    // Исправление иконок Leaflet
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    
    const iconDefaults = {
      iconRetinaUrl: '/leaflet/marker-icon-2x.png',
      iconUrl: '/leaflet/marker-icon.png',
      shadowUrl: '/leaflet/marker-shadow.png',
      iconSize: [25, 41] as [number, number],
      iconAnchor: [12, 41] as [number, number],
      popupAnchor: [1, -34] as [number, number],
      shadowSize: [41, 41] as [number, number],
    };

    L.Icon.Default.mergeOptions(iconDefaults);

    // Функция для обновления всех маркеров
    const updateMarkers = () => {
      if (map) {
        map.eachLayer((layer: any) => {
          if (layer instanceof L.Marker) {
            // Обновляем все маркеры, независимо от типа иконки
            if (!layer.options.icon || layer.options.icon instanceof L.Icon.Default) {
              const newIcon = new L.Icon.Default(iconDefaults);
              layer.setIcon(newIcon);
            }
          }
        });
      }
    };

    // Обновляем маркеры сразу и после небольшой задержки
    updateMarkers();
    const timer = setTimeout(updateMarkers, 100);
    const timer2 = setTimeout(updateMarkers, 500);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
    };
  }, [map]);

  return null;
}

