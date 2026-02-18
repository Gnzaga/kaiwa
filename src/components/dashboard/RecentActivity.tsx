'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import type { Article } from '@/db/schema';

interface RecentArticle extends Article {
  feedSourceName: string | null;
  readAt: string | Date | null;
}

interface Response {
  data: RecentArticle[];
  total: number;
}

function relativeTime(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function RecentActivity() {
  const { data } = useQuery<Response>({
    queryKey: ['articles-recent-read'],
    queryFn: () =>
      fetch('/api/articles?isRead=true&sort=newest&pageSize=5&page=1').then((r) => r.json()),
    staleTime: 30000,
  });

  const articles = data?.data ?? [];
  if (articles.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">Recently Read</h2>
        <Link href="/articles?readFilter=read" className="text-xs text-text-tertiary hover:text-accent-primary transition-colors">
          View all read →
        </Link>
      </div>
      <div className="space-y-1">
        {articles.map((article) => {
          const title = article.translatedTitle || article.originalTitle;
          return (
            <Link key={article.id} href={`/article/${article.id}`}>
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors group">
                {article.imageUrl && (
                  <img
                    src={article.imageUrl}
                    alt=""
                    className="w-9 h-9 object-cover rounded shrink-0"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-secondary group-hover:text-text-primary truncate transition-colors">
                    {title}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary">
                    {article.feedSourceName && <span>{article.feedSourceName}</span>}
                  </div>
                </div>
                <span className="text-xs text-text-tertiary shrink-0">
                  {relativeTime(article.readAt ?? article.publishedAt)}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
