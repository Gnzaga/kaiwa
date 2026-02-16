'use client';

import Link from 'next/link';
import type { Article } from '@/db/schema';
import Tag from '@/components/ui/Tag';
import SentimentBadge from './SentimentBadge';
import StatusIndicator from '@/components/ui/StatusIndicator';

function relativeTime(date: Date | string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ArticleCard({
  article,
  sourceName,
}: {
  article: Article;
  sourceName?: string;
}) {
  const title = article.translatedTitle || article.originalTitle;
  const showOriginal = article.translatedTitle && article.translatedTitle !== article.originalTitle;

  return (
    <Link href={`/article/${article.id}`}>
      <article className="accent-line pl-4 py-3 pr-4 bg-bg-secondary border border-border rounded-r card-hover animate-fade-in cursor-pointer">
        {/* Header: source + time */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            {sourceName && <span>{sourceName}</span>}
            <span>{relativeTime(article.publishedAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <StatusIndicator
              status={article.translationStatus ?? 'pending'}
              tooltip={`Translation: ${article.translationStatus}`}
            />
            <StatusIndicator
              status={article.summaryStatus ?? 'pending'}
              tooltip={`Summary: ${article.summaryStatus}`}
            />
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm font-medium text-text-primary leading-snug mb-0.5">{title}</h3>

        {/* Original title */}
        {showOriginal && (
          <p className="text-xs text-text-tertiary font-jp mb-1.5 truncate">
            {article.originalTitle}
          </p>
        )}

        {/* TL;DR */}
        {article.summaryTldr && (
          <p className="text-xs text-text-secondary line-clamp-2 mb-2">{article.summaryTldr}</p>
        )}

        {/* Footer: tags + sentiment */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-wrap">
            {article.summaryTags?.slice(0, 3).map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </div>
          <SentimentBadge sentiment={article.summarySentiment} />
        </div>
      </article>
    </Link>
  );
}
