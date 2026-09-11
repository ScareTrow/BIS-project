'use client';

import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { AlertCircle, Calendar, MapPin, Newspaper, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface NewsItem {
  id: number;
  title: string;
  content: string;
  news_type: string;
  created_at: string;
  author?: {
    first_name: string;
    last_name?: string;
  };
}

const iconMap: Record<string, any> = {
  stats: TrendingUp,
  location: MapPin,
  safety: AlertCircle,
  volunteers: Users,
  general: Newspaper,
};

export default function NewsPage() {
  const { user } = useStore();
  const [loading, setLoading] = useState(true);
  const [newsItems, setNewsItems] = useState<NewsItem[]>([]);

  useEffect(() => {
    loadNews();
  }, []);

  const loadNews = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getNews(50, 0);
      setNewsItems(data.news || []);
    } catch (error) {
      console.error('Error loading news:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getIcon = (type: string) => {
    return iconMap[type] || Newspaper;
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
          <Newspaper className="w-8 h-8 mr-3 text-blue-600" />
          Новости платформы
        </h1>
        <p className="text-gray-600">
          Актуальная информация о работе платформы, статистике и важных обновлениях
        </p>
      </div>

      {newsItems.length > 0 ? (
        <div className="space-y-4">
          {newsItems.map((item) => {
            const Icon = getIcon(item.news_type);
            const contentPreview = item.content.length > 150
              ? item.content.substring(0, 150) + '...'
              : item.content;
            return (
              <Link
                key={item.id}
                href={`/news/${item.id}`}
                className="block bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer"
              >
                <div className="flex items-start space-x-4">
                  <div className="bg-blue-50 p-3 rounded-lg flex-shrink-0">
                    <Icon className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 text-sm text-gray-500 mb-2">
                      <Calendar className="w-4 h-4" />
                      <span>{formatDate(item.created_at)}</span>
                      {item.author && (
                        <>
                          <span className="text-gray-300">•</span>
                          <span>{item.author.first_name} {item.author.last_name || ''}</span>
                        </>
                      )}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-gray-600 text-sm leading-relaxed">
                      {contentPreview}
                    </p>
                    <div className="mt-3 text-blue-600 text-sm font-medium">
                      Читать далее →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12">
          <Newspaper className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-500 text-lg">Новостей пока нет</p>
        </div>
      )}

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          О платформе ASAR
        </h2>
        <p className="text-gray-700 mb-4">
          ASAR - это платформа для экстренной помощи и обмена ресурсами в Казахстане.
          Мы объединяем людей, которые нуждаются в помощи, и тех, кто готов помочь.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">500+</div>
            <div className="text-sm text-gray-600">Заявок создано</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">85%</div>
            <div className="text-sm text-gray-600">Успешно решено</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">1000+</div>
            <div className="text-sm text-gray-600">Активных волонтеров</div>
          </div>
        </div>
      </div>
    </div>
  );
}

