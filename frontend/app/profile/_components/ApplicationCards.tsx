import { CheckCircle, Clock, MapPin, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { categoryLabels, formatDate, pluralRu, responseStatusLabels } from './format';

const cardLink =
  'block rounded-lg bg-gray-50 p-4 transition-colors hover:bg-gray-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600';

function Header({ app, children }: { app: any; children?: React.ReactNode }) {
  return (
    <div className="mb-1 flex flex-wrap items-center gap-2">
      <span className="font-semibold text-primary">#{app.id}</span>
      <span className="badge badge-primary text-xs">{categoryLabels[app.category] || app.category}</span>
      {app.is_sos && <span className="badge badge-danger text-xs">SOS</span>}
      {children}
    </div>
  );
}

function Meta({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">{children}</div>;
}

/** Карточка моей заявки */
export function MyApplicationCard({ app }: { app: any }) {
  const href = `/applications/${app.public_id || app.id}`;
  return (
    <Link href={href} className={cardLink}>
      <Header app={app}>
        {app.is_resolved ? (
          <span className="flex items-center gap-1 text-xs text-success">
            <CheckCircle className="h-4 w-4" aria-hidden="true" /> Выполнена
          </span>
        ) : (
          <span className="flex items-center gap-1 text-xs text-warning">
            <Clock className="h-4 w-4" aria-hidden="true" /> Ждёт помощи
          </span>
        )}
      </Header>
      <p className="mb-2 line-clamp-2 text-sm text-gray-700">{app.description}</p>
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

/** Карточка заявки, на которую я откликнулся */
export function MyResponseCard({ app }: { app: any }) {
  const href = `/applications/${app.public_id || app.id}`;
  return (
    <Link href={href} className={cardLink}>
      <Header app={app}>
        <span className={`badge text-xs ${responseBadge[app.response_status] || 'badge-warning'}`}>
          {responseStatusLabels[app.response_status] || app.response_status}
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

export function EmptyState({ text }: { text: string }) {
  return <p className="py-8 text-center text-gray-500">{text}</p>;
}