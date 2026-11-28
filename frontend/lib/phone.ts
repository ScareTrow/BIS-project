export function nationalPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '');
  return (digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits).slice(0, 10);
}

/** Ten national digits from the masked signup field, e.g. "+7 (701) 987-65-43". */
export function maskedPhoneDigits(value: string): string {
  const national = value.startsWith('+7') ? value.slice(2).trimStart() : value;
  return value === '+' ? '' : nationalPhoneDigits(national);
}

export function completePhone(digits: string): string {
  return '+7' + digits;
}
