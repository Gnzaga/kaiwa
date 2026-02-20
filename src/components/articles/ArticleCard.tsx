'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
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

function absoluteTime(date: Date | string): string {
  return new Date(date).toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ArticleCard({
  article,
  sourceName,
  categorySlug,
  variant = 'default',
  selected = false,
}: {
  article: Article & { imageUrl?: string | null; categorySlug?: string | null; isRead?: boolean | null; isStarred?: boolean | null; readingMinutes?: number | null };
  sourceName?: string;
  categorySlug?: string | null;
  variant?: 'default' | 'hero' | 'compact';
  selected?: boolean;
}) {
  const displayCategory = categorySlug ?? (article as Article & { categorySlug?: string | null }).categorySlug;
  const isRead = (article as Article & { isRead?: boolean | null }).isRead;
  const isStarred = (article as Article & { isStarred?: boolean | null }).isStarred;
  const title = article.translatedTitle || article.originalTitle;
  const showOriginal = article.translatedTitle && article.translatedTitle !== article.originalTitle;
  const imageUrl = article.imageUrl;
  const precomputedRt = (article as Article & { readingMinutes?: number | null }).readingMinutes;
  const rt = precomputedRt && precomputedRt > 0 ? `${precomputedRt} min` : readingTime(article.translatedContent || article.originalContent);

  // All hooks must be called before any conditional returns (Rules of Hooks)
  const queryClient = useQueryClient();
  const router = useRouter();
  const [localStarred, setLocalStarred] = useState<boolean | null>(null);
  const [localRead, setLocalRead] = useState<boolean | null>(null);
  const [localArchived, setLocalArchived] = useState<boolean | null>(null);
  const [inProgress, setInProgress] = useState(false);
  useEffect(() => {
    const saved = localStorage.getItem(`article-scroll-${article.id}`);
    setInProgress(!!saved && parseInt(saved, 10) > 100);
  }, [article.id]);
  const starred = localStarred !== null ? localStarred : !!isStarred;
  const read = localRead !== null ? localRead : !!isRead;
  const archived = localArchived !== null ? localArchived : !!(article as Article & { isArchived?: boolean | null }).isArchived;

  // Hero variant — large featured card with full-width image
  if (variant === 'hero' && imageUrl) {
    return (
      <Link href={`/article/${article.id}`}>
        <article className={`group relative rounded-xl overflow-hidden bg-bg-secondary border card-hover animate-fade-in cursor-pointer${selected ? ' border-accent-primary ring-1 ring-accent-primary' : ' border-border'}`}>
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
              <span title={absoluteTime(article.publishedAt)}>{relativeTime(article.publishedAt)}</span>
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
        <article className={`flex items-center gap-3 py-2.5 px-3 rounded-lg card-hover animate-fade-in cursor-pointer group${selected ? ' bg-accent-primary/5 border border-accent-primary/40' : ''}`}>
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
              {sourceName && (
                <a
                  href={`/articles?source=${encodeURIComponent(sourceName)}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-accent-primary hover:text-accent-highlight transition-colors"
                >
                  {sourceName}
                </a>
              )}
              <span title={absoluteTime(article.publishedAt)}>{relativeTime(article.publishedAt)}</span>
              {rt && <span className="opacity-70">{rt}</span>}
              <SentimentBadge sentiment={article.summarySentiment} />
            </div>
          </div>
        </article>
      </Link>
    );
  }

  const quickAction = async (e: React.MouseEvent, type: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (type === 'toggleStar') setLocalStarred(!starred);
    if (type === 'toggleRead') setLocalRead(!read);
    if (type === 'toggleArchive') setLocalArchived(!archived);
    await fetch(`/api/articles/${article.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type }),
    });
    queryClient.invalidateQueries({ queryKey: ['articles'] });
  };

  const isNew = !read && (Date.now() - new Date(article.publishedAt).getTime()) < 6 * 60 * 60 * 1000;
  return (
    <Link href={`/article/${article.id}`}>
      <article
        className={`flex gap-3 p-3 bg-bg-secondary border rounded-xl card-hover animate-fade-in cursor-pointer group transition-opacity${read ? ' opacity-60 hover:opacity-100' : ''}${selected ? ' border-accent-primary ring-1 ring-accent-primary' : starred ? ' border-accent-highlight/30' : ' border-border'}`}
        onDoubleClick={(e) => { e.preventDefault(); window.open(article.originalUrl, '_blank', 'noopener,noreferrer'); }}
      >
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          {/* Source + time */}
          <div>
            <div className="flex items-center gap-2 text-xs text-text-tertiary mb-1">
              {sourceName && (
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/articles?source=${encodeURIComponent(sourceName)}`); }}
                  className="font-medium text-accent-primary hover:text-accent-highlight transition-colors"
                >
                  {sourceName}
                </button>
              )}
              {displayCategory && (() => {
                const regionId = (article as Article & { feedRegionId?: string | null }).feedRegionId;
                const catHref = regionId ? `/region/${regionId}/${displayCategory}` : null;
                return catHref ? (
                  <a
                    href={catHref}
                    onClick={(e) => e.stopPropagation()}
                    className="px-1.5 py-0.5 rounded bg-bg-elevated text-text-tertiary border border-border capitalize text-[10px] hover:border-accent-primary hover:text-accent-primary transition-colors"
                  >
                    {displayCategory}
                  </a>
                ) : (
                  <span className="px-1.5 py-0.5 rounded bg-bg-elevated text-text-tertiary border border-border capitalize text-[10px]">
                    {displayCategory}
                  </span>
                );
              })()}
              <span title={absoluteTime(article.publishedAt)}>{relativeTime(article.publishedAt)}</span>
              {rt && <span>{rt} read</span>}
              {isNew && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold tracking-wider bg-accent-primary/20 text-accent-primary border border-accent-primary/30">
                  NEW
                </span>
              )}
              {inProgress && !read && (
                <span className="px-1.5 py-0.5 rounded text-[9px] font-medium tracking-wider bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/30">
                  ▶ IN PROGRESS
                </span>
              )}
              {article.sourceLanguage && article.sourceLanguage !== 'en' && (
                <span className="px-1 py-0.5 text-[9px] font-mono uppercase border border-border rounded text-text-tertiary" title={`Source: ${article.sourceLanguage}`}>
                  {article.sourceLanguage}
                </span>
              )}
              <div className="flex items-center gap-1 ml-auto">
                {starred && (
                  <span className="text-accent-highlight" title="Starred">★</span>
                )}
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

            {/* Image under title */}
            {imageUrl && (
              <div className="mt-2 mb-1.5 rounded-lg overflow-hidden bg-bg-elevated max-h-48 border border-border/50">
                <img
                  src={imageUrl}
                  alt=""
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                    (e.target as HTMLImageElement).parentElement!.style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Original title */}
            {showOriginal && (
              <p className="text-xs text-text-tertiary font-jp mt-0.5 truncate">{article.originalTitle}</p>
            )}

            {/* TL;DR */}
            {article.summaryTldr && (
              <p className="text-xs text-text-secondary line-clamp-2 mt-1">{article.summaryTldr}</p>
            )}
          </div>

          {/* Footer: tags + sentiment + quick actions */}
          <div className="flex items-center justify-between gap-2 flex-wrap mt-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              {article.summaryTags?.slice(0, 3).map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <SentimentBadge sentiment={article.summarySentiment} />
              {/* Hover quick actions */}
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                <button
                  onClick={(e) => quickAction(e, 'toggleStar')}
                  title={starred ? 'Unstar' : 'Star'}
                  className={`text-xs px-1.5 py-0.5 rounded border transition-colors ${starred ? 'border-accent-highlight text-accent-highlight' : 'border-border text-text-tertiary hover:border-accent-highlight hover:text-accent-highlight'}`}
                >★</button>
                <button
                  onClick={(e) => quickAction(e, 'toggleRead')}
                  title={read ? 'Mark unread' : 'Mark read'}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${read ? 'border-accent-primary text-accent-primary' : 'border-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary'}`}
                >{read ? '✓' : '○'}</button>
                <button
                  onClick={(e) => quickAction(e, 'toggleArchive')}
                  title={archived ? 'Unarchive' : 'Archive'}
                  className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${archived ? 'border-text-secondary text-text-secondary' : 'border-border text-text-tertiary hover:border-text-secondary hover:text-text-secondary'}`}
                >■</button>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigator.clipboard.writeText(article.originalUrl);
                  }}
                  title="Copy link"
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary transition-colors"
                >⎘</button>
                <a
                  href={article.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  title="Open original"
                  className="text-[10px] px-1.5 py-0.5 rounded border border-border text-text-tertiary hover:border-accent-secondary hover:text-accent-secondary transition-colors"
                >↗</a>
              </div>
            </div>
          </div>
        </div>
      </article>
    </Link>
  );
}
