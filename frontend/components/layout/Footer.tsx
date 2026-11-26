'use client';

import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export default function Footer() {
  const t = useTranslation(useStore(state => state.language));
  return <footer className="mt-8 border-t border-gray-200 bg-white">
    <p className="container mx-auto px-4 py-4 text-sm text-gray-600">© 2026 ASAR.kz — {t('footer.description')}</p>
  </footer>;
}
