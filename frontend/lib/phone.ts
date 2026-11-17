export function nationalPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return (digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits).slice(0, 10);
}

export function completePhone(digits: string): string {
  return '+7' + digits;
}
