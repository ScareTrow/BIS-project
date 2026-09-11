'use client';

import CursorEffect from '@/components/home/CursorEffect';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { CityData, searchKazakhstanCities } from '@/lib/kazakhstanCities';
import { getPasswordStrengthColor, PasswordValidationResult, validatePassword } from '@/lib/passwordValidation';
import { useStore } from '@/lib/store';
import { CheckCircle2, Eye, EyeOff, Lock, Mail, MapPin, MessageCircle, Phone, User, UserPlus, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { useEffect, useState } from 'react';

const ProgressBarLogger = ({ validation }: { validation: PasswordValidationResult }) => {
  useEffect(() => {
    // #region agent log
    const logData = {
      location: 'sign-up/page.tsx:ProgressBarLogger',
      message: 'Rendering progress bar',
      data: {
        progress: validation.progress,
        color: validation.color,
        strength: validation.strength,
        width: `${Math.max(0, Math.min(100, validation.progress))}%`
      },
      timestamp: Date.now(),
      sessionId: 'debug-session',
      runId: 'run1',
      hypothesisId: 'D'
    };
    fetch('http://127.0.0.1:7242/ingest/f28ac3a7-4b67-4e31-94dc-2caa9d98ba71', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logData)
    }).catch(() => { });
    // #endregion
  }, [validation.progress, validation.color]);
  return null;
};

