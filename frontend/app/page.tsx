'use client';

import CursorEffect from '@/components/home/CursorEffect';
import ListView from '@/components/home/ListView';
import MapView from '@/components/home/MapView';
import ViewToggle from '@/components/home/ViewToggle';
import { apiClient, Application } from '@/lib/api';
import { getLanguage, useTranslation } from '@/lib/i18n';
import { CityData, getCityByName, kazakhstanCities, searchKazakhstanCities } from '@/lib/kazakhstanCities';
import { useStore } from '@/lib/store';
import { AlertCircle, Clock, Heart, List, MapPin, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

export default function HomePage() {
  const { viewMode, setViewMode, user, language, setLanguage: setLang, shouldRefreshApplications, setShouldRefreshApplications } = useStore();
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, active: 0, emergency: 0, city: '' });
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [citySearchValue, setCitySearchValue] = useState<string>('');
  const [citySuggestions, setCitySuggestions] = useState<CityData[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [mapCenter, setMapCenter] = useState<[number, number]>([43.2220, 76.8512]);
  const pathname = usePathname();
  const prevPathnameRef = useRef<string | null>(null);
  const t = useTranslation(language);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLang = getLanguage();
      if (storedLang !== language) {
        setLang(storedLang);
      }

      const storedViewMode = localStorage.getItem('viewMode') as 'map' | 'list' | null;
      if (storedViewMode && (storedViewMode === 'map' || storedViewMode === 'list')) {
        setViewMode(storedViewMode);
      } else {
        setViewMode('map');
      }
    }
  }, []);

  useEffect(() => {
    const determineUserCity = async () => {
      if (user?.city) {
        const cityData = getCityByName(user.city);
        if (cityData) {
          setSelectedCity(user.city);
          setCitySearchValue(user.city);
          setMapCenter([cityData.lat, cityData.lng]);
        } else {
          setSelectedCity(user.city);
          setCitySearchValue(user.city);
        }
      } else if (typeof window !== 'undefined' && navigator.geolocation) {
        try {
          navigator.geolocation.getCurrentPosition(
            async (position) => {
              const userLat = position.coords.latitude;
              const userLng = position.coords.longitude;

              let closestCity: CityData | null = null;
              let minDistance = Infinity;

              for (const city of kazakhstanCities) {
                const distance = Math.sqrt(
                  Math.pow(city.lat - userLat, 2) + Math.pow(city.lng - userLng, 2)
                );
                if (distance < minDistance) {
                  minDistance = distance;
                  closestCity = city;
                }
              }

              if (closestCity) {
                setSelectedCity(closestCity.name);
                setCitySearchValue(closestCity.name);
                setMapCenter([closestCity.lat, closestCity.lng]);
              }
            },
            () => {
              const defaultCity = getCityByName('Алматы');
              if (defaultCity) {
                setSelectedCity('Алматы');
                setCitySearchValue('Алматы');
                setMapCenter([defaultCity.lat, defaultCity.lng]);
              } else {
                setSelectedCity('Алматы');
                setCitySearchValue('Алматы');
              }
            }
          );
        } catch (error) {
          const defaultCity = getCityByName('Алматы');
          if (defaultCity) {
            setSelectedCity('Алматы');
            setCitySearchValue('Алматы');
            setMapCenter([defaultCity.lat, defaultCity.lng]);
          } else {
            setSelectedCity('Алматы');
            setCitySearchValue('Алматы');
          }
        }
      } else {
        const defaultCity = getCityByName('Алматы');
        if (defaultCity) {
          setSelectedCity('Алматы');
          setCitySearchValue('Алматы');
          setMapCenter([defaultCity.lat, defaultCity.lng]);
        } else {
          setSelectedCity('Алматы');
          setCitySearchValue('Алматы');
        }
      }
    };

    determineUserCity();
  }, [user]);

  const loadApplications = useCallback(async (forceRefresh: boolean = false, city?: string) => {
    try {
      setLoading(true);
      const filterCity = city || selectedCity || 'Алматы';
      console.log('Загрузка заявок...', { viewMode, forceRefresh, city: filterCity });
      const data = viewMode === 'list'
        ? await apiClient.getApplicationsList(forceRefresh, filterCity)
        : await apiClient.getApplications(forceRefresh, filterCity);
      console.log('Заявки загружены:', data?.length || 0);
      setApplications(data || []);
    } catch (error) {
      console.error('Error loading applications:', error);
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [viewMode, selectedCity]);

  const loadStats = useCallback(async (forceRefresh: boolean = false, city?: string) => {
    try {
      const filterCity = city || selectedCity || 'Алматы';
      const statsData = await apiClient.getRegionalStats(filterCity);
      setStats({
        total: statsData.total || 0,
        active: statsData.active || 0,
        emergency: statsData.emergency || 0,
        city: statsData.city || filterCity
      });
      console.log('Региональная статистика обновлена:', statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
      try {
        const filterCity = city || selectedCity;
        const data = await apiClient.getApplications(forceRefresh, filterCity);
        const emergencyCount = data.filter((app: Application) => app.is_sos).length;
        const activeCount = data.filter((app: Application) => !app.is_resolved).length;
        setStats({
          total: data.length,
          active: activeCount,
          emergency: emergencyCount,
          city: filterCity || 'Алматы'
        });
      } catch (fallbackError) {
        console.error('Error loading fallback stats:', fallbackError);
      }
    }
  }, [selectedCity]);

  useEffect(() => {
    const cityToUse = selectedCity || 'Алматы';
    loadApplications(false, cityToUse);
    loadStats(false, cityToUse);
  }, [selectedCity, loadApplications, loadStats]);

  useEffect(() => {
    if (pathname === '/' && prevPathnameRef.current && prevPathnameRef.current !== '/') {
      const shouldRefresh = typeof window !== 'undefined' && sessionStorage.getItem('shouldRefreshApplications') === 'true';

      setTimeout(() => {
        console.log('Обновление данных при переходе на главную страницу...', { shouldRefresh });
        loadApplications(shouldRefresh, selectedCity);
        loadStats(shouldRefresh, selectedCity);
        if (shouldRefresh) {
          sessionStorage.removeItem('shouldRefreshApplications');
          setShouldRefreshApplications(false);
        }
      }, shouldRefresh ? 1000 : 300);
    }
    prevPathnameRef.current = pathname;
  }, [pathname, loadApplications, loadStats, setShouldRefreshApplications, selectedCity]);

  useEffect(() => {
    if (shouldRefreshApplications) {
      console.log('Флаг обновления установлен, начинаем обновление данных...');
      const lastApplicationId = typeof window !== 'undefined'
        ? sessionStorage.getItem('lastApplicationId')
        : null;

      const timeoutId = setTimeout(async () => {
        console.log('Принудительное обновление данных после создания заявки...', { lastApplicationId });
        await loadApplications(true, selectedCity);
        await loadStats(true, selectedCity);

        if (lastApplicationId) {
          setTimeout(async () => {
            const currentData = viewMode === 'list'
              ? await apiClient.getApplicationsList(true, selectedCity)
              : await apiClient.getApplications(true, selectedCity);
            const found = currentData.some((app: Application) => String(app.id) === lastApplicationId);
            console.log('Проверка новой заявки после повторной загрузки:', { lastApplicationId, found, applicationsCount: currentData.length });

            if (found) {
              setApplications(currentData);
              const emergencyCount = currentData.filter((app: Application) => app.is_sos).length;
              setStats({
                total: currentData.length,
                active: currentData.length,
                emergency: emergencyCount,
                city: stats.city || selectedCity || 'Алматы'
              });
            }
          }, 1000);
        }

        setShouldRefreshApplications(false);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('shouldRefreshApplications');
          sessionStorage.removeItem('lastApplicationId');
        }
      }, 1000);
      return () => clearTimeout(timeoutId);
    }
  }, [shouldRefreshApplications, loadApplications, loadStats, setShouldRefreshApplications, viewMode, selectedCity]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const shouldRefresh = sessionStorage.getItem('shouldRefreshApplications');
      if (shouldRefresh === 'true') {
        setShouldRefreshApplications(true);
        sessionStorage.removeItem('shouldRefreshApplications');
      }
    }
  }, [setShouldRefreshApplications]);

  useEffect(() => {
    const handleFocus = () => {
      console.log('Обновление данных при фокусе окна...');
      loadApplications(true, selectedCity);
      loadStats(true, selectedCity);
    };

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        console.log('Обновление данных при возврате на страницу...');
        loadApplications(true, selectedCity);
        loadStats(true, selectedCity);
      }
    };

    const handleApplicationUpdate = () => {
      console.log('Событие обновления заявок получено...');
      loadApplications(true, selectedCity);
      loadStats(true, selectedCity);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('applications-updated', handleApplicationUpdate);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('applications-updated', handleApplicationUpdate);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadApplications, loadStats, selectedCity]);

  return (
    <div className="min-h-screen bg-gray-50">
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
                <div className="flex gap-4 justify-center">
                  <button
                    onClick={async () => {
                      if (!navigator.geolocation) {
                        alert(t('alerts.geolocationNotSupported'));
                        return;
                      }
                      const confirmSOS = confirm('Отправить SOS? Ваше местоположение будет определено автоматически.');
                      if (!confirmSOS) return;
                      navigator.geolocation.getCurrentPosition(
                        async (position) => {
                          try {
                            await apiClient.createSOS(position.coords.latitude, position.coords.longitude);
                            alert(t('alerts.sosSent'));
                            loadApplications(true, selectedCity);
                            loadStats(true, selectedCity);
                          } catch (error) {
                            console.error('Error sending SOS:', error);
                            alert(t('alerts.sosError'));
                          }
                        },
                        (error) => {
                          alert(t('alerts.locationError'));
                        }
                      );
                    }}
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
                <div className="flex gap-4 justify-center">
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
              </div>
              <ViewToggle />
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center items-center h-96">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600"></div>
            </div>
          ) : viewMode === 'list' ? (
            <ListView applications={applications} />
          ) : (
            <MapView applications={applications} center={mapCenter} />
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
