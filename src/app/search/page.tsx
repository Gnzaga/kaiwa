'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';
import type { Article } from '@/db/schema';
import SearchBar, { type SearchFilters } from '@/components/search/SearchBar';
import ArticleCard from '@/components/articles/ArticleCard';

interface SearchResponse {
  data: (Article & { feedSourceName?: string; imageUrl?: string | null })[];
  total: number;
  page: number;
  pageSize: number;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQ = searchParams.get('q') ?? '';

  const [filters, setFilters] = useState<SearchFilters>({
    query: initialQ,
    region: '',
    dateRange: '',
  });

  // Sync URL ?q= changes (e.g. from tag cloud links)
  useEffect(() => {
    const q = searchParams.get('q') ?? '';
    if (q && q !== filters.query) {
      setFilters((f) => ({ ...f, query: q }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const hasQuery = filters.query.length > 0;

  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.region) params.set('region', filters.region);
  if (filters.dateRange) params.set('dateRange', filters.dateRange);

  const { data, isLoading } = useQuery<SearchResponse>({
    queryKey: ['search', filters],
    queryFn: () => fetch(`/api/articles/search?${params}`).then((r) => r.json()),
    enabled: hasQuery,
  });

  const handleSearch = useCallback((f: SearchFilters) => {
    setFilters(f);
  }, []);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Search</h1>
      </header>

      <SearchBar onSearch={handleSearch} />

      {/* Results */}
      {!hasQuery && (
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
          <p className="text-xs text-text-tertiary">{data.total} result{data.total !== 1 ? 's' : ''}</p>
          {data.data.map((article) => (
            <ArticleCard key={article.id} article={article} sourceName={article.feedSourceName} />
          ))}
        </div>
      )}
    </div>
  );
}
