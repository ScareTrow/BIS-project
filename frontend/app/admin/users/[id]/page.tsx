'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useTranslation, getLanguage } from '@/lib/i18n';
import Link from 'next/link';
import { 
  ArrowLeft, Mail, MapPin, Star, FileText, CheckCircle, 
  Ban, Unlock, Trash2, Shield, User, Calendar, AlertTriangle
} from 'lucide-react';

interface UserDetail {
  id: number;
  email: string;
  first_name: string;
  last_name?: string;
  avatar?: string;
  city?: string;
  isAdmin: boolean;
  is_super_admin: boolean;
  is_blocked: boolean;
  blocked_until?: string;
  blocked_reason?: string;
  total_applications: number;
  resolved_applications: number;
  false_calls_count: number;
  help_given: number;
  help_total: number;
  average_rating: number;
  rating_count: number;
  badge?: string;
  received_ratings?: Array<{
    id: number;
    rating_value: number;
    comment?: string;
    created_at: string;
    rater?: {
      first_name: string;
      last_name?: string;
    };
  }>;
}

interface RecentApplication {
  id: number;
  description: string;
  category: string;
  is_sos: boolean;
  is_false_call: boolean;
  date: string;
  moderation_status: string;
}

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user, setUser } = useStore();
  const t = useTranslation(getLanguage());
  const [userDetail, setUserDetail] = useState<UserDetail | null>(null);
  const [recentApplications, setRecentApplications] = useState<RecentApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [blockDays, setBlockDays] = useState(7);
  const [blockReason, setBlockReason] = useState('');

  useEffect(() => {
    const checkAdminAccess = async () => {
      if (!user) {
        try {
          const data = await apiClient.getCurrentUser();
          if (data.user) {
            setUser({
              id: data.user.id,
              email: data.user.email,
              first_name: data.user.first_name,
              last_name: data.user.last_name,
              isAdmin: data.user.isAdmin,
              is_authenticated: true,
            });
            if (!data.user.isAdmin) {
              router.push('/');
              return;
            }
          } else {
            router.push('/login');
            return;
          }
        } catch (error) {
          router.push('/login');
          return;
        }
      } else if (!user.isAdmin) {
        router.push('/');
        return;
      }

      if (params.id) {
        loadUserDetail();
      }
      setCheckingAccess(false);
    };

    checkAdminAccess();
  }, [user, router, params.id, setUser]);

  const loadUserDetail = async () => {
    try {
      setLoading(true);
      const userData = await apiClient.getUser(Number(params.id));
      setUserDetail(userData);
      
      try {
        const allApps = await apiClient.getAdminApplications('all');
        const userApps = allApps
          .filter((app: any) => app.user_id === Number(params.id))
          .slice(0, 10)
          .map((app: any) => ({
            id: app.id,
            description: app.full_description || app.description,
            category: app.category,
            is_sos: app.is_sos,
            is_false_call: app.is_false_call,
            date: app.date,
            moderation_status: app.moderation_status,
          }));
        setRecentApplications(userApps);
      } catch (error) {
        console.error('Error loading user applications:', error);
      }
    } catch (error) {
      console.error('Error loading user detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async () => {
    if (!userDetail) return;
    if (!confirm(`Заблокировать пользователя на ${blockDays} дней?`)) return;

    try {
      await apiClient.blockUser(userDetail.id, blockDays, blockReason);
      await loadUserDetail();
      setBlockReason('');
      setBlockDays(7);
    } catch (error) {
      console.error('Error blocking user:', error);
      alert(t('admin.users.blockError'));
    }
  };

  const handleUnblock = async () => {
    if (!userDetail) return;
    if (!confirm('Разблокировать пользователя?')) return;

    try {
      await apiClient.unblockUser(userDetail.id);
      await loadUserDetail();
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert(t('admin.users.unblockError'));
    }
  };

  const handleDelete = async () => {
    if (!userDetail) return;
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Все данные пользователя будут удалены. Продолжить?')) return;

    try {
      await apiClient.deleteUser(userDetail.id);
      router.push('/admin/users');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(t('admin.users.deleteError'));
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      food: 'bg-green-100 text-green-800',
      medicine: 'bg-red-100 text-red-800',
      shelter: 'bg-blue-100 text-blue-800',
      emergency: 'bg-yellow-100 text-yellow-800',
    };
    const labels: Record<string, string> = {
      food: 'Продукты',
      medicine: 'Медицина',
      shelter: 'Убежище',
      emergency: 'Экстренная помощь',
    };
    return (
      <span className={`badge ${colors[category] || 'bg-gray-100 text-gray-800'}`}>
        {labels[category] || category}
      </span>
    );
  };

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (!user || !user.isAdmin) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (!userDetail) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <p className="text-gray-600">Пользователь не найден</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        <Link href="/admin/users" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Назад к списку пользователей
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center">
                {userDetail.avatar ? (
                  <img
                    src={`/api/uploads/${userDetail.avatar}`}
                    alt={userDetail.first_name}
                    className="w-32 h-32 rounded-full object-cover mx-auto mb-4 border-4 border-blue-500"
                  />
                ) : (
                  <div className="w-32 h-32 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4 border-4 border-blue-500">
                    <span className="text-blue-600 font-bold text-4xl">
                      {userDetail.first_name[0]}{userDetail.last_name?.[0] || ''}
                    </span>
                  </div>
                )}
                <h2 className="text-2xl font-bold text-gray-900 mb-1">
                  {userDetail.first_name} {userDetail.last_name || ''}
                </h2>
                <p className="text-gray-600 mb-4">{userDetail.email}</p>
                {userDetail.city && (
                  <p className="text-gray-600 flex items-center justify-center gap-1 mb-4">
                    <MapPin className="w-4 h-4" />
                    {userDetail.city}
                  </p>
                )}

                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-4 mb-4 text-white">
                  <div className="text-5xl font-bold mb-2">{userDetail.average_rating.toFixed(1)}</div>
                  <div className="flex justify-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= Math.round(userDetail.average_rating)
                            ? 'fill-yellow-300 text-yellow-300'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-blue-100">
                    На основе {userDetail.rating_count} оценок
                  </p>
                </div>

                {userDetail.badge && (
                  <div className="mb-4">
                    <span className="badge bg-blue-500 text-white text-lg px-4 py-2">
                      {userDetail.badge === 'verified_help_source' && '✓ Проверенный источник помощи'}
                      {userDetail.badge === 'reliable_volunteer' && '❤ Надежный волонтер'}
                      {!['verified_help_source', 'reliable_volunteer'].includes(userDetail.badge) && userDetail.badge}
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  {userDetail.is_super_admin && (
                    <span className="badge bg-red-500 text-white">Супер-администратор</span>
                  )}
                  {userDetail.isAdmin && !userDetail.is_super_admin && (
                    <span className="badge bg-yellow-500 text-white">
                      <Shield className="w-3 h-3 mr-1 inline" />
                      Администратор
                    </span>
                  )}
                  {!userDetail.isAdmin && (
                    <span className="badge bg-blue-500 text-white">Пользователь</span>
                  )}
                  {userDetail.is_blocked && (
                    <div className="mt-2">
                      <span className="badge bg-red-600 text-white">
                        <Ban className="w-3 h-3 mr-1 inline" />
                        Заблокирован
                        {userDetail.blocked_until && (
                          <span className="ml-1">
                            до {new Date(userDetail.blocked_until).toLocaleDateString('ru-RU')}
                          </span>
                        )}
                      </span>
                      {userDetail.blocked_reason && (
                        <p className="text-sm text-red-600 mt-1">Причина: {userDetail.blocked_reason}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {!userDetail.is_super_admin && (
              <div className="bg-white rounded-lg shadow-sm border border-red-200 p-6">
                <h3 className="text-lg font-bold text-red-700 mb-4">Опасные действия</h3>
                
                {userDetail.is_blocked ? (
                  <button
                    onClick={handleUnblock}
                    className="w-full btn bg-green-600 text-white hover:bg-green-700 mb-4 flex items-center justify-center gap-2"
                  >
                    <Unlock className="w-5 h-5" />
                    Разблокировать
                  </button>
                ) : (
                  <div className="space-y-3 mb-4">
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Срок блокировки (дней):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="365"
                        value={blockDays}
                        onChange={(e) => setBlockDays(parseInt(e.target.value) || 7)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">
                        Причина блокировки:
                      </label>
                      <textarea
                        value={blockReason}
                        onChange={(e) => setBlockReason(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                        rows={3}
                        placeholder="Например: Ложные вызовы, нарушение правил"
                      />
                    </div>
                    <button
                      onClick={handleBlock}
                      className="w-full btn bg-yellow-600 text-white hover:bg-yellow-700 flex items-center justify-center gap-2"
                    >
                      <Ban className="w-5 h-5" />
                      Заблокировать
                    </button>
                  </div>
                )}

                <button
                  onClick={handleDelete}
                  className="w-full btn bg-red-700 text-white hover:bg-red-800 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Удалить пользователя
                </button>
              </div>
            )}

            {userDetail.is_super_admin && (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <p className="text-gray-600 text-sm">
                  Нельзя заблокировать или удалить супер-администратора
                </p>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Статистика</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 text-sm mb-1">{t('admin.users.totalApplications')}</p>
                  <p className="text-2xl font-bold text-gray-900">{userDetail.total_applications}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-1">Решенных</p>
                  <p className="text-2xl font-bold text-green-600">{userDetail.resolved_applications}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-1">Ложных вызовов</p>
                  <p className="text-2xl font-bold text-red-600">{userDetail.false_calls_count}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-1">Помог людям</p>
                  <p className="text-2xl font-bold text-blue-600">{userDetail.help_given}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-1">Всего откликов</p>
                  <p className="text-2xl font-bold text-gray-900">{userDetail.help_total}</p>
                </div>
                <div>
                  <p className="text-gray-600 text-sm mb-1">Получено оценок</p>
                  <p className="text-2xl font-bold text-yellow-600">{userDetail.rating_count}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Последние заявки</h3>
              {recentApplications.length > 0 ? (
                <div className="space-y-3">
                  {recentApplications.map((app) => (
                    <div
                      key={app.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            {getCategoryBadge(app.category)}
                            {app.is_sos && (
                              <span className="badge bg-red-500 text-white">
                                <AlertTriangle className="w-3 h-3 mr-1 inline" />
                                SOS
                              </span>
                            )}
                            {app.is_false_call && (
                              <span className="badge bg-red-600 text-white">Ложный вызов</span>
                            )}
                          </div>
                          <p className="text-gray-700 mb-2 line-clamp-2">
                            {app.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-4 h-4" />
                              {new Date(app.date).toLocaleDateString('ru-RU', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                            <span>Статус: {app.moderation_status}</span>
                          </div>
                        </div>
                        <Link
                          href={`/applications/${app.id}`}
                          className="btn btn-outline text-sm ml-4"
                        >
                          Просмотр
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-600">{t('admin.users.noApplications')}</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

