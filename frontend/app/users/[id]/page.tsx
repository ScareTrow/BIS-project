'use client';

import { apiClient, User } from '@/lib/api';
import { Award, Star, User as UserIcon, Clock, Heart, MapPin, HelpCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation, getLanguage } from '@/lib/i18n';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const t = useTranslation(getLanguage());
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (params.id) {
      loadUser();
    }
  }, [params.id]);

  const loadUser = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getUser(Number(params.id));
      setUser(data);
    } catch (error: any) {
      console.error('Error loading user:', error);
      if (error.response?.status === 404) {
        router.push('/');
      }
    } finally {
      setLoading(false);
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
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">Пользователь не найден</p>
          <Link href="/" className="text-primary hover:underline mt-4 inline-block">
            Вернуться на главную
          </Link>
        </div>
      </div>
    );
  }

  const socialLinks = user.social_links ? (typeof user.social_links === 'string' ? JSON.parse(user.social_links) : user.social_links) : {};

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-primary hover:underline mb-4"
        >
          ← Назад
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Левая колонка - Профиль */}
        <div className="md:col-span-1">
          <div className="card">
            <div className="text-center">
              {user.avatar ? (
                <img
                  src={`/api/uploads/${user.avatar}`}
                  alt={user.first_name}
                  className="w-32 h-32 rounded-full mx-auto mb-4 object-cover border-4 border-primary"
                />
              ) : (
                <div className="w-32 h-32 rounded-full mx-auto mb-4 bg-gray-200 flex items-center justify-center border-4 border-primary">
                  <UserIcon className="w-16 h-16 text-gray-400" />
                </div>
              )}
              
              <h2 className="text-2xl font-bold text-gray-900 mb-1">
                {user.first_name} {user.last_name || ''}
              </h2>
              
              {user.city && (
                <div className="flex items-center justify-center text-gray-600 mb-3">
                  <MapPin className="w-4 h-4 mr-1" />
                  <span>{user.city}</span>
                </div>
              )}

              {/* Рейтинг */}
              <div className="mb-4">
                <div className="flex items-center justify-center space-x-1 mb-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  <span className="text-xl font-bold">{user.average_rating?.toFixed(1) || '0.0'}</span>
                  <span className="text-gray-500">/ 5.0</span>
                </div>
                <p className="text-sm text-gray-500">
                  {user.rating_count || 0} {user.rating_count === 1 ? 'оценка' : user.rating_count && user.rating_count < 5 ? 'оценки' : 'оценок'}
                </p>
              </div>

              {/* Бейдж */}
              {user.badge && (
                <div className="mb-4">
                  <Award className="w-5 h-5 text-primary mx-auto" />
                  <p className="text-sm text-primary font-medium mt-1">
                    {user.badge === 'reliable_volunteer' ? 'Надежный волонтер' : 
                     user.badge === 'verified_help_source' ? 'Проверенный источник помощи' : 
                     user.badge}
                  </p>
                </div>
              )}

              {/* Социальные сети */}
              {(socialLinks.instagram || socialLinks.vk || socialLinks.telegram) && (
                <div className="border-t pt-4 mt-4">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Социальные сети:</p>
                  <div className="space-y-1">
                    {socialLinks.instagram && (
                      <a
                        href={`https://instagram.com/${socialLinks.instagram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                      >
                        Instagram: @{socialLinks.instagram.replace('@', '')}
                      </a>
                    )}
                    {socialLinks.vk && (
                      <a
                        href={`https://vk.com/${socialLinks.vk}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                      >
                        VK: {socialLinks.vk}
                      </a>
                    )}
                    {socialLinks.telegram && (
                      <a
                        href={`https://t.me/${socialLinks.telegram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline block"
                      >
                        Telegram: @{socialLinks.telegram.replace('@', '')}
                      </a>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Правая колонка - Статистика и отзывы */}
        <div className="md:col-span-2 space-y-6">
          {/* Статистика */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Статистика</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <HelpCircle className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{user.total_applications || 0}</p>
                <p className="text-sm text-gray-600">{t('admin.users.applications')}</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Clock className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{user.active_applications || 0}</p>
                <p className="text-sm text-gray-600">Активных</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{user.resolved_applications || 0}</p>
                <p className="text-sm text-gray-600">Решено</p>
              </div>
              
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <Heart className="w-6 h-6 text-red-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-gray-900">{user.help_given || 0}</p>
                <p className="text-sm text-gray-600">Помощи оказано</p>
              </div>
            </div>
          </div>

          {/* Отзывы */}
          {user.received_ratings && user.received_ratings.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Последние отзывы</h2>
              <div className="space-y-3">
                {user.received_ratings.map((rating: any) => (
                  <div key={rating.id} className="border-b pb-3 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <p className="font-medium">
                            {rating.rater?.first_name} {rating.rater?.last_name || ''}
                          </p>
                          <div className="flex items-center space-x-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-4 h-4 ${
                                  i < rating.rating_value
                                    ? 'text-yellow-400 fill-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        {rating.comment && (
                          <p className="text-sm text-gray-700 mt-1">{rating.comment}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(rating.created_at).toLocaleDateString('ru-RU', {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
