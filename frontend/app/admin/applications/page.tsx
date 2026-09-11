'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient, Application } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useTranslation, getLanguage } from '@/lib/i18n';
import Link from 'next/link';
import { 
  FileText, CheckCircle, XCircle, Clock, AlertTriangle, 
  Star, MapPin, User, Calendar, Eye, ArrowLeft
} from 'lucide-react';

interface AdminApplication extends Application {
  full_description?: string;
  moderation_status?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    email: string;
  };
  moderator_id?: number;
  moderated_at?: string;
  responses_count?: number;
}

export default function AdminApplicationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, setUser } = useStore();
  const t = useTranslation(getLanguage());
  const [applications, setApplications] = useState<AdminApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');

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

      const status = searchParams.get('status') as 'all' | 'pending' | 'approved' | 'rejected' | null;
      if (status) {
        setStatusFilter(status);
      }

      loadApplications(status || 'pending');
      setCheckingAccess(false);
    };

    checkAdminAccess();
  }, [user, router, searchParams, setUser]);

  const loadApplications = async (status: 'all' | 'pending' | 'approved' | 'rejected' = 'pending') => {
    try {
      setLoading(true);
      const data = await apiClient.getAdminApplications(status);
      setApplications(data);
    } catch (error) {
      console.error('Error loading applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (appId: number) => {
    if (!confirm('Вы уверены, что хотите одобрить эту заявку?')) return;

    try {
      await apiClient.approveApplication(appId);
      await loadApplications(statusFilter);
    } catch (error) {
      console.error('Error approving application:', error);
      alert(t('admin.applications.approveError'));
    }
  };

  const handleReject = async (appId: number) => {
    if (!confirm('Вы уверены, что хотите отклонить эту заявку?')) return;

    try {
      await apiClient.rejectApplication(appId);
      await loadApplications(statusFilter);
    } catch (error) {
      console.error('Error rejecting application:', error);
      alert(t('admin.applications.rejectError'));
    }
  };

  const handleMarkFalse = async (appId: number) => {
    if (!confirm('Вы уверены, что хотите пометить эту заявку как ложную?')) return;

    try {
      await apiClient.markFalseApplication(appId);
      await loadApplications(statusFilter);
    } catch (error) {
      console.error('Error marking false:', error);
      alert(t('admin.applications.markError'));
    }
  };

  const handleSetPriority = async (appId: number, priority: number) => {
    try {
      await apiClient.setApplicationPriority(appId, priority);
      await loadApplications(statusFilter);
    } catch (error) {
      console.error('Error setting priority:', error);
      alert(t('admin.applications.priorityError'));
    }
  };

  const handleStatusChange = (status: 'all' | 'pending' | 'approved' | 'rejected') => {
    setStatusFilter(status);
    router.push(`/admin/applications?status=${status}`);
    loadApplications(status);
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="badge bg-yellow-500 text-white">На модерации</span>;
      case 'approved':
        return <span className="badge bg-green-500 text-white">Одобрено</span>;
      case 'rejected':
        return <span className="badge bg-red-500 text-white">Отклонено</span>;
      default:
        return <span className="badge bg-gray-500 text-white">{status}</span>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      food: 'bg-green-100 text-green-800',
      medicine: 'bg-red-100 text-red-800',
      shelter: 'bg-blue-100 text-blue-800',
      emergency: 'bg-yellow-100 text-yellow-800',
    };
    return (
      <span className={`badge ${colors[category] || 'bg-gray-100 text-gray-800'}`}>
        {category === 'food' ? 'Продукты' : 
         category === 'medicine' ? 'Медицина' :
         category === 'shelter' ? 'Убежище' :
         category === 'emergency' ? 'Экстренная помощь' : category}
      </span>
    );
  };

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
              <FileText className="w-8 h-8 text-white" />
            </div>
            Управление заявками
          </h1>
        </div>

        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Фильтр по статусу</h3>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleStatusChange('all')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                statusFilter === 'all'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Все
            </button>
            <button
              onClick={() => handleStatusChange('pending')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                statusFilter === 'pending'
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              На модерации
            </button>
            <button
              onClick={() => handleStatusChange('approved')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                statusFilter === 'approved'
                  ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Одобрено
            </button>
            <button
              onClick={() => handleStatusChange('rejected')}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                statusFilter === 'rejected'
                  ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Отклонено
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
          </div>
        ) : applications.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
            <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">{t('admin.applications.noApplications')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="hidden lg:block bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gradient-to-r from-gray-50 to-gray-100">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Описание</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Категория</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Пользователь</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Дата</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Статус</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Приоритет</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {applications.map((app) => (
                      <tr key={app.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">#{app.id}</td>
                        <td className="px-6 py-4 text-sm text-gray-700 max-w-xs">
                          <p className="truncate">{app.full_description || app.description}</p>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getCategoryBadge(app.category)}
                          {app.is_sos && (
                            <span className="badge bg-red-500 text-white ml-1 text-xs">SOS</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {app.user ? `${app.user.first_name} ${app.user.last_name || ''}` : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {app.date ? new Date(app.date).toLocaleDateString('ru-RU') : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(app.moderation_status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {app.moderation_status === 'rejected' ? (
                            <span className="text-sm text-gray-400">-</span>
                          ) : (
                            <div className="flex gap-1">
                              {[0, 1, 2, 3, 4, 5].map((priority) => (
                                <button
                                  key={priority}
                                  onClick={() => handleSetPriority(app.id, priority)}
                                  className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                                    app.priority === priority
                                      ? 'bg-blue-600 text-white'
                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                  }`}
                                >
                                  {priority}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                          <Link
                            href={`/applications/${app.id}`}
                            className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors font-medium"
                          >
                            Просмотр
                          </Link>
                          {app.moderation_status === 'pending' && (
                            <>
                              <button
                                onClick={() => handleApprove(app.id)}
                                className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors font-medium"
                              >
                                Одобрить
                              </button>
                              <button
                                onClick={() => handleReject(app.id)}
                                className="px-3 py-1 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors font-medium"
                              >
                                Отклонить
                              </button>
                            </>
                          )}
                          {app.moderation_status === 'approved' && (
                            <button
                              onClick={() => handleMarkFalse(app.id)}
                              className="px-3 py-1 bg-orange-100 text-orange-700 rounded-md hover:bg-orange-200 transition-colors font-medium"
                            >
                              Ложный
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lg:hidden grid grid-cols-1 gap-4">
              {applications.map((app) => (
                <div
                  key={app.id}
                  className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900">#{app.id}</span>
                      {getStatusBadge(app.moderation_status)}
                      {getCategoryBadge(app.category)}
                      {app.is_sos && (
                        <span className="badge bg-red-500 text-white">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          SOS
                        </span>
                      )}
                      {app.priority !== undefined && app.priority > 0 && (
                        <span className="badge bg-blue-500 text-white">
                          <Star className="w-3 h-3 mr-1" />
                          Приоритет: {app.priority}
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="text-gray-700 mb-4 line-clamp-2">
                    {app.full_description || app.description}
                  </p>

                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-4 flex-wrap">
                    {app.user && (
                      <div className="flex items-center gap-1">
                        <User className="w-4 h-4" />
                        <span>{app.user.first_name} {app.user.last_name || ''}</span>
                      </div>
                    )}
                    {app.city && (
                      <div className="flex items-center gap-1">
                        <MapPin className="w-4 h-4" />
                        <span>{app.city}</span>
                      </div>
                    )}
                    {app.date && (
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        <span>{new Date(app.date).toLocaleDateString('ru-RU')}</span>
                      </div>
                    )}
                  </div>

                  {app.moderation_status !== 'rejected' && (
                    <div className="flex gap-2 mb-4">
                      <div className="flex gap-1">
                        {[0, 1, 2, 3, 4, 5].map((priority) => (
                          <button
                            key={priority}
                            onClick={() => handleSetPriority(app.id, priority)}
                            className={`w-8 h-8 rounded text-xs font-medium transition-colors ${
                              app.priority === priority
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {priority}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Link
                      href={`/applications/${app.id}`}
                      className="btn bg-gradient-to-r from-blue-500 to-blue-600 text-white text-sm hover:from-blue-600 hover:to-blue-700 shadow-md hover:shadow-lg transition-all"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      Просмотр
                    </Link>
                    {app.moderation_status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleApprove(app.id)}
                          className="btn bg-gradient-to-r from-green-500 to-green-600 text-white text-sm hover:from-green-600 hover:to-green-700 shadow-md hover:shadow-lg transition-all"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Одобрить
                        </button>
                        <button
                          onClick={() => handleReject(app.id)}
                          className="btn bg-gradient-to-r from-red-500 to-red-600 text-white text-sm hover:from-red-600 hover:to-red-700 shadow-md hover:shadow-lg transition-all"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Отклонить
                        </button>
                      </>
                    )}
                    {app.moderation_status === 'approved' && (
                      <button
                        onClick={() => handleMarkFalse(app.id)}
                        className="btn bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm hover:from-orange-600 hover:to-orange-700 shadow-md hover:shadow-lg transition-all"
                      >
                        <AlertTriangle className="w-4 h-4 mr-1" />
                        Ложный
                      </button>
                    )}
                  </div>

                  {app.responses_count !== undefined && app.responses_count > 0 && (
                    <div className="text-sm text-blue-600 font-medium mt-2">
                      {app.responses_count} откликов
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

