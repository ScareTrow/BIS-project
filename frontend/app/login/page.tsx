'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';
import CursorEffect from '@/components/home/CursorEffect';
import { Mail, Lock, LogIn, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { setUser, language } = useStore();
  const t = useTranslation(language);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);

    try {
      const response = await apiClient.login(formData.email, formData.password);
      
      if (response.success) {
        setUser({
          id: response.user.id,
          email: response.user.email,
          first_name: response.user.first_name,
          last_name: response.user.last_name,
          isAdmin: response.user.isAdmin,
          is_authenticated: true,
        });
        if (response.user.isAdmin) {
          router.push('/admin');
        } else {
          router.push('/');
        }
      } else {
        setErrors({ submit: response.message || t('alerts.loginError') });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || t('alerts.loginErrorDetail') });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <CursorEffect>
        <div className="max-w-md w-full space-y-8 relative z-10">
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                {t('auth.login.title') || 'Вход в систему'}
              </h2>
              <p className="text-sm text-gray-600">
                {t('auth.login.subtitle') || 'Или'}{' '}
                <Link href="/sign-up" className="font-medium text-blue-600 hover:text-blue-700 transition-colors">
                  {t('auth.login.signupLink') || 'зарегистрируйтесь'}
                </Link>
              </p>
            </div>

            <form className="space-y-6" onSubmit={handleSubmit}>
              {errors.submit && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 animate-fade-in">
                  <div className="text-sm text-red-800">{errors.submit}</div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.login.email') || 'Email'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="block w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900 placeholder-gray-400"
                      placeholder={t('auth.login.email') || 'Email адрес'}
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.login.password') || 'Пароль'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      required
                      className="block w-full pl-12 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900 placeholder-gray-400"
                      placeholder={t('auth.login.password') || 'Пароль'}
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <>
                      <LogIn className="h-5 w-5 mr-2" />
                      {t('auth.login.submit') || 'Войти'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </CursorEffect>
    </div>
  );
}
