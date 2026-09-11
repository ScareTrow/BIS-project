'use client';

import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { AlertCircle, ArrowLeft, Calendar, MapPin, Newspaper, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NewsItem {
    id: number;
    title: string;
    content: string;
    news_type: string;
    created_at: string;
    updated_at: string;
    author: {
        id: number;
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

export default function NewsDetailPage() {
    const router = useRouter();
    const params = useParams();
    const { user } = useStore();
    const [loading, setLoading] = useState(true);
    const [newsItem, setNewsItem] = useState<NewsItem | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadNews = async () => {
            try {
                setLoading(true);
                const newsId = parseInt(params.id as string);
                if (isNaN(newsId)) {
                    setError('Некорректный ID новости');
                    return;
                }
                const data = await apiClient.getSingleNews(newsId);
                setNewsItem(data);
            } catch (error: any) {
                console.error('Error loading news:', error);
                if (error.response?.status === 404) {
                    setError('Новость не найдена');
                } else {
                    setError('Ошибка при загрузке новости');
                }
            } finally {
                setLoading(false);
            }
        };
        loadNews();
    }, [params.id]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
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

    if (error || !newsItem) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
                    <AlertCircle className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        {error || 'Новость не найдена'}
                    </h2>
                    <p className="text-gray-600 mb-6">
                        К сожалению, запрашиваемая новость не существует или была удалена.
                    </p>
                    <Link
                        href="/news"
                        className="btn btn-primary inline-flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Вернуться к новостям
                    </Link>
                </div>
            </div>
        );
    }

    const Icon = getIcon(newsItem.news_type);

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Link
                href="/news"
                className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-6 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Вернуться к новостям
            </Link>

            <article className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                <div className="flex items-start space-x-4 mb-6">
                    <div className="bg-blue-50 p-4 rounded-lg flex-shrink-0">
                        <Icon className="w-8 h-8 text-blue-600" />
                    </div>
                    <div className="flex-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-500 mb-3">
                            <Calendar className="w-4 h-4" />
                            <span>{formatDate(newsItem.created_at)}</span>
                            {newsItem.author && (
                                <>
                                    <span className="text-gray-300">•</span>
                                    <span>Автор: {newsItem.author.first_name} {newsItem.author.last_name || ''}</span>
                                </>
                            )}
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-4">
                            {newsItem.title}
                        </h1>
                    </div>
                </div>

                <div className="prose max-w-none">
                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap text-base">
                        {newsItem.content}
                    </div>
                </div>

                {newsItem.updated_at && newsItem.updated_at !== newsItem.created_at && (
                    <div className="mt-8 pt-6 border-t border-gray-200 text-sm text-gray-500">
                        Обновлено: {formatDate(newsItem.updated_at)}
                    </div>
                )}
            </article>
        </div>
    );
}

