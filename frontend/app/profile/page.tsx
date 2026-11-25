'use client';
import TelegramLink from '@/components/community/TelegramLink';
import VolunteerLocation from '@/components/community/VolunteerLocation';
import VolunteerSettings from '@/components/community/VolunteerSettings';
import { Badge } from '@/components/ui/Badge';
import { apiClient, Application, User } from '@/lib/api';
import { communityApi } from '@/lib/community-api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { Award, Edit, MapPin, Send, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EmptyState, MyApplicationCard, MyResponseCard, Spinner } from './_components/ApplicationCards';
import { pluralRu } from './_components/format';
import Reviews, { Avatar, Stars } from './_components/Reviews';
import SocialLinks from './_components/SocialLinks';

type Tab = 'requests' | 'responses' | 'reviews' | 'notifications';

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslation(useStore(state => state.language));
  const onboarding = useRef<HTMLDialogElement>(null);
  const claimingOnboarding = useRef(false);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [userApplications, setUserApplications] = useState<Application[]>([]);
  const [userResponses, setUserResponses] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [tab, setTab] = useState<Tab>('requests');

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    if (loading || user?.capability_onboarding_seen !== false || claimingOnboarding.current) return;
    claimingOnboarding.current = true;
    communityApi.claimCapabilityOnboarding().then(({ show }) => {
      if (show) onboarding.current?.showModal();
    }).catch(() => { claimingOnboarding.current = false; });
  }, [loading, user?.capability_onboarding_seen]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getCurrentUser();
      setUser(data.user);
      setStats(data);
      await loadUserApplications();
    } catch (error) {
      console.error('Error loading profile:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const loadUserApplications = async () => {
    try {
      setLoadingApplications(true);
      const [appsData, responsesData] = await Promise.all([
        apiClient.getUserApplications(10, 0),
        apiClient.getUserResponses(10, 0),
      ]);
      setUserApplications(appsData.applications || []);
      setUserResponses(responsesData.applications || []);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoadingApplications(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex h-96 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      </div>
    );
  }
  if (!user) return null;

  const ratingCount = user.rating_count || 0;
  const averageRating = ratingCount > 0 ? user.rating_sum / ratingCount : 0;
  const helped = userResponses.filter((a: any) => a.response_status === 'completed' && a.author);

  const statItems = [
    { label: 'Заявок', value: stats?.total_applications || 0 },
    { label: 'Активных', value: stats?.active_applications || 0 },
    { label: 'Помог', value: stats?.help_given || 0 },
    // Берём то же число, что и в рейтинге, чтобы данные не расходились.
    { label: pluralRu(ratingCount, ['Оценка', 'Оценки', 'Оценок']), value: ratingCount },
  ];

  const tabs: { id: Tab; label: string }[] = [
    { id: 'requests', label: t('profile.requests') },
    { id: 'responses', label: t('profile.responses') },
    { id: 'reviews', label: 'Отзывы' },
    { id: 'notifications', label: 'Уведомления' },
  ];

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <dialog ref={onboarding} aria-label={t('capability.title')} className="w-[calc(100%-2rem)] max-w-lg rounded-xl border p-5 backdrop:bg-gray-900/40">
        {user.capability_onboarding_seen === false && <VolunteerSettings onDone={() => onboarding.current?.close()} />}
      </dialog>

      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t('profile.title')}</h1>
        <Link href="/profile/edit" className="btn btn-primary flex items-center gap-2" aria-label="Редактировать профиль">
          <Edit className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Редактировать</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Карточка профиля: на телефоне компактная, на компьютере — колонка слева */}
        <aside className="lg:col-span-1">
          <div className="card flex items-center gap-4 text-left lg:flex-col lg:text-center">
            {user.avatar ? (
              <img src={`/api/uploads/${user.avatar}`} alt="Аватар"
                className="h-20 w-20 shrink-0 rounded-full border-4 border-primary object-cover lg:h-32 lg:w-32" />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gray-200 lg:h-32 lg:w-32">
                <UserIcon className="h-10 w-10 text-gray-400 lg:h-16 lg:w-16" aria-hidden="true" />
              </div>
            )}

            <div className="min-w-0 flex-1 lg:flex lg:flex-col lg:items-center">
              <h2 className="truncate text-xl font-bold lg:text-2xl">
                {user.first_name} {user.last_name || ''}
              </h2>
              <p className="mb-2 truncate text-sm text-gray-600">{user.email}</p>

              <div className="mb-2 flex flex-wrap items-center gap-2 lg:justify-center">
                {user.city && (
                  <Badge tone="info"><MapPin aria-hidden="true" className="h-4 w-4" />{user.city}</Badge>
                )}
                {user.badge && (
                  <span className="badge badge-warning flex items-center gap-1">
                    <Award className="h-4 w-4" aria-hidden="true" />{user.badge}
                  </span>
                )}
              </div>

              <div className="mb-2 flex items-center gap-2 lg:flex-col lg:gap-1">
                <Stars value={Math.round(averageRating)} size="h-5 w-5" />
                <p className="text-sm text-gray-600">
                  <span className="text-lg font-bold text-primary">{averageRating.toFixed(1)}</span>{' '}
                  · {ratingCount} {pluralRu(ratingCount, ['оценка', 'оценки', 'оценок'])}
                </p>
              </div>

              <button type="button" onClick={() => setTab('notifications')}
                className={`flex items-center gap-1.5 text-sm hover:underline ${user.telegram_id ? 'text-success' : 'text-gray-600'}`}>
                <Send className="h-4 w-4" aria-hidden="true" />
                {user.telegram_id ? 'Telegram подключён' : 'Подключить Telegram'}
              </button>

              <div className="mt-3"><SocialLinks value={user.social_links} /></div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          {/* Статистика: одна компактная строка */}
          <div className="grid grid-cols-4 gap-2 sm:gap-4">
            {statItems.map(item => (
              <div key={item.label} className="card px-2 py-3 text-center">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="text-xs text-gray-600">{item.label}</p>
              </div>
            ))}
          </div>

          {/* Вкладки: закрепляются при прокрутке, на узком экране листаются вбок */}
          <div role="tablist" aria-label="Разделы профиля"
            className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-gray-50 px-4 py-2">
            {tabs.map(item => (
              <button key={item.id} type="button" role="tab" id={`tab-${item.id}`}
                aria-selected={tab === item.id} aria-controls={`panel-${item.id}`}
                className={`btn shrink-0 ${tab === item.id ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setTab(item.id)}>
                {item.label}
              </button>
            ))}
          </div>

          {/* Панели остаются в DOM (hidden), чтобы настройки геолокации не сбрасывались при переключении */}
          <section id="panel-requests" role="tabpanel" aria-labelledby="tab-requests" className="card" hidden={tab !== 'requests'}>
            {loadingApplications ? <Spinner /> : userApplications.length > 0 ? (
              <div className="space-y-3">
                {userApplications.map((app: any) => <MyApplicationCard key={app.id} app={app} />)}
              </div>
            ) : (
              <EmptyState text="У вас пока нет заявок. Создайте первую на главной странице." />
            )}
          </section>

          <section id="panel-responses" role="tabpanel" aria-labelledby="tab-responses" className="space-y-6" hidden={tab !== 'responses'}>
            <div className="card">
              {loadingApplications ? <Spinner /> : userResponses.length > 0 ? (
                <div className="space-y-3">
                  {userResponses.map((app: any) => <MyResponseCard key={app.id} app={app} />)}
                </div>
              ) : (
                <EmptyState text="Вы ещё не откликались на заявки. Найдите, кому нужна помощь, в разделе «Заявки»." />
              )}
            </div>

            {helped.length > 0 && (
              <div className="card">
                <h3 className="mb-4 text-lg font-semibold">Люди, которым я помог</h3>
                <div className="flex flex-wrap gap-3">
                  {helped.map((app: any) => (
                    <Link key={app.id} href={`/users/${app.author.id}`}
                      className="flex items-center gap-2 rounded-lg bg-gray-50 p-2 transition-colors hover:bg-gray-100">
                      <Avatar person={app.author} />
                      <div>
                        <p className="text-sm font-medium">{app.author.first_name} {app.author.last_name || ''}</p>
                        <p className="text-xs text-gray-500">Заявка #{app.id}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </section>

          <section id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" className="card" hidden={tab !== 'reviews'}>
            <Reviews ratings={stats?.received_ratings} />
          </section>

          <section id="panel-notifications" role="tabpanel" aria-labelledby="tab-notifications" className="card space-y-4" hidden={tab !== 'notifications'}>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-3 font-semibold text-blue-900">Telegram-оповещения</h3>
              <TelegramLink telegramId={user.telegram_id} onLinked={() => loadProfile()} />
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <VolunteerLocation />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}