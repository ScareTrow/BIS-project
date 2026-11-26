'use client';

import { ADMIN_COUNTS_EVENT } from '@/components/admin/shared';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { ClipboardCheck, LayoutDashboard, Newspaper, Shield, SlidersHorizontal, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

const NAV = [
  { href: '/admin', label: 'Обзор', icon: LayoutDashboard, exact: true },
  { href: '/admin/applications', label: 'Проверка заявок', icon: ClipboardCheck, badge: 'pending_applications' as const },
  { href: '/admin/resources', label: 'Проверка пунктов помощи', icon: ClipboardCheck, badge: 'pending_resources' as const },
  { href: '/admin/users', label: 'Пользователи', icon: Users },
  { href: '/admin/news', label: 'Новости', icon: Newspaper },
  ...(process.env.NEXT_PUBLIC_FEATURE_TRIAGE === 'true' ? [{ href: '/admin/community', label: 'Правила и аналитика', icon: SlidersHorizontal }] : []),
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname() || '';
  const { user } = useStore();
  const [counts, setCounts] = useState<Awaited<ReturnType<typeof apiClient.getAdminCounts>> | null>(null);

  useEffect(() => {
    if (!user?.isAdmin) return;
    let active = true;
    const load = () => apiClient.getAdminCounts().then(data => { if (active) setCounts(data); }).catch(() => {});
    load();
    window.addEventListener(ADMIN_COUNTS_EVENT, load);
    return () => { active = false; window.removeEventListener(ADMIN_COUNTS_EVENT, load); };
  }, [user?.isAdmin]);

  // Не показываем меню, пока не ясно, что это администратор: сами страницы делают редирект.
  if (!user?.isAdmin) return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="container mx-auto px-4">
          <div className="flex items-center gap-2 pt-3 text-sm text-gray-500">
            <Shield className="w-4 h-4 text-purple-600" />
            <span>Панель администратора</span>
          </div>
          <nav aria-label="Разделы админки" className="flex gap-1 overflow-x-auto -mb-px">
            {NAV.map(({ href, label, icon: Icon, exact, badge }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2 whitespace-nowrap px-3 py-3 border-b-2 text-sm font-medium transition-colors ${
                    active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {badge && !!counts?.[badge] && (
                    <span className="rounded-full bg-yellow-500 text-white text-xs font-bold px-2 py-0.5" title={label}>
                      {counts[badge]}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">{children}</div>
    </div>
  );
}
