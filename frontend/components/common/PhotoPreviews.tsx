'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export default function PhotoPreviews({ photos, onRemove }: { photos: File[]; onRemove?: (index: number) => void }) {
  const [urls, setUrls] = useState<string[]>([]);
  const t = useTranslation(useStore(state => state.language));

  useEffect(() => {
    if (!URL.createObjectURL) return;
    const previews = photos.map(photo => URL.createObjectURL(photo));
    setUrls(previews);
    return () => { previews.forEach(url => URL.revokeObjectURL(url)); };
  }, [photos]);

  if (!photos.length) return null;
  return <ul className="grid gap-2 sm:grid-cols-3">
    {photos.map((photo, index) => <li key={photo.name + ':' + index} className="min-w-0 space-y-2 rounded-md border p-2">
      {urls[index] && <img src={urls[index]} alt="" className="h-24 w-full rounded object-cover" />}
      <p className="break-all text-sm text-gray-700">{photo.name}</p>
      {onRemove && <Button size="sm" variant="ghost" aria-label={t('request.create.removePhoto', { name: photo.name })}
        onClick={() => onRemove(index)}>{t('request.create.remove')}</Button>}
    </li>)}
  </ul>;
}
