'use client';

import CategoryBadge from '@/components/common/CategoryBadge';
import { apiClient, Application } from '@/lib/api';
import L from 'leaflet';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CATEGORY_META } from '@/lib/categories';
import { Marker, Popup } from 'react-leaflet';
import { ActionFeedback } from '@/components/ui/ActionFeedback';
import { Button } from '@/components/ui/Button';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

interface ApplicationMarkerProps {
  application: Application;
}

export default function ApplicationMarker({ application }: ApplicationMarkerProps) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { user, language } = useStore();
  const t = useTranslation(language);
  const details = `/applications/${application.public_id || application.id}`;

  const { category, is_sos } = application;
  const pending = application.moderation_status === 'pending' && application.is_own;
  const { Icon, color, labelKey } = CATEGORY_META[category] || CATEGORY_META.food;
  const icon = useMemo(() => L.divIcon({
    className: 'application-marker',
    html: renderToStaticMarkup(
      <div className={['application-pin', pending && 'application-pin-pending', is_sos && 'application-pin-sos'].filter(Boolean).join(' ')}
        style={{ backgroundColor: color }}>
        <Icon size={17} aria-hidden="true" />
        {is_sos && <span aria-hidden="true">!</span>}
      </div>
    ),
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  }), [Icon, color, is_sos, pending]);

  return (
    <Marker
      position={[application.latitude, application.longitude]}
      icon={icon}
      title={[t(labelKey), is_sos && 'SOS', pending && t('status.pending')].filter(Boolean).join(' · ')}
      zIndexOffset={is_sos ? 1000 : 0}
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

