'use client';
import TelegramLink from '@/components/community/TelegramLink';
import VolunteerLocation from '@/components/community/VolunteerLocation';
import VolunteerSettings from '@/components/community/VolunteerSettings';
import { Badge } from '@/components/ui/Badge';
import { apiClient, Application, User } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { Award, Clock, Edit, Heart, HelpCircle, Mail, MapPin, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { EmptyState, MyApplicationCard, MyResponseCard, Spinner } from './_components/ApplicationCards';
import { pluralRu } from './_components/format';
import Reviews, { Avatar, Stars } from './_components/Reviews';
import SocialLinks from './_components/SocialLinks';
import StatsCard, { StatItem } from './_components/StatsCard';
import TelegramBanner from './_components/TelegramBanner';

type Tab = 'requests' | 'responses' | 'reviews' | 'notifications';

export default function ProfilePage() {
  const router = useRouter();
  const t = useTranslation(useStore(state => state.language));
  const tabsRef = useRef<HTMLDivElement>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [userApplications, setUserApplications] = useState<Application[]>([]);
  const [userResponses, setUserResponses] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [loadingResponses, setLoadingResponses] = useState(true);
  const [responsesError, setResponsesError] = useState(false);
  const [tab, setTab] = useState<Tab>('requests');
  const [visited, setVisited] = useState<Tab[]>(['requests']);
  const [totals, setTotals] = useState({ requests: 0, responses: 0 });
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageError, setPageError] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

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
      const appsData = await apiClient.getUserApplications(10, 0);
      setUserApplications(appsData.applications || []);
      setTotals(current => ({ ...current, requests: appsData.total }));
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoadingApplications(false);
    }
  };


  const hasVisitedResponses = visited.includes('responses');
  useEffect(() => {
    if (!hasVisitedResponses) return;
    let active = true;
    apiClient.getUserResponses(10, 0).then(data => {
      if (!active) return;
      setUserResponses(data.applications);
      setTotals(current => ({ ...current, responses: data.total }));
    }).catch(() => {
      if (active) setResponsesError(true);
    }).finally(() => {
      if (active) setLoadingResponses(false);
    });
    return () => { active = false; };
  }, [hasVisitedResponses]);


  async function loadMore(kind: 'requests' | 'responses') {
    setLoadingMore(true);
    setPageError(false);
    try {
      const result = kind === 'requests'
        ? await apiClient.getUserApplications(10, userApplications.length)
        : await apiClient.getUserResponses(10, userResponses.length);
      if (kind === 'requests') setUserApplications(current => [...current, ...result.applications]);
      else setUserResponses(current => [...current, ...result.applications]);
      setTotals(current => ({ ...current, [kind]: result.total }));
    } catch {
      setPageError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  const selectTab = (id: Tab) => {
    setTab(id);
    setVisited(current => current.includes(id) ? current : [...current, id]);
    requestAnimationFrame(() =>
      document.getElementById(`tab-${id}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }));
  };

  const openNotifications = () => {
    selectTab('notifications');
    tabsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const statItems: StatItem[] = [
    { label: 'Заявок', value: stats?.total_applications || 0, icon: HelpCircle, tone: 'blue' },
    { label: 'Активных', value: stats?.active_applications || 0, icon: Clock, tone: 'emerald' },
    { label: 'Помог', value: stats?.help_given || 0, icon: Heart, tone: 'rose' },
  ];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'requests', label: t('profile.requests'), count: stats?.total_applications },
    { id: 'responses', label: t('profile.responses'), count: hasVisitedResponses && !loadingResponses ? totals.responses : undefined },
    { id: 'reviews', label: 'Отзывы', count: stats?.received_ratings?.length },
    { id: 'notifications', label: t('profile.alerts') },
  ];

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-blue-600">Личный кабинет</p>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{t('profile.title')}</h1>
        </div>
        <Link href="/profile/edit" className="btn btn-primary flex shrink-0 items-center gap-2">
          <Edit className="h-4 w-4" aria-hidden="true" />
          <span className="sm:hidden">Изменить</span>
          <span className="hidden sm:inline">Редактировать профиль</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Карточка профиля */}
                <aside className="lg:col-span-1">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            <div className="h-20 bg-gradient-to-r from-blue-600 to-indigo-500" />
            <div className="px-5 pb-5">
              <div className="flex items-start gap-4 lg:flex-col lg:items-center lg:text-center">
                {user.avatar ? (
                  <img src={`/api/uploads/${user.avatar}`} alt="Аватар"
                    className="-mt-10 h-20 w-20 shrink-0 rounded-full border-4 border-white object-cover shadow lg:-mt-14 lg:h-28 lg:w-28" />
                ) : (
                  <div className="-mt-10 flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-blue-50 shadow lg:-mt-14 lg:h-28 lg:w-28">
                    <UserIcon className="h-10 w-10 text-blue-400 lg:h-14 lg:w-14" aria-hidden="true" />
                  </div>
                )}
                <div className="min-w-0 flex-1 pt-3 lg:pt-0">
                  <h2 className="truncate text-xl font-bold lg:text-2xl">
                    {user.first_name} {user.last_name || ''}
                  </h2>
                  <p className="mb-2 flex items-center gap-1.5 text-sm text-gray-600 lg:justify-center">
                    <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{user.email}</span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2 lg:justify-center">
                    {user.city && (
                      <Badge tone="info"><MapPin aria-hidden="true" className="h-4 w-4" />{user.city}</Badge>
                    )}
                    {user.badge && (
                      <span className="badge badge-warning flex items-center gap-1">
                        <Award className="h-4 w-4" aria-hidden="true" />{user.badge}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-lg bg-amber-50 px-4 py-3">
                <div>
                  <p className="text-sm text-amber-800">Рейтинг</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {averageRating.toFixed(1)} <span className="text-base font-normal text-gray-500">/ 5</span>
                  </p>
                  <p className="text-sm text-gray-600">
                    {ratingCount} {pluralRu(ratingCount, ['оценка', 'оценки', 'оценок'])}
                  </p>
                </div>
                <Stars value={Math.round(averageRating)} size="h-5 w-5" />
              </div>

              <div className="mt-4">
                <TelegramBanner connected={Boolean(user.telegram_id)} onOpen={openNotifications} />
              </div>

              <div className="mt-3"><SocialLinks value={user.social_links} /></div>
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-4 lg:col-span-2">
          <StatsCard items={statItems} />

          <div ref={tabsRef} className="relative scroll-mt-4">
            <div role="tablist" aria-label="Разделы профиля"
              className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-100 p-1">
              {tabs.map(item => {
                const active = tab === item.id;
                return (
                  <button key={item.id} type="button" role="tab" id={`tab-${item.id}`}
                    aria-selected={active} aria-controls={`panel-${item.id}`}
                    onClick={() => selectTab(item.id)}
                    className={`flex shrink-0 items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                      active ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                    }`}>
                    {item.label}
                    {item.count ? (
                      <span className="rounded-full bg-gray-200 px-1.5 text-xs text-gray-700">{item.count}</span>
                    ) : null}
                    {item.id === 'notifications' && !user.telegram_id && (
                      <span className="h-2 w-2 rounded-full bg-red-500" role="img" aria-label="Требует настройки" />
                    )}
                  </button>
                );
              })}
            </div>
            <div className="pointer-events-none absolute inset-y-px right-px w-8 rounded-r-xl bg-gradient-to-l from-gray-100 to-transparent lg:hidden" />
          </div>

          {/* Панели остаются в DOM (hidden), чтобы настройки геолокации не сбрасывались при переключении */}
          <section id="panel-requests" role="tabpanel" aria-labelledby="tab-requests" className="card" hidden={tab !== 'requests'}>
            {loadingApplications ? <Spinner /> : userApplications.length > 0 ? (
              <div className="space-y-3">
                {userApplications.map((app: any) => <MyApplicationCard key={app.id} app={app} />)}
              </div>
            ) : (
              <EmptyState text="У вас пока нет заявок. Если вам нужна помощь, создайте первую." href="/applications/new" actionLabel={t('home.hero.createApplication')} />
            )}
          {userApplications.length < totals.requests && <button type="button" disabled={loadingMore}
              onClick={() => loadMore('requests')} className="btn btn-secondary mt-3">{t('common.loadMore')}</button>}
            {tab === 'requests' && pageError && <p role="alert" className="mt-2 text-danger-dark">{t('ui.action.error')}</p>}
          </section>

          <section id="panel-responses" role="tabpanel" aria-labelledby="tab-responses" className="space-y-6" hidden={tab !== 'responses'}>
            {hasVisitedResponses && <>
            <div className="card">
              {loadingResponses ? <Spinner /> : responsesError
                ? <p role="alert" className="text-danger-dark">{t('home.loadError')}</p>
                : userResponses.length > 0 ? (
                <div className="space-y-3">
                  {userResponses.map((app: any) => <MyResponseCard key={app.id} app={app} />)}
                </div>
              ) : (
                <EmptyState text="Вы ещё не откликались на заявки. Посмотрите, кому нужна помощь." href="/applications" actionLabel="Найти, кому помочь" />
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
          {userResponses.length < totals.responses && <button type="button" disabled={loadingMore}
              onClick={() => loadMore('responses')} className="btn btn-secondary mt-3">{t('common.loadMore')}</button>}
            {tab === 'responses' && pageError && <p role="alert" className="mt-2 text-danger-dark">{t('ui.action.error')}</p>}
            </>}
          </section>

          <section id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" className="card" hidden={tab !== 'reviews'}>
            {visited.includes('reviews') && <Reviews ratings={stats?.received_ratings} />}
          </section>

          <section id="panel-notifications" role="tabpanel" aria-labelledby="tab-notifications" className="space-y-4" hidden={tab !== 'notifications'}>
            {visited.includes('notifications') && <>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                <h3 className="mb-3 font-semibold text-blue-900">{t('profile.telegramAlerts')}</h3>
                <TelegramLink telegramId={user.telegram_id} onLinked={telegramId => {
                  setUser(current => current && ({ ...current, telegram_id: telegramId }));
                }} />
              </div>
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><VolunteerLocation /></div>
              <details className="card">
                <summary className="cursor-pointer font-semibold">{t('capability.title')}</summary>
                <div className="mt-4"><VolunteerSettings /></div>
              </details>
            </>}
          </section>
        </div>
      </div>
    </div>
  );
}