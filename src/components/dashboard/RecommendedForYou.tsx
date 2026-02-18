'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface RecommendedArticle {
  id: number;
  translatedTitle: string | null;
  originalTitle: string;
  summaryTldr: string | null;
  summaryTags: string[] | null;
  summarySentiment: string | null;
  feedSourceName: string | null;
  publishedAt: string;
}

const sentimentColor: Record<string, string> = {
  positive: 'text-success',
  bullish: 'text-success',
  negative: 'text-accent-highlight',
  bearish: 'text-accent-highlight',
  neutral: 'text-text-tertiary',
};

export default function RecommendedForYou() {
  const { data } = useQuery<RecommendedArticle[]>({
    queryKey: ['recommended-articles'],
    queryFn: () => fetch('/api/articles/recommended').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const articles = Array.isArray(data) ? data : [];
  if (articles.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-text-secondary uppercase tracking-wider">For You</h2>
      <div className="space-y-1">
        {articles.map(article => {
          const title = article.translatedTitle || article.originalTitle;
          const sc = article.summarySentiment ? sentimentColor[article.summarySentiment.toLowerCase()] ?? 'text-text-tertiary' : null;
          return (
            <Link key={article.id} href={`/article/${article.id}`}>
              <div className="flex items-start gap-3 px-3 py-2 rounded-lg hover:bg-bg-elevated transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text-primary line-clamp-2 group-hover:text-accent-primary transition-colors leading-snug">{title}</div>
                  <div className="flex items-center gap-2 text-xs text-text-tertiary mt-0.5 flex-wrap">
                    {article.feedSourceName && <span>{article.feedSourceName}</span>}
                    {article.summarySentiment && sc && (
                      <span className={sc}>{article.summarySentiment}</span>
                    )}
                    {article.summaryTags && article.summaryTags.length > 0 && (
                      <span className="text-accent-secondary">{article.summaryTags.slice(0, 2).join(', ')}</span>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
