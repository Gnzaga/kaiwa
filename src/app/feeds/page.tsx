'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface FeedStat {
  id: number;
  name: string;
  sourceName: string;
  regionId: string;
  regionName: string;
  regionFlag: string;
  categoryName: string;
  sourceLanguage: string;
  enabled: boolean;
  articleCount: number;
  lastArticleAt: string | null;
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function FeedsPage() {
  const [regionFilter, setRegionFilter] = useState('');
  const [search, setSearch] = useState('');
  const [staleOnly, setStaleOnly] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'' | 'enabled' | 'disabled'>('');
  const [feedSort, setFeedSort] = useState<'default' | 'articles' | 'stale'>('default');

  const { data: feeds, isLoading } = useQuery<FeedStat[]>({
    queryKey: ['feed-stats'],
    queryFn: () => fetch('/api/feeds/stats').then((r) => r.json()),
  });

  const regions = feeds ? [...new Set(feeds.map((f) => f.regionId))].map(id => {
    const f = feeds.find(x => x.regionId === id)!;
    return { id, name: f.regionName, flag: f.regionFlag };
  }) : [];

  const filtered = (feeds ?? []).filter((f) => {
    if (regionFilter && f.regionId !== regionFilter) return false;
    if (search && !f.sourceName.toLowerCase().includes(search.toLowerCase()) &&
        !f.name.toLowerCase().includes(search.toLowerCase())) return false;
    if (staleOnly) {
      const hours = f.lastArticleAt ? (Date.now() - new Date(f.lastArticleAt).getTime()) / 3600000 : Infinity;
      if (!(f.enabled && hours > 24)) return false;
    }
    if (statusFilter === 'enabled' && !f.enabled) return false;
    if (statusFilter === 'disabled' && f.enabled) return false;
    return true;
  });

  const sorted = filtered.slice().sort((a, b) => {
    if (feedSort === 'articles') return Number(b.articleCount) - Number(a.articleCount);
    if (feedSort === 'stale') {
      const aAge = a.lastArticleAt ? Date.now() - new Date(a.lastArticleAt).getTime() : Infinity;
      const bAge = b.lastArticleAt ? Date.now() - new Date(b.lastArticleAt).getTime() : Infinity;
      return bAge - aAge;
    }
    return 0;
  });

  const enabledCount = filtered.filter((f) => f.enabled).length;
  const totalArticles = filtered.reduce((sum, f) => sum + Number(f.articleCount), 0);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-6">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-text-primary">Feeds</h1>
          <p className="text-xs text-text-tertiary">
            {feeds ? (() => {
              const staleCount = feeds.filter(f => {
                if (!f.enabled || !f.lastArticleAt) return false;
                return (Date.now() - new Date(f.lastArticleAt).getTime()) / 3600000 > 24;
              }).length;
              return `${feeds.length} feeds · ${feeds.filter(f => f.enabled).length} active · ${feeds.reduce((s, f) => s + Number(f.articleCount), 0).toLocaleString()} articles${staleCount > 0 ? ` · ${staleCount} stale ⚠` : ''}`;
            })() : 'Loading...'}
          </p>
        </div>
        <a
          href="/api/feeds/opml"
          download="kaiwa-feeds.opml"
          className="px-3 py-1.5 text-xs border border-border rounded text-text-tertiary hover:text-text-primary hover:border-accent-primary transition-colors"
        >
          Export OPML
        </a>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search sources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary w-48"
        />
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="">All Regions</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>{r.flag} {r.name}</option>
          ))}
        </select>
        <button
          onClick={() => setStaleOnly(s => !s)}
          className={`px-3 py-1.5 text-xs border rounded transition-colors ${staleOnly ? 'border-yellow-500 text-yellow-500' : 'border-border text-text-tertiary hover:text-text-primary'}`}
        >
          {staleOnly ? '⚠ Stale only' : 'Show stale'}
        </button>
        <div className="flex border border-border rounded overflow-hidden text-xs">
          {(['', 'enabled', 'disabled'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setStatusFilter(v)}
              className={`px-2.5 py-1.5 transition-colors ${statusFilter === v ? 'bg-accent-primary text-bg-primary' : 'text-text-tertiary hover:text-text-primary'}`}
            >
              {v === '' ? 'All' : v === 'enabled' ? 'Active' : 'Disabled'}
            </button>
          ))}
        </div>
        <select
          value={feedSort}
          onChange={(e) => setFeedSort(e.target.value as 'default' | 'articles' | 'stale')}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="default">Default order</option>
          <option value="articles">Most articles</option>
          <option value="stale">Stalest first</option>
        </select>
        {(search || regionFilter || staleOnly || statusFilter) && (
          <span className="text-xs text-text-tertiary self-center">
            {filtered.length}/{feeds?.length ?? 0} feeds · {enabledCount} active · {totalArticles.toLocaleString()} articles
          </span>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-12 bg-bg-secondary border border-border rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-1">
          {sorted.map((feed) => (
            <div
              key={feed.id}
              className={`flex items-center gap-4 px-4 py-3 bg-bg-secondary border border-border rounded transition-colors ${
                feed.enabled ? '' : 'opacity-50'
              }`}
            >
              {/* Region flag + source */}
              <div className="flex items-center gap-2 w-48 shrink-0 min-w-0">
                <span className="text-base">{feed.regionFlag}</span>
                <div className="min-w-0">
                  <Link
                    href={`/articles?source=${encodeURIComponent(feed.sourceName)}`}
                    className="text-sm text-text-primary truncate hover:text-accent-primary transition-colors block"
                  >
                    {feed.sourceName}
                  </Link>
                  <div className="text-xs text-text-tertiary truncate">{feed.categoryName}</div>
                </div>
              </div>

              {/* Article count */}
              <div className="w-20 shrink-0 text-right">
                <span className="text-sm font-mono text-text-primary">
                  {Number(feed.articleCount).toLocaleString()}
                </span>
                <div className="text-xs text-text-tertiary">articles</div>
              </div>

              {/* Last article + health */}
              <div className="flex-1 text-xs">
                {feed.lastArticleAt ? (() => {
                  const hoursSince = (Date.now() - new Date(feed.lastArticleAt).getTime()) / 3600000;
                  const stale = feed.enabled && hoursSince > 48;
                  const warning = feed.enabled && hoursSince > 24 && !stale;
                  return (
                    <span className={stale ? 'text-accent-highlight' : warning ? 'text-yellow-500' : 'text-text-tertiary'}>
                      Last: {relativeTime(feed.lastArticleAt)}{stale ? ' ⚠' : ''}
                    </span>
                  );
                })() : (
                  <span className="text-text-tertiary">No articles yet</span>
                )}
              </div>

              {/* Lang badge */}
              <span className="text-xs font-mono text-text-tertiary border border-border rounded px-1.5 py-0.5 uppercase shrink-0">
                {feed.sourceLanguage}
              </span>

              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${feed.enabled ? 'bg-green-500' : 'bg-text-tertiary'}`} />

              {/* Link to region */}
              <Link
                href={`/region/${feed.regionId}`}
                className="text-xs text-text-tertiary hover:text-accent-primary transition-colors shrink-0"
              >
                View →
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
