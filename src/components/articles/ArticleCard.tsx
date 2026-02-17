'use client';

import Link from 'next/link';
import type { Article } from '@/db/schema';
import Tag from '@/components/ui/Tag';
import SentimentBadge from './SentimentBadge';
import StatusIndicator from '@/components/ui/StatusIndicator';

function readingTime(content: string | null | undefined): string | null {
  if (!content) return null;
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return minutes < 1 ? null : `${minutes} min`;
}

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
  categorySlug,
  variant = 'default',
}: {
  article: Article & { imageUrl?: string | null; categorySlug?: string | null };
  sourceName?: string;
  categorySlug?: string | null;
  variant?: 'default' | 'hero' | 'compact';
}) {
  const displayCategory = categorySlug ?? (article as Article & { categorySlug?: string | null }).categorySlug;
  const title = article.translatedTitle || article.originalTitle;
  const showOriginal = article.translatedTitle && article.translatedTitle !== article.originalTitle;
  const imageUrl = article.imageUrl;

  // Hero variant — large featured card with full-width image
  if (variant === 'hero' && imageUrl) {
    return (
      <Link href={`/article/${article.id}`}>
        <article className="group relative rounded-xl overflow-hidden bg-bg-secondary border border-border card-hover animate-fade-in cursor-pointer">
          <div className="aspect-[16/9] w-full bg-bg-elevated">
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
              }}
            />
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
              {sourceName && <span className="font-medium text-accent-primary">{sourceName}</span>}
              <span>{relativeTime(article.publishedAt)}</span>
              <SentimentBadge sentiment={article.summarySentiment} />
            </div>
            <h3 className="text-base font-semibold text-text-primary leading-snug mb-1">{title}</h3>
            {showOriginal && (
              <p className="text-xs text-text-tertiary font-jp mb-1.5 truncate">{article.originalTitle}</p>
            )}
            {article.summaryTldr && (
              <p className="text-sm text-text-secondary line-clamp-2">{article.summaryTldr}</p>
            )}
            {article.summaryTags && article.summaryTags.length > 0 && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {article.summaryTags.slice(0, 3).map((tag) => (
                  <Tag key={tag} label={tag} />
                ))}
              </div>
            )}
          </div>
        </article>
      </Link>
    );
  }

  // Compact variant — minimal row for lists
  if (variant === 'compact') {
    return (
      <Link href={`/article/${article.id}`}>
        <article className="flex items-center gap-3 py-2.5 px-3 rounded-lg card-hover animate-fade-in cursor-pointer group">
          {imageUrl && (
            <div className="shrink-0 w-14 h-14 rounded-lg overflow-hidden bg-bg-elevated">
              <img src={imageUrl} alt="" className="w-full h-full object-cover" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-text-primary leading-snug line-clamp-2 group-hover:text-accent-highlight transition-colors">{title}</h3>
            <div className="flex items-center gap-2 text-xs text-text-tertiary mt-0.5">
              {sourceName && <span>{sourceName}</span>}
              <span>{relativeTime(article.publishedAt)}</span>
            </div>
          </div>
        </article>
      </Link>
    );
  }

  // Default variant — image on right, content on left (Apple News row style)
  const rt = readingTime(article.translatedContent || article.originalContent);
  return (
    <Link href={`/article/${article.id}`}>
      <article className="flex gap-3 p-3 bg-bg-secondary border border-border rounded-xl card-hover animate-fade-in cursor-pointer group">
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Source + time */}
          <div>
            <div className="flex items-center gap-2 text-xs text-text-tertiary mb-1">
              {sourceName && <span className="font-medium text-accent-primary">{sourceName}</span>}
              {displayCategory && (
                <span className="px-1.5 py-0.5 rounded bg-bg-elevated text-text-tertiary border border-border capitalize text-[10px]">
                  {displayCategory}
                </span>
              )}
              <span>{relativeTime(article.publishedAt)}</span>
              {rt && <span>{rt} read</span>}
              <div className="flex items-center gap-1 ml-auto">
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
            <h3 className="text-sm font-semibold text-text-primary leading-snug line-clamp-3 group-hover:text-accent-highlight transition-colors">{title}</h3>

            {/* Original title */}
            {showOriginal && (
              <p className="text-xs text-text-tertiary font-jp mt-0.5 truncate">{article.originalTitle}</p>
            )}

            {/* TL;DR */}
            {article.summaryTldr && (
              <p className="text-xs text-text-secondary line-clamp-2 mt-1">{article.summaryTldr}</p>
            )}
          </div>

          {/* Footer: tags + sentiment */}
          <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {article.summaryTags?.slice(0, 3).map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
            <SentimentBadge sentiment={article.summarySentiment} />
          </div>
        </div>

        {/* Image on right */}
        {imageUrl && (
          <div className="shrink-0 w-24 h-24 rounded-lg overflow-hidden bg-bg-elevated self-center">
            <img
              src={imageUrl}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
              onError={(e) => {
                (e.target as HTMLImageElement).parentElement!.style.display = 'none';
              }}
            />
          </div>
        )}
      </article>
    </Link>
  );
}
