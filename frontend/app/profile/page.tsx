'use client';
import TelegramLink from '@/components/community/TelegramLink';
import VolunteerLocation from '@/components/community/VolunteerLocation';
import VolunteerSettings from '@/components/community/VolunteerSettings';
import { Badge } from '@/components/ui/Badge';
import { apiClient, Application, User } from '@/lib/api';
import { communityApi } from '@/lib/community-api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { Award, Clock, Edit, Heart, HelpCircle, Mail, MapPin, Star, User as UserIcon } from 'lucide-react';
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
  const onboarding = useRef<HTMLDialogElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
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


  const selectTab = (id: Tab) => {
    setTab(id);
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
    { label: pluralRu(ratingCount, ['Оценка', 'Оценки', 'Оценок']), value: ratingCount, icon: Star, tone: 'amber' },
  ];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'requests', label: t('profile.requests'), count: stats?.total_applications },
    { id: 'responses', label: t('profile.responses') },
    { id: 'reviews', label: 'Отзывы', count: stats?.received_ratings?.length },
    { id: 'notifications', label: 'Уведомления' },
  ];

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <dialog ref={onboarding} aria-label={t('capability.title')} className="w-[calc(100%-2rem)] max-w-lg rounded-xl border p-5 backdrop:bg-gray-900/40">
        {user.capability_onboarding_seen === false && <VolunteerSettings onDone={() => onboarding.current?.close()} />}
      </dialog>

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
              <EmptyState text="У вас пока нет заявок. Если вам нужна помощь, создайте первую." href="/" actionLabel="Перейти на главную" />
            )}
          </section>

          <section id="panel-responses" role="tabpanel" aria-labelledby="tab-responses" className="space-y-6" hidden={tab !== 'responses'}>
            <div className="card">
              {loadingApplications ? <Spinner /> : userResponses.length > 0 ? (
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
          </section>

          <section id="panel-reviews" role="tabpanel" aria-labelledby="tab-reviews" className="card" hidden={tab !== 'reviews'}>
            <Reviews ratings={stats?.received_ratings} />
          </section>

          <section id="panel-notifications" role="tabpanel" aria-labelledby="tab-notifications" className="space-y-4" hidden={tab !== 'notifications'}>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <h3 className="mb-3 font-semibold text-blue-900">Telegram-оповещения</h3>
              <TelegramLink telegramId={user.telegram_id} onLinked={() => loadProfile()} />
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <VolunteerLocation />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}