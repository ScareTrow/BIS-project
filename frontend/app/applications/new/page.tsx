'use client';

import { getLanguage, useTranslation } from '@/lib/i18n';
import { getCityByName, searchKazakhstanCities } from '@/lib/kazakhstanCities';
import { useStore } from '@/lib/store';
import { AlertCircle, Calendar, FileText, Image as ImageIcon, MapPin, Search, Send, Upload, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const MapComponent = dynamic(() => import('@/components/common/ApplicationMap'), {
  ssr: false,
});

export default function NewApplicationPage() {
  const router = useRouter();
  const { user, setShouldRefreshApplications } = useStore();
  const t = useTranslation(getLanguage());
  const [formData, setFormData] = useState({
    description: '',
    category: 'food',
    latitude: 43.2220,
    longitude: 76.8512,
    expires_days: 7,
    address: '',
    city: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [citySuggestions, setCitySuggestions] = useState<string[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [blockedInfo, setBlockedInfo] = useState<{ blocked_until?: string; blocked_reason?: string } | null>(null);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaPreviews, setMediaPreviews] = useState<string[]>([]);
  const [verificationDocument, setVerificationDocument] = useState<File | null>(null);
  const [verificationDocumentPreview, setVerificationDocumentPreview] = useState<string | null>(null);
  const [isResourcePoint, setIsResourcePoint] = useState(false);

  const MAX_DESCRIPTION_LENGTH = 5000;

  const fetchAddress = async (lat: number, lng: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ASAR Application/1.0'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        const address = data.address || {};
        const city = address.city || address.town || address.village || address.municipality || '';
        const region = address.state || address.region || address.county || '';
        const street = address.road || '';
        const house = address.house_number || '';

        let fullAddress = '';
        if (street) {
          fullAddress = house ? `${street}, ${house}` : street;
          if (city) fullAddress += `, ${city}`;
          if (region && region !== city) fullAddress += `, ${region}`;
        } else if (city) {
          fullAddress = city;
          if (region && region !== city) fullAddress += `, ${region}`;
        } else if (region) {
          fullAddress = region;
        }

        setFormData(prev => ({ ...prev, address: fullAddress || `${lat.toFixed(6)}, ${lng.toFixed(6)}`, city: city || '' }));
      }
    } catch (error) {
      console.error('Error fetching address:', error);
      setFormData(prev => ({ ...prev, address: `${lat.toFixed(6)}, ${lng.toFixed(6)}` }));
    }
  };

  const searchCities = async (query: string) => {
    if (query.length < 1) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      return;
    }

    const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const searchPattern = new RegExp(`^${escapedQuery}`, 'i');

    const localResults = searchKazakhstanCities(query, true);
    const localCityNames = localResults.map(city => city.name);

    if (localCityNames.length > 0) {
      setCitySuggestions(localCityNames);
      setShowCitySuggestions(true);
    }
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
          .filter((city: string) => !localCityNames.includes(city))
          .filter((city: string) => searchPattern.test(city));

        const allCities = [...localCityNames, ...nominatimCities].slice(0, 10);
        setCitySuggestions(allCities);
        setShowCitySuggestions(true);
      }
    } catch (error) {
      console.error('Error searching cities:', error);
      if (localCityNames.length > 0) {
        setCitySuggestions(localCityNames);
        setShowCitySuggestions(true);
      }
    }
  };

  // Выбор города и перемещение карты
  const selectCity = async (cityName: string) => {
    setCitySearch(cityName);
    setFormData(prev => ({ ...prev, city: cityName }));
    setShowCitySuggestions(false);

    // Сначала проверяем локальный список
    const localCity = getCityByName(cityName);
    if (localCity) {
      setFormData(prev => ({
        ...prev,
        latitude: localCity.lat,
        longitude: localCity.lng
      }));
      fetchAddress(localCity.lat, localCity.lng);
      return;
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cityName)}&countrycodes=kz&limit=1&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ASAR Application/1.0'
          }
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          setFormData(prev => ({ ...prev, latitude: lat, longitude: lng }));
          fetchAddress(lat, lng);
        }
      }
    } catch (error) {
      console.error('Error geocoding city:', error);
    }
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

  useEffect(() => {
    if (!user || !user.is_authenticated) {
      router.push('/login');
      return;
    }

    if (user.is_blocked) {
      const blockedUntil = user.blocked_until ? new Date(user.blocked_until) : null;
      const now = new Date();

      if (blockedUntil && blockedUntil > now) {
        setBlockedInfo({
          blocked_until: user.blocked_until,
          blocked_reason: user.blocked_reason || undefined
        });
      }
    }
  }, [user, router]);

  useEffect(() => {
    if (user && user.is_authenticated) {
      fetchAddress(formData.latitude, formData.longitude);
    }
    setIsResourcePoint(['food', 'medicine', 'shelter'].includes(formData.category));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    if (!user || !user.is_authenticated) {
      setErrors({ submit: 'Вам нужно войти в аккаунт прежде чем создать заявку' });
      setTimeout(() => {
        router.push('/login');
      }, 2000);
      return;
    }

    if (!formData.description.trim()) {
      setErrors({ description: t('application.form.descriptionRequired') });
      return;
    }

    if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
      setErrors({ description: `Описание слишком длинное (максимум ${MAX_DESCRIPTION_LENGTH} символов)` });
      return;
    }

    if (!formData.latitude || !formData.longitude) {
      setErrors({ location: t('application.form.locationRequired') });
      return;
    }

    // Проверка обязательных медиафайлов
    if (mediaFiles.length === 0) {
      setErrors({ media: 'Необходимо приложить хотя бы один медиафайл в качестве доказательства' });
      return;
    }

    setLoading(true);
    try {
      // Создаем FormData для отправки файлов
      const formDataToSend = new FormData();
      formDataToSend.append('description', formData.description);
      formDataToSend.append('category', formData.category);
      formDataToSend.append('latitude', formData.latitude.toString());
      formDataToSend.append('longitude', formData.longitude.toString());
      formDataToSend.append('expires_days', formData.expires_days.toString());

      mediaFiles.forEach((file) => {
        formDataToSend.append('media_files', file);
      });

      if (verificationDocument) {
        formDataToSend.append('verification_document', verificationDocument);
      }

      const response = await fetch('http://localhost:5000/api/applications', {
        method: 'POST',
        credentials: 'include',
        body: formDataToSend,
      });

      if (response.status === 413) {
        setErrors({ submit: 'Размер загружаемых файлов слишком большой. Пожалуйста, уменьшите размер файлов или загрузите меньше файлов.' });
        setLoading(false);
        return;
      }

      const result = await response.json();

      if (response.ok && result.success) {
        console.log('Заявка успешно создана, ID:', result.application_id);
        setShouldRefreshApplications(true);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('shouldRefreshApplications', 'true');
          sessionStorage.setItem('lastApplicationId', String(result.application_id || ''));
          window.dispatchEvent(new Event('applications-updated'));
        }
        setTimeout(() => {
          router.push('/');
        }, 500);
      } else {
        if (result.blocked && result.blocked_until) {
          const blockedUntil = new Date(result.blocked_until);
          const dateStr = blockedUntil.toLocaleDateString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });

          let message = `Вы не можете создавать заявки до ${dateStr}`;
          if (result.blocked_reason) {
            message += `. Причина: ${result.blocked_reason}`;
          }

          setBlockedInfo({
            blocked_until: result.blocked_until,
            blocked_reason: result.blocked_reason
          });
          setErrors({ submit: message });
        } else if (response.status === 401 ||
          result.error?.toLowerCase().includes('войти') ||
          result.error?.toLowerCase().includes('login') ||
          result.error?.toLowerCase().includes('authenticated')) {
          setErrors({ submit: 'Вам нужно войти в аккаунт прежде чем создать заявку' });
          setTimeout(() => {
            router.push('/login');
          }, 2000);
        } else {
          setErrors({ submit: result.error || result.message || t('application.form.submitError') });
        }
      }
    } catch (error) {
      setErrors({ submit: t('application.form.submitError') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="card mb-8">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-blue-50 p-3 rounded-md border border-blue-200">
              <FileText className="w-8 h-8 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-blue-700">{t('application.form.title')}</h1>
              <p className="text-gray-600 mt-1 text-sm">{t('application.form.subtitle')}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Search className="w-5 h-5 mr-2 text-blue-600" />
                Выберите город
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={citySearch}
                  onChange={(e) => setCitySearch(e.target.value)}
                  onFocus={() => citySuggestions.length > 0 && setShowCitySuggestions(true)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all bg-white"
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

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-blue-600" />
                {t('application.form.selectLocation')}
              </label>
              <div
                className="border border-gray-300 rounded-md overflow-hidden shadow-sm w-full relative"
                style={{ height: '450px', position: 'relative', isolation: 'isolate' }}
              >
                <div
                  className="w-full h-full relative overflow-hidden"
                  style={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    maxWidth: '100%',
                    overflow: 'hidden'
                  }}
                >
                  <MapComponent
                    center={[formData.latitude, formData.longitude]}
                    onLocationSelect={(lat, lng) => {
                      setFormData({ ...formData, latitude: lat, longitude: lng });
                      fetchAddress(lat, lng);
                    }}
                  />
                </div>
              </div>
              {errors.location && (
                <p className="mt-2 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.location}
                </p>
              )}
              <p className="mt-3 text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
                <strong>{t('application.form.selected')}:</strong> {formData.address || `${formData.latitude.toFixed(6)}, ${formData.longitude.toFixed(6)}`}
              </p>
            </div>

            <div>
              <label htmlFor="category" className="block text-sm font-semibold text-gray-700 mb-3">
                {t('application.form.category')}
              </label>
              <select
                id="category"
                value={formData.category}
                onChange={(e) => {
                  const category = e.target.value;
                  setFormData({ ...formData, category });
                  setIsResourcePoint(['food', 'medicine', 'shelter'].includes(category));
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all bg-white"
                required
              >
                <option value="food">{t('categories.food')}</option>
                <option value="medicine">{t('categories.medicine')}</option>
                <option value="shelter">{t('categories.shelter')}</option>
                <option value="emergency">{t('categories.emergency')}</option>
              </select>
            </div>

            {/* Специальная форма для точек ресурсов */}
            {isResourcePoint && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">
                  Подтверждение точки ресурсов
                </h3>
                <p className="text-sm text-blue-700 mb-4">
                  Для категорий "Продукты", "Медицина" и "Убежище" необходимо подтвердить,
                  что по указанному адресу действительно зарегистрирована точка выдачи ресурсов.
                </p>
                <div>
                  <label htmlFor="verification_document" className="block text-sm font-semibold text-gray-700 mb-3">
                    Документ подтверждения (опционально)
                  </label>
                  <div className="space-y-3">
                    <div className="border-2 border-dashed border-blue-300 rounded-lg p-4 hover:border-blue-500 transition-colors">
                      <input
                        type="file"
                        id="verification_document"
                        accept=".pdf"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.type !== 'application/pdf' && !file.name.endsWith('.pdf')) {
                              setErrors({ verification: 'Разрешены только PDF файлы' });
                              return;
                            }
                            setVerificationDocument(file);
                            const newErrors = { ...errors };
                            delete newErrors.verification;
                            setErrors(newErrors);
                            // Для PDF не создаем превью, просто показываем имя файла
                          }
                        }}
                        className="hidden"
                      />
                      <label
                        htmlFor="verification_document"
                        className="cursor-pointer flex flex-col items-center justify-center text-center"
                      >
                        <FileText className="w-8 h-8 text-blue-400 mb-2" />
                        <span className="text-sm font-medium text-gray-700">
                          Загрузить PDF документ
                        </span>
                        <span className="text-xs text-gray-500 mt-1">
                          Документ, подтверждающий владение/регистрацию точки
                        </span>
                      </label>
                    </div>
                    {verificationDocument && (
                      <div className="flex items-center justify-between p-3 bg-white rounded-lg border border-gray-300">
                        <div className="flex items-center space-x-3">
                          <FileText className="w-6 h-6 text-red-500" />
                          <div>
                            <p className="text-sm font-medium">{verificationDocument.name}</p>
                            <p className="text-xs text-gray-500">
                              {(verificationDocument.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setVerificationDocument(null);
                            setVerificationDocumentPreview(null);
                          }}
                          className="text-red-500 hover:text-red-700"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    {errors.verification && (
                      <p className="text-sm text-red-600 flex items-center">
                        <AlertCircle className="w-4 h-4 mr-1" />
                        {errors.verification}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="description" className="block text-sm font-semibold text-gray-700 mb-3">
                {t('application.form.description')}
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= MAX_DESCRIPTION_LENGTH) {
                    setFormData({ ...formData, description: value });
                  }
                }}
                rows={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all resize-none bg-white"
                placeholder={t('application.form.descriptionPlaceholder')}
                required
              />
              <div className="mt-2 flex justify-between items-center text-sm">
                <span className={`${formData.description.length > MAX_DESCRIPTION_LENGTH * 0.9 ? 'text-red-600' : 'text-gray-500'}`}>
                  {formData.description.length} / {MAX_DESCRIPTION_LENGTH} {t('application.form.characters')}
                </span>
                {errors.description && (
                  <span className="text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.description}
                  </span>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="media_files" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <ImageIcon className="w-5 h-5 mr-2 text-blue-600" />
                Медиафайлы <span className="text-red-500 ml-1">*</span>
              </label>
              <div className="space-y-3">
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-blue-500 transition-colors">
                  <input
                    type="file"
                    id="media_files"
                    multiple
                    accept="image/*,.pdf"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      if (files.length > 0) {
                        setMediaFiles(files);
                        // Создаем превью для изображений
                        const previews: string[] = [];
                        files.forEach((file) => {
                          if (file.type.startsWith('image/')) {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                              previews.push(e.target?.result as string);
                              if (previews.length === files.filter(f => f.type.startsWith('image/')).length) {
                                setMediaPreviews(previews);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        });
                        const newErrors = { ...errors };
                        delete newErrors.media;
                        setErrors(newErrors);
                      }
                    }}
                    className="hidden"
                    required
                  />
                  <label
                    htmlFor="media_files"
                    className="cursor-pointer flex flex-col items-center justify-center text-center"
                  >
                    <Upload className="w-10 h-10 text-gray-400 mb-2" />
                    <span className="text-sm font-medium text-gray-700">
                      Нажмите для загрузки файлов
                    </span>
                    <span className="text-xs text-gray-500 mt-1">
                      Изображения или PDF (макс. 50MB каждый)
                    </span>
                  </label>
                </div>
                {mediaFiles.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {mediaFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {file.type.startsWith('image/') && mediaPreviews[index] ? (
                          <img
                            src={mediaPreviews[index]}
                            alt={`Preview ${index + 1}`}
                            className="w-full h-32 object-cover rounded-lg border border-gray-300"
                          />
                        ) : (
                          <div className="w-full h-32 bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center">
                            <FileText className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            const newFiles = mediaFiles.filter((_, i) => i !== index);
                            setMediaFiles(newFiles);
                            if (file.type.startsWith('image/')) {
                              const newPreviews = mediaPreviews.filter((_, i) => i !== index);
                              setMediaPreviews(newPreviews);
                            }
                          }}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <p className="text-xs text-gray-600 mt-1 truncate">{file.name}</p>
                      </div>
                    ))}
                  </div>
                )}
                {errors.media && (
                  <p className="mt-2 text-sm text-red-600 flex items-center">
                    <AlertCircle className="w-4 h-4 mr-1" />
                    {errors.media}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="expires_days" className="block text-sm font-semibold text-gray-700 mb-3 flex items-center">
                <Calendar className="w-5 h-5 mr-2 text-blue-600" />
                {t('application.form.expires')}
              </label>
              <select
                id="expires_days"
                value={formData.expires_days}
                onChange={(e) => setFormData({ ...formData, expires_days: parseInt(e.target.value) })}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all bg-white"
              >
                <option value="3">{t('application.form.days3')}</option>
                <option value="7">{t('application.form.days7')}</option>
                <option value="14">{t('application.form.days14')}</option>
                <option value="30">{t('application.form.days30')}</option>
              </select>
            </div>

            {errors.submit && (
              <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-md flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                {errors.submit}
              </div>
            )}

            {blockedInfo && blockedInfo.blocked_until && (
              <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded-md flex items-start">
                <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold mb-1">Аккаунт заблокирован</p>
                  <p className="text-sm">
                    Вы не можете создавать заявки до {new Date(blockedInfo.blocked_until).toLocaleDateString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {blockedInfo.blocked_reason && `. Причина: ${blockedInfo.blocked_reason}`}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={loading || !!(blockedInfo && blockedInfo.blocked_until)}
                className="flex-1 btn btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>{t('application.form.submitting')}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    <span>{t('application.form.submit')}</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-6 py-3 border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-colors flex items-center space-x-2"
              >
                <X className="w-5 h-5" />
                <span>{t('common.cancel')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
