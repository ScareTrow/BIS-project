export function validateRequestPhotos(photos: File[]): string | null {
  if (photos.length < 1 || photos.length > 3) return 'Приложите от 1 до 3 фотографий JPEG/PNG';
  for (const photo of photos) {
    if (photo.size === 0) return 'Файл пуст';
    if (photo.size > 10 * 1024 * 1024) return 'Файл слишком большой (максимум 10 МБ)';
    if (!/\.(jpe?g|png)$/i.test(photo.name) || (photo.type && !['image/jpeg', 'image/png'].includes(photo.type))) {
      return 'Поддерживаются только JPEG и PNG';
    }
  }
  return null;
}
