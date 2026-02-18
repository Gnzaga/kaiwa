'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Article } from '@/db/schema';
import ArticleCard from './ArticleCard';
import { setArticleNavList } from './ArticleNav';

interface FeedOption { id: number; name: string; regionId: string; }

type SortOption = 'newest' | 'oldest' | 'source' | 'sentiment' | 'unread_first';

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
  initialSource,
  initialTag,
  emptyMessage,
}: {
  regionId?: string;
  categorySlug?: string;
  isStarred?: boolean;
  isArchived?: boolean;
  hideFilters?: boolean;
  initialSource?: string;
  initialTag?: string;
  emptyMessage?: React.ReactNode;
}) {
  const queryClient = useQueryClient();
  const { data: prefs } = useQuery<{ articlesPerPage: number }>({
    queryKey: ['user-prefs'],
    queryFn: () => fetch('/api/user/preferences').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const pageSize = prefs?.articlesPerPage ?? 20;
  const { data: feedOptions } = useQuery<FeedOption[]>({
    queryKey: ['feeds-list'],
    queryFn: () => fetch('/api/feeds').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
    enabled: !hideFilters,
  });
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortOption>(() => {
    if (typeof window === 'undefined') return 'newest';
    return (localStorage.getItem('article-sort') as SortOption) ?? 'newest';
  });
  const [sourceFilter, setSourceFilter] = useState(initialSource ?? '');
  const [tagFilter, setTagFilter] = useState(initialTag ?? '');
  const [readFilter, setReadFilter] = useState<'' | 'read' | 'unread'>(() => {
    if (typeof window === 'undefined') return '';
    return (localStorage.getItem('article-read-filter') as '' | 'read' | 'unread') ?? '';
  });
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [languageFilter, setLanguageFilter] = useState('');
  const [markingRead, setMarkingRead] = useState(false);
  const [confirmMarkRead, setConfirmMarkRead] = useState(false);
  const [datePreset, setDatePreset] = useState<'' | 'today' | '7d' | '30d'>('');
  const [viewMode, setViewMode] = useState<'expanded' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'expanded';
    return (localStorage.getItem('article-view-mode') as 'expanded' | 'compact') ?? 'expanded';
  });

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
  params.set('pageSize', String(pageSize));
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
  if (languageFilter) params.set('language', languageFilter);
  const dateFrom = getDateFrom(datePreset);
  if (dateFrom) params.set('dateFrom', dateFrom);

  const handleMarkAllRead = async () => {
    if (!confirmMarkRead) {
      setConfirmMarkRead(true);
      setTimeout(() => setConfirmMarkRead(false), 3000);
      return;
    }
    setConfirmMarkRead(false);
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
    queryKey: ['articles', regionId, categorySlug, page, sort, sourceFilter, tagFilter, readFilter, isStarred, isArchived, sentimentFilter, languageFilter, datePreset, pageSize],
    queryFn: () => fetch(`/api/articles?${params}`).then((r) => r.json()),
    refetchInterval: 120000, // background refresh every 2 min
  });

  // Track previous total to detect new articles from background refetch
  const prevTotalRef = useRef<number | null>(null);
  const [newArticlesCount, setNewArticlesCount] = useState(0);
  useEffect(() => {
    if (!data) return;
    if (prevTotalRef.current !== null && page === 1 && sort === 'newest' && data.total > prevTotalRef.current) {
      setNewArticlesCount(data.total - prevTotalRef.current);
    } else {
      setNewArticlesCount(0);
    }
    prevTotalRef.current = data.total;
  }, [data, page, sort]);

  const totalPages = data ? Math.ceil(data.total / data.pageSize) : 0;

  // Keyboard navigation: [ = prev page, ] = next page, v = toggle view, u = toggle unread
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === '[') setPage(p => Math.max(1, p - 1));
      if (e.key === ']') setPage(p => Math.min(totalPages, p + 1));
      if (e.key === 'v') {
        setViewMode(m => {
          const next = m === 'expanded' ? 'compact' : 'expanded';
          localStorage.setItem('article-view-mode', next);
          return next;
        });
      }
      if (e.key === 'u') {
        setReadFilter(f => {
          const next = f === 'unread' ? '' : 'unread';
          localStorage.setItem('article-read-filter', next);
          return next;
        });
        setPage(1);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [totalPages]);

  return (
    <div className="space-y-4">
      {/* New articles banner */}
      {newArticlesCount > 0 && (
        <button
          onClick={() => { setNewArticlesCount(0); queryClient.invalidateQueries({ queryKey: ['articles'] }); }}
          className="w-full py-2 text-xs text-center bg-accent-primary/10 border border-accent-primary/40 rounded text-accent-primary hover:bg-accent-primary/20 transition-colors"
        >
          {newArticlesCount} new article{newArticlesCount !== 1 ? 's' : ''} — click to refresh
        </button>
      )}

      {/* Controls */}
      {!hideFilters && (
      <div className="flex flex-wrap items-center gap-3">
        {/* Sort */}
        <select
          value={sort}
          onChange={(e) => { const v = e.target.value as SortOption; setSort(v); localStorage.setItem('article-sort', v); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="unread_first">Unread First</option>
          <option value="source">By Source</option>
          <option value="sentiment">By Sentiment</option>
        </select>

        {/* Source filter */}
        <select
          value={sourceFilter}
          onChange={(e) => { setSourceFilter(e.target.value); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary max-w-[160px]"
        >
          <option value="">All Sources</option>
          {feedOptions?.filter(f => !regionId || f.regionId === regionId).map(f => (
            <option key={f.id} value={f.name}>{f.name}</option>
          ))}
        </select>

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
          onChange={(e) => { const v = e.target.value as '' | 'read' | 'unread'; setReadFilter(v); localStorage.setItem('article-read-filter', v); setPage(1); }}
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

        {/* Language filter */}
        <select
          value={languageFilter}
          onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="">All Languages</option>
          <option value="ja">🇯🇵 Japanese</option>
          <option value="en">🇺🇸 English</option>
          <option value="zh">🇨🇳 Chinese</option>
          <option value="ko">🇰🇷 Korean</option>
          <option value="tl">🇵🇭 Filipino</option>
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
            onClick={() => { setViewMode('expanded'); localStorage.setItem('article-view-mode', 'expanded'); }}
            title="Expanded view"
            className={`px-2 py-1.5 transition-colors ${viewMode === 'expanded' ? 'bg-accent-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="1" y="1" width="12" height="4" rx="1" />
              <rect x="1" y="7" width="12" height="4" rx="1" />
            </svg>
          </button>
          <button
            onClick={() => { setViewMode('compact'); localStorage.setItem('article-view-mode', 'compact'); }}
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
          className={`ml-auto px-3 py-1.5 text-sm border rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${confirmMarkRead ? 'border-accent-highlight text-accent-highlight hover:border-accent-highlight' : 'border-border text-text-tertiary hover:text-text-primary hover:border-accent-primary'}`}
        >
          {markingRead ? 'Marking...' : confirmMarkRead ? 'Confirm?' : 'Mark all read'}
        </button>
      </div>
      )}

      {/* Active filter chips */}
      {!hideFilters && (sourceFilter || tagFilter || readFilter || sentimentFilter || languageFilter || datePreset) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-tertiary">Filters:</span>
          {sourceFilter && (
            <button onClick={() => { setSourceFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs bg-accent-primary/10 text-accent-primary border border-accent-primary/30 rounded-full px-2 py-0.5 hover:bg-accent-primary/20 transition-colors">
              Source: {sourceFilter} ✕
            </button>
          )}
          {tagFilter && (
            <button onClick={() => { setTagFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs bg-accent-primary/10 text-accent-primary border border-accent-primary/30 rounded-full px-2 py-0.5 hover:bg-accent-primary/20 transition-colors">
              Tag: {tagFilter} ✕
            </button>
          )}
          {readFilter && (
            <button onClick={() => { setReadFilter(''); localStorage.setItem('article-read-filter', ''); setPage(1); }} className="flex items-center gap-1 text-xs bg-accent-primary/10 text-accent-primary border border-accent-primary/30 rounded-full px-2 py-0.5 hover:bg-accent-primary/20 transition-colors">
              {readFilter === 'read' ? 'Read only' : 'Unread only'} ✕
            </button>
          )}
          {sentimentFilter && (
            <button onClick={() => { setSentimentFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs bg-accent-primary/10 text-accent-primary border border-accent-primary/30 rounded-full px-2 py-0.5 hover:bg-accent-primary/20 transition-colors">
              Sentiment: {sentimentFilter} ✕
            </button>
          )}
          {languageFilter && (
            <button onClick={() => { setLanguageFilter(''); setPage(1); }} className="flex items-center gap-1 text-xs bg-accent-primary/10 text-accent-primary border border-accent-primary/30 rounded-full px-2 py-0.5 hover:bg-accent-primary/20 transition-colors">
              Lang: {languageFilter} ✕
            </button>
          )}
          {datePreset && (
            <button onClick={() => { setDatePreset(''); setPage(1); }} className="flex items-center gap-1 text-xs bg-accent-primary/10 text-accent-primary border border-accent-primary/30 rounded-full px-2 py-0.5 hover:bg-accent-primary/20 transition-colors">
              Date: {datePreset} ✕
            </button>
          )}
          <button onClick={() => { setSourceFilter(''); setTagFilter(''); setReadFilter(''); setSentimentFilter(''); setLanguageFilter(''); setDatePreset(''); setPage(1); }} className="text-xs text-text-tertiary hover:text-text-primary ml-1 transition-colors">
            Clear all
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
        <div className="text-center py-12 text-text-tertiary text-sm">
          {readFilter === 'unread' ? (
            <>
              <div className="text-2xl mb-2">✓</div>
              <p className="font-medium text-text-secondary">All caught up!</p>
              <p className="text-xs mt-1">No unread articles matching your filters</p>
            </>
          ) : emptyMessage ?? 'No articles found'}
        </div>
      )}

      {data && data.data.length > 0 && (
        <div className="space-y-2">
          {(() => { setArticleNavList(data.data.map(a => a.id)); return null; })()}
          {data.data.map((article, i) => (
            <ArticleCard
              key={article.id}
              article={article}
              sourceName={article.feedSourceName}
              variant={viewMode === 'compact' ? 'compact' : page === 1 && i === 0 && article.imageUrl ? 'hero' : 'default'}
            />
          ))}
        </div>
      )}

      {/* Result count + Pagination */}
      {data && data.total > 0 && (() => {
        const totalMins = data.data.reduce((s, a) => s + (Number((a as Article & { readingMinutes?: number }).readingMinutes) || 0), 0);
        const readingEst = totalMins > 60 ? `~${Math.round(totalMins / 60)}h` : totalMins > 0 ? `~${totalMins}m` : null;
        return (
          <div className="text-xs text-text-tertiary text-center">
            Showing {((page - 1) * data.pageSize) + 1}–{Math.min(page * data.pageSize, data.total)} of {data.total.toLocaleString()} articles
            {readingEst && <span className="ml-2 opacity-60">· {readingEst} reading on this page</span>}
          </div>
        );
      })()}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 text-sm border border-border rounded text-text-secondary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Prev
          </button>
          {totalPages > 5 ? (
            <input
              type="number"
              min={1}
              max={totalPages}
              value={page}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v >= 1 && v <= totalPages) setPage(v);
              }}
              className="w-16 text-center text-sm font-mono bg-bg-elevated border border-border rounded px-2 py-1 text-text-primary focus:outline-none focus:border-accent-primary"
              title={`Page ${page} of ${totalPages}`}
            />
          ) : (
            <span className="text-sm text-text-tertiary font-mono">{page} / {totalPages}</span>
          )}
          <span className="text-xs text-text-tertiary">of {totalPages}</span>
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
