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
import { useStore } from '@/lib/store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';

export default function SignUpPage() {
  const router = useRouter();
  const { setUser, language } = useStore();
  const t = useTranslation(language);
  const [showPasswords, setShowPasswords] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const { register, control, setValue, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: '', firstName: '', lastName: '', phone: '', city: '', cityHidden: false, password1: '', password2: '' },
  });
  const [city, phone, password, confirmation] = useWatch({ control, name: ['city', 'phone', 'password1', 'password2'] });
  const matchingCities = searchKazakhstanCities(city || '').slice(0, 12);
  const checks = Object.values(passwordRequirements(password)).filter(Boolean).length;
  const validPassword = validatePassword(password).isValid;

  return <div className="mx-auto w-full max-w-lg space-y-6 px-4 py-8">
    <PageHeader title={t('auth.signup.title')} />
    <Card>
      <p className="mb-5 text-sm text-gray-600">
        {t('auth.signup.subtitle')}{' '}
        <Link href="/login" className="text-primary underline">{t('auth.signup.loginLink')}</Link>
      </p>
      <form className="space-y-4" method="post" noValidate onSubmit={handleSubmit(async values => {
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
        <Input id="email" label={t('auth.signup.email')} type="email" autoComplete="email"
          error={errors.email?.message} {...register('email', {
            validate: value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || t('signup.validEmail'),
          })} />
        <Input id="firstName" label={t('auth.signup.firstName')} autoComplete="given-name"
          error={errors.firstName?.message} {...register('firstName', { validate: value => !!value.trim() || t('signup.required') })} />
        <Input id="lastName" label={t('auth.signup.lastName')} autoComplete="family-name" {...register('lastName')} />
        <Input id="phone" label={t('signup.phone')} type="tel" inputMode="numeric"
          autoComplete="tel-national" hint={t('signup.phoneHint')} error={errors.phone?.message}
          {...register('phone', { validate: value => /^\d{10}$/.test(value) || t('signup.phoneHint') })}
          value={phone} onChange={event => setValue('phone', nationalPhoneDigits(event.target.value), { shouldValidate: !!errors.phone })} />
        <Input id="city" label={t('signup.city')} autoComplete="address-level2" list="signup-cities"
          error={errors.city?.message} {...register('city', { validate: value => !!value.trim() || t('signup.required') })} />
        <datalist id="signup-cities">{matchingCities.map(item => <option key={item.name} value={item.name} />)}</datalist>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" className="form-checkbox" {...register('cityHidden')} />{t('signup.hideCity')}
        </label>
        <Input id="password1" label={t('auth.signup.password')} type={showPasswords ? 'text' : 'password'}
          autoComplete="new-password" error={errors.password1?.message} hint={t('signup.passwordHint')}
          {...register('password1', { validate: value => validatePassword(value).isValid || t('signup.passwordHint') })} />
        {password && <p className="text-sm text-gray-600" role="status">{t('signup.passwordChecks', { count: checks })}</p>}
        <Input id="password2" label={t('auth.signup.confirmPassword')} type={showPasswords ? 'text' : 'password'}
          autoComplete="new-password" error={errors.password2?.message}
          {...register('password2', { validate: value => (!!value && value === password) || t('signup.passwordMismatch') })} />
        <Button size="sm" variant="ghost" onClick={() => setShowPasswords(current => !current)} aria-pressed={showPasswords}>
          {t(showPasswords ? 'signup.hidePasswords' : 'signup.showPasswords')}
        </Button>
        <ActionFeedback message={submitError} error />
        <Button type="submit" className="w-full" busy={isSubmitting} disabled={!validPassword || password !== confirmation}>
          {t('auth.signup.submit')}
        </Button>
      </form>
    </Card>
  </div>;
}
