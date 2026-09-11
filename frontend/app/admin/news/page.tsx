'use client';

import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { Edit, Eye, EyeOff, Newspaper, Plus, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

interface NewsItem {
    id: number;
    title: string;
    content: string;
    news_type: string;
    is_published: boolean;
    created_at: string;
    updated_at: string;
    author: {
        first_name: string;
        last_name?: string;
    };
}

export default function AdminNewsPage() {
    const router = useRouter();
    const { user } = useStore();
    const [loading, setLoading] = useState(true);
    const [newsItems, setNewsItems] = useState<NewsItem[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingNews, setEditingNews] = useState<NewsItem | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        content: '',
        news_type: 'general',
        is_published: true,
    });

    useEffect(() => {
        if (!user?.isAdmin) {
            router.push('/');
            return;
        }
        loadNews();
    }, [user, router]);

    const loadNews = async () => {
        try {
            setLoading(true);
            const data = await apiClient.getAdminNews();
            setNewsItems(data.news || []);
        } catch (error) {
            console.error('Error loading news:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingNews) {
                await apiClient.updateNews(editingNews.id, formData);
            } else {
                await apiClient.createNews(formData);
            }
            setShowForm(false);
            setEditingNews(null);
            setFormData({ title: '', content: '', news_type: 'general', is_published: true });
            loadNews();
        } catch (error) {
            console.error('Error saving news:', error);
            alert('Ошибка при сохранении новости');
        }
    };

    const handleEdit = (news: NewsItem) => {
        setEditingNews(news);
        setFormData({
            title: news.title,
            content: news.content,
            news_type: news.news_type,
            is_published: news.is_published,
        });
        setShowForm(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Вы уверены, что хотите удалить эту новость?')) {
            return;
        }
        try {
            await apiClient.deleteNews(id);
            loadNews();
        } catch (error) {
            console.error('Error deleting news:', error);
            alert('Ошибка при удалении новости');
        }
    };

    const handleTogglePublish = async (news: NewsItem) => {
        try {
            await apiClient.updateNews(news.id, { is_published: !news.is_published });
            loadNews();
        } catch (error) {
            console.error('Error updating news:', error);
            alert('Ошибка при обновлении новости');
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (!user?.isAdmin) {
        return null;
    }

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
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center">
                        <Newspaper className="w-8 h-8 mr-3 text-blue-600" />
                        Управление новостями
                    </h1>
                    <p className="text-gray-600">Создавайте и редактируйте новости платформы</p>
                </div>
                <button
                    onClick={() => {
                        setShowForm(true);
                        setEditingNews(null);
                        setFormData({ title: '', content: '', news_type: 'general', is_published: true });
                    }}
                    className="btn btn-primary flex items-center space-x-2"
                >
                    <Plus className="w-5 h-5" />
                    <span>Создать новость</span>
                </button>
            </div>

            {showForm && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
                    <h2 className="text-xl font-semibold mb-4">
                        {editingNews ? 'Редактировать новость' : 'Создать новость'}
                    </h2>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Заголовок *
                            </label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                required
                                maxLength={200}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Содержание *
                            </label>
                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                rows={6}
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Тип новости
                            </label>
                            <select
                                value={formData.news_type}
                                onChange={(e) => setFormData({ ...formData, news_type: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="general">Общее</option>
                                <option value="stats">Статистика</option>
                                <option value="location">Местоположение</option>
                                <option value="safety">Безопасность</option>
                                <option value="volunteers">Волонтеры</option>
                            </select>
                        </div>
                        <div className="flex items-center">
                            <input
                                type="checkbox"
                                id="is_published"
                                checked={formData.is_published}
                                onChange={(e) => setFormData({ ...formData, is_published: e.target.checked })}
                                className="mr-2"
                            />
                            <label htmlFor="is_published" className="text-sm text-gray-700">
                                Опубликовать сразу
                            </label>
                        </div>
                        <div className="flex space-x-3">
                            <button type="submit" className="btn btn-primary">
                                {editingNews ? 'Сохранить' : 'Создать'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setShowForm(false);
                                    setEditingNews(null);
                                    setFormData({ title: '', content: '', news_type: 'general', is_published: true });
                                }}
                                className="btn btn-secondary"
                            >
                                Отмена
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Заголовок
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Тип
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Автор
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Дата
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Статус
                                </th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Действия
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {newsItems.length > 0 ? (
                                newsItems.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="text-sm font-medium text-gray-900">{item.title}</div>
                                            <div className="text-sm text-gray-500 line-clamp-2 max-w-md">
                                                {item.content.substring(0, 100)}...
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {item.news_type}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {item.author.first_name} {item.author.last_name || ''}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {formatDate(item.created_at)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {item.is_published ? (
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                                    Опубликовано
                                                </span>
                                            ) : (
                                                <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                                    Черновик
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <div className="flex justify-end space-x-2">
                                                <button
                                                    onClick={() => handleTogglePublish(item)}
                                                    className="text-blue-600 hover:text-blue-900"
                                                    title={item.is_published ? 'Снять с публикации' : 'Опубликовать'}
                                                >
                                                    {item.is_published ? (
                                                        <EyeOff className="w-5 h-5" />
                                                    ) : (
                                                        <Eye className="w-5 h-5" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(item)}
                                                    className="text-indigo-600 hover:text-indigo-900"
                                                    title="Редактировать"
                                                >
                                                    <Edit className="w-5 h-5" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                    title="Удалить"
                                                >
                                                    <Trash2 className="w-5 h-5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                        Новостей пока нет. Создайте первую новость!
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

