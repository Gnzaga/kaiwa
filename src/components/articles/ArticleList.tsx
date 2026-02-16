'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Article } from '@/db/schema';
import ArticleCard from './ArticleCard';

type SortOption = 'newest' | 'source' | 'sentiment';

interface ArticlesResponse {
  data: (Article & { feedSourceName?: string; imageUrl?: string | null })[];
  total: number;
  page: number;
  pageSize: number;
}

export default function ArticleList({
  regionId,
  categorySlug,
}: {
  regionId?: string;
  categorySlug?: string;
}) {
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('newest');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [readFilter, setReadFilter] = useState<'' | 'read' | 'unread'>('');

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', '20');
  params.set('sort', sort);
  if (regionId) params.set('region', regionId);
  if (categorySlug) params.set('category', categorySlug);
  if (sourceFilter) params.set('source', sourceFilter);
  if (tagFilter) params.set('tag', tagFilter);
  if (readFilter) params.set('read', readFilter);

  const { data, isLoading, error } = useQuery<ArticlesResponse>({
    queryKey: ['articles', regionId, categorySlug, page, sort, sourceFilter, tagFilter, readFilter],
    queryFn: () => fetch(`/api/articles?${params}`).then((r) => r.json()),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="newest">Newest</option>
          <option value="source">By Source</option>
          <option value="sentiment">By Sentiment</option>
        </select>

        {/* Source filter */}
        <input
          type="text"
          placeholder="Filter source..."
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary w-36"
        />

        {/* Tag filter */}
        <input
          type="text"
          placeholder="Filter tag..."
          value={tagFilter}
          onChange={(e) => { setTagFilter(e.target.value); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary w-32"
        />

        {/* Read/Unread */}
        <select
          value={readFilter}
          onChange={(e) => { setReadFilter(e.target.value as '' | 'read' | 'unread'); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="">All</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      {/* Articles */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-28 bg-bg-secondary border border-border rounded animate-pulse" />
          ))}
        </div>
      )}

      {error && (
        <div className="text-center py-8 text-accent-highlight text-sm">
          Failed to load articles
        </div>
      )}

      {data && data.data.length === 0 && (
        <div className="text-center py-12 text-text-tertiary text-sm">No articles found</div>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-2">
          {data.data.map((article, i) => (
            <ArticleCard
              key={article.id}
              article={article}
              sourceName={article.feedSourceName}
              variant={i === 0 && article.imageUrl ? 'hero' : 'default'}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          <span className="text-sm text-text-tertiary font-mono">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 text-sm border border-border rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
