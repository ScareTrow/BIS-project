'use client';

import CategoryBadge from '@/components/common/CategoryBadge';
import { Badge } from '@/components/ui/Badge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Application } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { MapPin } from 'lucide-react';
import Link from 'next/link';

function relativeTime(date: string, language: string, now: number) {
  const minutes = Math.floor((now - Date.parse(date)) / 60_000);
  if (!Number.isFinite(minutes)) return;
  const formatter = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (minutes >= 1440) return formatter.format(-Math.floor(minutes / 1440), 'day');
  if (minutes >= 60) return formatter.format(-Math.floor(minutes / 60), 'hour');
  return formatter.format(-Math.max(0, minutes), 'minute');
}

export default function ListView({ applications }: { applications: Application[] }) {
  const language = useStore(state => state.language);
  const t = useTranslation(language);
  const now = Date.now();

  return <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
    {applications.map(app => {
      const location = app.address || app.city || app.region || app.location;
      const expiresIn = app.expires_at ? Date.parse(app.expires_at) - now : Infinity;
      return <li key={app.id} className="min-w-0">
        <Link href={'/applications/' + (app.public_id || app.id)}
          className="card flex h-full flex-col gap-3 transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary">
          <div className="flex flex-wrap items-center gap-2">
            <CategoryBadge category={app.category} />
            {app.is_sos && <Badge tone="danger">SOS</Badge>}
            <StatusBadge status={app.status} />
          </div>
          <p className="line-clamp-3 flex-1 break-words text-gray-900">{app.description}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-600">
            {location && <span className="inline-flex min-w-0 items-center gap-1 break-words">
              <MapPin aria-hidden="true" className="h-4 w-4 shrink-0" />{location}
            </span>}
            {app.date && <time dateTime={app.date}>{relativeTime(app.date, language, now)}</time>}
            {!app.is_resolved && expiresIn > 0 && expiresIn <= 86_400_000 &&
              <span className="font-medium text-orange-800">{t('applications.expiring')}</span>}
          </div>
        </Link>
      </li>;
    })}
  </ul>;
}
