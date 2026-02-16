'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Article } from '@/db/schema';
import Tag from '@/components/ui/Tag';
import SentimentBadge from './SentimentBadge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import BrushDivider from '@/components/ui/BrushDivider';
import ArticleCard from './ArticleCard';

interface ArticleDetailResponse {
  article: Article & { sourceName?: string };
  related: (Article & { sourceName?: string })[];
}

export default function ArticleDetail({ id }: { id: number }) {
  const [showOriginal, setShowOriginal] = useState(false);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<ArticleDetailResponse>({
    queryKey: ['article', id],
    queryFn: () => fetch(`/api/articles/${id}`).then((r) => r.json()),
  });

  const actionMutation = useMutation({
    mutationFn: (action: { type: string }) =>
      fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      }).then((r) => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-bg-secondary rounded w-3/4" />
        <div className="h-4 bg-bg-secondary rounded w-1/2" />
        <div className="h-64 bg-bg-secondary rounded" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="text-center py-12 text-accent-highlight text-sm">
        Failed to load article
      </div>
    );
  }

  const { article, related } = data;
  const title = article.translatedTitle || article.originalTitle;

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Header */}
      <header className="space-y-2">
        <div className="flex items-center gap-3 text-xs text-text-tertiary">
          {article.sourceName && <span>{article.sourceName}</span>}
          <span>
            {new Date(article.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          <StatusIndicator status={article.translationStatus ?? 'pending'} tooltip={`Translation: ${article.translationStatus}`} />
          <StatusIndicator status={article.summaryStatus ?? 'pending'} tooltip={`Summary: ${article.summaryStatus}`} />
        </div>
        <h1 className="text-2xl font-semibold text-text-primary leading-tight">{title}</h1>
        {article.translatedTitle && article.translatedTitle !== article.originalTitle && (
          <p className="text-sm text-text-tertiary font-jp">{article.originalTitle}</p>
        )}
      </header>

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <ActionButton
          onClick={() => actionMutation.mutate({ type: 'toggleRead' })}
          active={article.isRead ?? false}
        >
          {article.isRead ? 'Mark Unread' : 'Mark Read'}
        </ActionButton>
        <ActionButton
          onClick={() => actionMutation.mutate({ type: 'toggleStar' })}
          active={article.isStarred ?? false}
        >
          {article.isStarred ? 'Unstar' : 'Star'}
        </ActionButton>
        <ActionButton
          onClick={() => actionMutation.mutate({ type: 'toggleArchive' })}
          active={article.isArchived ?? false}
        >
          {article.isArchived ? 'Unarchive' : 'Archive'}
        </ActionButton>
        <ActionButton onClick={() => actionMutation.mutate({ type: 'retranslate' })}>
          Re-translate
        </ActionButton>
        <ActionButton onClick={() => actionMutation.mutate({ type: 'resummarize' })}>
          Re-summarize
        </ActionButton>
        <a
          href={article.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
        >
          View Original
        </a>
      </div>

      <BrushDivider />

      {/* AI Summary */}
      {article.summaryStatus === 'complete' && (
        <section className="bg-bg-elevated border border-border rounded p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-text-primary">AI Summary</h2>
            <SentimentBadge sentiment={article.summarySentiment} />
          </div>
          {article.summaryTldr && (
            <p className="text-sm text-text-secondary leading-relaxed">{article.summaryTldr}</p>
          )}
          {article.summaryBullets && article.summaryBullets.length > 0 && (
            <ul className="space-y-1.5 pl-4">
              {article.summaryBullets.map((bullet, i) => (
                <li key={i} className="text-sm text-text-secondary list-disc">{bullet}</li>
              ))}
            </ul>
          )}
          {article.summaryTags && article.summaryTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {article.summaryTags.map((tag) => (
                <Tag key={tag} label={tag} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Translated content */}
      {article.translatedContent && (
        <section className="prose-sm text-text-secondary leading-relaxed space-y-3">
          <div dangerouslySetInnerHTML={{ __html: article.translatedContent }} />
        </section>
      )}

      {/* Original Japanese text (collapsible) */}
      {article.originalContent && (
        <section className="border border-border rounded overflow-hidden">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center justify-between w-full px-4 py-3 text-sm text-text-tertiary hover:text-text-secondary transition-colors bg-bg-elevated"
          >
            <span className="font-jp">{'\u539F\u6587'} Original</span>
            <svg
              className={`w-4 h-4 transition-transform ${showOriginal ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {showOriginal && (
            <div className="px-4 py-3 text-sm text-text-tertiary font-jp leading-relaxed border-t border-border">
              <div dangerouslySetInnerHTML={{ __html: article.originalContent }} />
            </div>
          )}
        </section>
      )}

      {/* Related articles */}
      {related && related.length > 0 && (
        <>
          <BrushDivider className="my-6" />
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-text-tertiary">Related Articles</h2>
            <div className="space-y-2">
              {related.map((r) => (
                <ArticleCard key={r.id} article={r} sourceName={r.sourceName} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  active,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs border rounded transition-colors ${
        active
          ? 'border-accent-primary text-accent-primary'
          : 'border-border text-text-secondary hover:text-text-primary hover:border-accent-primary'
      }`}
    >
      {children}
    </button>
  );
}
