'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface Article {
  id: number;
  translatedTitle: string | null;
  originalTitle: string;
  feedSourceName?: string | null;
  readingMinutes?: number | null;
}

export default function QuickRead() {
  const { data } = useQuery<{ data: Article[] }>({
    queryKey: ['quick-read-articles'],
    queryFn: () =>
      fetch('/api/articles?isRead=false&sort=quickest&pageSize=3&page=1').then(r => r.json()),
    staleTime: 120000,
  });

  const articles = data?.data ?? [];
  if (articles.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Quick Reads</h2>
      <div className="space-y-1">
        {articles.map(article => {
          const title = article.translatedTitle || article.originalTitle;
          const rt = article.readingMinutes && article.readingMinutes > 0 ? `${article.readingMinutes}m` : null;
          return (
            <Link key={article.id} href={`/article/${article.id}`}>
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary line-clamp-1 group-hover:text-accent-primary transition-colors">{title}</div>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary mt-0.5">
                    {article.feedSourceName && <span>{article.feedSourceName}</span>}
                    {rt && <span className="font-mono text-accent-secondary">{rt} read</span>}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <Link
        href="/articles?sort=quickest&readFilter=unread"
        className="text-xs text-text-tertiary hover:text-accent-primary transition-colors block text-right"
      >
        More quick reads →
      </Link>
    </section>
  );
}
