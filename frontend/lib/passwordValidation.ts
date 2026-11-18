export interface PasswordValidationResult {
  isValid: boolean; errors: string[]; progress: number; color: 'red' | 'yellow' | 'green';
  strength: 'weak' | 'medium' | 'strong';
}
export function getPasswordStrengthColor(color: PasswordValidationResult['color']) {
  return { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' }[color];
}
export function passwordRequirements(password: string) {
  return {
    hasMinLength: password.length >= 8 && password.length <= 128,
    hasUpperCase: /[A-ZА-ЯЁ]/.test(password),
    hasLowerCase: /[a-zа-яё]/.test(password),
    hasNumbers: /[0-9]/.test(password),
    hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?\/\\~\x60]/.test(password),
  };
}
export function validatePassword(password: string): PasswordValidationResult {
  const checks = passwordRequirements(password);
  const met = Object.values(checks).filter(Boolean).length;
  const errors: string[] = [];
  if (!checks.hasMinLength) errors.push('Пароль должен содержать от 8 до 128 символов');
  if (met < 3) errors.push('Выполните минимум 3 условия: длина и любые два вида символов');
  if (/(.)\1{2,}|012|123|234|345|456|567|678|789|890|qwerty|asdfgh|zxcvbn|password/i.test(password)) errors.push('Пароль содержит слабые паттерны');
  const progress = Math.round(met / 5 * 100);
  const strength = errors.length ? 'weak' : met === 5 ? 'strong' : 'medium';
  return { isValid: errors.length === 0, errors, progress, strength, color: strength === 'strong' ? 'green' : strength === 'medium' ? 'yellow' : 'red' };
}
