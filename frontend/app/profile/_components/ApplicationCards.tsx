import { MapPin, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import CategoryBadge from '@/components/common/CategoryBadge';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { formatDate, pluralRu } from './format';

const cardLink =
  'block rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

function Header({ app, children }: { app: any; children?: React.ReactNode }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <span className="font-semibold text-primary">#{app.id}</span>
      <CategoryBadge category={app.category} />
      {app.is_sos && <span className="badge badge-danger text-xs">SOS</span>}
      {children}
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">{children}</div>;
}

export function MyApplicationCard({ app }: { app: any }) {
  const t = useTranslation(useStore(state => state.language));
  const href = `/applications/${app.public_id || app.id}`;
  return (
        <Link
      href={href}
      className={`${cardLink} border-l-4 ${
        app.is_sos ? 'border-red-500' : app.is_resolved ? 'border-emerald-500' : 'border-amber-400'
      }`}
    >
      <Header app={app}>
        <StatusBadge status={app.is_false_call ? 'false_call' : app.lifecycle || app.status} />
        {app.rating_pending && <span className="badge badge-warning text-xs">{t('review.title')}</span>}
      </Header>
      <p className="mb-2 line-clamp-2 text-sm text-gray-700">{app.description}</p>
      {app.rejection_reason && <p className="mb-2 break-words text-sm text-danger-dark">
        {t('request.rejectedBecause', { reason: app.rejection_reason })}
      </p>}
      <Meta>
        {app.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {app.city}
          </span>
        )}
        <span>{formatDate(app.date)}</span>
        {app.responses_count > 0 && (
          <span className="font-medium text-primary">
            {app.responses_count} {pluralRu(app.responses_count, ['отклик', 'отклика', 'откликов'])} ›
          </span>
        )}
      </Meta>
    </Link>
  );
}

const responseBadge: Record<string, string> = {
  accepted: 'badge-success',
  completed: 'badge-info',
  cancelled: 'badge-danger',
};


export function MyResponseCard({ app }: { app: any }) {
  const t = useTranslation(useStore(state => state.language));
  const href = `/applications/${app.public_id || app.id}`;
  return (
        <Link
      href={href}
      className={`${cardLink} border-l-4 ${
        app.response_status === 'accepted' ? 'border-emerald-500'
        : app.response_status === 'completed' ? 'border-blue-500'
        : app.response_status === 'cancelled' ? 'border-red-400'
        : 'border-amber-400'
      }`}
    >
      <Header app={app}>
        <StatusBadge status={app.is_false_call ? 'false_call' : app.lifecycle || app.status} />
        <span className={`badge text-xs ${responseBadge[app.response_status] || 'badge-warning'}`}>
          {t(`response.status.${app.response_status}`)}
        </span>
      </Header>
      <p className="mb-2 line-clamp-2 text-sm text-gray-700">{app.description}</p>
      <Meta>
        {app.city && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden="true" />
            {app.city}
          </span>
        )}
        {app.author && (
          <span className="flex items-center gap-1">
            <UserIcon className="h-3 w-3" aria-hidden="true" />
            {app.author.first_name} {app.author.last_name || ''}
          </span>
        )}
        <span>Отклик: {formatDate(app.response_created_at)}</span>
      </Meta>
    </Link>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center py-8" role="status" aria-label="Загрузка">
      <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
    </div>
  );
}

export function EmptyState({ text, href, actionLabel }: { text: string; href?: string; actionLabel?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <p className="max-w-sm text-gray-600">{text}</p>
      {href && actionLabel && (
        <Link href={href} className="btn btn-primary">{actionLabel}</Link>
      )}
    </div>
  );
}