'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import type { Article } from '@/db/schema';
import SearchBar, { type SearchFilters } from '@/components/search/SearchBar';
import ArticleCard from '@/components/articles/ArticleCard';

const RECENT_KEY = 'kaiwa-recent-searches';
const SAVED_KEY = 'kaiwa-saved-searches';
const MAX_RECENT = 8;

interface SavedSearch { label: string; query: string; region: string; dateRange: '' | '24h' | '7d' | '30d'; sentiment: string; savedAt: string; }

function getRecentSearches(): string[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

function getSavedSearches(): SavedSearch[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]'); } catch { return []; }
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
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [searchPage, setSearchPage] = useState(1);
  const [searchSort, setSearchSort] = useState<'relevance' | 'newest' | 'oldest'>('relevance');

  useEffect(() => {
    setRecentSearches(getRecentSearches());
    setSavedSearches(getSavedSearches());
  }, []);

  function saveCurrentSearch() {
    if (!filters.query.trim()) return;
    const entry: SavedSearch = {
      label: filters.query,
      query: filters.query,
      region: filters.region,
      dateRange: filters.dateRange as SavedSearch['dateRange'],
      sentiment: filters.sentiment,
      savedAt: new Date().toISOString(),
    };
    const prev = getSavedSearches().filter(
      (s) => !(s.query === entry.query && s.region === entry.region && s.dateRange === entry.dateRange && s.sentiment === entry.sentiment),
    );
    const next = [entry, ...prev];
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSavedSearches(next);
  }

  function deleteSavedSearch(savedAt: string) {
    const next = getSavedSearches().filter((s) => s.savedAt !== savedAt);
    localStorage.setItem(SAVED_KEY, JSON.stringify(next));
    setSavedSearches(next);
  }

  const isCurrentSaved = savedSearches.some(
    (s) => s.query === filters.query && s.region === filters.region && s.dateRange === filters.dateRange && s.sentiment === filters.sentiment,
  );

  const hasQuery = filters.query.length > 0;

  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.region) params.set('region', filters.region);
  if (filters.dateRange) params.set('dateRange', filters.dateRange);
  if (filters.sentiment) params.set('sentiment', filters.sentiment);
  params.set('page', String(searchPage));
  params.set('sort', searchSort);

  const { data, isLoading, error } = useQuery<SearchResponse>({
    queryKey: ['search', filters, searchPage, searchSort],
    queryFn: async () => {
      const r = await fetch(`/api/articles/search?${params}`);
      if (!r.ok) throw new Error(`Search failed (${r.status})`);
      return r.json();
    },
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

      <div className="flex items-start gap-2">
        <div className="flex-1">
          <SearchBar onSearch={handleSearch} />
        </div>
        {hasQuery && (
          <button
            onClick={saveCurrentSearch}
            title={isCurrentSaved ? 'Search saved' : 'Save this search'}
            className={`mt-0.5 px-2.5 py-2 border rounded text-xs transition-colors ${isCurrentSaved ? 'border-accent-primary text-accent-primary' : 'border-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary'}`}
          >
            {isCurrentSaved ? '★' : '☆'}
          </button>
        )}
      </div>

      {/* Recent searches */}
      {!hasQuery && recentSearches.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-tertiary">Recent searches</p>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((q) => (
              <div key={q} className="flex items-center gap-0 border border-border rounded-full overflow-hidden text-sm text-text-secondary hover:border-accent-primary transition-colors group">
                <button
                  onClick={() => setFilters((f) => ({ ...f, query: q }))}
                  className="px-3 py-1 hover:text-text-primary transition-colors"
                >
                  {q}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = recentSearches.filter(s => s !== q);
                    setRecentSearches(next);
                    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
                  }}
                  className="pr-2 py-1 text-xs text-text-tertiary hover:text-accent-highlight transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove"
                >✕</button>
              </div>
            ))}
            <button
              onClick={() => { localStorage.removeItem(RECENT_KEY); setRecentSearches([]); }}
              className="px-2 py-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
            >
              Clear all
            </button>
          </div>
        </div>
      )}

      {/* Saved searches */}
      {!hasQuery && savedSearches.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-text-tertiary">Saved searches</p>
          <div className="flex flex-wrap gap-2">
            {savedSearches.map((s) => (
              <div key={s.savedAt} className="flex items-center gap-0 border border-accent-primary/40 rounded-full overflow-hidden text-sm text-text-secondary hover:border-accent-primary transition-colors group">
                <button
                  onClick={() => setFilters({ query: s.query, region: s.region, dateRange: s.dateRange, sentiment: s.sentiment })}
                  className="px-3 py-1 hover:text-text-primary transition-colors"
                >
                  ★ {s.label}
                  {(s.region || s.dateRange || s.sentiment) && (
                    <span className="ml-1 text-xs text-text-tertiary">
                      {[s.region, s.dateRange, s.sentiment].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSavedSearch(s.savedAt); }}
                  className="pr-2 py-1 text-xs text-text-tertiary hover:text-accent-highlight transition-colors opacity-0 group-hover:opacity-100"
                  title="Remove"
                >✕</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {!hasQuery && recentSearches.length === 0 && savedSearches.length === 0 && (
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

      {hasQuery && error && (
        <div className="text-center py-12 text-accent-highlight text-sm">
          Search failed. Please try again.
        </div>
      )}

      {hasQuery && data && data.data.length === 0 && (
        <div className="text-center py-12 text-text-tertiary text-sm">
          No results found
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-text-tertiary">{data.total.toLocaleString()} result{data.total !== 1 ? 's' : ''}</p>
            <div className="flex items-center gap-2">
              <button
                onClick={async () => {
                  const exportParams = new URLSearchParams(params);
                  exportParams.set('pageSize', '200');
                  exportParams.delete('page');
                  const resp = await fetch(`/api/articles/search?${exportParams}`).then(r => r.json());
                  const articles = resp.data ?? [];
                  const lines = [
                    `# Search: "${filters.query}"`,
                    `_${articles.length} results · ${new Date().toLocaleDateString()}_`,
                    '',
                    ...articles.map((a: { translatedTitle?: string | null; originalTitle: string; feedSourceName?: string; publishedAt: string; originalUrl: string; summaryTldr?: string | null }) =>
                      `## ${a.translatedTitle || a.originalTitle}\n**Source:** ${a.feedSourceName ?? 'Unknown'} · ${new Date(a.publishedAt).toLocaleDateString()}\n${a.summaryTldr ? `> ${a.summaryTldr}\n` : ''}\n${a.originalUrl}`
                    ),
                  ];
                  const blob = new Blob([lines.join('\n\n')], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `search-${filters.query.replace(/\s+/g, '-')}.md`; a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-xs px-2 py-1 border border-border rounded text-text-tertiary hover:text-text-primary hover:border-accent-primary transition-colors"
              >
                Export
              </button>
              <select
                value={searchSort}
                onChange={(e) => { setSearchSort(e.target.value as 'relevance' | 'newest' | 'oldest'); setSearchPage(1); }}
                className="text-xs bg-bg-elevated border border-border rounded px-2 py-1 text-text-secondary focus:outline-none focus:border-accent-primary"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
              </select>
            </div>
          </div>
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
