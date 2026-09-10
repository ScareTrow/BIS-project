'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';

// Глобальная инициализация иконок Leaflet
if (typeof window !== 'undefined') {
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  });
}

export default function MapInitializer() {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // Дополнительная инициализация иконок на случай, если глобальная не сработала
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    
    const iconDefaults = {
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
      iconSize: [25, 41] as [number, number],
      iconAnchor: [12, 41] as [number, number],
      popupAnchor: [1, -34] as [number, number],
      shadowSize: [41, 41] as [number, number],
    };

    L.Icon.Default.mergeOptions(iconDefaults);

    // Принудительно обновляем все существующие маркеры
    map.eachLayer((layer: any) => {
      if (layer instanceof L.Marker && layer.options.icon instanceof L.Icon.Default) {
        const newIcon = new L.Icon.Default(iconDefaults);
        layer.setIcon(newIcon);
      }
    });

    // Принудительная инициализация тайлов
    const initTiles = () => {
      map.invalidateSize();
      
      // Принудительное обновление тайлов
      setTimeout(() => {
        map.eachLayer((layer: any) => {
          if (layer._url) {
            // Это TileLayer
            layer.redraw();
          }
        });
      }, 200);
    };

    // Вызываем сразу и после небольшой задержки
    initTiles();
    const timer = setTimeout(initTiles, 300);

    return () => clearTimeout(timer);
  }, [map]);

  return null;
}

