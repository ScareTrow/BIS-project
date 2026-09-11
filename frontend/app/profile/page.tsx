'use client';

import { apiClient, Application, User } from '@/lib/api';
import { Award, CheckCircle, Clock, Edit, Heart, HelpCircle, MapPin, Star, User as UserIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

function TelegramBotLink() {
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBotInfo();
  }, []);

  const loadBotInfo = async () => {
    try {
      const data = await apiClient.getTelegramBotInfo();
      if (data.bot_url) {
        setBotUrl(data.bot_url);
      }
    } catch (error) {
      console.error('Error loading bot info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="btn bg-green-600 hover:bg-green-700 text-white w-full block text-center py-2.5 opacity-50">
        Загрузка...
      </div>
    );
  }

  if (botUrl) {
    return (
      <a
        href={botUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="btn bg-green-600 hover:bg-green-700 text-white w-full block text-center py-2.5"
      >
        Перейти к Telegram боту
      </a>
    );
  }

  return (
    <div className="text-center">
      <p className="text-xs text-green-600 mb-2">
        Используйте команду /start в Telegram боте
      </p>
    </div>
  );
}

const categoryLabels: Record<string, string> = {
  food: 'Еда',
  medicine: 'Медицина',
  shelter: 'Убежище',
  emergency: 'Экстренная',
};

const statusLabels: Record<string, string> = {
  pending: 'На модерации',
  approved: 'Одобрена',
  rejected: 'Отклонена',
};

const responseStatusLabels: Record<string, string> = {
  pending: 'Ожидает',
  accepted: 'Принят',
  completed: 'Завершен',
  cancelled: 'Отменен',
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [userApplications, setUserApplications] = useState<Application[]>([]);
  const [userResponses, setUserResponses] = useState<any[]>([]);
  const [loadingApplications, setLoadingApplications] = useState(true);

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
        <div className="flex justify-center items-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const averageRating = user.rating_count > 0
    ? (user.rating_sum / user.rating_count).toFixed(2)
    : '0.00';

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Мой профиль</h1>
        <Link
          href="/profile/edit"
          className="btn btn-primary flex items-center space-x-2"
        >
          <Edit className="w-4 h-4" />
          <span>Редактировать</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <div className="card text-center">
            <div className="mb-4">
              {user.avatar ? (
                <img
                  src={`/api/uploads/${user.avatar}`}
                  alt="Avatar"
                  className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-primary"
                />
              ) : (
                <div className="w-32 h-32 rounded-full mx-auto bg-gray-200 flex items-center justify-center">
                  <UserIcon className="w-16 h-16 text-gray-400" />
                </div>
              )}
            </div>
            <h2 className="text-2xl font-bold mb-1">
              {user.first_name} {user.last_name || ''}
            </h2>
            <p className="text-gray-600 mb-4">{user.email}</p>
            {user.city && (
              <p className="text-gray-600 mb-4">📍 {user.city}</p>
            )}

            {user.social_links && (() => {
              try {
                const socialLinks = typeof user.social_links === 'string'
                  ? JSON.parse(user.social_links)
                  : user.social_links;

                if (socialLinks && Object.keys(socialLinks).length > 0) {
                  return (
                    <div className="mb-4 flex justify-center space-x-3">
                      {socialLinks.instagram && (
                        <a
                          href={socialLinks.instagram.startsWith('http') ? socialLinks.instagram : `https://instagram.com/${socialLinks.instagram.replace('@', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-pink-600 hover:text-pink-700"
                          title="Instagram"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                          </svg>
                        </a>
                      )}
                      {socialLinks.telegram && (
                        <a
                          href={socialLinks.telegram.startsWith('http') ? socialLinks.telegram : (socialLinks.telegram.startsWith('@') ? `https://t.me/${socialLinks.telegram.replace('@', '')}` : `https://t.me/${socialLinks.telegram}`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-600"
                          title="Telegram"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
                          </svg>
                        </a>
                      )}
                      {socialLinks.vk && (
                        <a
                          href={socialLinks.vk.startsWith('http') ? socialLinks.vk : `https://vk.com/${socialLinks.vk.replace('@', '').replace('https://vk.com/', '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-700 hover:text-blue-800"
                          title="VK"
                        >
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M15.684 0H8.316C1.592 0 0 1.592 0 8.316v7.368C0 22.408 1.592 24 8.316 24h7.368C22.408 24 24 22.408 24 15.684V8.316C24 1.592 22.408 0 15.684 0zm3.692 17.123h-1.744c-.66 0-.864-.525-2.05-1.727-1.572-1.692-2.274-.042-2.274 1.44v1.595c0 .724-.479.91-1.084.91H9.474c-1.02 0-1.724-.415-1.724-1.56V8.316c0-1.298.651-1.734 1.724-1.734h1.244c.724 0 .91.328.91.91v2.933c.479-.574 1.533-2.002 3.439-2.933 1.329-.479 2.5-.287 2.931.91 0 0 .574 1.744.574 4.093v3.35c0 .908.246 1.141.574 1.141z" />
                          </svg>
                        </a>
                      )}
                    </div>
                  );
                }
                return null;
              } catch (e) {
                return null;
              }
            })()}

            <div className="mb-4">
              <div className="flex items-center justify-center space-x-1 mb-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-5 h-5 ${i <= Math.round(Number(averageRating))
                      ? 'text-blue-600 fill-current'
                      : 'text-gray-300'
                      }`}
                  />
                ))}
              </div>
              <p className="text-2xl font-bold text-primary">{averageRating}</p>
              <p className="text-sm text-gray-500">
                На основе {user.rating_count} оценок
              </p>
            </div>

            {user.badge && (
              <div className="mb-4">
                <Award className="w-6 h-6 mx-auto text-warning mb-2" />
                <span className="badge badge-warning">{user.badge}</span>
              </div>
            )}

            {!user.telegram_id ? (
              <div className="mt-4 p-5 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-700 mb-4 text-center">
                  Привяжите ваш Telegram аккаунт для удобной работы через бота
                </p>
                <Link
                  href="/profile/edit"
                  className="btn btn-primary w-full block text-center py-2.5"
                >
                  Привязать Telegram
                </Link>
                <p className="text-xs text-blue-600 mt-3 text-center">
                  Получите ваш Telegram ID в боте командой /start
                </p>
              </div>
            ) : (
              <div className="mt-4 p-5 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-700 mb-4 text-center">
                  Telegram аккаунт привязан
                </p>
                <TelegramBotLink />
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="card text-center">
              <HelpCircle className="w-8 h-8 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold">{stats?.total_applications || 0}</p>
              <p className="text-sm text-gray-600">Всего заявок</p>
            </div>
            <div className="card text-center">
              <Clock className="w-8 h-8 mx-auto text-success mb-2" />
              <p className="text-2xl font-bold text-success">{stats?.active_applications || 0}</p>
              <p className="text-sm text-gray-600">Активных</p>
            </div>
            <div className="card text-center">
              <Heart className="w-8 h-8 mx-auto text-info mb-2" />
              <p className="text-2xl font-bold text-info">{stats?.help_given || 0}</p>
              <p className="text-sm text-gray-600">Помог людям</p>
            </div>
            <div className="card text-center">
              <Star className="w-8 h-8 mx-auto text-blue-600 mb-2" />
              <p className="text-2xl font-bold">{stats?.received_ratings?.length || 0}</p>
              <p className="text-sm text-gray-600">Оценок получено</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Мои последние заявки</h3>
            {loadingApplications ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : userApplications.length > 0 ? (
              <div className="space-y-3">
                {userApplications.map((app: any) => (
                  <Link
                    key={app.id}
                    href={`/applications/${app.id}`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-primary">#{app.id}</span>
                          <span className="badge badge-primary text-xs">
                            {categoryLabels[app.category] || app.category}
                          </span>
                          {app.is_sos && (
                            <span className="badge badge-danger text-xs">SOS</span>
                          )}
                          {app.is_resolved ? (
                            <CheckCircle className="w-4 h-4 text-success" />
                          ) : (
                            <Clock className="w-4 h-4 text-warning" />
                          )}
                        </div>
                        <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                          {app.description}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {app.city && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{app.city}</span>
                            </div>
                          )}
                          <span>
                            {new Date(app.date).toLocaleDateString('ru-RU')}
                          </span>
                          {app.responses_count > 0 && (
                            <span className="text-primary">
                              {app.responses_count} отклик{app.responses_count === 1 ? '' : app.responses_count < 5 ? 'а' : 'ов'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                У вас пока нет созданных заявок
              </p>
            )}
          </div>

          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Заявки, на которые я откликнулся</h3>
            {loadingApplications ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : userResponses.length > 0 ? (
              <div className="space-y-3">
                {userResponses.map((app: any) => (
                  <Link
                    key={app.id}
                    href={`/applications/${app.id}`}
                    className="block p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-semibold text-primary">#{app.id}</span>
                          <span className="badge badge-primary text-xs">
                            {categoryLabels[app.category] || app.category}
                          </span>
                          {app.is_sos && (
                            <span className="badge badge-danger text-xs">SOS</span>
                          )}
                          <span className={`badge text-xs ${app.response_status === 'accepted' ? 'badge-success' :
                            app.response_status === 'completed' ? 'badge-info' :
                              app.response_status === 'cancelled' ? 'badge-danger' :
                                'badge-warning'
                            }`}>
                            {responseStatusLabels[app.response_status] || app.response_status}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2 line-clamp-2">
                          {app.description}
                        </p>
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          {app.city && (
                            <div className="flex items-center space-x-1">
                              <MapPin className="w-3 h-3" />
                              <span>{app.city}</span>
                            </div>
                          )}
                          {app.author && (
                            <div className="flex items-center space-x-1">
                              <UserIcon className="w-3 h-3" />
                              <span>
                                {app.author.first_name} {app.author.last_name || ''}
                              </span>
                            </div>
                          )}
                          <span>
                            Отклик: {new Date(app.response_created_at).toLocaleDateString('ru-RU')}
                          </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Вы еще не откликались на заявки
              </p>
            )}
          </div>

          {userResponses.filter((app: any) => app.response_status === 'completed').length > 0 && (
            <div className="card">
              <h3 className="text-xl font-semibold mb-4">Люди, которым я помог</h3>
              <div className="flex flex-wrap gap-3">
                {userResponses
                  .filter((app: any) => app.response_status === 'completed' && app.author)
                  .map((app: any) => (
                    <Link
                      key={app.id}
                      href={`/users/${app.author.id}`}
                      className="flex items-center space-x-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      {app.author.avatar ? (
                        <img
                          src={`/api/uploads/${app.author.avatar}`}
                          alt={app.author.first_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                          <UserIcon className="w-6 h-6 text-gray-600" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">
                          {app.author.first_name} {app.author.last_name || ''}
                        </p>
                        <p className="text-xs text-gray-500">Заявка #{app.id}</p>
                      </div>
                    </Link>
                  ))}
              </div>
            </div>
          )}

          <div className="card">
            <h3 className="text-xl font-semibold mb-4">Комментарии и отзывы</h3>
            {stats?.received_ratings && stats.received_ratings.length > 0 ? (
              <div className="space-y-4">
                {stats.received_ratings.map((rating: any) => (
                  <div
                    key={rating.id}
                    className="p-4 bg-gray-50 rounded-lg border-l-4 border-blue-500"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        {rating.rater?.avatar ? (
                          <img
                            src={`/api/uploads/${rating.rater.avatar}`}
                            alt={rating.rater.first_name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-300 flex items-center justify-center">
                            <UserIcon className="w-6 h-6 text-gray-600" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">
                            {rating.rater?.first_name || 'Пользователь'} {rating.rater?.last_name || ''}
                          </p>
                          <p className="text-xs text-gray-500">
                            {new Date(rating.created_at).toLocaleDateString('ru-RU', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-4 h-4 ${i <= rating.rating_value
                              ? 'text-blue-600 fill-current'
                              : 'text-gray-300'
                              }`}
                          />
                        ))}
                        <span className="ml-1 font-semibold text-sm">{rating.rating_value}/5</span>
                      </div>
                    </div>
                    {rating.comment && (
                      <p className="text-sm text-gray-700 mt-2 pl-13 italic">"{rating.comment}"</p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                Пока нет комментариев и отзывов
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

