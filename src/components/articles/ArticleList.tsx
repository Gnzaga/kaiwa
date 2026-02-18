'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type { Article } from '@/db/schema';
import ArticleCard from './ArticleCard';
import { setArticleNavList } from './ArticleNav';
import { useToast } from '@/components/ui/Toast';

interface FeedOption { id: number; name: string; regionId: string; }

type SortOption = 'newest' | 'oldest' | 'source' | 'sentiment' | 'unread_first' | 'quickest';

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
  const router = useRouter();
  const { toast } = useToast();
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
  const [readingLength, setReadingLength] = useState('');
  const [titleSearch, setTitleSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const selectedIdxRef = useRef(-1);
  const articlesRef = useRef<(Article & { feedSourceName?: string; imageUrl?: string | null })[]>([]);
  const [markingRead, setMarkingRead] = useState(false);
  const [confirmMarkRead, setConfirmMarkRead] = useState(false);
  const [datePreset, setDatePreset] = useState<'' | '1h' | '6h' | 'today' | '7d' | '30d' | '60d'>('');
  const [viewMode, setViewMode] = useState<'expanded' | 'compact'>(() => {
    if (typeof window === 'undefined') return 'expanded';
    return (localStorage.getItem('article-view-mode') as 'expanded' | 'compact') ?? 'expanded';
  });
  const [filtersVisible, setFiltersVisible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('article-filters-visible') === 'true';
  });
  const [groupByDate, setGroupByDate] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('article-group-by-date') === 'true';
  });
  const tagFilterRef = useRef<HTMLInputElement>(null);

  function getDateFrom(preset: '' | '1h' | '6h' | 'today' | '7d' | '30d' | '60d'): string {
    if (!preset) return '';
    const d = new Date();
    if (preset === '1h') d.setTime(d.getTime() - 60 * 60 * 1000);
    else if (preset === '6h') d.setTime(d.getTime() - 6 * 60 * 60 * 1000);
    else if (preset === 'today') d.setHours(0, 0, 0, 0);
    else if (preset === '7d') d.setDate(d.getDate() - 7);
    else if (preset === '30d') d.setDate(d.getDate() - 30);
    else if (preset === '60d') d.setDate(d.getDate() - 60);
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
  if (titleSearch) params.set('q', titleSearch);
  if (readingLength === 'quick') params.set('maxReadingMinutes', '5');
  if (readingLength === 'medium') { params.set('minReadingMinutes', '5'); params.set('maxReadingMinutes', '15'); }
  if (readingLength === 'long') params.set('minReadingMinutes', '15');

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
    queryKey: ['articles', regionId, categorySlug, page, sort, sourceFilter, tagFilter, readFilter, isStarred, isArchived, sentimentFilter, languageFilter, datePreset, pageSize, titleSearch, readingLength],
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

  // Keep refs in sync for use in keyboard handler without stale closure
  useEffect(() => { selectedIdxRef.current = selectedIdx; }, [selectedIdx]);
  useEffect(() => { articlesRef.current = data?.data ?? []; }, [data]);
  // Reset selection when page/filter changes
  useEffect(() => { setSelectedIdx(-1); }, [data]);
  // Scroll selected article into view
  useEffect(() => {
    if (selectedIdx < 0) return;
    const el = document.querySelector(`[data-article-idx="${selectedIdx}"]`);
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIdx]);

  // Keyboard navigation: [ = prev page, ] = next page, v = toggle view, u = toggle unread, j/k = select article, Enter = open
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (selectedIdxRef.current >= 0) { setSelectedIdx(-1); return; }
        if (filtersVisible) { setFiltersVisible(false); localStorage.setItem('article-filters-visible', 'false'); return; }
      }
      if (e.key === '[' || e.key === 'p') setPage(p => Math.max(1, p - 1));
      if (e.key === ']' || e.key === 'n') setPage(p => Math.min(totalPages, p + 1));
      if (e.key === 'g') { setSelectedIdx(0); setTimeout(() => document.querySelector('[data-article-idx="0"]')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0); }
      if (e.key === 'G') { const last = articlesRef.current.length - 1; setSelectedIdx(last); setTimeout(() => document.querySelector(`[data-article-idx="${last}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 0); }
      if (e.key === 'e') { setGroupByDate(v => { const next = !v; localStorage.setItem('article-group-by-date', String(next)); return next; }); }
      if (e.key === 'c' && selectedIdxRef.current >= 0) {
        const article = articlesRef.current[selectedIdxRef.current];
        if (article?.originalUrl) navigator.clipboard.writeText(article.originalUrl).catch(() => {});
      }
      if (e.key === 'j') {
        e.preventDefault();
        setSelectedIdx(prev => Math.min(prev + 1, articlesRef.current.length - 1));
      }
      if (e.key === 'k') {
        e.preventDefault();
        setSelectedIdx(prev => Math.max(0, prev - 1));
      }
      if (e.key === 'Enter' && selectedIdxRef.current >= 0) {
        const article = articlesRef.current[selectedIdxRef.current];
        if (article) router.push(`/article/${article.id}`);
      }
      if ((e.key === 'x' || e.key === 'a' || e.key === '*' || e.key === 's' || e.key === 'm' || e.key === 'r') && selectedIdxRef.current >= 0) {
        const article = articlesRef.current[selectedIdxRef.current];
        if (article) {
          const type = (e.key === 'x' || e.key === 'a') ? 'toggleArchive' : (e.key === '*' || e.key === 's') ? 'toggleStar' : 'toggleRead';
          fetch(`/api/articles/${article.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type }),
          }).then(() => queryClient.invalidateQueries({ queryKey: ['articles'] }));
        }
      }
      if (e.key === 'S' && selectedIdxRef.current >= 0) {
        const article = articlesRef.current[selectedIdxRef.current];
        const src = (article as typeof article & { feedSourceName?: string })?.feedSourceName;
        if (src) { setSourceFilter(prev => prev === src ? '' : src); setPage(1); }
      }
      if (e.key === 'O' && selectedIdxRef.current >= 0) {
        const article = articlesRef.current[selectedIdxRef.current];
        if (article?.originalUrl) window.open(article.originalUrl, '_blank', 'noopener,noreferrer');
      }
      if (e.key === 'N') {
        setDatePreset(p => { const next = p === '6h' ? '' : '6h'; setPage(1); return next; });
      }
      if (e.key === 'v') {
        setViewMode(m => {
          const next = m === 'expanded' ? 'compact' : 'expanded';
          localStorage.setItem('article-view-mode', next);
          return next;
        });
      }
      if (e.key === 'f') {
        setFiltersVisible(v => {
          const next = !v;
          localStorage.setItem('article-filters-visible', String(next));
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
      if (e.key === 'w' && selectedIdxRef.current >= 0) {
        const article = articlesRef.current[selectedIdxRef.current];
        if (article) {
          // Add to user's first reading list
          fetch('/api/reading-lists')
            .then(r => r.json())
            .then((lists: { id: number; name: string }[]) => {
              if (!Array.isArray(lists) || lists.length === 0) {
                toast('No reading lists found — create one first', 'error');
                return;
              }
              const list = lists[0];
              return fetch(`/api/reading-lists/${list.id}/items`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ articleId: article.id }),
              }).then(r => {
                if (r.ok) toast(`Saved to "${list.name}"`);
                else toast('Already in list or failed', 'error');
              });
            })
            .catch(() => toast('Failed to add to list', 'error'));
        }
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [totalPages, router]);

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
      {!hideFilters && (() => {
        const activeFilterCount = [titleSearch, sourceFilter, tagFilter, readFilter, sentimentFilter, languageFilter, datePreset, readingLength].filter(Boolean).length;
        return (
          <div className="space-y-2">
            {/* Primary row: always visible */}
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
                <option value="quickest">Quickest Read</option>
                <option value="source">By Source</option>
                <option value="sentiment">By Sentiment</option>
              </select>

              {/* Filters toggle */}
              <button
                onClick={() => { const next = !filtersVisible; setFiltersVisible(next); localStorage.setItem('article-filters-visible', String(next)); }}
                title="Toggle filters (f)"
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border rounded transition-colors ${filtersVisible ? 'border-accent-primary text-accent-primary bg-accent-primary/10' : 'border-border text-text-tertiary hover:text-text-primary hover:border-accent-primary'}`}
              >
                <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M1 3h12M3 7h8M5 11h4" strokeLinecap="round" />
                </svg>
                Filters
                {activeFilterCount > 0 && (
                  <span className="bg-accent-primary text-bg-primary text-[10px] font-mono rounded-full w-4 h-4 flex items-center justify-center leading-none">{activeFilterCount}</span>
                )}
              </button>

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
                onClick={() => { const next = !groupByDate; setGroupByDate(next); localStorage.setItem('article-group-by-date', String(next)); }}
                title="Group articles by date"
                className={`px-2.5 py-1.5 text-xs border rounded transition-colors ${groupByDate ? 'border-accent-primary text-accent-primary bg-accent-primary/10' : 'border-border text-text-tertiary hover:text-text-primary hover:border-accent-primary'}`}
              >§</button>

              <button
                onClick={() => {
                  fetch('/api/articles/random')
                    .then(r => r.json())
                    .then(d => { if (d.id) router.push(`/article/${d.id}`); });
                }}
                title="Go to a random unread article (R)"
                className="px-3 py-1.5 text-sm border border-border rounded text-text-tertiary hover:text-text-primary hover:border-accent-primary transition-colors"
              >
                Surprise me
              </button>

              <button
                onClick={() => {
                  if (!data?.data || data.data.length === 0) return;
                  const urls = data.data.map(a => a.originalUrl).join('\n');
                  navigator.clipboard.writeText(urls);
                }}
                title="Copy all visible article URLs to clipboard"
                disabled={!data || data.data.length === 0}
                className="px-3 py-1.5 text-sm border border-border rounded text-text-tertiary hover:text-text-primary hover:border-accent-primary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Copy URLs
              </button>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setTitleSearch('');
                    setSourceFilter('');
                    setTagFilter('');
                    setReadFilter('');
                    setSentimentFilter('');
                    setLanguageFilter('');
                    setDatePreset('');
                    setReadingLength('');
                    setPage(1);
                    localStorage.removeItem('article-read-filter');
                  }}
                  className="px-3 py-1.5 text-sm border border-border rounded text-accent-highlight hover:border-accent-highlight transition-colors"
                  title="Clear all active filters"
                >
                  Clear filters
                </button>
              )}

              <button
                onClick={handleMarkAllRead}
                disabled={markingRead || !data || data.data.length === 0}
                className={`ml-auto px-3 py-1.5 text-sm border rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors ${confirmMarkRead ? 'border-accent-highlight text-accent-highlight hover:border-accent-highlight' : 'border-border text-text-tertiary hover:text-text-primary hover:border-accent-primary'}`}
              >
                {markingRead ? 'Marking...' : confirmMarkRead ? 'Confirm?' : 'Mark all read'}
              </button>
            </div>

            {/* Secondary row: collapsible filters */}
            {filtersVisible && (
              <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-border">
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

                {/* Title search */}
                <input
                  ref={tagFilterRef}
                  data-shortcut-focus
                  type="text"
                  placeholder="Search title..."
                  value={titleSearch}
                  onChange={(e) => { setTitleSearch(e.target.value); setPage(1); }}
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

                {/* Reading length */}
                <select
                  value={readingLength}
                  onChange={(e) => { setReadingLength(e.target.value); setPage(1); }}
                  className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
                >
                  <option value="">Any length</option>
                  <option value="quick">Quick (&lt;5 min)</option>
                  <option value="medium">Medium (5–15 min)</option>
                  <option value="long">Long (&gt;15 min)</option>
                </select>

                {/* Date presets */}
                <div className="flex items-center gap-1 border border-border rounded overflow-hidden">
                  {(['', '1h', '6h', 'today', '7d', '30d', '60d'] as const).map((preset) => (
                    <button
                      key={preset || 'all'}
                      onClick={() => { setDatePreset(preset); setPage(1); }}
                      className={`px-2.5 py-1.5 text-xs transition-colors ${datePreset === preset ? 'bg-accent-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
                    >
                      {preset === '' ? 'All' : preset === 'today' ? 'Today' : preset}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Active filter chips */}
      {!hideFilters && (titleSearch || sourceFilter || tagFilter || readFilter || sentimentFilter || languageFilter || datePreset || readingLength) && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-text-tertiary">Filters:</span>
          {titleSearch && (
            <button onClick={() => { setTitleSearch(''); setPage(1); }} className="flex items-center gap-1 text-xs bg-accent-primary/10 text-accent-primary border border-accent-primary/30 rounded-full px-2 py-0.5 hover:bg-accent-primary/20 transition-colors">
              "{titleSearch}" ✕
            </button>
          )}
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
          {readingLength && (
            <button onClick={() => { setReadingLength(''); setPage(1); }} className="flex items-center gap-1 text-xs bg-accent-primary/10 text-accent-primary border border-accent-primary/30 rounded-full px-2 py-0.5 hover:bg-accent-primary/20 transition-colors">
              {readingLength === 'quick' ? 'Quick read' : readingLength === 'medium' ? 'Medium read' : 'Long read'} ✕
            </button>
          )}
          <button onClick={() => { setTitleSearch(''); setSourceFilter(''); setTagFilter(''); setReadFilter(''); setSentimentFilter(''); setLanguageFilter(''); setDatePreset(''); setReadingLength(''); setPage(1); }} className="text-xs text-text-tertiary hover:text-text-primary ml-1 transition-colors">
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
        <div className="space-y-2 relative">
          {selectedIdx >= 0 && (
            <div className="fixed bottom-4 right-4 z-30 pointer-events-none">
              <span className="text-xs font-mono bg-bg-elevated border border-border rounded px-2 py-1 text-text-tertiary shadow">
                {selectedIdx + 1}/{data.data.length}
              </span>
            </div>
          )}
          {(() => { setArticleNavList(data.data.map(a => a.id)); return null; })()}
          {data.data.map((article, i) => {
            let dateBucket: string | null = null;
            if (groupByDate) {
              const now = new Date();
              const d = new Date(article.publishedAt);
              const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
              if (d.toDateString() === now.toDateString()) dateBucket = 'Today';
              else if (diffDays < 2) dateBucket = 'Yesterday';
              else if (diffDays < 7) dateBucket = 'This Week';
              else if (diffDays < 30) dateBucket = 'This Month';
              else dateBucket = 'Older';
            }
            const prevBucket = i > 0 && groupByDate ? (() => {
              const prev = data.data[i - 1];
              const now = new Date();
              const d = new Date(prev.publishedAt);
              const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
              if (d.toDateString() === now.toDateString()) return 'Today';
              if (diffDays < 2) return 'Yesterday';
              if (diffDays < 7) return 'This Week';
              if (diffDays < 30) return 'This Month';
              return 'Older';
            })() : null;
            const showHeader = groupByDate && dateBucket && dateBucket !== prevBucket;
            return (
              <React.Fragment key={article.id}>
                {showHeader && (() => {
                  const bucketCount = data.data.filter(a => {
                    const d = new Date(a.publishedAt);
                    const diffDays = Math.floor((new Date().getTime() - d.getTime()) / 86400000);
                    if (d.toDateString() === new Date().toDateString()) return dateBucket === 'Today';
                    if (diffDays < 2) return dateBucket === 'Yesterday';
                    if (diffDays < 7) return dateBucket === 'This Week';
                    if (diffDays < 30) return dateBucket === 'This Month';
                    return dateBucket === 'Older';
                  }).length;
                  return (
                    <div className="flex items-center justify-between text-xs font-semibold text-text-tertiary uppercase tracking-wider pt-3 pb-0.5 px-1 border-b border-border/50">
                      <span>{dateBucket}</span>
                      <span className="font-mono font-normal text-[10px]">{bucketCount}</span>
                    </div>
                  );
                })()}
                <div data-article-idx={i} onMouseEnter={() => setSelectedIdx(i)}>
                  <ArticleCard
                    article={article}
                    sourceName={article.feedSourceName}
                    variant={viewMode === 'compact' ? 'compact' : page === 1 && i === 0 && article.imageUrl ? 'hero' : 'default'}
                    selected={i === selectedIdx}
                  />
                </div>
              </React.Fragment>
            );
          })}
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
