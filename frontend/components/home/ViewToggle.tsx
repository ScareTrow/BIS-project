'use client';

import { Map, List } from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTranslation } from '@/lib/i18n';

export default function ViewToggle() {
  const { viewMode, setViewMode, language } = useStore();
  const t = useTranslation(language);

  return (
    <div className="flex items-center space-x-1 bg-white rounded-md p-1 shadow-sm border border-gray-300">
      <button
        onClick={() => setViewMode('map')}
        className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 text-sm ${
          viewMode === 'map'
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <Map className="w-4 h-4" />
        <span className="font-medium">{t('home.viewMap')}</span>
      </button>
      <button
        onClick={() => setViewMode('list')}
        className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-all duration-200 text-sm ${
          viewMode === 'list'
            ? 'bg-blue-600 text-white'
            : 'text-gray-700 hover:bg-gray-50'
        }`}
      >
        <List className="w-4 h-4" />
        <span className="font-medium">{t('home.viewList')}</span>
      </button>
    </div>
  );
}
