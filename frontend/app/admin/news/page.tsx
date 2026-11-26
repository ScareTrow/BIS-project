'use client';

import {
  EmptyState, NEWS_TYPES, NoticeBar, PageHeader, Pill, Spinner, Tabs, useNotice, useRequireAdmin,
} from '@/components/admin/shared';
import { apiClient } from '@/lib/api';
import { Edit, Eye, EyeOff, Newspaper, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface NewsItem {
  id: number;
  title: string;
  content: string;
  news_type: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  author: { first_name: string; last_name?: string | null };
}

const EMPTY_FORM = { title: '', content: '', news_type: 'general', is_published: true };
type Filter = 'all' | 'published' | 'draft';

export default function AdminNewsPage() {
  const ready = useRequireAdmin();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<NewsItem | 'new' | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getAdminNews();
      setItems(data.news || []);
    } catch {
      setNotice({ kind: 'error', text: 'Не удалось загрузить новости.' });
    } finally {
      setLoading(false);
    }
  }, [setNotice]);

  useEffect(() => {
    if (ready) load();
  }, [ready, load]);

  const visible = useMemo(
    () => items.filter((n) => (filter === 'published' ? n.is_published : filter === 'draft' ? !n.is_published : true)),
    [items, filter],
  );

  const openNew = () => {
    setEditing('new');
    setForm(EMPTY_FORM);
  };

  const openEdit = (n: NewsItem) => {
    setEditing(n);
    setForm({ title: n.title, content: n.content, news_type: n.news_type, is_published: n.is_published });
  };

  const close = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing && editing !== 'new') await apiClient.updateNews(editing.id, form);
      else await apiClient.createNews(form);
      setNotice({ kind: 'success', text: form.is_published ? 'Новость опубликована.' : 'Черновик сохранён.' });
      close();
      await load();
    } catch {
      setNotice({ kind: 'error', text: 'Не удалось сохранить новость.' });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (n: NewsItem) => {
    if (!confirm(`Удалить новость «${n.title}»? Это нельзя отменить.`)) return;
    try {
      await apiClient.deleteNews(n.id);
      setNotice({ kind: 'success', text: 'Новость удалена.' });
      await load();
    } catch {
      setNotice({ kind: 'error', text: 'Не удалось удалить новость.' });
    }
  };

  const togglePublish = async (n: NewsItem) => {
    try {
      await apiClient.updateNews(n.id, { is_published: !n.is_published });
      setNotice({ kind: 'success', text: n.is_published ? 'Новость скрыта — теперь это черновик.' : 'Новость опубликована.' });
      await load();
    } catch {
      setNotice({ kind: 'error', text: 'Не удалось изменить статус новости.' });
    }
  };

  if (!ready) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Новости"
        description="Объявления, которые видят все пользователи на странице «Новости». Черновики видны только администраторам."
        action={
          !editing && (
            <button onClick={openNew} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700">
              <Plus className="w-5 h-5" />Написать новость
            </button>
          )
        }
      />
      <NoticeBar notice={notice} onClose={() => setNotice(null)} />

      {editing && (
        <form onSubmit={submit} className="bg-white rounded-xl border border-blue-200 p-6 mb-6 space-y-4">
          <h2 className="text-lg font-semibold">{editing === 'new' ? 'Новая новость' : 'Редактирование'}</h2>
          <div>
            <label htmlFor="news-title" className="block text-sm font-medium text-gray-700 mb-1">Заголовок</label>
            <input
              id="news-title" type="text" required maxLength={200} value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label htmlFor="news-content" className="block text-sm font-medium text-gray-700 mb-1">Текст</label>
            <textarea
              id="news-content" rows={6} required value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="sm:w-64">
              <label htmlFor="news-type" className="block text-sm font-medium text-gray-700 mb-1">Рубрика</label>
              <select
                id="news-type" value={form.news_type}
                onChange={(e) => setForm({ ...form, news_type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2"
              >
                {Object.entries(NEWS_TYPES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700 sm:mt-6">
              <input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} />
              Сразу показать пользователям (иначе — черновик)
            </label>
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {form.is_published ? 'Опубликовать' : 'Сохранить черновик'}
            </button>
            <button type="button" onClick={close} className="rounded-lg px-4 py-2 text-gray-700 hover:bg-gray-100">Отмена</button>
          </div>
        </form>
      )}

      <div className="mb-4">
        <Tabs
          value={filter}
          onChange={setFilter}
          items={[
            { value: 'all', label: 'Все', count: items.length },
            { value: 'published', label: 'Опубликованные', count: items.filter((n) => n.is_published).length },
            { value: 'draft', label: 'Черновики', count: items.filter((n) => !n.is_published).length },
          ]}
        />
      </div>

      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Newspaper className="w-12 h-12" />} title="Новостей нет" hint="Нажмите «Написать новость», чтобы создать первую." />
      ) : (
        <ul className="space-y-3">
          {visible.map((n) => (
            <li key={n.id} className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col md:flex-row gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {n.is_published
                    ? <Pill className="bg-green-100 text-green-800 border-green-300">Опубликовано</Pill>
                    : <Pill className="bg-gray-100 text-gray-700 border-gray-300">Черновик</Pill>}
                  <Pill className="bg-blue-50 text-blue-800 border-blue-200">{NEWS_TYPES[n.news_type] || n.news_type}</Pill>
                </div>
                <h3 className="font-semibold text-gray-900">{n.title}</h3>
                <p className="text-sm text-gray-600 line-clamp-2">{n.content}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {n.author.first_name} {n.author.last_name || ''} · {new Date(n.created_at).toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              </div>
              <div className="flex md:flex-col gap-2 shrink-0">
                <button onClick={() => togglePublish(n)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  {n.is_published ? <><EyeOff className="w-4 h-4" />Скрыть</> : <><Eye className="w-4 h-4" />Опубликовать</>}
                </button>
                <button onClick={() => openEdit(n)} className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                  <Edit className="w-4 h-4" />Изменить
                </button>
                <button onClick={() => remove(n)} className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
                  <Trash2 className="w-4 h-4" />Удалить
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
