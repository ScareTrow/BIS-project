'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useTranslation, getLanguage } from '@/lib/i18n';
import Link from 'next/link';
import { 
  Users, Shield, Ban, Unlock, UserPlus, Trash2, 
  ArrowLeft, Mail, MapPin, Star, FileText, CheckCircle
} from 'lucide-react';

interface AdminUser {
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
  average_rating: number;
  rating_count: number;
  badge?: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const { user, setUser } = useStore();
  const t = useTranslation(getLanguage());
  const [users, setUsers] = useState<AdminUser[]>([]);
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

      loadUsers();
      setCheckingAccess(false);
    };

    checkAdminAccess();
  }, [user, router, setUser]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAdminUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBlock = async (userId: number) => {
    if (!confirm(`Заблокировать пользователя на ${blockDays} дней?`)) return;

    try {
      await apiClient.blockUser(userId, blockDays, blockReason);
      await loadUsers();
      setBlockReason('');
      setBlockDays(7);
    } catch (error) {
      console.error('Error blocking user:', error);
      alert(t('admin.users.blockError'));
    }
  };

  const handleUnblock = async (userId: number) => {
    if (!confirm('Разблокировать пользователя?')) return;

    try {
      await apiClient.unblockUser(userId);
      await loadUsers();
    } catch (error) {
      console.error('Error unblocking user:', error);
      alert(t('admin.users.unblockError'));
    }
  };

  const handleMakeAdmin = async (userId: number) => {
    if (!confirm('Назначить пользователя администратором?')) return;

    try {
      await apiClient.makeAdmin(userId);
      await loadUsers();
    } catch (error) {
      console.error('Error making admin:', error);
      alert(t('admin.users.adminError'));
    }
  };

  const handleDelete = async (userId: number) => {
    if (!confirm('ВНИМАНИЕ! Это действие необратимо. Удалить пользователя?')) return;
    if (!confirm('Вы уверены? Это удалит все данные пользователя!')) return;

    try {
      await apiClient.deleteUser(userId);
      await loadUsers();
    } catch (error) {
      console.error('Error deleting user:', error);
      alert(t('admin.users.deleteError'));
    }
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-6">
          <Link href="/admin" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4 font-medium transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Назад к панели администратора
          </Link>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl shadow-lg">
              <Users className="w-8 h-8 text-white" />
            </div>
            Управление пользователями
          </h1>
          <p className="text-gray-600 mt-2 text-lg">Всего пользователей: <span className="font-bold text-blue-600">{users.length}</span></p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="hidden lg:block bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Имя</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Рейтинг</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Бейдж</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статистика</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{u.id}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            {u.avatar ? (
                              <img
                                src={`/api/uploads/${u.avatar}`}
                                alt={u.first_name}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <span className="text-blue-600 font-bold">
                                  {u.first_name[0]}{u.last_name?.[0] || ''}
                                </span>
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900">
                                {u.first_name} {u.last_name || ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{u.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {u.rating_count > 0 ? (
                            <div className="flex items-center gap-1">
                              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                              <span className="text-sm font-medium">{u.average_rating.toFixed(1)}</span>
                              <span className="text-xs text-gray-500">({u.rating_count})</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">Нет оценок</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {u.badge ? (
                            <span className="badge bg-yellow-500 text-white">{u.badge}</span>
                          ) : (
                            <span className="text-sm text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            {u.is_super_admin && (
                              <span className="badge bg-red-500 text-white text-xs">Супер-админ</span>
                            )}
                            {u.isAdmin && !u.is_super_admin && (
                              <span className="badge bg-yellow-500 text-white text-xs">
                                <Shield className="w-3 h-3 mr-1 inline" />
                                Админ
                              </span>
                            )}
                            {!u.isAdmin && (
                              <span className="badge bg-blue-500 text-white text-xs">Пользователь</span>
                            )}
                            {u.is_blocked && (
                              <span className="badge bg-red-600 text-white text-xs">
                                <Ban className="w-3 h-3 mr-1 inline" />
                                Заблокирован
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          <div className="space-y-1">
                            <div>{t('admin.users.applications')}: <span className="font-medium">{u.total_applications}</span></div>
                            <div>Помог: <span className="font-medium text-green-600">{u.help_given}</span></div>
                            <div>Ложных: <span className="font-medium text-red-600">{u.false_calls_count}</span></div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <Link
                            href={`/admin/users/${u.id}`}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium"
                          >
                            Просмотр
                          </Link>
                          {!u.is_super_admin && !u.isAdmin && user?.is_super_admin && (
                            <button
                              onClick={() => handleMakeAdmin(u.id)}
                              className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-md hover:bg-yellow-200 transition-colors font-medium"
                            >
                              Сделать админом
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:hidden space-y-4">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {u.avatar ? (
                        <img
                          src={`/uploads/${u.avatar}`}
                          alt={u.first_name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                          <span className="text-blue-600 font-bold text-lg">
                            {u.first_name[0]}{u.last_name?.[0] || ''}
                          </span>
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-gray-900">
                            {u.first_name} {u.last_name || ''}
                          </h3>
                          {u.is_super_admin && (
                            <span className="badge bg-purple-500 text-white">Супер-админ</span>
                          )}
                          {u.isAdmin && !u.is_super_admin && (
                            <span className="badge bg-blue-500 text-white">
                              <Shield className="w-3 h-3 mr-1" />
                              Админ
                            </span>
                          )}
                          {u.is_blocked && (
                            <span className="badge bg-red-500 text-white">
                              <Ban className="w-3 h-3 mr-1" />
                              Заблокирован
                            </span>
                          )}
                          {u.badge && (
                            <span className="badge bg-yellow-500 text-white">{u.badge}</span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 flex items-center gap-1">
                          <Mail className="w-4 h-4" />
                          {u.email}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">{t('admin.users.applications')}</p>
                      <p className="font-semibold text-gray-900">{u.total_applications}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Помог</p>
                      <p className="font-semibold text-green-600">{u.help_given}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Рейтинг</p>
                      <p className="font-semibold text-yellow-600 flex items-center gap-1">
                        <Star className="w-4 h-4" />
                        {u.average_rating.toFixed(1)} ({u.rating_count})
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Ложных</p>
                      <p className="font-semibold text-red-600">{u.false_calls_count}</p>
                    </div>
                  </div>
                  
                  <div className="mt-3">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="btn btn-outline text-sm"
                    >
                      Подробнее
                    </Link>
                  </div>

                  {u.is_blocked && u.blocked_until && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                      Заблокирован до: {new Date(u.blocked_until).toLocaleDateString('ru-RU')}
                      {u.blocked_reason && <p className="mt-1">Причина: {u.blocked_reason}</p>}
                    </div>
                  )}

                  <div className="mt-4 space-y-2">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="btn bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm w-full hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all"
                    >
                      Подробнее
                    </Link>
                    {!u.is_super_admin && !u.isAdmin && user?.is_super_admin && (
                      <button
                        onClick={() => handleMakeAdmin(u.id)}
                        className="btn bg-gradient-to-r from-yellow-500 to-yellow-600 text-white text-sm w-full hover:from-yellow-600 hover:to-yellow-700 shadow-md hover:shadow-lg transition-all"
                      >
                        <Shield className="w-4 h-4 mr-1 inline" />
                        Сделать админом
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

