export interface PasswordValidationResult {
  isValid: boolean; errors: string[]; progress: number; color: 'red' | 'yellow' | 'green';
  strength: 'weak' | 'medium' | 'strong';
}
export function getPasswordStrengthColor(color: PasswordValidationResult['color']) {
  return { red: '#ef4444', yellow: '#f59e0b', green: '#22c55e' }[color];
}
export function validatePassword(password: string): PasswordValidationResult {
  const checks: [boolean, string][] = [
    [password.length >= 8 && password.length <= 128, 'Пароль должен содержать от 8 до 128 символов'],
    [/[A-ZА-ЯЁ]/.test(password), 'Добавьте заглавную букву'],
    [/[a-zа-яё]/.test(password), 'Добавьте строчную букву'],
    [/[0-9]/.test(password), 'Добавьте цифру'],
    [/[!@#$%^&*()_+\-=\[\]{}|;:'",.<>?\/\\~\x60]/.test(password), 'Добавьте специальный символ'],
    [!/(.)\1{2,}|012|123|234|345|456|567|678|789|890|qwerty|asdfgh|zxcvbn|password/i.test(password), 'Пароль содержит слабые паттерны'],
  ];
  const errors = checks.filter(([ok]) => !ok).map(([, message]) => message);
  const progress = Math.round((checks.length - errors.length) / checks.length * 100);
  const strength = errors.length === 0 ? 'strong' : progress >= 50 ? 'medium' : 'weak';
  return { isValid: errors.length === 0, errors, progress, strength, color: strength === 'strong' ? 'green' : strength === 'medium' ? 'yellow' : 'red' };
}

