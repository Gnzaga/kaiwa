'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const RECENT_ARTICLES_KEY = 'kaiwa-recent-articles';

interface RecentArticle {
  id: number;
  title: string;
  source?: string;
}

export default function RecentlyViewed() {
  const [articles, setArticles] = useState<RecentArticle[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_ARTICLES_KEY);
      if (raw) setArticles(JSON.parse(raw).slice(0, 5));
    } catch {}
  }, []);

  if (articles.length === 0) return null;

  return (
    <div className="bg-bg-secondary border border-border rounded p-4 accent-line-top">
      <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Recently Viewed</h2>
      <div className="space-y-1.5">
        {articles.map((a) => (
          <Link
            key={a.id}
            href={`/articles/${a.id}`}
            className="flex items-center gap-2 group"
          >
            <div className="w-1 h-1 rounded-full bg-text-tertiary/50 group-hover:bg-accent-primary shrink-0 transition-colors" />
            <div className="min-w-0">
              <span className="text-sm text-text-secondary group-hover:text-accent-primary transition-colors truncate block leading-snug">
                {a.title}
              </span>
              {a.source && (
                <span className="text-xs text-text-tertiary">{a.source}</span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
