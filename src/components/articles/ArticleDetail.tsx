'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Article } from '@/db/schema';
import Tag from '@/components/ui/Tag';
import SentimentBadge from './SentimentBadge';
import StatusIndicator from '@/components/ui/StatusIndicator';
import ArticleCard from './ArticleCard';
import { useToast } from '@/components/ui/Toast';
import { trackArticleView } from '@/components/ui/CommandPalette';

interface ArticleDetailResponse {
  article: Article & { sourceName?: string; imageUrl?: string | null; note?: string | null };
  related: (Article & { sourceName?: string })[];
}

interface ReadingList {
  id: number;
  name: string;
  articleCount: number;
}

type FontSize = 'sm' | 'base' | 'lg';
const FONT_SIZES: FontSize[] = ['sm', 'base', 'lg'];
const FONT_CLASS: Record<FontSize, string> = { sm: 'text-sm', base: 'text-base', lg: 'text-lg' };

export default function ArticleDetail({ id }: { id: number }) {
  const { toast } = useToast();
  const [showOriginal, setShowOriginal] = useState(false);
  const [showListMenu, setShowListMenu] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window === 'undefined') return 'base';
    return (localStorage.getItem('article-font-size') as FontSize) ?? 'base';
  });
  const queryClient = useQueryClient();

  function cycleFontSize() {
    const next = FONT_SIZES[(FONT_SIZES.indexOf(fontSize) + 1) % FONT_SIZES.length];
    setFontSize(next);
    localStorage.setItem('article-font-size', next);
  }

  const { data, isLoading, error } = useQuery<ArticleDetailResponse>({
    queryKey: ['article', id],
    queryFn: () => fetch(`/api/articles/${id}`).then((r) => r.json()),
  });

  const { data: prefs } = useQuery<{ autoMarkRead: boolean }>({
    queryKey: ['user-prefs'],
    queryFn: () => fetch('/api/user/preferences').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: lists } = useQuery<ReadingList[]>({
    queryKey: ['reading-lists'],
    queryFn: () => fetch('/api/reading-lists').then(r => r.json()),
    enabled: showListMenu,
  });

  const actionMutation = useMutation({
    mutationFn: (action: { type: string }) =>
      fetch(`/api/articles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      }).then((r) => r.json()),
    onSuccess: (_, action) => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      const labels: Record<string, string> = {
        toggleRead: 'Marked as read',
        toggleStar: 'Starred',
        toggleArchive: 'Archived',
        retranslate: 'Re-translation queued',
        resummarize: 'Re-summarization queued',
      };
      if (labels[action.type]) toast(labels[action.type]);
    },
    onError: () => toast('Action failed', 'error'),
  });

  const scrapeMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/articles/${id}/scrape`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || `Scrape failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['article', id] });
    },
  });

  const addToListMutation = useMutation({
    mutationFn: (listId: number) =>
      fetch(`/api/reading-lists/${listId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId: id }),
      }).then(r => r.json()),
    onSuccess: () => {
      setShowListMenu(false);
      queryClient.invalidateQueries({ queryKey: ['reading-lists'] });
      toast('Added to reading list');
    },
    onError: () => toast('Failed to add to list', 'error'),
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

  // Article page keyboard shortcuts: s=star, r=read, a=archive
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 's') actionMutation.mutate({ type: 'toggleStar' });
      if (e.key === 'r') actionMutation.mutate({ type: 'toggleRead' });
      if (e.key === 'a') actionMutation.mutate({ type: 'toggleArchive' });
      if (e.key === 'o' && data?.article?.originalUrl) window.open(data.article.originalUrl, '_blank', 'noopener,noreferrer');
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-mark read + track view when article loads
  useEffect(() => {
    if (data?.article && !data.article.isRead && prefs?.autoMarkRead !== false) {
      actionMutation.mutate({ type: 'toggleRead' });
    }
    if (data?.article) {
      const title = data.article.translatedTitle || data.article.originalTitle;
      trackArticleView(id, title, data.article.sourceName);
      setNoteText(data.article.note ?? '');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.article?.id, prefs?.autoMarkRead]);

  const [copied, setCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState('');
  const copyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const copySummary = useCallback(() => {
    if (!data?.article) return;
    const parts: string[] = [];
    if (data.article.summaryTldr) parts.push(data.article.summaryTldr);
    if (data.article.summaryBullets && data.article.summaryBullets.length > 0) {
      parts.push(data.article.summaryBullets.map((b: string) => `• ${b}`).join('\n'));
    }
    if (parts.length === 0) return;
    navigator.clipboard.writeText(parts.join('\n\n'));
    setSummaryCopied(true);
    setTimeout(() => setSummaryCopied(false), 2000);
  }, [data?.article]);

  const { article, related } = data;
  const title = article.translatedTitle || article.originalTitle;
  const content = article.translatedContent || article.originalContent;
  const wordCount = content ? content.trim().split(/\s+/).length : 0;
  const readingMins = wordCount > 0 ? Math.ceil(wordCount / 200) : 0;

  return (
    <div className="max-w-3xl space-y-6 animate-fade-in">
      {/* Hero image */}
      {article.imageUrl && (
        <div className="rounded overflow-hidden border border-border cursor-zoom-in" onClick={() => setLightboxOpen(true)}>
          <img
            src={article.imageUrl}
            alt=""
            className="w-full max-h-80 object-cover"
            loading="lazy"
            onError={(e) => {
              (e.target as HTMLImageElement).parentElement!.style.display = 'none';
            }}
          />
        </div>
      )}

      {/* Image lightbox */}
      {lightboxOpen && article.imageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 cursor-zoom-out"
          onClick={() => setLightboxOpen(false)}
        >
          <img
            src={article.imageUrl}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded shadow-2xl"
          />
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl leading-none"
          >
            ✕
          </button>
        </div>
      )}

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
          {readingMins > 0 && <span>{readingMins} min read · {wordCount.toLocaleString()} words</span>}
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

        {/* Save to List dropdown */}
        <div className="relative">
          <ActionButton onClick={() => setShowListMenu(!showListMenu)}>
            Save to List
          </ActionButton>
          {showListMenu && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-bg-elevated border border-border rounded shadow-lg z-10">
              {lists && lists.length > 0 ? (
                lists.map(list => (
                  <button
                    key={list.id}
                    onClick={() => addToListMutation.mutate(list.id)}
                    className="block w-full text-left px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-bg-secondary transition-colors"
                  >
                    {list.name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-text-tertiary">No lists yet</div>
              )}
            </div>
          )}
        </div>

        <ActionButton onClick={copyLink} active={copied}>
          {copied ? 'Copied!' : 'Copy Link'}
        </ActionButton>

        <ActionButton
          onClick={() => {
            if (!data?.article) return;
            const mdTitle = data.article.translatedTitle || data.article.originalTitle;
            navigator.clipboard.writeText(`[${mdTitle}](${data.article.originalUrl})`);
            setMdCopied(true);
            setTimeout(() => setMdCopied(false), 2000);
          }}
          active={mdCopied}
        >
          {mdCopied ? 'Copied!' : 'Copy MD'}
        </ActionButton>

        {article.summaryStatus === 'complete' && (article.summaryTldr || (article.summaryBullets && article.summaryBullets.length > 0)) && (
          <ActionButton onClick={copySummary} active={summaryCopied}>
            {summaryCopied ? 'Copied!' : 'Copy Summary'}
          </ActionButton>
        )}

        <button
          onClick={cycleFontSize}
          title={`Font size: ${fontSize} (click to cycle)`}
          className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors font-mono"
        >
          A{fontSize === 'sm' ? '−' : fontSize === 'lg' ? '+' : ''}
        </button>

        <a
          href={article.originalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
        >
          Source ↗
        </a>

        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
        >
          Print
        </button>

        <button
          onClick={() => {
            if (navigator.share) {
              navigator.share({ title, url: article.originalUrl }).catch(() => {});
            } else {
              navigator.clipboard.writeText(article.originalUrl);
              toast('Link copied');
            }
          }}
          className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
        >
          Share
        </button>

        <ActionButton onClick={() => actionMutation.mutate({ type: 'retranslate' })}>
          Re-translate
        </ActionButton>
        <ActionButton onClick={() => actionMutation.mutate({ type: 'resummarize' })}>
          Re-summarize
        </ActionButton>
        <ActionButton
          onClick={() => scrapeMutation.mutate()}
          disabled={scrapeMutation.isPending}
        >
          {scrapeMutation.isPending ? 'Scraping...' : 'Scrape'}
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

      {scrapeMutation.isError && (
        <p className="text-xs text-accent-highlight">{(scrapeMutation.error as Error).message}</p>
      )}
      {scrapeMutation.isSuccess && (
        <p className="text-xs text-accent-secondary">
          Pipeline queued: scrape &rarr; translate &rarr; summarize
        </p>
      )}

      {/* Personal Note */}
      <div className="border border-border rounded overflow-hidden">
        <button
          onClick={() => setNoteOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-text-tertiary hover:text-text-primary hover:bg-bg-elevated transition-colors"
        >
          <span className="flex items-center gap-2">
            <span>My Note</span>
            {article.note && <span className="w-1.5 h-1.5 rounded-full bg-accent-primary" />}
          </span>
          <span>{noteOpen ? '▲' : '▼'}</span>
        </button>
        {noteOpen && (
          <div className="border-t border-border p-3 space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a private note about this article..."
              rows={4}
              className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
            />
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  actionMutation.mutate({ type: 'updateNote', note: noteText } as { type: string });
                  toast(noteText.trim() ? 'Note saved' : 'Note cleared');
                }}
                className="px-3 py-1 text-xs bg-accent-primary text-bg-primary rounded hover:bg-accent-highlight transition-colors"
              >
                Save Note
              </button>
              {noteText && (
                <button
                  onClick={() => { setNoteText(''); actionMutation.mutate({ type: 'updateNote', note: '' } as { type: string }); toast('Note cleared'); }}
                  className="px-3 py-1 text-xs border border-border rounded text-text-tertiary hover:text-text-primary transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <hr className="divider-line border-0" />

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
        <section className={`${FONT_CLASS[fontSize]} text-text-secondary leading-relaxed space-y-3 transition-[font-size]`}>
          <div dangerouslySetInnerHTML={{ __html: article.translatedContent }} />
        </section>
      )}

      {/* Original text (collapsible) */}
      {article.originalContent && (
        <section className="border border-border rounded overflow-hidden">
          <button
            onClick={() => setShowOriginal(!showOriginal)}
            className="flex items-center justify-between w-full px-4 py-3 text-sm text-text-tertiary hover:text-text-secondary transition-colors bg-bg-elevated"
          >
            <span>Original Text</span>
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
          <hr className="divider-line border-0 my-6" />
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
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-xs border rounded transition-colors ${
        disabled
          ? 'border-border text-text-tertiary cursor-not-allowed opacity-60'
          : active
            ? 'border-accent-primary text-accent-primary'
            : 'border-border text-text-secondary hover:text-text-primary hover:border-accent-primary'
      }`}
    >
      {children}
    </button>
  );
}
