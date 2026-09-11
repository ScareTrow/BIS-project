'use client';

import { apiClient } from '@/lib/api';
import { getLanguage, useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  FileText,
  Newspaper,
  Settings,
  Shield,
  TrendingUp,
  Users,
  XCircle
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface AdminStats {
  total_applications: number;
  pending_applications: number;
  approved_applications: number;
  rejected_applications: number;
  total_responses: number;
  volunteers_count: number;
  false_calls_count: number;
  category_stats: Array<{ category: string; count: number }>;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, setUser } = useStore();
  const t = useTranslation(getLanguage());
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);

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

      loadStats();
      setCheckingAccess(false);
    };

    checkAdminAccess();
  }, [user, router, setUser]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getAdminStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading admin stats:', error);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Ошибка загрузки статистики</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50 py-8">
      <div className="container mx-auto px-4">
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent flex items-center gap-3">
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-3 rounded-xl shadow-lg">
                  <Shield className="w-8 h-8 text-white" />
                </div>
                Панель администратора
              </h1>
              <p className="text-gray-600 mt-2 text-lg">Управление заявками и статистика системы</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Всего заявок</p>
                <p className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-blue-800 bg-clip-text text-transparent">{stats.total_applications}</p>
              </div>
              <div className="bg-gradient-to-br from-blue-100 to-blue-200 p-4 rounded-xl shadow-md">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border-l-4 border-yellow-500 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">На модерации</p>
                <p className="text-4xl font-bold text-yellow-600">{stats.pending_applications}</p>
                {stats.pending_applications > 0 && (
                  <p className="text-xs text-yellow-600 mt-1">Требуют внимания</p>
                )}
              </div>
              <div className="bg-gradient-to-br from-yellow-100 to-yellow-200 p-4 rounded-xl shadow-md">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border-l-4 border-green-500 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Одобрено</p>
                <p className="text-4xl font-bold text-green-600">{stats.approved_applications}</p>
                <p className="text-xs text-green-600 mt-1">
                  {stats.total_applications > 0
                    ? Math.round((stats.approved_applications / stats.total_applications) * 100)
                    : 0}% от всех
                </p>
              </div>
              <div className="bg-gradient-to-br from-green-100 to-green-200 p-4 rounded-xl shadow-md">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-lg border-l-4 border-red-500 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Отклонено</p>
                <p className="text-4xl font-bold text-red-600">{stats.rejected_applications}</p>
              </div>
              <div className="bg-gradient-to-br from-red-100 to-red-200 p-4 rounded-xl shadow-md">
                <XCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border border-blue-200 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Всего откликов</p>
                <p className="text-4xl font-bold text-blue-600">{stats.total_responses}</p>
                <p className="text-xs text-blue-600 mt-1">Активность волонтеров</p>
              </div>
              <div className="bg-gradient-to-br from-blue-200 to-indigo-300 p-4 rounded-xl shadow-md">
                <TrendingUp className="w-8 h-8 text-blue-700" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl shadow-lg border border-green-200 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Волонтеров помогло</p>
                <p className="text-4xl font-bold text-green-600">{stats.volunteers_count}</p>
                <p className="text-xs text-green-600 mt-1">Активных помощников</p>
              </div>
              <div className="bg-gradient-to-br from-green-200 to-emerald-300 p-4 rounded-xl shadow-md">
                <Users className="w-8 h-8 text-green-700" />
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-xl shadow-lg border border-red-200 p-6 hover:shadow-xl transition-all duration-300">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">Ложных заявок</p>
                <p className="text-4xl font-bold text-red-600">{stats.false_calls_count}</p>
                <p className="text-xs text-red-600 mt-1">
                  {stats.total_applications > 0
                    ? Math.round((stats.false_calls_count / stats.total_applications) * 100)
                    : 0}% от всех
                </p>
              </div>
              <div className="bg-gradient-to-br from-red-200 to-rose-300 p-4 rounded-xl shadow-md">
                <AlertTriangle className="w-8 h-8 text-red-700" />
              </div>
            </div>
          </div>
        </div>

        {stats.category_stats && stats.category_stats.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              Статистика по категориям
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              {stats.category_stats.map((stat) => {
                const categoryColors: Record<string, string> = {
                  food: 'from-green-400 to-green-600',
                  medicine: 'from-red-400 to-red-600',
                  shelter: 'from-blue-400 to-blue-600',
                  emergency: 'from-yellow-400 to-orange-600',
                };
                const colorClass = categoryColors[stat.category] || 'from-gray-400 to-gray-600';

                return (
                  <div key={stat.category} className="text-center p-5 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 hover:shadow-md transition-all duration-300">
                    <p className="text-sm font-medium text-gray-700 mb-2 capitalize">
                      {stat.category === 'food' ? 'Продукты' :
                        stat.category === 'medicine' ? 'Медицина' :
                          stat.category === 'shelter' ? 'Убежище' :
                            stat.category === 'emergency' ? 'Экстренная помощь' : stat.category}
                    </p>
                    <p className={`text-3xl font-bold bg-gradient-to-r ${colorClass} bg-clip-text text-transparent`}>
                      {stat.count}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-6">
              <div className="space-y-3">
                {stats.category_stats.map((stat) => {
                  const maxCount = Math.max(...stats.category_stats.map(s => s.count));
                  const percentage = maxCount > 0 ? (stat.count / maxCount) * 100 : 0;
                  return (
                    <div key={stat.category}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700 capitalize">
                          {stat.category === 'food' ? 'Продукты' :
                            stat.category === 'medicine' ? 'Медицина' :
                              stat.category === 'shelter' ? 'Убежище' :
                                stat.category === 'emergency' ? 'Экстренная помощь' : stat.category}
                        </span>
                        <span className="text-sm font-bold text-gray-900">{stat.count}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-5 shadow-inner">
                        <div
                          className="bg-gradient-to-r from-blue-500 to-purple-600 h-5 rounded-full transition-all duration-500 shadow-md"
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 p-2 rounded-lg">
              <Settings className="w-6 h-6 text-white" />
            </div>
            Быстрые действия
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Link
              href="/admin/applications?status=pending"
              className="group p-6 border-2 border-yellow-300 rounded-xl hover:bg-gradient-to-br hover:from-yellow-50 hover:to-orange-50 transition-all duration-300 hover:shadow-lg hover:border-yellow-400 transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-yellow-400 to-orange-500 p-4 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                  <Clock className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-900 group-hover:text-yellow-700 transition-colors">Модерация заявок</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {stats.pending_applications > 0 ? (
                      <span className="font-semibold text-yellow-600">{stats.pending_applications} заявок ожидают модерации</span>
                    ) : (
                      'Все заявки обработаны'
                    )}
                  </p>
                </div>
              </div>
            </Link>
            <Link
              href="/admin/users"
              className="group p-6 border-2 border-blue-300 rounded-xl hover:bg-gradient-to-br hover:from-blue-50 hover:to-indigo-50 transition-all duration-300 hover:shadow-lg hover:border-blue-400 transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-blue-400 to-indigo-500 p-4 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                  <Users className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-900 group-hover:text-blue-700 transition-colors">Управление пользователями</p>
                  <p className="text-sm text-gray-600 mt-1">Просмотр и управление пользователями системы</p>
                </div>
              </div>
            </Link>
            <Link
              href="/admin/news"
              className="group p-6 border-2 border-purple-300 rounded-xl hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 transition-all duration-300 hover:shadow-lg hover:border-purple-400 transform hover:-translate-y-1"
            >
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-400 to-pink-500 p-4 rounded-xl shadow-md group-hover:scale-110 transition-transform">
                  <Newspaper className="w-8 h-8 text-white" />
                </div>
                <div>
                  <p className="font-bold text-lg text-gray-900 group-hover:text-purple-700 transition-colors">Управление новостями</p>
                  <p className="text-sm text-gray-600 mt-1">Создание и редактирование новостей платформы</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

