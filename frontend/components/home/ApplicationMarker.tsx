'use client';

import CategoryBadge from '@/components/common/CategoryBadge';
import { Application } from '@/lib/api';
import L from 'leaflet';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';

const categoryColors: Record<string, string> = {
  food: '#28a745',
  medicine: '#dc3545',
  shelter: '#007bff',
  emergency: '#ffc107',
};

interface ApplicationMarkerProps {
  application: Application;
}

export default function ApplicationMarker({ application }: ApplicationMarkerProps) {
  const [icon, setIcon] = useState<L.DivIcon | null>(null);

  useEffect(() => {
    const color = categoryColors[application.category] || '#6c757d';
    const customIcon = L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background-color: ${color};
          width: 30px;
          height: 30px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ${application.is_sos ? 'animation: pulse 2s infinite;' : ''}
        ">
          ${application.is_sos ? '<span style="transform: rotate(45deg); display: block; text-align: center; line-height: 24px; font-weight: bold; color: white;">!</span>' : ''}
        </div>
      `,
      iconSize: [30, 30],
      iconAnchor: [15, 30],
    });
    setIcon(customIcon);
  }, [application.category, application.is_sos]);

  if (!icon) return null;

  return (
    <Marker
      position={[application.latitude, application.longitude]}
      icon={icon}
    >
      <Popup>
        <div className="p-2 min-w-[200px]">
          <div className="flex items-center space-x-2 mb-2">
            <CategoryBadge category={application.category} />
            {application.is_sos && (
              <span className="badge badge-danger">SOS</span>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-2 line-clamp-2">
            {application.description}
          </p>
          <p className="text-xs text-gray-500 mb-2">
            Координаты: {application.latitude.toFixed(4)}, {application.longitude.toFixed(4)}
          </p>
          <Link
            href={`/applications/${application.id}`}
            className="text-sm text-primary hover:underline"
          >
            Подробнее →
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}

