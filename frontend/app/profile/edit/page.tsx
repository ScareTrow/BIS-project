'use client';

import { useStore } from '@/lib/store';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, User } from '@/lib/api';
import { Edit, User as UserIcon, Save, X, Instagram, MessageCircle } from 'lucide-react';
import Link from 'next/link';
import { getCityByName, kazakhstanCities } from '@/lib/kazakhstanCities';
import { completePhone, nationalPhoneDigits } from '@/lib/phone';
import { formatKzPhone } from '@/lib/phoneFormat';
import { Select } from '@/components/ui/Select';
import { Input } from '@/components/ui/Input';
import { useTranslation } from '@/lib/i18n';

export default function EditProfilePage() {
  const router = useRouter();
  const t = useTranslation(useStore(state => state.language));
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
    phone: '',
  });
  const [phoneChanged, setPhoneChanged] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<string | null>(null);
  const [nameChangesRemaining, setNameChangesRemaining] = useState<number | null>(null);
  useEffect(() => {
    void loadProfile();
  }, []);

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
      
      const userCity = getCityByName(userData.city || '')?.name || userData.city || '';
      setFormData({
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        city: userCity,
        avatar: null,
        telegram: socialLinks.telegram || '',
        instagram: socialLinks.instagram || '',
        phone: nationalPhoneDigits(socialLinks.phone || ''),
      });
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

    if (phoneChanged && formData.phone.length !== 10) {
      setErrors({ phone: t('profile.phoneError') });
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
      if (phoneChanged) formDataToSend.append('phone', completePhone(formData.phone));
      if (formData.telegram) {
        formDataToSend.append('telegram', formData.telegram);
      }
      if (formData.instagram) {
        formDataToSend.append('instagram', formData.instagram);
      }

      if (formData.avatar) {
        formDataToSend.append('avatar', formData.avatar);
      }

      await apiClient.updateProfile(formDataToSend);
      const refreshed = await apiClient.getSession();
      useStore.getState().setUser({ ...refreshed.user, is_authenticated: true });
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
        <h1 className="text-3xl font-bold text-gray-900">{t('profile.editTitle')}</h1>
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

          <Select label={t('home.city')} value={formData.city} onChange={city => setFormData(current => ({ ...current, city }))}
            options={[{ value: '', label: t('common.notSpecified') },
              ...(formData.city && !getCityByName(formData.city) ? [{ value: formData.city, label: formData.city }] : []),
              ...kazakhstanCities.map(city => ({ value: city.name, label: city.name }))]} />
          <Input id="profile-phone" label={t('profile.phone')} error={errors.phone} type="tel"
            autoComplete="tel-national" inputMode="numeric" placeholder="(700) 000-00-00" hint={t('signup.phoneHint')}
            value={formatKzPhone(formData.phone)}
            onChange={event => {
              const typed = event.target.value;
              const digits = nationalPhoneDigits(typed);
              const phone = typed.length < formatKzPhone(formData.phone).length && digits === formData.phone
                ? formData.phone.slice(0, -1) : digits;
              setPhoneChanged(true);
              setFormData(current => ({ ...current, phone }));
            }} />

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
              <span>{t('ui.cancel')}</span>
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

