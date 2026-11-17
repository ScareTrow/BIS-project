'use client';

import { useEffect } from 'react';
import { useMap } from 'react-leaflet';

export default function MapResizeHandler() {
  const map = useMap();

  useEffect(() => {
    // Обновление размеров карты после монтирования
    const timer1 = setTimeout(() => {
      if (map) {
        map.invalidateSize();
      }
    }, 100);

    // Дополнительное обновление через 500ms для надежности
    const timer2 = setTimeout(() => {
      if (map) {
        map.invalidateSize();
      }
    }, 500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [map]);

  return null;
}

