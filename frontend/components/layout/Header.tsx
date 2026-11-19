'use client';

import SearchBar from '@/components/common/SearchBar';
import { apiClient, Notification } from '@/lib/api';
import { getLanguage, Language, useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { Bell, ChevronDown, FileText, Globe, Home, LogOut, Shield, User, Menu, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import NotificationsDropdown from './NotificationsDropdown';
import { useToast } from '@/components/ui/Toast';

export default function Header() {
  const router = useRouter();
  const navigation = useRef(router);
  navigation.current = router;
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, setUser, language, setLanguage: setLang, viewMode, setViewMode } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const showToast = useToast()?.show;
  const notificationVersion = useRef(0);
  const seen = useRef<Set<number> | null>(null);
  const t = useTranslation(language);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLang = getLanguage();
      if (storedLang !== language) {
        setLang(storedLang);
      }
      const storedViewMode = (localStorage.getItem('viewMode') as 'map' | 'list') || 'map';
      if (storedViewMode !== viewMode) {
        setViewMode(storedViewMode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showLangMenu || showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLangMenu, showNotifications]);

  const loadNotifications = useCallback(async () => {
    const revision = ++notificationVersion.current;
    try {
      const data = await apiClient.getNotifications();
      if (revision !== notificationVersion.current) return;
      const items = data.notifications || [];
      if (seen.current) {
        for (const item of items.slice().reverse()) {
          if (!item.is_read && !seen.current.has(item.id)) showToast?.({
            id: `notification-${item.id}`, title: item.title, message: item.message,
            onClick: item.related_application_id ? () => navigation.current.push(`/applications/${item.related_application_id}`) : undefined,
          });
          seen.current.add(item.id);
        }
      } else {
        seen.current = new Set(items.map(item => item.id));
      }
      setNotifications(items);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }, [showToast]);

  useEffect(() => {
    seen.current = null;
    setNotifications([]);
    setUnreadCount(0);
    if (!user?.is_authenticated) return;
    const refresh = () => { if (!document.hidden) void loadNotifications(); };
    refresh();
    const interval = window.setInterval(refresh, 30000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      notificationVersion.current++;
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [user?.is_authenticated, user?.id, loadNotifications]);

  useEffect(() => { setMenuOpen(false); setShowNotifications(false); }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setShowNotifications(false); setShowLangMenu(false); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  const links = user?.is_authenticated ? [
    { href: '/', label: t('nav.home'), icon: Home },
    { href: '/applications', label: t('nav.applications'), icon: FileText },
    { href: '/resources', label: t('nav.resources'), icon: FileText },
    { href: '/profile', label: t('nav.profile'), icon: User },
    ...(user.isAdmin ? [{ href: '/admin', label: t('admin.title'), icon: Shield }] : []),
  ] : [
    { href: '/', label: t('nav.home'), icon: Home },
    { href: '/applications', label: t('nav.applications'), icon: FileText },
    { href: '/about', label: t('nav.about'), icon: FileText },
    { href: '/resources', label: t('nav.resources'), icon: FileText },
    { href: '/login', label: t('nav.login'), icon: User },
  ];

  async function logout() {
    try { await apiClient.logout(); setUser(null); setMenuOpen(false); router.push('/'); }
    catch (error) { console.error('Error logging out:', error); }
  }

  return (
    <header className="relative z-50 border-b border-gray-200 bg-white shadow-sm">
      <nav className="container mx-auto px-4" aria-label="Основная навигация">
        <div className="flex min-w-0 items-center justify-between gap-3 py-3">
          <Link href="/" aria-label="ASAR — главная" className="shrink-0">
            <span className="block h-10 w-24 overflow-hidden">
              <img src="/ASARlogoo.png" alt="ASAR" className="relative -left-2 -top-8 h-28 w-28 max-w-none" />
            </span>
          </Link>
          <div className="hidden min-w-0 max-w-sm flex-1 xl:block"><SearchBar /></div>
          <div className="hidden items-center gap-1 lg:flex">
            {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={label}
              aria-label={label} className="flex items-center gap-2 rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">
              <Icon className="h-5 w-5 shrink-0" /><span className="hidden 2xl:inline">{label}</span>
            </Link>)}
            {user?.is_authenticated && <button type="button" onClick={logout} title={t('nav.logout')}
              aria-label={t('nav.logout')} className="rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50"><LogOut className="h-5 w-5" /></button>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user?.is_authenticated && <div className="relative" ref={notificationsRef}>
              <button type="button" aria-label={t('notifications.title')} aria-expanded={showNotifications}
                onClick={() => { setShowNotifications(!showNotifications); setShowLangMenu(false); }}
                className="relative rounded-md p-2 text-gray-700 hover:bg-blue-50">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              {showNotifications && <NotificationsDropdown notifications={notifications} onClose={() => setShowNotifications(false)}
                onMarkRead={async id => { await apiClient.markNotificationRead(id); loadNotifications(); }}
                onMarkAllRead={async () => { await apiClient.markAllNotificationsRead(); loadNotifications(); }} />}
            </div>}
            <div className="relative" ref={langMenuRef}>
              <button type="button" aria-label="Язык" aria-expanded={showLangMenu}
                onClick={() => { setShowLangMenu(!showLangMenu); setShowNotifications(false); }}
                className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Globe className="h-4 w-4" /><span>{language === 'kk' ? 'KZ' : language.toUpperCase()}</span><ChevronDown className="h-4 w-4" />
              </button>
              {showLangMenu && <div className="absolute right-0 mt-2 w-44 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {(['ru', 'kk', 'en'] as Language[]).map(lang => <button key={lang} type="button"
                  onClick={() => { setLang(lang); setShowLangMenu(false); }}
                  className={`block w-full px-4 py-3 text-left text-sm ${language === lang ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'}`}>
                  {{ ru: 'Русский', kk: 'Қазақша', en: 'English' }[lang]}
                </button>)}
              </div>}
            </div>
            <button type="button" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menuOpen}
              aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)} className="rounded-md p-2 text-gray-700 hover:bg-blue-50 lg:hidden">
              {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
        {menuOpen && <div id="mobile-navigation" className="space-y-3 border-t border-gray-100 py-4 lg:hidden">
          <SearchBar />
          <div className="grid gap-1 sm:grid-cols-2">
            {links.map(({ href, label, icon: Icon }) => <Link key={href} href={href} onClick={() => setMenuOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-3 text-gray-700 hover:bg-blue-50"><Icon className="h-5 w-5" />{label}</Link>)}
            {user?.is_authenticated && <button type="button" onClick={logout} className="flex items-center gap-3 rounded-md px-3 py-3 text-left text-gray-700 hover:bg-blue-50"><LogOut className="h-5 w-5" />{t('nav.logout')}</button>}
          </div>
        </div>}
      </nav>
    </header>
  );
}
