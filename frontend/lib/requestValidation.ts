import { translations } from './i18n';

export function validateRequestPhotos(photos: File[], translate = (key: string) => translations[key]?.[0] || key): string | null {
  if (photos.length < 1 || photos.length > 3) return translate('photo.count');
  for (const photo of photos) {
    if (photo.size === 0) return translate('photo.empty');
    if (photo.size > 10 * 1024 * 1024) return translate('photo.size');
    if (!/\.(jpe?g|jfif|png)$/i.test(photo.name) || (photo.type && !['image/jpeg', 'image/png'].includes(photo.type))) {
      return translate('photo.type');
    }
  }
  return null;
}
