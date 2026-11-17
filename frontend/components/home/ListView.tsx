'use client';

import CategoryBadge from '@/components/common/CategoryBadge';
import { Application } from '@/lib/api';
import { MapPin, AlertCircle, Star, Clock, Calendar } from 'lucide-react';
import Link from 'next/link';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

interface ListViewProps {
  applications: Application[];
}

export default function ListView({ applications }: ListViewProps) {
  const { language } = useStore();
  const t = useTranslation(language);

  if (applications.length === 0) {
    return (
      <div className="card text-center py-16">
        <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-500 text-xl font-medium">{t('home.noApplications')}</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {applications.map((app) => (
        <div
          key={app.id}
          className={`card hover:scale-105 transition-transform duration-300 ${
            app.is_sos ? 'card-emergency' : ''
          }`}
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-2 flex-wrap gap-2">
              <span className="badge bg-gray-200 text-gray-700 font-bold">
                #{app.number || app.id}
              </span>
              <CategoryBadge category={app.category} />
              {app.is_sos && (
                <span className="badge-emergency animate-pulse-emergency">
                  <AlertCircle className="inline w-4 h-4 mr-1" />
                  SOS
                </span>
              )}
              {app.priority !== undefined && app.priority > 0 && (
                <span className="badge bg-blue-600 text-white border border-blue-700">
                  <Star className="inline w-3 h-3 mr-1" />
                  {app.priority}
                </span>
              )}
              {(app as any).moderation_status === 'pending' && (app as any).is_own && (
                <span className="badge bg-yellow-500 text-white border border-yellow-600">
                  На модерации
                </span>
              )}
            </div>
          </div>

          <p className="text-gray-700 mb-4 line-clamp-3 text-sm leading-relaxed">
            {app.description}
          </p>

          <div className="space-y-2 mb-4 pb-4 border-b border-gray-200">
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="w-4 h-4 mr-2 text-blue-600" />
              <span className="font-semibold">{t('application.location')}:</span>
              <span className="ml-2">{app.location || `${app.city || t('common.notSpecified')}, ${app.region || ''}`}</span>
            </div>
            {app.date && (
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="w-4 h-4 mr-2 text-blue-600" />
                <span className="font-semibold">Создано:</span>
                <span className="ml-2">{new Date(app.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            )}
            {app.expires_at && (
              <div className="flex items-center text-sm text-gray-600">
                <Clock className="w-4 h-4 mr-2 text-orange-600" />
                <span className="font-semibold">Действует до:</span>
                <span className="ml-2">{new Date(app.expires_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
            )}
            {app.priority > 0 && (
              <div className="flex items-center text-sm text-gray-600">
                <Star className="w-4 h-4 mr-2 text-blue-600" />
                <span className="font-semibold">{t('application.priority')}:</span>
                <span className="ml-2">{app.priority}/5</span>
              </div>
            )}
          </div>

          <Link
            href={`/applications/${app.id}`}
            className="block w-full text-center btn btn-primary"
          >
            {t('common.more')}
          </Link>
        </div>
      ))}
    </div>
  );
}
