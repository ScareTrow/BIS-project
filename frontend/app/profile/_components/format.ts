export const categoryLabels: Record<string, string> = {
  food: 'Еда',
  medicine: 'Медицина',
  shelter: 'Убежище',
  emergency: 'Экстренная',
};

export const responseStatusLabels: Record<string, string> = {
  pending: 'Ожидает',
  accepted: 'Принят',
  completed: 'Завершен',
  cancelled: 'Отменен',
};

/** Русское склонение: pluralRu(1, ['оценка','оценки','оценок']) -> 'оценка' */
export function pluralRu(n: number, forms: [string, string, string]): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return forms[2];
  if (last > 1 && last < 5) return forms[1];
  if (last === 1) return forms[0];
  return forms[2];
}

export const formatDate = (value: string | number | Date) =>
  new Date(value).toLocaleDateString('ru-RU');