'use client';

import { apiClient, SearchResult } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import { useStore } from '@/lib/store';
import { FileText, MapPin, Search, User, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export default function SearchBar() {
  const { language } = useStore();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const t = useTranslation(language);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setIsOpen(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await apiClient.search(query);
        setResults(data);
        setIsOpen(true);
      } catch (error) {
        console.error('Search error:', error);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  const totalResults = results
    ? (results.applications?.length || 0) +
    (results.users?.length || 0) +
    (results.cities?.length || 0)
    : 0;

  return (
    <div className="relative w-full max-w-2xl" ref={searchRef}>
      <div className="relative">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={t('search.placeholder')}
          className="w-full pl-12 pr-10 py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-all bg-white"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults(null);
              setIsOpen(false);
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {isOpen && query.length >= 2 && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-xl border border-gray-200 max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-gray-500">{t('common.loading')}</div>
          ) : totalResults === 0 ? (
            <div className="p-4 text-center text-gray-500">{t('search.noResults')}</div>
          ) : (
            <div className="p-2">
              {totalResults > 0 && (
                <div className="px-3 py-2 text-xs font-semibold text-gray-500 border-b">
                  {t('search.resultsCount')}: {totalResults}
                </div>
              )}

              {results?.applications && results.applications.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-700 flex items-center space-x-1">
                    <FileText className="w-4 h-4" />
                    <span>{t('search.applications')}</span>
                  </div>
                  {results.applications.map((app: any) => (
                    <Link
                      key={app.id}
                      href={`/applications/${app.id}`}
                      onClick={() => setIsOpen(false)}
                      className="block px-3 py-2 hover:bg-gray-50 rounded transition-colors"
                    >
                      <div className="font-medium text-sm">{app.description}</div>
                      <div className="text-xs text-gray-500 mt-1">
                        {t(`categories.${app.category}`)} • {app.is_sos && 'SOS'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results?.users && results.users.length > 0 && (
                <div className="mb-2">
                  <div className="px-3 py-2 text-xs font-semibold text-gray-700 flex items-center space-x-1">
                    <User className="w-4 h-4" />
                    <span>{t('search.users')}</span>
                  </div>
                  {results.users.map((user: any) => (
                    <Link
                      key={user.id}
                      href={`/users/${user.id}`}
                      onClick={() => setIsOpen(false)}
                      className="block px-3 py-2 hover:bg-gray-50 rounded transition-colors"
                    >
                      <div className="font-medium text-sm">
                        {user.first_name} {user.last_name || ''}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {user.city || user.email} • ⭐ {user.average_rating || 0}
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results?.cities && results.cities.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-700 flex items-center space-x-1">
                    <MapPin className="w-4 h-4" />
                    <span>{t('search.cities')}</span>
                  </div>
                  {results.cities.map((city, idx) => {
                    // Ищем заявки из этого города в результатах
                    const cityApplications = results?.applications?.filter(
                      (app: any) => app.city && app.city.includes(city as string)
                    ) || [];
                    
                    // Если есть заявки из этого города, показываем первую при клике
                    return (
                      <Link
                        key={idx}
                        href={`/?city=${encodeURIComponent(city as string)}`}
                        onClick={() => setIsOpen(false)}
                        className="block px-3 py-2 hover:bg-gray-50 rounded transition-colors"
                      >
                        <div className="text-sm font-medium">{city as string}</div>
                        {cityApplications.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {cityApplications.length} {t('search.applicationsCount')}
                          </div>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

