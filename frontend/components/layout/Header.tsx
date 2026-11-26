'use client';

import { apiClient, Notification } from '@/lib/api';
import { getLanguage, Language, useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { Bell, ChevronDown, ClipboardList, Globe, Home, Info, LogIn, LogOut, MapPinned, Menu, Newspaper, Shield, UserCircle, X } from 'lucide-react';
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
  const { user, setUser, language, setLanguage: setLang } = useStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const mobileRef = useRef<HTMLElement>(null);
  const langMenuRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const showToast = useToast()?.show;
  const notificationVersion = useRef(0);
  const seen = useRef<Set<number> | null>(null);
  const t = useTranslation(language);
  const translate = useRef(t);
  translate.current = t;
  useEffect(() => { document.documentElement.lang = language; }, [language]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLang = getLanguage();
      if (storedLang !== language) {
        setLang(storedLang);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setShowMore(false);
      if (!mobileRef.current?.contains(event.target as Node)) setMenuOpen(false);
      if (langMenuRef.current && !langMenuRef.current.contains(event.target as Node)) {
        setShowLangMenu(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showLangMenu || showNotifications || showMore || menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showLangMenu, showNotifications, showMore, menuOpen]);

  const loadNotifications = useCallback(async () => {
    const revision = ++notificationVersion.current;
    try {
      const data = await apiClient.getNotifications();
      if (revision !== notificationVersion.current) return;
      const items = data.notifications || [];
      if (seen.current) {
        for (const item of items.slice().reverse()) {
          if (!item.is_read && !seen.current.has(item.id)) showToast?.({
            id: `notification-${item.id}`, title: item.title,
            message: item.related_application_category && item.related_application_id
              ? item.message.replace(`#${item.related_application_id}`, `«${translate.current(`category.${item.related_application_category}`)}»`)
              : item.message,
            onClick: item.related_application_id ? () => navigation.current.push(`/applications/${item.related_application_public_id || item.related_application_id}`) : undefined,
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

  useEffect(() => { setMenuOpen(false); setShowMore(false); setShowNotifications(false); }, [pathname]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenuOpen(false); setShowMore(false); setShowNotifications(false); setShowLangMenu(false); } };
    document.addEventListener('keydown', close);
    return () => document.removeEventListener('keydown', close);
  }, []);

  const primary = [
    { href: '/', label: t('nav.home'), icon: Home },
    { href: '/applications', label: t('nav.applications'), icon: ClipboardList },
    { href: '/resources', label: t('nav.resources'), icon: MapPinned },
    user?.is_authenticated
      ? { href: '/profile', label: t('nav.profile'), icon: UserCircle }
      : { href: '/login', label: t('nav.login'), icon: LogIn },
    ...(user?.isAdmin ? [{ href: '/admin', label: t('nav.admin'), icon: Shield }] : []),
  ];
  const secondary = [
    { href: '/news', label: t('nav.news'), icon: Newspaper },
    { href: '/about', label: t('nav.about'), icon: Info },
  ];

  function active(href: string) {
    return pathname === href || (href !== '/' && pathname?.startsWith(href + '/'));
  }

  function navLink({ href, label, icon: Icon }: typeof primary[number]) {
    return <Link key={href} href={href} aria-current={active(href) ? 'page' : undefined}
      onClick={() => { setMenuOpen(false); setShowMore(false); }}
      className={'flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-2.5 text-sm hover:bg-blue-50 hover:text-blue-700 ' +
        (active(href) ? 'bg-blue-50 font-semibold text-blue-700' : 'text-gray-700')}>
      <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />{label}
    </Link>;
  }

  async function logout() {
    try { await apiClient.logout(); setUser(null); setMenuOpen(false); setShowMore(false); router.push('/'); }
    catch (error) { console.error('Error logging out:', error); }
  }

  return (
    <header className="relative z-50 border-b border-gray-200 bg-white shadow-sm">
      <nav ref={mobileRef} className="container mx-auto px-4" aria-label="Основная навигация">
        <div className="flex min-w-0 items-center justify-between gap-3 py-3">
          <Link href="/" aria-label="ASAR — главная" className="shrink-0">
            <span className="block h-10 w-24 overflow-hidden">
              <img src="/ASARlogoo.png" alt="ASAR" className="relative -left-2 -top-8 h-28 w-28 max-w-none" />
            </span>
          </Link>
          <div className="hidden items-center gap-1 lg:flex">
            {primary.map(navLink)}
            <div className="relative" ref={moreRef}>
              <button type="button" aria-expanded={showMore} onClick={() => {
                setShowMore(!showMore);
                setShowLangMenu(false);
                setShowNotifications(false);
              }} className={'flex items-center gap-1 rounded-md px-2 py-2 text-sm hover:bg-blue-50 ' +
                (secondary.some(link => active(link.href)) ? 'bg-blue-50 text-blue-700' : 'text-gray-700')}>
                {t('nav.more')}<ChevronDown aria-hidden="true" className="h-4 w-4" />
              </button>
              {showMore && <div className="absolute right-0 mt-2 min-w-40 rounded-lg border border-gray-200 bg-white p-1 shadow-lg">
                {secondary.map(navLink)}
                {user?.is_authenticated && <button type="button" onClick={logout}
                  className="flex w-full items-center gap-1.5 rounded-md px-2 py-2.5 text-left text-sm text-gray-700 hover:bg-blue-50">
                  <LogOut aria-hidden="true" className="h-4 w-4" />{t('nav.logout')}
                </button>}
              </div>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {user?.is_authenticated && <div className="relative" ref={notificationsRef}>
              <button type="button" aria-label={t('notifications.title')} aria-expanded={showNotifications}
                onClick={() => { setShowNotifications(!showNotifications); setShowLangMenu(false); setShowMore(false); }}
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
                onClick={() => { setShowLangMenu(!showLangMenu); setShowNotifications(false); setShowMore(false); }}
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
          <div className="grid gap-1 sm:grid-cols-2">
            {[...primary, ...secondary].map(navLink)}
            {user?.is_authenticated && <button type="button" onClick={logout} className="flex items-center gap-3 rounded-md px-3 py-3 text-left text-gray-700 hover:bg-blue-50"><LogOut className="h-5 w-5" />{t('nav.logout')}</button>}
          </div>
        </div>}
      </nav>
    </header>
  );
}
