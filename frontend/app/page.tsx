'use client';

import CursorEffect from '@/components/home/CursorEffect';
import ListView from '@/components/home/ListView';
import MapView from '@/components/home/MapView';
import ViewToggle from '@/components/home/ViewToggle';
import SOSDialog from '@/components/home/SOSDialog';
import { apiClient, Application, ApplicationStatus } from '@/lib/api';
import { getLanguage, useTranslation } from '@/lib/i18n';
import { CityData, getCityByName, kazakhstanCities, searchKazakhstanCities } from '@/lib/kazakhstanCities';
import { useStore } from '@/lib/store';
import { AlertCircle, Clock, Heart, List, MapPin, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function HomePage() {
  const { viewMode, setViewMode, user, authLoading, language, setLanguage: setLang, shouldRefreshApplications, setShouldRefreshApplications } = useStore();
  const [showSOS, setShowSOS] = useState(false);
  const [statusFilter, setStatusFilter] = useState<ApplicationStatus>('active');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, emergency: 0, city: '' });
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [citySearchValue, setCitySearchValue] = useState<string>('');
  const [citySuggestions, setCitySuggestions] = useState<CityData[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([43.2220, 76.8512]);
  const pathname = usePathname();
  const applicationsRequest = useRef(0);
  const statsRequest = useRef(0);
  const [loadError, setLoadError] = useState('');
  const effectiveCity = (user?.city && (getCityByName(user.city)?.name || user.city)) || selectedCity || 'Алматы';
  const t = useTranslation(language);

  useEffect(() => {
    const storedLang = getLanguage();
    if (storedLang !== language) setLang(storedLang);
    const storedMode = localStorage.getItem('viewMode');
    if (storedMode === 'map' || storedMode === 'list') setViewMode(storedMode);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    function chooseCity(name: string) {
      if (!active) return;
      const city = getCityByName(name);
      setSelectedCity(city?.name || name);
      setCitySearchValue(city?.name || name);
      if (city) setMapCenter([city.lat, city.lng]);
    }
    if (user?.city) chooseCity(user.city);
    else if (navigator.geolocation) navigator.geolocation.getCurrentPosition(position => {
      const nearest = [...kazakhstanCities].sort((a,b) =>
        Math.hypot(a.lat-position.coords.latitude,a.lng-position.coords.longitude) - Math.hypot(b.lat-position.coords.latitude,b.lng-position.coords.longitude))[0];
      chooseCity(nearest.name);
    }, () => chooseCity('Алматы'), { timeout: 8000 });
    else chooseCity('Алматы');
    return () => { active = false; };
  }, [authLoading, user?.city]);

  const loadApplications = useCallback(async (forceRefresh = false, city?: string, status: ApplicationStatus = statusFilter) => {
    if (authLoading) return;
    const requestId = ++applicationsRequest.current;
    setLoading(true); setLoadError('');
    try {
      const region = user?.city ? effectiveCity : city || effectiveCity;
      const data = viewMode === 'list'
        ? await apiClient.getApplicationsList(forceRefresh, region, status)
        : await apiClient.getApplications(forceRefresh, region, status);
      if (requestId === applicationsRequest.current) setApplications(data || []);
    } catch (error) {
      if (requestId === applicationsRequest.current) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить заявки');
    } finally {
      if (requestId === applicationsRequest.current) setLoading(false);
    }
  }, [authLoading, user?.city, effectiveCity, viewMode, statusFilter]);

  const loadStats = useCallback(async (_forceRefresh = false, city?: string) => {
    if (authLoading) return;
    const requestId = ++statsRequest.current;
    try {
      const region = user?.city ? effectiveCity : city || effectiveCity;
      const data = await apiClient.getRegionalStats(region);
      if (requestId === statsRequest.current) setStats({total:data.total || 0, active:data.active || 0, emergency:data.emergency || 0, city:region});
    } catch (error) { console.error('Error loading stats:', error); }
  }, [authLoading, user?.city, effectiveCity]);

  useEffect(() => {
    const refresh = () => { loadApplications(true); loadStats(true); };
    const onVisible = () => { if (!document.hidden) refresh(); };
    loadApplications(); loadStats();
    window.addEventListener('focus', refresh);
    window.addEventListener('applications-updated', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      applicationsRequest.current++; statsRequest.current++;
      window.removeEventListener('focus', refresh);
      window.removeEventListener('applications-updated', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [pathname, loadApplications, loadStats]);

  useEffect(() => {
    if (shouldRefreshApplications) {
      loadApplications(true); loadStats(true);
      setShouldRefreshApplications(false);
      sessionStorage.removeItem('shouldRefreshApplications');
      sessionStorage.removeItem('lastApplicationId');
    }
  }, [shouldRefreshApplications, loadApplications, loadStats, setShouldRefreshApplications]);

  return (
    <div className="min-h-screen bg-gray-50">
      {showSOS && <SOSDialog onClose={() => setShowSOS(false)} onCreated={(_id, point) => {
        setShowSOS(false);
        setMapCenter(point);
        setStatusFilter('open');
        setViewMode('map');
        loadApplications(true, selectedCity, 'open');
        loadStats(true, selectedCity);
      }} />}
      <CursorEffect>
        <div className="hero-section py-12 mb-8">
          <div className="container mx-auto px-4 relative z-10">
            <div className="text-center text-white">
              <h1 className="text-4xl font-bold mb-4 text-white">
                {t('home.hero.title')}
              </h1>
              <p className="text-lg mb-8 text-blue-100">
                {t('home.hero.subtitle')}
              </p>
              {user?.is_authenticated ? (
                <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => setShowSOS(true)}
                    className="sos-button bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold flex items-center"
                  >
                    <AlertCircle className="inline w-5 h-5 mr-2" />
                    SOS
                  </button>
                  <Link href="/applications/new" className="btn bg-white text-blue-700 hover:bg-gray-50 border border-gray-300 px-6 py-3 rounded-lg font-semibold flex items-center">
                    <AlertCircle className="inline w-5 h-5 mr-2" />
                    {t('home.hero.createApplication')}
                  </Link>
                  <Link href="/applications" className="btn btn-outline bg-white text-blue-700 border-white hover:bg-blue-50 px-6 py-3 rounded-lg font-semibold flex items-center">
                    <List className="inline w-5 h-5 mr-2" />
                    {t('home.hero.viewAll')}
                  </Link>
                </div>
              ) : (
                <div className="flex flex-wrap gap-3 justify-center">
                  <Link href="/login" className="btn bg-white text-blue-700 hover:bg-gray-50 border border-gray-300">
                    {t('nav.login')}
                  </Link>
                  <Link href="/sign-up" className="btn bg-blue-500 text-white hover:bg-blue-600 border border-blue-600">
                    {t('nav.signup')}
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      </CursorEffect>

      <div className="container mx-auto px-4 mb-8 max-w-full overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="stat-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">{t('stats.totalInRegion')}</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
                <p className="text-xs text-gray-500 mt-1">{stats.city || selectedCity || 'Алматы'}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                <MapPin className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>
          <div className="stat-card border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">{t('stats.activeApplications')}</p>
                <p className="text-3xl font-bold text-green-600">{stats.active}</p>
                <p className="text-xs text-gray-500 mt-1">Требуют помощи</p>
              </div>
              <div className="bg-green-50 p-4 rounded-md border border-green-200">
                <Clock className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>
          <div className="stat-card border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium mb-1">{t('stats.emergencyApplications')}</p>
                <p className="text-3xl font-bold text-red-600">{stats.emergency}</p>
                <p className="text-xs text-gray-500 mt-1">SOS</p>
              </div>
              <div className="bg-red-50 p-4 rounded-md border border-red-200">
                <AlertCircle className="w-8 h-8 text-red-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6 overflow-hidden max-w-full">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl font-bold text-blue-700 mb-2">
                Последние заявки
              </h2>
              <p className="text-gray-600 text-sm">
                Новые заявки, требующие помощи
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {user?.is_authenticated ? <p className="text-sm text-gray-600">Ваш город: <strong>{effectiveCity}</strong> · <Link href="/profile/edit" className="text-blue-700 underline">Изменить в профиле</Link></p> : <>
              <div className="relative" ref={(node) => {
                if (node) {
                  const handleClickOutside = (event: MouseEvent) => {
                    if (!node.contains(event.target as Node)) {
                      setShowCitySuggestions(false);
                    }
                  };
                  document.addEventListener('mousedown', handleClickOutside);
                  return () => document.removeEventListener('mousedown', handleClickOutside);
                }
              }}>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Выберите город..."
                    value={citySearchValue}
                    onChange={(e) => {
                      const value = e.target.value;
                      setCitySearchValue(value);
                      if (value.length > 0) {
                        const suggestions = searchKazakhstanCities(value);
                        setCitySuggestions(suggestions);
                        setShowCitySuggestions(true);
                      } else {
                        setCitySuggestions([]);
                        setShowCitySuggestions(false);
                      }
                    }}
                    onFocus={() => {
                      if (citySearchValue.length > 0) {
                        const suggestions = searchKazakhstanCities(citySearchValue);
                        setCitySuggestions(suggestions);
                        setShowCitySuggestions(true);
                      } else {
                        const suggestions = searchKazakhstanCities('');
                        setCitySuggestions(suggestions.slice(0, 10));
                        setShowCitySuggestions(true);
                      }
                    }}
                    onBlur={(e) => {
                      setTimeout(() => {
                        if (!citySearchValue || citySearchValue.trim() === '') {
                          const defaultCity = getCityByName('Алматы');
                          if (defaultCity) {
                            setSelectedCity('Алматы');
                            setCitySearchValue('Алматы');
                            setMapCenter([defaultCity.lat, defaultCity.lng]);
                          } else {
                            setSelectedCity('Алматы');
                            setCitySearchValue('Алматы');
                          }
                          loadApplications(false, 'Алматы');
                          loadStats(false, 'Алматы');
                        }
                      }, 200);
                    }}
                    className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-48"
                  />
                  {citySearchValue && (
                    <button
                      onClick={() => {
                        setCitySearchValue('');
                        setCitySuggestions([]);
                        setShowCitySuggestions(false);
                        const defaultCity = getCityByName('Алматы');
                        if (defaultCity) {
                          setSelectedCity('Алматы');
                          setMapCenter([defaultCity.lat, defaultCity.lng]);
                        } else {
                          setSelectedCity('Алматы');
                        }
                        loadApplications(false, 'Алматы');
                        loadStats(false, 'Алматы');
                      }}
                      className="absolute inset-y-0 right-0 pr-2 flex items-center text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {showCitySuggestions && citySuggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                    <div className="sticky top-0 bg-white border-b border-gray-200 p-2">
                      <input
                        type="text"
                        placeholder="Поиск города..."
                        value={citySearchValue}
                        onChange={(e) => {
                          const value = e.target.value;
                          setCitySearchValue(value);
                          if (value.length > 0) {
                            const suggestions = searchKazakhstanCities(value);
                            setCitySuggestions(suggestions);
                          } else {
                            const suggestions = searchKazakhstanCities('');
                            setCitySuggestions(suggestions.slice(0, 10));
                          }
                        }}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    {citySuggestions.map((city, index) => (
                      <button
                        key={index}
                        type="button"
                        className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                        onClick={() => {
                          setSelectedCity(city.name);
                          setCitySearchValue(city.name);
                          setMapCenter([city.lat, city.lng]);
                          setCitySuggestions([]);
                          setShowCitySuggestions(false);
                          loadApplications(false, city.name);
                          loadStats(false, city.name);
                        }}
                      >
                        <div className="font-medium text-gray-900">{city.name}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div></>}
              <label className="form-field">Статус заявки
                <select aria-label="Статус заявки" className="form-select" value={statusFilter}
                  onChange={event => setStatusFilter(event.target.value as ApplicationStatus)}>
                  <option value="open">Открытые</option>
                  <option value="in_progress">В работе</option>
                  <option value="completed">Завершённые</option>
                  <option value="active">Все активные</option>
                </select>
              </label>
              <ViewToggle />
            </div>
          </div>

          {loadError && <p role="alert" className="mb-4 text-red-700">{loadError} <button type="button" className="underline" onClick={() => loadApplications(true)}>Повторить загрузку</button></p>}
          {loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            </div>
          ) : viewMode === 'list' ? (
            <ListView applications={applications} />
          ) : (
            <MapView applications={applications} center={mapCenter} city={effectiveCity} />
          )}
        </div>

        {user?.is_authenticated && (
          <div className="bg-blue-600 rounded-lg shadow-sm border border-blue-700 p-8 text-white text-center">
            <Heart className="w-10 h-10 mx-auto mb-4 text-blue-200" />
            <h3 className="text-xl font-bold mb-2">{t('home.cta.title')}</h3>
            <p className="mb-6 text-blue-100 text-sm">{t('home.cta.description')}</p>
            <Link href="/applications/new" className="btn bg-white text-blue-700 hover:bg-gray-50 inline-block border border-gray-300">
              {t('home.cta.button')}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
