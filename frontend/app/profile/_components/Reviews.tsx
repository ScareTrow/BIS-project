import { Star, User as UserIcon } from 'lucide-react';
import { EmptyState } from './ApplicationCards';

function Stars({ value, size = 'h-4 w-4' }: { value: number; size?: string }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`Оценка ${value} из 5`}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${size} ${i <= value ? 'fill-current text-amber-400' : 'text-gray-300'}`} />
      ))}
    </span>
  );
}

export { Stars };

export function Avatar({ person, size = 'h-10 w-10' }: { person?: any; size?: string }) {
  return person?.avatar ? (
    <img src={`/api/uploads/${person.avatar}`} alt={person.first_name || ''} className={`${size} rounded-full object-cover`} />
  ) : (
    <div className={`${size} flex items-center justify-center rounded-full bg-gray-300`}>
      <UserIcon className="h-1/2 w-1/2 text-gray-600" aria-hidden="true" />
    </div>
  );
}

export default function Reviews({ ratings }: { ratings?: any[] }) {
  if (!ratings || ratings.length === 0) {
    return <EmptyState text="Пока нет отзывов. Они появятся после того, как вы поможете кому-то." />;
  }
  return (
    <div className="space-y-4">
      {ratings.map(r => (
        <div key={r.id} className="rounded-lg border-l-4 border-blue-500 bg-gray-50 p-4">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar person={r.rater} />
              <div>
                <p className="font-medium">
                  {r.rater?.first_name || 'Пользователь'} {r.rater?.last_name || ''}
                </p>
                <p className="text-xs text-gray-500">
                  {new Date(r.created_at).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>
              </div>
            </div>
            <Stars value={r.rating_value} />
          </div>
          {r.comment && <p className="mt-2 whitespace-pre-wrap break-words text-sm text-gray-700">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}