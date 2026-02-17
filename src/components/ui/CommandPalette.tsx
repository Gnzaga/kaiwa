'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

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
  const inputRef = useRef<HTMLInputElement>(null);
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
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  if (!open) return null;

  const results = data?.data ?? [];

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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && query.trim()) {
                setOpen(false);
                router.push(`/search?q=${encodeURIComponent(query.trim())}`);
              }
            }}
            placeholder="Search articles... (Enter for full results)"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none"
          />
          <kbd className="text-xs text-text-tertiary font-mono">Esc</kbd>
        </div>

        {results.length > 0 && (
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {results.map((article) => (
              <button
                key={article.id}
                onClick={() => { setOpen(false); router.push(`/article/${article.id}`); }}
                className="w-full text-left px-4 py-3 hover:bg-bg-primary transition-colors"
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
              onClick={() => { setOpen(false); router.push(`/search?q=${encodeURIComponent(query)}`); }}
              className="w-full text-left px-4 py-3 text-xs text-accent-primary hover:text-accent-highlight transition-colors"
            >
              See all results for &quot;{query}&quot; →
            </button>
          </div>
        )}

        {query.length > 1 && results.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-text-tertiary">No results</div>
        )}

        {query.length <= 1 && (
          <div className="px-4 py-3 text-xs text-text-tertiary">
            Type to search, Enter for full results, Esc to close
          </div>
        )}
      </div>
    </div>
  );
}
