'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

const RECENT_ARTICLES_KEY = 'kaiwa-recent-articles';
const MAX_RECENT_ARTICLES = 6;

interface RecentArticle { id: number; title: string; source?: string; }

export function trackArticleView(id: number, title: string, source?: string) {
  if (typeof window === 'undefined') return;
  const prev: RecentArticle[] = getRecentArticles().filter(a => a.id !== id);
  localStorage.setItem(RECENT_ARTICLES_KEY, JSON.stringify([{ id, title, source }, ...prev].slice(0, MAX_RECENT_ARTICLES)));
}

function getRecentArticles(): RecentArticle[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_ARTICLES_KEY) ?? '[]'); } catch { return []; }
}

interface SearchResult {
  id: number;
  translatedTitle?: string | null;
  originalTitle: string;
  publishedAt: string;
  feedSourceName?: string;
}

interface SearchResponse {
  data: SearchResult[];
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [recentArticles, setRecentArticles] = useState<RecentArticle[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const { data } = useQuery<SearchResponse>({
    queryKey: ['cmd-search', query],
    queryFn: () =>
      fetch(`/api/articles/search?q=${encodeURIComponent(query)}&pageSize=6`).then((r) => r.json()),
    enabled: open && query.length > 1,
    staleTime: 10000,
  });

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
        setQuery('');
        setSelectedIdx(-1);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setRecentArticles(getRecentArticles());
    }
  }, [open]);

  // Reset selection when query changes
  useEffect(() => { setSelectedIdx(-1); }, [query]);

  if (!open) return null;

  const results = data?.data ?? [];
  const isSearchMode = query.length > 1;

  // Unified items list for keyboard navigation
  // Search mode: results + "see all" sentinel (id=-1)
  // Recent mode: recent articles
  const navItems: { id: number; href: string }[] = isSearchMode
    ? [...results.map(r => ({ id: r.id, href: `/article/${r.id}` })),
       ...(results.length > 0 ? [{ id: -1, href: `/search?q=${encodeURIComponent(query)}` }] : [])]
    : recentArticles.map(a => ({ id: a.id, href: `/article/${a.id}` }));

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(selectedIdx + 1, navItems.length - 1);
      setSelectedIdx(next);
      // Scroll selected item into view
      setTimeout(() => {
        listRef.current?.querySelector(`[data-idx="${next}"]`)?.scrollIntoView({ block: 'nearest' });
      }, 0);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((v) => Math.max(v - 1, -1));
    } else if (e.key === 'Enter') {
      if (selectedIdx >= 0 && navItems[selectedIdx]) {
        setOpen(false);
        router.push(navItems[selectedIdx].href);
      } else if (query.trim()) {
        setOpen(false);
        router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-lg bg-bg-elevated border border-border rounded-xl shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <svg className="w-4 h-4 text-text-tertiary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search articles... (Enter for full results)"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <kbd className="text-xs text-text-tertiary font-mono">Esc</kbd>
        </div>

        {isSearchMode && results.length > 0 && (
          <div ref={listRef} className="divide-y divide-border max-h-80 overflow-y-auto">
            {results.map((article, i) => (
              <button
                key={article.id}
                data-idx={i}
                onClick={() => { setOpen(false); router.push(`/article/${article.id}`); }}
                className={`w-full text-left px-4 py-3 transition-colors ${selectedIdx === i ? 'bg-bg-primary' : 'hover:bg-bg-primary'}`}
              >
                <div className="text-sm text-text-primary line-clamp-1">
                  {article.translatedTitle || article.originalTitle}
                </div>
                <div className="flex items-center gap-2 text-xs text-text-tertiary mt-0.5">
                  {article.feedSourceName && <span>{article.feedSourceName}</span>}
                  <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
                </div>
              </button>
            ))}
            <button
              data-idx={results.length}
              onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(query)}`); }}
              className={`w-full text-left px-4 py-3 text-xs text-accent-primary transition-colors ${selectedIdx === results.length ? 'bg-bg-primary text-accent-highlight' : 'hover:text-accent-highlight'}`}
            >
              See all results for &quot;{query}&quot; →
            </button>
          </div>
        )}

        {isSearchMode && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-text-tertiary">No results</div>
        )}

        {!isSearchMode && recentArticles.length > 0 && (
          <div>
            <div className="px-4 pt-3 pb-1 text-xs text-text-tertiary font-medium uppercase tracking-wider">Recently Viewed</div>
            <div ref={listRef} className="divide-y divide-border">
              {recentArticles.map((article, i) => (
                <button
                  key={article.id}
                  data-idx={i}
                  onClick={() => { setOpen(false); router.push(`/article/${article.id}`); }}
                  className={`w-full text-left px-4 py-2.5 transition-colors ${selectedIdx === i ? 'bg-bg-primary' : 'hover:bg-bg-primary'}`}
                >
                  <div className="text-sm text-text-primary line-clamp-1">{article.title}</div>
                  {article.source && <div className="text-xs text-text-tertiary mt-0.5">{article.source}</div>}
                </button>
              ))}
            </div>
            <div className="px-4 py-2 text-xs text-text-tertiary border-t border-border">
              ↑↓ to navigate · Enter to open · Esc to close
            </div>
          </div>
        )}

        {!isSearchMode && recentArticles.length === 0 && (
          <div className="px-4 py-3 text-xs text-text-tertiary">
            Type to search, Enter for full results, Esc to close
          </div>
        )}
      </div>
    </div>
  );
}
