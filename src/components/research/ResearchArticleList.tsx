'use client';

import Link from 'next/link';
import type { ResearchArticle } from '@/hooks/useResearchStream';

const REGION_FLAGS: Record<string, string> = {
  jp: '\u{1F1EF}\u{1F1F5}',
  us: '\u{1F1FA}\u{1F1F8}',
  ph: '\u{1F1F5}\u{1F1ED}',
  tw: '\u{1F1F9}\u{1F1FC}',
};

function relativeTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function ResearchArticleList({
  articles,
}: {
  articles: ResearchArticle[];
}) {
  if (articles.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-text-primary">
        Related Articles
        <span className="text-sm font-normal text-text-tertiary ml-2">
          {articles.length} found
        </span>
      </h2>

      <div className="space-y-2">
        {articles.map((article, idx) => (
          <Link
            key={article.id}
            href={`/article/${article.id}`}
            className="flex gap-3 p-3 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors group"
          >
            <div className="text-xs text-text-tertiary font-mono w-5 shrink-0 mt-0.5 text-right">
              {idx + 1}
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="text-sm text-text-primary group-hover:text-accent-primary transition-colors line-clamp-1">
                {article.translated_title || article.original_title}
              </div>
              {article.summary_tldr && (
                <div className="text-xs text-text-tertiary line-clamp-2">
                  {article.summary_tldr}
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-text-tertiary">
                {article.feed_region_id && (
                  <span>{REGION_FLAGS[article.feed_region_id] || article.feed_region_id}</span>
                )}
                {article.feed_source_name && <span>{article.feed_source_name}</span>}
                {article.published_at && <span>{relativeTime(article.published_at)}</span>}
                {article.summary_sentiment && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                    article.summary_sentiment === 'positive' ? 'bg-green-400/10 text-green-400' :
                    article.summary_sentiment === 'negative' ? 'bg-red-400/10 text-red-400' :
                    'bg-bg-elevated text-text-tertiary'
                  }`}>
                    {article.summary_sentiment}
                  </span>
                )}
              </div>
              {article.relevance_reason && (
                <div className="text-[11px] text-accent-primary/70 italic">
                  {article.relevance_reason}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
