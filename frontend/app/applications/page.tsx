"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import ListView from '@/components/home/ListView';
import { apiClient, Application, ApplicationStatus } from '@/lib/api';
import { useStore } from '@/lib/store';
import { getCityByName } from '@/lib/kazakhstanCities';

export default function ApplicationsPage() {
  const { user, authLoading } = useStore();
  const city = user?.city ? getCityByName(user.city)?.name || user.city : undefined;
  const [applications, setApplications] = useState<Application[]>([]);
  const [status, setStatus] = useState<ApplicationStatus>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (authLoading) return;
    let active = true;
    let latestRequest = 0;
    const load = async () => {
      const requestId = ++latestRequest;
      setLoading(true); setError('');
      try {
        const data = await apiClient.getApplicationsList(true, city, status);
        if (active && requestId === latestRequest) setApplications(data);
      } catch (failure) { if (active && requestId === latestRequest) setError(failure instanceof Error ? failure.message : 'Не удалось загрузить заявки'); }
      finally { if (active && requestId === latestRequest) setLoading(false); }
    };
    const refresh = () => { load(); };
    load();
    window.addEventListener('focus', refresh);
    window.addEventListener('applications-updated', refresh);
    return () => { active = false; window.removeEventListener('focus', refresh); window.removeEventListener('applications-updated', refresh); };
  }, [authLoading, city, status, revision]);
  return <div className="container mx-auto space-y-6 px-4 py-8">
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-3xl font-bold">Заявки на помощь</h1>
        <p className="mt-2 text-gray-600">{city ? `Ваш город: ${city}` : 'Заявки во всех городах'} {user?.is_authenticated && <Link href="/profile/edit" className="text-blue-700 underline">Изменить город</Link>}</p>
      </div>
      <Link href={user?.is_authenticated ? '/applications/new' : '/login'} className="btn btn-primary">Попросить помощь</Link>
    </div>
    <label className="form-field max-w-xs">Статус заявки
      <select className="form-select" value={status} onChange={event => setStatus(event.target.value as ApplicationStatus)}>
        <option value="active">Все активные</option><option value="open">Открытые</option>
        <option value="in_progress">В работе</option><option value="completed">Завершённые</option>
      </select>
    </label>
    {error ? <p role="alert" className="text-red-700">{error} <button type="button" className="underline" onClick={() => setRevision(n=>n+1)}>Повторить загрузку</button></p>
      : loading ? <p role="status">Загрузка заявок…</p> : <ListView applications={applications} />}
  </div>;
}
