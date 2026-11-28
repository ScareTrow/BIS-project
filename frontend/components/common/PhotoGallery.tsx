'use client';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export type GalleryPhoto = { src: string; alt: string };

/** Thumbnails that open the full photo in a modal on the same page instead of a new tab. */
export default function PhotoGallery({ photos, className = 'flex flex-wrap gap-2', thumbClassName = 'h-16 w-16 rounded border object-cover' }: {
  photos: GalleryPhoto[];
  className?: string;
  thumbClassName?: string;
}) {
  const t = useTranslation(useStore(state => state.language));
  const [index, setIndex] = useState<number | null>(null);
  if (!photos.length) return null;
  return <>
    <div className={className}>
      {photos.map((photo, position) => <button key={photo.src} type="button" onClick={() => setIndex(position)}
        aria-label={t('photo.open', { number: position + 1 })}
        className="cursor-zoom-in rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
        <img src={photo.src} alt={photo.alt} className={thumbClassName} />
      </button>)}
    </div>
    {index !== null && <PhotoDialog photos={photos} index={index} onIndexChange={setIndex} onClose={() => setIndex(null)} />}
  </>;
}

function PhotoDialog({ photos, index, onIndexChange, onClose }: {
  photos: GalleryPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const t = useTranslation(useStore(state => state.language));
  const dialog = useRef<HTMLDialogElement>(null);
  const many = photos.length > 1;
  const photo = photos[index];
  const step = (delta: number) => onIndexChange((index + delta + photos.length) % photos.length);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (element.showModal) element.showModal();
    else element.open = true;
    return () => {
      if (element.close) element.close();
      else element.open = false;
    };
  }, []);

  return <dialog ref={dialog} aria-label={photo.alt}
    // Esc fires "cancel"; let the parent unmount the dialog instead of the browser closing it.
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (!many) return;
      if (event.key === 'ArrowLeft') step(-1);
      if (event.key === 'ArrowRight') step(1);
    }}
    className="m-auto max-h-none max-w-none bg-transparent p-0 backdrop:bg-black/80">
    <div className="relative flex flex-col items-center gap-3 p-2">
      <img src={photo.src} alt={photo.alt} className="max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-2rem)] rounded-lg object-contain shadow-2xl" />
      <div className="flex items-center gap-3 text-white">
        {many && <button type="button" onClick={() => step(-1)} aria-label={t('photo.previous')}
          className="rounded-full bg-white/15 p-2 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>}
        {many && <span className="min-w-[4rem] text-center text-sm">{t('photo.counter', { number: index + 1, total: photos.length })}</span>}
        {many && <button type="button" onClick={() => step(1)} aria-label={t('photo.next')}
          className="rounded-full bg-white/15 p-2 hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>}
        <button type="button" onClick={onClose} autoFocus
          className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-2 text-sm hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">
          <X className="h-4 w-4" aria-hidden="true" />{t('ui.close')}
        </button>
      </div>
    </div>
  </dialog>;
}
