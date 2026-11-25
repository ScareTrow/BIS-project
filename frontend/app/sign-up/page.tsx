'use client';

import { ActionFeedback } from '@/components/ui/ActionFeedback';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { searchKazakhstanCities } from '@/lib/kazakhstanCities';
import { passwordRequirements, validatePassword } from '@/lib/passwordValidation';
import { completePhone, nationalPhoneDigits } from '@/lib/phone';
import { formatKzPhone } from '@/lib/phoneFormat';
import { useStore } from '@/lib/store';
import { Lock, User as UserIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';

const COPY = {
  ru: {
    about: 'О вас',
    account: 'Вход в аккаунт',
    emailPh: 'name@example.com',
    firstNamePh: 'Например, Айдар',
    lastNamePh: 'Например, Сериков',
    cityPh: 'Начните вводить, например, Алматы',
    passwordPh: 'Не менее 8 символов',
    confirmPh: 'Повторите пароль',
    blocked: 'Кнопка станет активной, когда пароль подойдёт и совпадёт в обоих полях.',
  },
  en: {
    about: 'About you',
    account: 'Account details',
    emailPh: 'name@example.com',
    firstNamePh: 'For example, Aidar',
    lastNamePh: 'For example, Serikov',
    cityPh: 'Start typing, for example, Almaty',
    passwordPh: 'At least 8 characters',
    confirmPh: 'Repeat the password',
    blocked: 'The button becomes active when the password is strong enough and matches in both fields.',
  },
};

const SECTION_TONES = {
  blue: 'bg-blue-600 text-white',
  violet: 'bg-indigo-600 text-white',
};

function Section({ icon: Icon, title, tone = 'blue', children }: { icon: LucideIcon; title: string; tone?: keyof typeof SECTION_TONES; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
        <span className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm ${SECTION_TONES[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function SignUpPage() {
  const router = useRouter();
  const { setUser, language } = useStore();
  const t = useTranslation(language);
  const copy = (COPY as Record<string, typeof COPY.ru>)[language as string] ?? COPY.ru;
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { register, control, setValue, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: '', firstName: '', lastName: '', phone: '', city: '', cityHidden: false, password1: '', password2: '' },
  });
  const [city, phone, password, confirmation] = useWatch({ control, name: ['city', 'phone', 'password1', 'password2'] });
  const matchingCities = searchKazakhstanCities(city || '').slice(0, 12);
  const requirements = passwordRequirements(password);
  const totalChecks = Object.keys(requirements).length;
  const checks = Object.values(requirements).filter(Boolean).length;
  const validPassword = validatePassword(password).isValid;
  const blocked = !validPassword || password !== confirmation;
  const barColor = checks >= totalChecks ? 'bg-emerald-500' : checks * 2 >= totalChecks ? 'bg-amber-400' : 'bg-red-400';

  return <div className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden bg-gradient-to-br from-sky-200 via-blue-200 to-blue-300">
    <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 -z-10 h-96 w-96 rounded-full bg-blue-500/45 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -right-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-indigo-400/30 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute right-1/4 top-1/3 -z-10 h-72 w-72 rounded-full bg-sky-400/30 blur-3xl" />
    <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
    <PageHeader title={t('auth.signup.title')} />
    <div className="rounded-2xl shadow-2xl shadow-blue-900/20 ring-1 ring-white/70">
    <Card>
      <p className="mb-6 text-sm text-gray-600">{t('auth.signup.subtitle')}</p>
      <form className="space-y-8" method="post" noValidate onSubmit={handleSubmit(async values => {
        setSubmitError('');
        try {
          const response = await apiClient.signup({ ...values, phone: completePhone(values.phone) });
          if (!response.success) {
            setSubmitError(response.message || t('alerts.registrationError'));
            return;
          }
          setUser({ ...response.user, is_authenticated: true });
          router.push('/profile');
        } catch (error) {
          setSubmitError(error instanceof Error ? error.message : t('alerts.registrationErrorDetail'));
        }
      })}>
        <Section icon={UserIcon} title={copy.about}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input id="firstName" label={t('auth.signup.firstName')} autoComplete="given-name" placeholder={copy.firstNamePh}
              error={errors.firstName?.message} {...register('firstName', { validate: value => !!value.trim() || t('signup.required') })} />
            <Input id="lastName" label={t('auth.signup.lastName')} autoComplete="family-name" placeholder={copy.lastNamePh}
              {...register('lastName')} />
          </div>
          <Input id="phone" label={t('signup.phone')} type="tel" inputMode="numeric"
            autoComplete="tel-national" placeholder="(700) 000-00-00" hint={t('signup.phoneHint')} error={errors.phone?.message}
            {...register('phone', { validate: value => /^\d{10}$/.test(value) || t('signup.phoneHint') })}
            value={formatKzPhone(phone)}
            onChange={event => {
              const typed = event.target.value;
              const digits = nationalPhoneDigits(typed);
              // Стёрли только скобку, пробел или дефис: удаляем последнюю цифру, иначе поле «залипнет».
              const next = typed.length < formatKzPhone(phone).length && digits === phone ? phone.slice(0, -1) : digits;
              setValue('phone', next, { shouldValidate: !!errors.phone });
            }} />
          <Input id="city" label={t('signup.city')} autoComplete="address-level2" list="signup-cities" placeholder={copy.cityPh}
            error={errors.city?.message} {...register('city', { validate: value => !!value.trim() || t('signup.required') })} />
          <datalist id="signup-cities">{matchingCities.map(item => <option key={item.name} value={item.name} />)}</datalist>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" className="form-checkbox" {...register('cityHidden')} />{t('signup.hideCity')}
          </label>
        </Section>

        <div className="border-t border-gray-100 pt-8">
          <Section icon={Lock} title={copy.account} tone="violet">
            <Input id="email" label={t('auth.signup.email')} type="email" autoComplete="email" placeholder={copy.emailPh}
              error={errors.email?.message} {...register('email', {
                validate: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || t('signup.validEmail'),
              })} />
            <Input id="password1" label={t('auth.signup.password')} type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password" placeholder={copy.passwordPh} error={errors.password1?.message} hint={t('signup.passwordHint')}
              {...register('password1', { validate: value => validatePassword(value).isValid || t('signup.passwordHint') })} />
            {password && (
              <div className="space-y-1.5" role="status">
                <div className="flex gap-1" aria-hidden="true">
                  {Array.from({ length: totalChecks }, (_, index) => (
                    <span key={index} className={`h-1.5 flex-1 rounded-full ${index < checks ? barColor : 'bg-gray-200'}`} />
                  ))}
                </div>
                <p className="text-sm text-gray-600">{t('signup.passwordChecks', { count: checks })}</p>
              </div>
            )}
            <Input id="password2" label={t('auth.signup.confirmPassword')} type={showPasswords ? 'text' : 'password'}
              autoComplete="new-password" placeholder={copy.confirmPh} error={errors.password2?.message}
              {...register('password2', { validate: value => (!!value && value === password) || t('signup.passwordMismatch') })} />
            <Button size="sm" variant="ghost" onClick={() => setShowPasswords(current => !current)} aria-pressed={showPasswords}>
              {t(showPasswords ? 'signup.hidePasswords' : 'signup.showPasswords')}
            </Button>
          </Section>
        </div>

        <div className="space-y-3">
          <ActionFeedback message={submitError} error />
          <Button type="submit" className="w-full" busy={isSubmitting} disabled={blocked}>
            {t('auth.signup.submit')}
          </Button>
          {blocked && <p className="text-center text-sm text-gray-500">{copy.blocked}</p>}
          <p className="text-center text-sm">
            <Link href="/login" className="text-primary underline">{t('auth.signup.loginLink')}</Link>
          </p>
        </div>
      </form>
    </Card>
    </div>
    </div>
  </div>;
}