'use client';

import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Article } from '@/db/schema';
import ArticleCard from './ArticleCard';
import { setArticleNavList } from './ArticleNav';

type SortOption = 'newest' | 'oldest' | 'source' | 'sentiment';

interface ArticlesResponse {
  data: (Article & { feedSourceName?: string; imageUrl?: string | null })[];
  total: number;
  page: number;
  pageSize: number;
}

export default function ArticleList({
  regionId,
  categorySlug,
  isStarred,
  isArchived,
  hideFilters,
}: {
  regionId?: string;
  categorySlug?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  hideFilters?: boolean;
}) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>('newest');
  const [sourceFilter, setSourceFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [readFilter, setReadFilter] = useState<'' | 'read' | 'unread'>('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [markingRead, setMarkingRead] = useState(false);
  const [datePreset, setDatePreset] = useState<'' | 'today' | '7d' | '30d'>('');
  const [viewMode, setViewMode] = useState<'expanded' | 'compact'>('expanded');

  function getDateFrom(preset: '' | 'today' | '7d' | '30d'): string {
    if (!preset) return '';
    const d = new Date();
    if (preset === 'today') d.setHours(0, 0, 0, 0);
    else if (preset === '7d') d.setDate(d.getDate() - 7);
    else if (preset === '30d') d.setDate(d.getDate() - 30);
    return d.toISOString();
  }

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('pageSize', '20');
  params.set('sort', sort);
  if (regionId) params.set('region', regionId);
  if (categorySlug) params.set('category', categorySlug);
  if (sourceFilter) params.set('source', sourceFilter);
  if (tagFilter) params.set('tag', tagFilter);
  if (readFilter === 'read') params.set('isRead', 'true');
  if (readFilter === 'unread') params.set('isRead', 'false');
  if (isStarred) params.set('isStarred', 'true');
  if (isArchived) params.set('isArchived', 'true');
  if (sentimentFilter) params.set('sentiment', sentimentFilter);
  const dateFrom = getDateFrom(datePreset);
  if (dateFrom) params.set('dateFrom', dateFrom);

  const handleMarkAllRead = async () => {
    setMarkingRead(true);
    try {
      const markParams = new URLSearchParams();
      if (regionId) markParams.set('region', regionId);
      if (categorySlug) markParams.set('category', categorySlug);
      if (sourceFilter) markParams.set('source', sourceFilter);
      await fetch(`/api/articles/mark-all-read?${markParams}`, { method: 'POST' });
      await queryClient.invalidateQueries({ queryKey: ['articles'] });
    } finally {
      setMarkingRead(false);
    }
  };

  const { data, isLoading, error } = useQuery<ArticlesResponse>({
    queryKey: ['articles', regionId, categorySlug, page, sort, sourceFilter, tagFilter, readFilter, isStarred, isArchived, sentimentFilter, datePreset],
    queryFn: () => fetch(`/api/articles?${params}`).then((r) => r.json()),
  });

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  return (
    <div className="space-y-4">
      {/* Controls */}
      {!hideFilters && (
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => { setSort(e.target.value as SortOption); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
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

        {/* Sentiment filter */}
        <select
          value={sentimentFilter}
          onChange={(e) => { setSentimentFilter(e.target.value); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="">All Sentiment</option>
          <option value="positive">Positive</option>
          <option value="negative">Negative</option>
          <option value="neutral">Neutral</option>
          <option value="mixed">Mixed</option>
          <option value="bullish">Bullish</option>
          <option value="bearish">Bearish</option>
          <option value="restrictive">Restrictive</option>
          <option value="permissive">Permissive</option>
        </select>

        {/* Date presets */}
        <div className="flex items-center gap-1 border border-border rounded overflow-hidden">
          {(['', 'today', '7d', '30d'] as const).map((preset) => (
            <button
              key={preset || 'all'}
              onClick={() => { setDatePreset(preset); setPage(1); }}
              className={`px-2.5 py-1.5 text-xs transition-colors ${datePreset === preset ? 'bg-accent-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
            >
              {preset === '' ? 'All' : preset === 'today' ? 'Today' : preset}
            </button>
          ))}
        </div>

        {/* View mode toggle */}
        <div className="flex items-center border border-border rounded overflow-hidden">
          <button
            onClick={() => setViewMode('expanded')}
            title="Expanded view"
            className={`px-2 py-1.5 transition-colors ${viewMode === 'expanded' ? 'bg-accent-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="12" height="4" rx="1" />
              <rect x="1" y="7" width="12" height="4" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode('compact')}
            title="Compact view"
            className={`px-2 py-1.5 transition-colors ${viewMode === 'compact' ? 'bg-accent-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <line x1="1" y1="3" x2="13" y2="3" />
              <line x1="1" y1="7" x2="13" y2="7" />
              <line x1="1" y1="11" x2="13" y2="11" />
            </svg>
          </button>
        </div>

        <button
          onClick={handleMarkAllRead}
          disabled={markingRead || !data || data.data.length === 0}
          className="ml-auto px-3 py-1.5 text-sm border border-border rounded text-text-tertiary hover:text-text-primary hover:border-accent-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          {markingRead ? 'Marking...' : 'Mark all read'}
        </button>
      </div>
      )}

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
          {(() => { setArticleNavList(data.data.map(a => a.id)); return null; })()}
          {data.data.map((article, i) => (
            <ArticleCard
              key={article.id}
              article={article}
              sourceName={article.feedSourceName}
              variant={viewMode === 'compact' ? 'compact' : i === 0 && article.imageUrl ? 'hero' : 'default'}
            />
          ))}
        </div>
      )}

      {/* Result count + Pagination */}
      {data && data.total > 0 && (
        <div className="text-xs text-text-tertiary text-center">
          Showing {((page - 1) * data.pageSize) + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total.toLocaleString()} articles
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
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
