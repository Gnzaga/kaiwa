'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import type { Article } from '@/db/schema';
import SearchBar, { type SearchFilters } from '@/components/search/SearchBar';
import ArticleCard from '@/components/articles/ArticleCard';

const RECENT_KEY = 'kaiwa-recent-searches';
const MAX_RECENT = 8;

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function saveSearch(query: string) {
  if (!query.trim()) return;
  const prev = getRecentSearches().filter(q => q !== query);
  localStorage.setItem(RECENT_KEY, JSON.stringify([query, ...prev].slice(0, MAX_RECENT)));
}

interface SearchResponse {
  data: (Article & { feedSourceName?: string; imageUrl?: string | null })[];
  total: number;
  page: number;
  pageSize: number;
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';

  const [filters, setFilters] = useState<SearchFilters>({
    query: initialQ,
    region: '',
    dateRange: '',
    sentiment: '',
  });

  // Sync URL ?q= changes (e.g. from tag cloud links)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    if (q && q !== filters.query) {
      setFilters((f) => ({ ...f, query: q }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [searchPage, setSearchPage] = useState(1);

  useEffect(() => {
    setRecentSearches(getRecentSearches());
  }, []);

  const hasQuery = filters.query.length > 0;

  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.region) params.set('region', filters.region);
  if (filters.dateRange) params.set('dateRange', filters.dateRange);
  if (filters.sentiment) params.set('sentiment', filters.sentiment);
  params.set('page', String(searchPage));

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ['search', filters, searchPage],
    queryFn: () => fetch(`/api/articles/search?${params}`).then((r) => r.json()),
    enabled: hasQuery,
  });

  const handleSearch = useCallback((f: SearchFilters) => {
    setFilters(f);
    setSearchPage(1);
    if (f.query) {
      saveSearch(f.query);
      setRecentSearches(getRecentSearches());
    }
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Search</h1>
      </header>

      <SearchBar onSearch={handleSearch} />

      {/* Recent searches */}
      {!hasQuery && recentSearches.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-tertiary">Recent searches</p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((q) => (
              <button
                key={q}
                onClick={() => setFilters((f) => ({ ...f, query: q }))}
                className="px-3 py-1 text-sm border border-border rounded-full text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
              >
                {q}
              </button>
            ))}
            <button
              onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }}
              className="px-2 py-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      {!hasQuery && recentSearches.length === 0 && (
        <div className="text-center py-16 text-text-tertiary text-sm">
          Enter a search term to find articles
        </div>
      )}

      {hasQuery && isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 bg-bg-secondary border border-border rounded animate-pulse" />
          ))}
        </div>
      )}

      {hasQuery && data && data.data.length === 0 && (
        <div className="text-center py-12 text-text-tertiary text-sm">
          No results found
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-tertiary">{data.total.toLocaleString()} result{data.total !== 1 ? 's' : ''}</p>
          {data.data.map((article) => (
            <ArticleCard key={article.id} article={article} sourceName={article.feedSourceName} />
          ))}
          {Math.ceil(data.total / data.pageSize) > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setSearchPage(p => Math.max(1, p - 1))}
                disabled={searchPage === 1}
                className="px-3 py-1.5 text-sm border border-border rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              >Prev</button>
              <span className="text-sm text-text-tertiary font-mono">{searchPage} / {Math.ceil(data.total / data.pageSize)}</span>
              <button
                onClick={() => setSearchPage(p => Math.min(Math.ceil(data.total / data.pageSize), p + 1))}
                disabled={searchPage >= Math.ceil(data.total / data.pageSize)}
                className="px-3 py-1.5 text-sm border border-border rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              >Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-6 md:p-8 max-w-4xl mx-auto"><div className="h-10 bg-bg-secondary border border-border rounded animate-pulse" /></div>}>
      <SearchPageContent />
    </Suspense>
  );
}