export default function SignUpPage(): JSX.Element {

  const router = useRouter();
  const { setUser, language } = useStore();
  const t = useTranslation(language);
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password1: '',
    password2: '',
    phone: '',
    city: '',
    cityHidden: false,
    telegram_id: '',
  });
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(false);
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState<ReturnType<typeof validatePassword> | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<CityData[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);

  // Функция для проверки выполнения требований к паролю
  const checkPasswordRequirements = (password: string) => {
    const hasMinLength = password.length >= 8;
    const hasUpperCase = /[A-ZА-ЯЁ]/.test(password);
    const hasLowerCase = /[a-zа-яё]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    const hasSpecialChars = /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?\/\\~`]/.test(password);

    return {
      hasMinLength,
      hasUpperCase,
      hasLowerCase,
      hasNumbers,
      hasSpecialChars
    };
  };

  const handlePasswordChange = (password: string) => {
    setFormData({ ...formData, password1: password });
    if (password) {
      const validation = validatePassword(password);
      // #region agent log
      const hasUpper = /[A-ZА-ЯЁ]/.test(password) ? 1 : 0;
      const hasLower = /[a-zа-яё]/.test(password) ? 1 : 0;
      const hasNumber = /[0-9]/.test(password) ? 1 : 0;
      const specialRegex = /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?\/\\~`]/;
      const hasSpecial = specialRegex.test(password) ? 1 : 0;
      const criticalCount = hasUpper + hasLower + hasNumber + hasSpecial;
      const logData = {
        location: 'sign-up/page.tsx:handlePasswordChange',
        message: 'Password validation result',
        data: {
          passwordLength: password.length,
          progress: validation.progress,
          color: validation.color,
          strength: validation.strength,
          criticalCount,
          errors: validation.errors
        },
        timestamp: Date.now(),
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'A'
      };
      fetch('http://127.0.0.1:7242/ingest/f28ac3a7-4b67-4e31-94dc-2caa9d98ba71', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logData)
      }).catch(() => { });
      // #endregion
      setPasswordValidation(validation);
    } else {
      setPasswordValidation(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { [key: string]: string } = {};

    // Валидация всех полей
    if (!formData.email || formData.email.trim() === '') {
      newErrors.email = 'Пожалуйста, заполните поле Email';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Пожалуйста, введите корректный Email адрес';
    }

    if (!formData.firstName || formData.firstName.trim() === '') {
      newErrors.firstName = 'Пожалуйста, заполните поле Имя';
    }

    if (!formData.city || formData.city.trim() === '') {
      newErrors.city = 'Пожалуйста, укажите город проживания';
    }

    if (!formData.phone || formData.phone.trim() === '') {
      newErrors.phone = 'Номер телефона обязателен';
    } else {
      // Простая валидация формата телефона
      const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;
      const cleanPhone = formData.phone.replace(/\s|-|\(|\)/g, '');
      if (!phoneRegex.test(cleanPhone)) {
        newErrors.phone = 'Введите корректный номер телефона';
      }
    }

    if (!formData.password1 || formData.password1.trim() === '') {
      newErrors.password1 = 'Пожалуйста, заполните поле Пароль';
    } else {
      const validation = validatePassword(formData.password1);
      if (!validation.isValid) {
        newErrors.password1 = validation.errors[0] || 'Пароль не соответствует требованиям';
      }
    }

    if (!formData.password2 || formData.password2.trim() === '') {
      newErrors.password2 = 'Пожалуйста, заполните поле Подтвердите пароль';
    } else if (formData.password1 !== formData.password2) {
      newErrors.password2 = 'Пароли не совпадают';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      // Прокрутка к первому полю с ошибкой
      const firstErrorField = Object.keys(newErrors)[0];
      const element = document.getElementById(firstErrorField);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        element.focus();
      }
      return;
    }

    setLoading(true);

    try {
      const response = await apiClient.signup({
        email: formData.email,
        firstName: formData.firstName,
        lastName: formData.lastName,
        password1: formData.password1,
        password2: formData.password2,
        phone: formData.phone,
        city: formData.city,
        cityHidden: formData.cityHidden,
        telegram_id: formData.telegram_id || undefined,
      });

      if (response.success) {
        setUser({
          id: response.user.id,
          email: response.user.email,
          first_name: response.user.first_name,
          last_name: response.user.last_name,
          isAdmin: response.user.isAdmin,
          is_authenticated: true,
        });
        router.push('/profile');
      } else {
        setErrors({ submit: response.message || t('alerts.registrationError') });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || t('alerts.registrationErrorDetail') });
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
                {t('auth.signup.title') || 'Регистрация'}
              </h2>
              <p className="text-sm text-gray-600">
                {t('auth.signup.subtitle') || 'Уже есть аккаунт?'}{' '}
                <Link href="/login" className="font-medium text-blue-600 hover:text-blue-700 transition-colors">
                  {t('auth.signup.loginLink') || 'Войдите'}
                </Link>
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {errors.submit && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 animate-fade-in">
                  <div className="text-sm text-red-800">{errors.submit}</div>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.signup.email') || 'Email'}
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
                      suppressHydrationWarning
                      required
                      className={`block w-full pl-12 pr-4 py-3 border ${errors.email ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        } rounded-lg focus:ring-2 transition-all bg-white text-gray-900 placeholder-gray-400`}
                      placeholder={t('auth.signup.email') || 'Email адрес'}
                      value={formData.email}
                      onChange={(e) => {
                        setFormData({ ...formData, email: e.target.value });
                        if (errors.email) {
                          setErrors({ ...errors, email: '' });
                        }
                      }}
                    />
                  </div>
                  {errors.email && (
                    <div className="mt-1.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 animate-fade-in">
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{errors.email}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.signup.firstName') || 'Имя'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="firstName"
                      name="firstName"
                      type="text"
                      autoComplete="given-name"
                      suppressHydrationWarning
                      required
                      className={`block w-full pl-12 pr-4 py-3 border ${errors.firstName ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        } rounded-lg focus:ring-2 transition-all bg-white text-gray-900 placeholder-gray-400`}
                      placeholder={t('auth.signup.firstName') || 'Имя'}
                      value={formData.firstName}
                      onChange={(e) => {
                        setFormData({ ...formData, firstName: e.target.value });
                        if (errors.firstName) {
                          setErrors({ ...errors, firstName: '' });
                        }
                      }}
                    />
                  </div>
                  {errors.firstName && (
                    <div className="mt-1.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 animate-fade-in">
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{errors.firstName}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.signup.lastName') || 'Фамилия'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="lastName"
                      name="lastName"
                      type="text"
                      autoComplete="family-name"
                      suppressHydrationWarning
                      className="block w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900 placeholder-gray-400"
                      placeholder={t('auth.signup.lastName') || 'Фамилия (необязательно)'}
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                    Номер телефона *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Phone className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="phone"
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      suppressHydrationWarning
                      required
                      className={`block w-full pl-12 pr-4 py-3 border ${errors.phone ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        } rounded-lg focus:ring-2 transition-all bg-white text-gray-900 placeholder-gray-400`}
                      placeholder="+7 (XXX) XXX-XX-XX"
                      value={formData.phone}
                      onChange={(e) => {
                        setFormData({ ...formData, phone: e.target.value });
                        if (errors.phone) {
                          setErrors({ ...errors, phone: '' });
                        }
                      }}
                    />
                  </div>
                  {errors.phone && (
                    <div className="mt-1.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 animate-fade-in">
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{errors.phone}</p>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-2">
                    Город проживания *
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <MapPin className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="city"
                      name="city"
                      type="text"
                      autoComplete="off"
                      suppressHydrationWarning
                      required
                      className={`block w-full pl-12 pr-4 py-3 border ${errors.city ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        } rounded-lg focus:ring-2 transition-all bg-white text-gray-900 placeholder-gray-400`}
                      placeholder="Начните вводить название города..."
                      value={formData.city}
                      onChange={(e) => {
                        const value = e.target.value;
                        setFormData({ ...formData, city: value });
                        if (errors.city) {
                          setErrors({ ...errors, city: '' });
                        }
                        if (value.length > 0) {
                          const suggestions = searchKazakhstanCities(value);
                          setCitySuggestions(suggestions);
                          setShowCitySuggestions(true);
                        } else {
                          setCitySuggestions([]);
                          setShowCitySuggestions(false);
                        }
                      }}
                      onBlur={() => {
                        // Delay hiding suggestions to allow clicking on them
                        setTimeout(() => setShowCitySuggestions(false), 200);
                      }}
                      onFocus={() => {
                        if (formData.city.length > 0) {
                          const suggestions = searchKazakhstanCities(formData.city);
                          setCitySuggestions(suggestions);
                          setShowCitySuggestions(true);
                        }
                      }}
                    />
                    {showCitySuggestions && citySuggestions.length > 0 && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto">
                        {citySuggestions.map((city, index) => (
                          <button
                            key={index}
                            type="button"
                            className="w-full text-left px-4 py-2 hover:bg-blue-50 focus:bg-blue-50 focus:outline-none transition-colors"
                            onClick={() => {
                              setFormData({ ...formData, city: city.name });
                              setCitySuggestions([]);
                              setShowCitySuggestions(false);
                            }}
                          >
                            <div className="font-medium text-gray-900">{city.name}</div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {errors.city && (
                    <div className="mt-1.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 animate-fade-in">
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{errors.city}</p>
                    </div>
                  )}
                  <small className="text-xs text-gray-500 mt-1 block">
                    Начните вводить название города для поиска
                  </small>
                </div>

                <div className="flex items-start">
                  <div className="flex items-center h-5">
                    <input
                      id="cityHidden"
                      name="cityHidden"
                      type="checkbox"
                      checked={formData.cityHidden}
                      onChange={(e) => setFormData({ ...formData, cityHidden: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                  </div>
                  <div className="ml-3 text-sm">
                    <label htmlFor="cityHidden" className="font-medium text-gray-700">
                      Скрыть город от других пользователей
                    </label>
                    <p className="text-gray-500">Ваш город не будет отображаться в вашем профиле</p>
                  </div>
                </div>

                <div>
                  <label htmlFor="telegram_id" className="block text-sm font-medium text-gray-700 mb-2">
                    Telegram ID (необязательно)
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <MessageCircle className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="telegram_id"
                      name="telegram_id"
                      type="text"
                      suppressHydrationWarning
                      className="block w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900 placeholder-gray-400"
                      placeholder="Получите ваш Telegram ID в боте командой /start"
                      value={formData.telegram_id}
                      onChange={(e) => setFormData({ ...formData, telegram_id: e.target.value })}
                    />
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Для использования Telegram бота укажите ваш Telegram ID. Получите его в боте командой /start
                  </p>
                </div>

                <div>
                  <label htmlFor="password1" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.signup.password') || 'Пароль'}
                  </label>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password1"
                      name="password1"
                      type={showPassword1 ? 'text' : 'password'}
                      autoComplete="new-password"
                      suppressHydrationWarning
                      required
                      className={`block w-full pl-12 pr-12 py-3 border ${errors.password1 ? 'border-red-300' : passwordValidation?.isValid ? 'border-green-300' : 'border-gray-300'
                        } rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white text-gray-900 placeholder-gray-400`}
                      placeholder="Минимум 8 символов: заглавные, строчные, цифры, спецсимволы"
                      value={formData.password1}
                      onChange={(e) => handlePasswordChange(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword1(!showPassword1)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword1 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>

                  {passwordValidation && (
                    <div className="mt-2 space-y-2">
                      <ProgressBarLogger validation={passwordValidation} />
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500 ease-out"
                          style={{
                            width: `${Math.max(0, Math.min(100, passwordValidation.progress))}%`,
                            backgroundColor: getPasswordStrengthColor(passwordValidation.color),
                            minWidth: passwordValidation.progress > 0 ? '4px' : '0'
                          }}
                        />
                      </div>

                      {/* Красный (слабый пароль) - максимум ~33% */}
                      {passwordValidation.color === 'red' && (
                        <div className="text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-200 flex items-center gap-2">
                          <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                          <span className="font-medium">{t('auth.signup.passwordStrength.weak') || 'Пароль слабый'}</span>
                        </div>
                      )}

                      {/* Желтый (средний пароль) - 50-75% */}
                      {passwordValidation.color === 'yellow' && passwordValidation.errors.length > 0 && (
                        <div className="text-xs text-yellow-800 bg-yellow-50 p-2.5 rounded-lg border border-yellow-200">
                          <div className="font-medium mb-1.5 text-yellow-900">{t('auth.signup.passwordStrength.medium') || 'Как усложнить пароль:'}</div>
                          <div className="space-y-1">
                            {passwordValidation.errors.map((error, idx) => (
                              <div key={idx} className="flex items-start gap-1.5">
                                <span className="text-yellow-600 mt-0.5">•</span>
                                <span>{error}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Зеленый (сильный пароль) - 100% */}
                      {passwordValidation.color === 'green' && passwordValidation.isValid && (
                        <div className="text-xs text-green-700 bg-green-50 p-2.5 rounded-lg border border-green-200 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-500" />
                          <span className="font-medium">{t('auth.signup.passwordStrength.strong') || 'Отлично'}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {errors.password1 && !passwordValidation && (
                    <div className="mt-1.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 animate-fade-in">
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{errors.password1}</p>
                    </div>
                  )}
                </div>

                {/* Блок с требованиями - показывается после первого ввода пароля и перед подтверждением */}
                {passwordValidation && formData.password1.length > 0 && (() => {
                  const requirements = checkPasswordRequirements(formData.password1);
                  return (
                    <div className="mb-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-xs font-semibold text-blue-900 mb-2">{t('auth.signup.passwordRequirements.title') || 'Требования к паролю:'}</div>
                      <div className="space-y-1.5 text-xs text-blue-800">
                        <div className="flex items-start gap-2">
                          {requirements.hasMinLength ? (
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500 mt-0.5" />
                          )}
                          <span className={requirements.hasMinLength ? 'text-green-700' : ''}>{t('auth.signup.passwordRequirements.minLength') || 'Минимум 8 символов'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          {requirements.hasUpperCase ? (
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500 mt-0.5" />
                          )}
                          <span className={requirements.hasUpperCase ? 'text-green-700' : ''}>{t('auth.signup.passwordRequirements.uppercase') || 'Хотя бы одна заглавная буква'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          {requirements.hasLowerCase ? (
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500 mt-0.5" />
                          )}
                          <span className={requirements.hasLowerCase ? 'text-green-700' : ''}>{t('auth.signup.passwordRequirements.lowercase') || 'Хотя бы одна строчная буква'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          {requirements.hasNumbers ? (
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500 mt-0.5" />
                          )}
                          <span className={requirements.hasNumbers ? 'text-green-700' : ''}>{t('auth.signup.passwordRequirements.number') || 'Хотя бы одна цифра'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          {requirements.hasSpecialChars ? (
                            <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-600 mt-0.5" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-500 mt-0.5" />
                          )}
                          <span className={requirements.hasSpecialChars ? 'text-green-700' : ''}>{t('auth.signup.passwordRequirements.special') || 'Хотя бы один специальный символ (!@#$%^&*()_+-=[]{}|;:,.<>?)'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <label htmlFor="password2" className="block text-sm font-medium text-gray-700 mb-2">
                    {t('auth.signup.confirmPassword') || 'Подтвердите пароль'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      id="password2"
                      name="password2"
                      type={showPassword2 ? 'text' : 'password'}
                      autoComplete="new-password"
                      suppressHydrationWarning
                      required
                      className={`block w-full pl-12 pr-12 py-3 border ${errors.password2 ? 'border-red-300 focus:border-red-500 focus:ring-red-500' : formData.password2 && formData.password1 === formData.password2 ? 'border-green-300 focus:border-green-500' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                        } rounded-lg focus:ring-2 transition-all bg-white text-gray-900 placeholder-gray-400`}
                      placeholder={t('auth.signup.confirmPassword') || 'Подтвердите пароль'}
                      value={formData.password2}
                      onChange={(e) => {
                        setFormData({ ...formData, password2: e.target.value });
                        if (errors.password2) {
                          setErrors({ ...errors, password2: '' });
                        }
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword2(!showPassword2)}
                      className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPassword2 ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {formData.password2 && formData.password1 === formData.password2 && !errors.password2 && (
                    <div className="mt-1 text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Пароли совпадают</span>
                    </div>
                  )}
                  {errors.password2 && (
                    <div className="mt-1.5 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-2.5 animate-fade-in">
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-red-700">{errors.password2}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={loading || !passwordValidation?.isValid}
                  className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  {loading ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <div className="flex items-center">
                      <UserPlus className="h-5 w-5 mr-2" />
                      {t('auth.signup.submit') || 'Зарегистрироваться'}
                    </div>
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
