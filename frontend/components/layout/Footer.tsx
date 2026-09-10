'use client';

import { Heart, Mail, Phone } from 'lucide-react';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';

export default function Footer() {
  const { language } = useStore();
  const t = useTranslation(language);

  return (
    <footer className="bg-blue-800 text-white mt-16 border-t border-blue-900">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-xl font-bold mb-4">
              ASAR.kz
            </h3>
            <p className="text-blue-200 text-sm">
              {t('footer.description')}
            </p>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('footer.quickLinks')}</h4>
            <ul className="space-y-2 text-blue-200 text-sm">
              <li><a href="/" className="hover:text-white transition-colors">{t('nav.home')}</a></li>
              <li><a href="/applications" className="hover:text-white transition-colors">{t('nav.applications')}</a></li>
              <li><a href="/about" className="hover:text-white transition-colors">{t('nav.about')}</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-lg font-semibold mb-4">{t('footer.contact')}</h4>
            <div className="space-y-2 text-blue-200 text-sm">
              <p className="flex items-center">
                <Mail className="w-4 h-4 mr-2" />
                support@asar.kz
              </p>
              <p className="flex items-center">
                <Phone className="w-4 h-4 mr-2" />
                +7 (XXX) XXX-XX-XX
              </p>
            </div>
          </div>
        </div>
        <div className="border-t border-blue-700 pt-6 text-center text-blue-200 text-sm">
          <p>© 2025 ASAR.kz - {t('footer.rights')}</p>
        </div>
      </div>
    </footer>
  );
}
