'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface InProgressEntry { id: number; scrollY: number; }

interface Article {
  id: number;
  translatedTitle?: string | null;
  originalTitle: string;
  feedSourceName?: string | null;
  readingMinutes?: number | null;
  isRead?: boolean;
}

function loadEntries(): InProgressEntry[] {
  const found: InProgressEntry[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('article-scroll-')) {
      const id = parseInt(key.slice('article-scroll-'.length), 10);
      const val = parseInt(localStorage.getItem(key) ?? '0', 10);
      if (!isNaN(id) && val > 100) found.push({ id, scrollY: val });
    }
  }
  return found.slice(0, 6);
}

export default function ContinueReading() {
  const [entries, setEntries] = useState<InProgressEntry[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    setEntries(loadEntries());
  }, []);

  const ids = entries.map(e => e.id);

  const { data } = useQuery<{ data: Article[] }>({
    queryKey: ['continue-reading', ids.join(',')],
    queryFn: () => fetch(`/api/articles?ids=${ids.join(',')}`).then(r => r.json()),
    enabled: ids.length > 0,
    staleTime: 60000,
  });

  if (ids.length === 0) return null;

  // Filter to unread articles only (read articles don't need "continuing")
  const articles = (data?.data ?? []).filter(a => !a.isRead);
  if (articles.length === 0) return null;

  function dismiss(e: React.MouseEvent, id: number) {
    e.preventDefault();
    e.stopPropagation();
    localStorage.removeItem(`article-scroll-${id}`);
    setEntries(prev => prev.filter(en => en.id !== id));
    queryClient.invalidateQueries({ queryKey: ['continue-reading'] });
  }

  return (
    <div>
      <h2 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-2">Continue Reading</h2>
      <div className="space-y-0.5">
        {articles.map((a) => (
          <Link
            key={a.id}
            href={`/article/${a.id}`}
            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-secondary transition-colors group"
          >
            <span className="text-accent-secondary text-[10px] shrink-0">▶</span>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-text-primary line-clamp-1 group-hover:text-accent-highlight transition-colors">
                {a.translatedTitle || a.originalTitle}
              </div>
              {a.feedSourceName && (
                <div className="text-xs text-text-tertiary">{a.feedSourceName}</div>
              )}
            </div>
            {a.readingMinutes && a.readingMinutes > 0 && (
              <span className="text-xs text-text-tertiary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">{a.readingMinutes}m</span>
            )}
            <button
              onClick={(e) => dismiss(e, a.id)}
              title="Dismiss"
              className="text-xs text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-text-primary transition-all shrink-0"
            >✕</button>
          </Link>
        ))}
      </div>
    </div>
  );
}
