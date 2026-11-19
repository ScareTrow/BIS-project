'use client';

import CategoryBadge from '@/components/common/CategoryBadge';
import { apiClient, Application } from '@/lib/api';
import L from 'leaflet';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Marker, Popup } from 'react-leaflet';
import { ActionFeedback } from '@/components/ui/ActionFeedback';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

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
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { user, language } = useStore();
  const t = useTranslation(language);
  const details = `/applications/${application.public_id || application.id}`;

  useEffect(() => {
    const color = application.is_sos ? '#dc2626' : categoryColors[application.category] || '#6c757d';
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
            {application.moderation_status === 'pending' && <StatusBadge status="pending" />}
            {application.is_sos && (
              <span className="badge badge-danger">SOS</span>
            )}
          </div>
          <p className="text-sm text-gray-700 mb-2 line-clamp-2">
            {application.description}
          </p>
          {application.status === 'open' && !application.is_own && (
            <div className="mb-2">
              {user?.is_authenticated ? <Button size="sm" busy={busy} disabled={sent} onClick={async () => {
                setBusy(true);
                setError('');
                try { await apiClient.respondToApplication(application.public_id || application.id); setSent(true); }
                catch (failure) { setError(failure instanceof Error ? failure.message : t('alerts.respondError')); }
                finally { setBusy(false); }
              }}>{t('request.respond')}</Button> :
                <Link className="text-primary underline" href={`/login?next=${encodeURIComponent(details)}`}>{t('request.respond')}</Link>}
              <ActionFeedback message={sent ? t('alerts.respondSuccess') : error} error={!!error} />
            </div>
          )}
          <Link
            href={details}
            className="text-sm text-primary hover:underline"
          >
            {t('common.more')}
          </Link>
        </div>
      </Popup>
    </Marker>
  );
}

