'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient, Application, ApplicationResponse } from '@/lib/api';
import CategoryBadge from '@/components/common/CategoryBadge';
import { MapPin, User, Check, X, Star, ThumbsUp, ThumbsDown } from 'lucide-react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useStore } from '@/lib/store';
import { useTranslation, getLanguage } from '@/lib/i18n';

const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
);
const LeafletIconFix = dynamic(
  () => import('@/components/common/LeafletIconFix'),
  { ssr: false }
);

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useStore();
  const t = useTranslation(getLanguage());
  const [application, setApplication] = useState<Application | null>(null);
  const [loading, setLoading] = useState(true);
  const [responses, setResponses] = useState<ApplicationResponse[]>([]);
  const [isClient, setIsClient] = useState(false);
  const [userResponse, setUserResponse] = useState<ApplicationResponse | null>(null);
  const [acceptedVolunteers, setAcceptedVolunteers] = useState<any[]>([]);

  useEffect(() => {
    setIsClient(true);
    if (params.id) {
      loadApplication();
    }
  }, [params.id]);

  const loadApplication = async () => {
    try {
      setLoading(true);

      const data = await apiClient.getApplication(Number(params.id));
      setApplication(data);
      setResponses(data.responses || []);
      // Сохраняем информацию об отклике текущего пользователя (если он есть, независимо от статуса)
      setUserResponse((data as any).user_response || null);
      // Сохраняем информацию о принятых волонтерах (для автора заявки)
      setAcceptedVolunteers((data as any).accepted_volunteers || []);
    } catch (error) {
      console.error('Error loading application:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async () => {
    try {
      await apiClient.respondToApplication(Number(params.id));
      alert(t('alerts.respondSuccess'));
      loadApplication();
    } catch (error: any) {
      console.error('Error responding:', error);
      alert(error.message || t('alerts.respondError'));
    }
  };

  const handleAcceptResponse = async (responseId: number) => {
    try {
      await apiClient.acceptResponse(Number(params.id), responseId);
      loadApplication();
    } catch (error) {
      console.error('Error accepting response:', error);
    }
  };

  const handleRejectResponse = async (responseId: number) => {
    try {
      await apiClient.rejectResponse(Number(params.id), responseId);
      loadApplication();
    } catch (error) {
      console.error('Error rejecting response:', error);
    }
  };

  const handleResolve = async () => {
    try {
      await apiClient.resolveApplication(Number(params.id));
      alert(t('alerts.resolvedSuccess'));
      loadApplication();
    } catch (error: any) {
      console.error('Error resolving application:', error);
      alert(error.message || t('alerts.resolvedError'));
    }
  };

  const handleRateVolunteer = async (helperId: number, isPositive: boolean) => {
    try {
      await apiClient.rateVolunteer(Number(params.id), helperId, isPositive);
      alert(isPositive ? t('alerts.ratingPositive') : t('alerts.ratingNegative'));
      loadApplication();
    } catch (error: any) {
      console.error('Error rating volunteer:', error);
      alert(error.response?.data?.message || error.message || t('alerts.ratingError'));
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

  if (!application) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-md p-8 text-center">
          <p className="text-gray-500">Заявка не найдена</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-primary hover:underline mb-4"
        >
          ← Назад
        </button>
        <div className="flex items-center space-x-2 mb-4">
          <CategoryBadge category={application.category} />
          {application.is_sos && (
            <span className="badge badge-danger">SOS</span>
          )}
          {application.is_resolved && (
            <span className="badge badge-success">Решена</span>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Заявка #{application.id}
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Левая колонка - Карта */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Местоположение</h2>
            <div className="flex items-center space-x-2 text-gray-600 mb-4">
              <MapPin className="w-5 h-5" />
              <span className="text-sm">
                {(application as any).address || `${application.latitude.toFixed(4)}, ${application.longitude.toFixed(4)}`}
              </span>
            </div>
            {isClient && (
              <div 
                className="w-full rounded-lg relative" 
                style={{ 
                  height: '500px', 
                  maxWidth: '100%', 
                  overflow: 'hidden',
                  position: 'relative',
                  isolation: 'isolate'
                }}
              >
                <MapContainer
                  center={[application.latitude, application.longitude]}
                  zoom={15}
                  style={{ height: '100%', width: '100%', position: 'relative' }}
                  className="w-full h-full"
                >
                  <LeafletIconFix />
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker 
                    position={[application.latitude, application.longitude]}
                  />
                </MapContainer>
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка - Детали */}
        <div className="space-y-6">
          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Описание</h2>
            <p className="text-gray-700 whitespace-pre-wrap">
              {application.description}
            </p>
          </div>

          {application.media_files && application.media_files.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Медиафайлы</h2>
              <div className="grid grid-cols-2 gap-4">
                {application.media_files.map((media) => (
                  <div key={media.id} className="relative">
                    {media.file_type?.startsWith('image/') ? (
                      <img
                        src={`/api/uploads/${media.file_path}`}
                        alt="Media"
                        className="w-full h-48 object-cover rounded-lg"
                      />
                    ) : (
                      <a
                        href={`/api/uploads/${media.file_path}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block p-4 bg-gray-100 rounded-lg text-center hover:bg-gray-200"
                      >
                        <span className="text-sm text-gray-600">📄 {media.file_path}</span>
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <h2 className="text-xl font-semibold mb-4">Информация</h2>
            <div className="space-y-3 text-sm">
              {(application as any).creator && (
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="text-gray-600 flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>Создал:</span>
                  </span>
                  <span className="font-medium">
                    {(application as any).creator.first_name} {(application as any).creator.last_name || ''}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Дата создания:</span>
                <span className="font-medium">
                  {new Date(application.date).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Действует до:</span>
                <span className="font-medium">
                  {new Date(application.expires_at).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              </div>
              {(application as any).duration_days && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Длительность:</span>
                  <span className="font-medium">
                    {(application as any).duration_days} дн.
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Статус:</span>
                <span className="font-medium">{application.status}</span>
              </div>
            </div>
          </div>

          {responses.length > 0 && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Отклики</h2>
              <div className="space-y-3">
                {responses.map((response) => (
                  <div
                    key={response.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-500" />
                      <div>
                        <Link 
                          href={`/users/${response.responder_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {response.responder?.first_name || 'Пользователь'} {response.responder?.last_name || ''}
                        </Link>
                        <p className="text-sm text-gray-500">
                          Статус: {response.status}
                        </p>
                      </div>
                    </div>
                    {response.status === 'pending' && (application as any).user_id === user?.id && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleAcceptResponse(response.id)}
                          className="btn btn-success text-sm"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleRejectResponse(response.id)}
                          className="btn btn-danger text-sm"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {application.is_resolved && acceptedVolunteers.length > 0 && (application as any).user_id === user?.id && (
            <div className="card">
              <h2 className="text-xl font-semibold mb-4">Оцените волонтеров</h2>
              <p className="text-sm text-gray-600 mb-4">
                Пожалуйста, оцените волонтеров, которые помогли с этой заявкой
              </p>
              <div className="space-y-3">
                {acceptedVolunteers.map((volunteer) => (
                  <div
                    key={volunteer.responder_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <User className="w-5 h-5 text-gray-500" />
                      <div>
                        <Link 
                          href={`/users/${volunteer.responder_id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {volunteer.responder?.first_name || 'Пользователь'} {volunteer.responder?.last_name || ''}
                        </Link>
                        {volunteer.responder?.average_rating && (
                          <p className="text-sm text-gray-500">
                            Рейтинг: {volunteer.responder.average_rating.toFixed(1)}/5.0
                          </p>
                        )}
                        {volunteer.is_rated && (
                          <p className="text-sm text-green-600 font-medium mt-1">
                            ✓ Оценен ({volunteer.rating_value === 5 ? '👍 Плюс' : '👎 Минус'})
                          </p>
                        )}
                      </div>
                    </div>
                    {!volunteer.is_rated && (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleRateVolunteer(volunteer.responder_id, true)}
                          className="btn btn-success text-sm flex items-center space-x-1"
                          title="Плюс"
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span>Плюс</span>
                        </button>
                        <button
                          onClick={() => handleRateVolunteer(volunteer.responder_id, false)}
                          className="btn btn-danger text-sm flex items-center space-x-1"
                          title="Минус"
                        >
                          <ThumbsDown className="w-4 h-4" />
                          <span>Минус</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex space-x-4">
            {!application.is_resolved && !userResponse && (application as any).user_id !== user?.id && (
              <button
                onClick={handleRespond}
                className="btn btn-primary flex-1"
              >
                Откликнуться
              </button>
            )}
            {userResponse && (application as any).user_id !== user?.id && (
              <div className="text-sm text-gray-600 flex-1 flex items-center justify-center">
                Вы уже откликнулись на эту заявку. Статус: <span className="ml-2 font-medium">{userResponse.status === 'pending' ? 'Ожидает рассмотрения' : userResponse.status === 'accepted' ? 'Принят' : userResponse.status === 'cancelled' ? 'Отклонен' : userResponse.status === 'completed' ? 'Завершен' : userResponse.status}</span>
              </div>
            )}
            {!application.is_resolved && 
             ((application as any).user_id === user?.id || userResponse?.status === 'accepted') && (
              <button
                onClick={handleResolve}
                className="btn btn-success flex-1"
              >
                Отметить как решенную
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

