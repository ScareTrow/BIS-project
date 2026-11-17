'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, User } from '@/lib/api';
import { Edit, User as UserIcon, MapPin, Save, X, Instagram, MessageCircle, Search } from 'lucide-react';
import Link from 'next/link';
import { searchKazakhstanCities } from '@/lib/kazakhstanCities';
import { useTranslation, getLanguage } from '@/lib/i18n';

export default function EditProfilePage() {
  const router = useRouter();
  const t = useTranslation(getLanguage());
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    city: '',
    avatar: null as File | null,
    telegram: '',
    instagram: '',
    telegram_id: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [nameChangesRemaining, setNameChangesRemaining] = useState<number | null>(null);
  const [citySearch, setCitySearch] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  // Поиск городов (используем локальный список + Nominatim)
  const searchCities = async (query: string) => {
    if (query.length < 1) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }
    
    // Создаем регулярное выражение для точного поиска
    // Всегда ищем города, начинающиеся с запроса (регистронезависимо)
    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchPattern = new RegExp(`^${escapedQuery}`, 'i');
    
    // Сначала ищем в локальном списке городов Казахстана (только начинающиеся с запроса)
    const localResults = searchKazakhstanCities(query, true);
    const localCityNames = localResults.map(city => city.name);
    
    // Если есть результаты из локального списка, показываем их
    if (localCityNames.length > 0) {
      setCitySuggestions(localCityNames);
      setShowCitySuggestions(true);
    }
    
    // Дополнительно ищем через Nominatim для других городов
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=kz&limit=10&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ASAR Application/1.0'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        const nominatimCities = data
          .filter((item: any) => item.type === 'city' || item.type === 'town' || item.type === 'village')
          .map((item: any) => {
            const addr = item.address || {};
            return addr.city || addr.town || addr.village || item.display_name.split(',')[0];
          })
          .filter((city: string, index: number, self: string[]) => self.indexOf(city) === index)
          .filter((city: string) => !localCityNames.includes(city)) // Исключаем дубликаты
          .filter((city: string) => searchPattern.test(city)); // Фильтруем по регулярному выражению
        
        // Объединяем результаты, приоритет локальному списку
        const allCities = [...localCityNames, ...nominatimCities].slice(0, 10);
        setCitySuggestions(allCities);
        setShowCitySuggestions(true);
      }
    } catch (error) {
      console.error('Error searching cities:', error);
      // Если ошибка, но есть локальные результаты, всё равно показываем их
      if (localCityNames.length > 0) {
        setCitySuggestions(localCityNames);
        setShowCitySuggestions(true);
      }
    }
  };

  // Выбор города
  const selectCity = (cityName: string) => {
    setCitySearch(cityName);
    setFormData(prev => ({ ...prev, city: cityName }));
    setShowCitySuggestions(false);
  };

  useEffect(() => {
    if (citySearch.trim()) {
      const timeoutId = setTimeout(() => {
        searchCities(citySearch.trim());
      }, 150);
      return () => clearTimeout(timeoutId);
    } else {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
    }
  }, [citySearch]);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await apiClient.getCurrentUser();
      const userData = data.user;
      setUser(userData);
      
      let socialLinks: any = {};
      if (userData.social_links) {
        try {
          socialLinks = typeof userData.social_links === 'string' 
            ? JSON.parse(userData.social_links) 
            : userData.social_links;
        } catch (e) {
          socialLinks = {};
        }
      }
      
      const userCity = userData.city || '';
      setFormData({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        city: userCity,
        avatar: null,
        telegram: socialLinks.telegram || '',
        instagram: socialLinks.instagram || '',
        telegram_id: userData.telegram_id || '',
      });
      setCitySearch(userCity);
      if (userData.avatar) {
        setPreview(`/api/uploads/${userData.avatar}`);
      }
      
      if (data.name_changes_remaining !== undefined) {
        setNameChangesRemaining(data.name_changes_remaining);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!formData.first_name.trim()) {
      setErrors({ first_name: 'Имя обязательно' });
      return;
    }

    setSaving(true);
    try {
      const formDataToSend = new FormData();
      formDataToSend.append('first_name', formData.first_name);
      if (formData.last_name) {
        formDataToSend.append('last_name', formData.last_name);
      }
      if (formData.city) {
        formDataToSend.append('city', formData.city);
      }
      if (formData.telegram) {
        formDataToSend.append('telegram', formData.telegram);
      }
      if (formData.instagram) {
        formDataToSend.append('instagram', formData.instagram);
      }
      if (formData.telegram_id) {
        formDataToSend.append('telegram_id', formData.telegram_id);
      }
      if (formData.avatar) {
        formDataToSend.append('avatar', formData.avatar);
      }

      await apiClient.updateProfile(formDataToSend);
      router.push('/profile');
    } catch (error: any) {
      setErrors({ submit: error.message || t('alerts.profileSaveError') });
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setErrors({ avatar: 'Размер файла не должен превышать 5MB' });
        return;
      }
      setFormData({ ...formData, avatar: file });
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
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

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Редактировать профиль</h1>
        <Link
          href="/profile"
          className="btn btn-outline flex items-center space-x-2"
        >
          <X className="w-4 h-4" />
          <span>Отмена</span>
        </Link>
      </div>

      <div className="max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="card space-y-6">
          <div className="text-center">
            <div className="mb-4">
              {preview ? (
                <img
                  src={preview}
                  alt="Avatar preview"
                  className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-primary"
                />
              ) : (
                <div className="w-32 h-32 rounded-full mx-auto bg-gray-200 flex items-center justify-center">
                  <UserIcon className="w-16 h-16 text-gray-400" />
                </div>
              )}
            </div>
            <label className="inline-flex items-center px-4 py-2 border-2 border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
              <Edit className="w-4 h-4 mr-2" />
              <span>Изменить фото</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </label>
            {errors.avatar && (
              <p className="mt-2 text-sm text-red-600">{errors.avatar}</p>
            )}
          </div>

          <div>
            <label htmlFor="first_name" className="block text-sm font-semibold text-gray-700 mb-2">
              Имя *
            </label>
            <input
              type="text"
              id="first_name"
              value={formData.first_name}
              onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            {errors.first_name && (
              <p className="mt-1 text-sm text-red-600">{errors.first_name}</p>
            )}
          </div>

          <div>
            <label htmlFor="last_name" className="block text-sm font-semibold text-gray-700 mb-2">
              Фамилия
            </label>
            <input
              type="text"
              id="last_name"
              value={formData.last_name}
              onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
              <MapPin className="w-4 h-4 mr-2" />
              Город
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                id="city"
                value={citySearch}
                onChange={(e) => {
                  setCitySearch(e.target.value);
                  setFormData({ ...formData, city: e.target.value });
                }}
                onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)}
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Введите название города для поиска..."
              />
              {showCitySuggestions && citySuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                  {citySuggestions.map((city, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => selectCity(city)}
                      className="w-full text-left px-4 py-2 hover:bg-blue-50 transition-colors"
                    >
                      {city}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {nameChangesRemaining !== null && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <p className="text-sm text-blue-800">
                <strong>Ограничение:</strong> Имя и фамилию можно изменить {nameChangesRemaining} раз(а) в этом месяце.
              </p>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Социальные сети (необязательно)</h3>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="telegram" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <MessageCircle className="w-4 h-4 mr-2 text-blue-500" />
                  Telegram
                </label>
                <input
                  type="text"
                  id="telegram"
                  value={formData.telegram}
                  onChange={(e) => setFormData({ ...formData, telegram: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="@username или https://t.me/username"
                />
                <p className="mt-1 text-xs text-gray-500">Можно указать @username или полную ссылку</p>
              </div>

              <div>
                <label htmlFor="telegram_id" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <MessageCircle className="w-4 h-4 mr-2 text-blue-500" />
                  Telegram ID (для бота)
                </label>
                <input
                  type="text"
                  id="telegram_id"
                  value={formData.telegram_id}
                  onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Получите ваш Telegram ID в боте командой /start"
                />
                <p className="mt-1 text-xs text-gray-500">Для использования Telegram бота укажите ваш Telegram ID</p>
              </div>

              <div>
                <label htmlFor="instagram" className="block text-sm font-semibold text-gray-700 mb-2 flex items-center">
                  <Instagram className="w-4 h-4 mr-2 text-pink-500" />
                  Instagram
                </label>
                <input
                  type="text"
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="https://instagram.com/username"
                />
                <p className="mt-1 text-xs text-gray-500">Укажите полную ссылку на ваш профиль</p>
              </div>
            </div>
          </div>

          {errors.submit && (
            <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md">
              {errors.submit}
            </div>
          )}

          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn btn-primary flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Сохранение...</span>
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  <span>Сохранить</span>
                </>
              )}
            </button>
            <Link
              href="/profile"
              className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center space-x-2"
            >
              <X className="w-5 h-5" />
              <span>Отмена</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

