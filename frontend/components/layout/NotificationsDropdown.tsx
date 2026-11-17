'use client';

import { Notification } from '@/lib/api';
import { Bell, Check, CheckCheck } from 'lucide-react';

interface NotificationsDropdownProps {
  notifications: Notification[];
  onClose: () => void;
  onMarkRead: (id: number) => Promise<void>;
  onMarkAllRead: () => Promise<void>;
}

export default function NotificationsDropdown({
  notifications,
  onClose,
  onMarkRead,
  onMarkAllRead,
}: NotificationsDropdownProps) {
  const emojiMap: Record<string, string> = {
    application_approved: '✅',
    application_rejected: '❌',
    new_response: '👋',
    response_accepted: '👍',
    application_resolved: '🎉',
    rating_received: '⭐',
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-96 overflow-hidden flex flex-col">
      <div className="p-4 border-b border-gray-200 flex justify-between items-center">
        <h3 className="font-semibold text-gray-900">Уведомления</h3>
        <button
          onClick={onMarkAllRead}
          className="text-sm text-primary hover:text-primary-dark flex items-center space-x-1"
        >
          <CheckCheck className="w-4 h-4" />
          <span>Отметить все</span>
        </button>
      </div>
      
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Нет уведомлений</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <div
              key={notification.id}
              onClick={() => {
                if (!notification.is_read) {
                  onMarkRead(notification.id);
                }
              }}
              className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${
                !notification.is_read ? 'bg-blue-50' : ''
              }`}
            >
              <div className="flex items-start space-x-3">
                <span className="text-2xl">
                  {emojiMap[notification.notification_type] || '🔔'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between">
                    <h4 className={`text-sm font-semibold ${!notification.is_read ? 'text-gray-900' : 'text-gray-700'}`}>
                      {notification.title}
                    </h4>
                    {!notification.is_read && (
                      <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1"></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{notification.message}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    {formatDate(notification.created_at)}
                  </p>
                  {notification.related_application_id && (
                    <a
                      href={`/applications/${notification.related_application_id}`}
                      className="text-xs text-primary hover:underline mt-2 inline-block"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Подробнее →
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

