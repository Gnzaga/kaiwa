'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  fromSameSource: { id: number; originalTitle: string; translatedTitle: string | null; originalUrl: string; publishedAt: string; summaryTldr: string | null; sourceName: string | null }[];
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
  const [showSummary, setShowSummary] = useState(true);
  const [quotePopup, setQuotePopup] = useState<{ text: string; x: number; y: number } | null>(null);
  const [quoteCopied, setQuoteCopied] = useState(false);
  const [fontSize, setFontSize] = useState<FontSize>(() => {
    if (typeof window === 'undefined') return 'base';
    return (localStorage.getItem('article-font-size') as FontSize) ?? 'base';
  });
  const [serifFont, setSerifFont] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('article-font-family') === 'serif';
  });
  const queryClient = useQueryClient();

  function cycleFontSize() {
    const next = FONT_SIZES[(FONT_SIZES.indexOf(fontSize) + 1) % FONT_SIZES.length];
    setFontSize(next);
    localStorage.setItem('article-font-size', next);
  }

  function toggleSerifFont() {
    const next = !serifFont;
    setSerifFont(next);
    localStorage.setItem('article-font-family', next ? 'serif' : 'sans');
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

  // Article page keyboard shortcuts: s=star, r=read, a=archive, c=copy link, d=copy tldr, l=list picker, i=toggle original
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 's') actionMutation.mutate({ type: 'toggleStar' });
      if (e.key === 'r') actionMutation.mutate({ type: 'toggleRead' });
      if (e.key === 'a') actionMutation.mutate({ type: 'toggleArchive' });
      if (e.key === 'o' && data?.article?.originalUrl) window.open(data.article.originalUrl, '_blank', 'noopener,noreferrer');
      if (e.key === 'c') { navigator.clipboard.writeText(window.location.href).then(() => toast('Link copied')).catch(() => {}); }
      if (e.key === 'd' && data?.article?.summaryTldr) { navigator.clipboard.writeText(data.article.summaryTldr).then(() => toast('TL;DR copied')).catch(() => {}); }
      if (e.key === 'l') setShowListMenu(m => !m);
      if (e.key === 'i') setShowOriginal(m => !m);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.article?.originalUrl, data?.article?.summaryTldr]);

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

  const [readProgress, setReadProgress] = useState(0);
  const scrollSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    function onScroll() {
      const el = document.documentElement;
      const scrolled = el.scrollTop || document.body.scrollTop;
      const total = el.scrollHeight - el.clientHeight;
      setReadProgress(total > 0 ? Math.min(100, Math.round((scrolled / total) * 100)) : 0);
      // Debounce save scroll position
      if (scrollSaveTimer.current) clearTimeout(scrollSaveTimer.current);
      scrollSaveTimer.current = setTimeout(() => {
        if (scrolled > 100) {
          localStorage.setItem(`article-scroll-${id}`, String(Math.round(scrolled)));
        } else {
          localStorage.removeItem(`article-scroll-${id}`);
        }
      }, 500);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Restore scroll position when article loads
  useEffect(() => {
    if (!data?.article) return;
    const saved = localStorage.getItem(`article-scroll-${id}`);
    if (saved) {
      const pos = parseInt(saved, 10);
      if (pos > 100) {
        requestAnimationFrame(() => window.scrollTo({ top: pos, behavior: 'instant' }));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.article?.id]);

  const [copied, setCopied] = useState(false);
  const [summaryCopied, setSummaryCopied] = useState(false);
  const [outlineCopied, setOutlineCopied] = useState(false);
  const [citationCopied, setCitationCopied] = useState(false);
  const [threadCopied, setThreadCopied] = useState(false);
  const [mdCopied, setMdCopied] = useState(false);

  const downloadMd = useCallback(() => {
    if (!data?.article) return;
    const a = data.article;
    const t = a.translatedTitle || a.originalTitle;
    const date = new Date(a.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const lines: string[] = [
      `# ${t}`,
      '',
      `**Source**: ${a.sourceName ?? 'Unknown'}`,
      `**Published**: ${date}`,
      `**URL**: ${a.originalUrl}`,
    ];
    if (a.summaryTldr) lines.push('', `> ${a.summaryTldr}`);
    if (a.summaryBullets && a.summaryBullets.length > 0) {
      lines.push('', '## Key Points', ...a.summaryBullets.map((b: string) => `- ${b}`));
    }
    if (a.summaryTags && a.summaryTags.length > 0) {
      lines.push('', `**Tags**: ${a.summaryTags.join(', ')}`);
    }
    const rawContent = a.translatedContent || a.originalContent;
    if (rawContent) {
      const div = document.createElement('div');
      div.innerHTML = rawContent;
      const text = div.innerText || div.textContent || '';
      if (text.trim()) lines.push('', '---', '', text.trim());
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${t.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 80)}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [data?.article]);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
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

  const copyOutline = useCallback(() => {
    if (!data?.article) return;
    const a = data.article;
    const t = a.translatedTitle || a.originalTitle;
    const lines: string[] = [`# ${t}`, '', `> ${a.originalUrl}`];
    if (a.summaryTldr) { lines.push('', `**TL;DR**: ${a.summaryTldr}`); }
    if (a.summaryBullets && a.summaryBullets.length > 0) {
      lines.push('', '## Key Points', ...a.summaryBullets.map((b: string) => `- ${b}`));
    }
    if (a.summaryTags && a.summaryTags.length > 0) {
      lines.push('', `**Tags**: ${a.summaryTags.join(', ')}`);
    }
    navigator.clipboard.writeText(lines.join('\n'));
    setOutlineCopied(true);
    setTimeout(() => setOutlineCopied(false), 2000);
  }, [data?.article]);

  const copyThread = useCallback(() => {
    if (!data?.article) return;
    const a = data.article;
    const t = a.translatedTitle || a.originalTitle;
    const posts: string[] = [`1/ ${t}\n${a.originalUrl}`];
    if (a.summaryTldr) posts.push(`2/ ${a.summaryTldr}`);
    if (a.summaryBullets && a.summaryBullets.length > 0) {
      a.summaryBullets.slice(0, 5).forEach((b: string) => {
        posts.push(`${posts.length + 1}/ ${b}`);
      });
    }
    navigator.clipboard.writeText(posts.join('\n\n'));
    setThreadCopied(true);
    setTimeout(() => setThreadCopied(false), 2000);
  }, [data?.article]);

  const copyCitation = useCallback(() => {
    if (!data?.article) return;
    const a = data.article;
    const t = a.translatedTitle || a.originalTitle;
    const date = new Date(a.publishedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const citation = `${t}. ${a.sourceName ?? 'Unknown Source'}, ${date}. ${a.originalUrl}`;
    navigator.clipboard.writeText(citation);
    setCitationCopied(true);
    setTimeout(() => setCitationCopied(false), 2000);
  }, [data?.article]);

  const { article, related, fromSameSource } = data;
  const title = article.translatedTitle || article.originalTitle;
  const content = article.translatedContent || article.originalContent;
  const wordCount = content ? content.trim().split(/\s+/).length : 0;
  const readingMins = wordCount > 0 ? Math.ceil(wordCount / 200) : 0;

  // Focus mode: toggle sidebar visibility
  useEffect(() => {
    const sidebar = document.getElementById('kaiwa-sidebar');
    if (sidebar) sidebar.style.display = focusMode ? 'none' : '';
    return () => { if (sidebar) sidebar.style.display = ''; };
  }, [focusMode]);

  // Add 'f' key for focus mode toggle, '?' for shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'f') setFocusMode(m => !m);
      if (e.key === '?') setShowShortcuts(m => !m);
      if (e.key === 'Escape') { setShowShortcuts(false); setQuotePopup(null); }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <div className={`space-y-6 animate-fade-in transition-all${focusMode ? ' max-w-2xl mx-auto' : ' max-w-3xl'}`}>
      {/* Reading progress bar */}
      <div
        className="fixed top-0 left-0 h-0.5 bg-accent-primary z-50 transition-all duration-150"
        style={{ width: `${readProgress}%` }}
      />
      {/* Back to top button */}
      {readProgress > 15 && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          title="Back to top"
          className="fixed bottom-6 right-6 z-40 w-9 h-9 flex items-center justify-center rounded-full bg-bg-elevated border border-border text-text-tertiary hover:text-text-primary hover:border-accent-primary shadow-lg transition-all opacity-70 hover:opacity-100"
          aria-label="Back to top"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 11V3M3 6l4-4 4 4" />
          </svg>
        </button>
      )}
      {/* Text selection quote popup */}
      {quotePopup && (
        <div
          className="fixed z-50 -translate-x-1/2 -translate-y-full"
          style={{ left: quotePopup.x, top: quotePopup.y }}
        >
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              const quotedText = `> ${quotePopup.text}\n\n— ${title} (${article.originalUrl})`;
              navigator.clipboard.writeText(quotedText);
              setQuoteCopied(true);
              setTimeout(() => { setQuoteCopied(false); setQuotePopup(null); }, 1500);
            }}
            className="px-2.5 py-1 text-xs bg-bg-secondary border border-border rounded shadow-md text-text-primary hover:border-accent-primary transition-colors whitespace-nowrap"
          >
            {quoteCopied ? 'Copied!' : 'Copy as quote'}
          </button>
        </div>
      )}
      {/* Keyboard shortcuts overlay */}
      {showShortcuts && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-bg-secondary border border-border rounded-xl p-6 space-y-3 w-80 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-text-primary mb-4">Keyboard Shortcuts</h3>
            {([
              ['s', 'Toggle star'],
              ['r', 'Toggle read'],
              ['a', 'Toggle archive'],
              ['f', 'Focus mode'],
              ['o', 'Open original'],
              ['c', 'Copy link'],
              ['d', 'Copy TL;DR'],
              ['n/p', 'Next/prev article'],
              ['←/→', 'Next/prev article'],
              ['l', 'Reading list picker'],
              ['i', 'Toggle original language'],
              ['R', 'Random unread (global)'],
              ['?', 'Show shortcuts'],
              ['Esc', 'Close panels'],
            ] as [string, string][]).map(([key, desc]) => (
              <div key={key} className="flex items-center justify-between text-xs">
                <span className="text-text-secondary">{desc}</span>
                <kbd className="px-2 py-0.5 bg-bg-elevated border border-border rounded font-mono text-text-tertiary">{key}</kbd>
              </div>
            ))}
            <button
              onClick={() => setShowShortcuts(false)}
              className="mt-4 w-full text-xs text-center text-text-tertiary hover:text-text-primary transition-colors"
            >
              Press ? or Esc to close
            </button>
          </div>
        </div>
      )}

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
          {article.sourceName && (
            <a
              href={`/articles?source=${encodeURIComponent(article.sourceName)}`}
              className="hover:text-accent-primary transition-colors"
            >
              {article.sourceName}
            </a>
          )}
          <span>
            {new Date(article.publishedAt).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </span>
          {readingMins > 0 && (
            <span>
              {readProgress > 2
                ? `${Math.max(1, Math.ceil((1 - readProgress / 100) * readingMins))}m remaining`
                : `${readingMins} min read`
              } · {wordCount.toLocaleString()} words
            </span>
          )}
          <StatusIndicator status={article.translationStatus ?? 'pending'} tooltip={`Translation: ${article.translationStatus}`} />
          <StatusIndicator status={article.summaryStatus ?? 'pending'} tooltip={`Summary: ${article.summaryStatus}`} />
          {article.translationStatus === 'complete' && article.translationProvider && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded border border-border font-mono opacity-60"
              title={`Translated by: ${article.translationProvider}`}
            >
              {article.translationProvider === 'libretranslate' ? 'LT' : article.translationProvider === 'llm' ? 'LLM' : article.translationProvider}
            </span>
          )}
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

        <ActionButton onClick={downloadMd}>
          Download MD
        </ActionButton>

        <ActionButton onClick={copyCitation} active={citationCopied}>
          {citationCopied ? 'Copied!' : 'Copy Citation'}
        </ActionButton>

        {article.summaryStatus === 'complete' && (article.summaryTldr || (article.summaryBullets && article.summaryBullets.length > 0)) && (
          <>
            <ActionButton onClick={copySummary} active={summaryCopied}>
              {summaryCopied ? 'Copied!' : 'Copy Summary'}
            </ActionButton>
            <ActionButton onClick={copyOutline} active={outlineCopied}>
              {outlineCopied ? 'Copied!' : 'Copy Outline'}
            </ActionButton>
            <ActionButton onClick={copyThread} active={threadCopied}>
              {threadCopied ? 'Copied!' : 'Copy Thread'}
            </ActionButton>
          </>
        )}

        <button
          onClick={cycleFontSize}
          title={`Font size: ${fontSize} (click to cycle)`}
          className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors font-mono"
        >
          A{fontSize === 'sm' ? '−' : fontSize === 'lg' ? '+' : ''}
        </button>
        <button
          onClick={toggleSerifFont}
          title={serifFont ? 'Switch to sans-serif' : 'Switch to serif'}
          className={`px-3 py-1.5 text-xs border rounded transition-colors ${serifFont ? 'border-accent-primary text-accent-primary font-serif' : 'border-border text-text-secondary hover:text-text-primary hover:border-accent-primary'}`}
        >
          Serif
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
          onClick={() => setFocusMode(m => !m)}
          title="Focus mode (f)"
          className={`px-3 py-1.5 text-xs border rounded transition-colors ${focusMode ? 'border-accent-primary text-accent-primary' : 'border-border text-text-secondary hover:text-text-primary hover:border-accent-primary'}`}
        >
          {focusMode ? 'Exit Focus' : 'Focus'}
        </button>

        {article.translatedContent && (
          <a
            href="#article-content"
            className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
          >
            ↓ Read
          </a>
        )}
        <button
          onClick={() => window.print()}
          className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
        >
          Print
        </button>

        <a
          href={`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${article.originalUrl}\n\n${article.summaryTldr ?? ''}`)}`}
          className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
        >
          Email
        </a>

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
        <section className="bg-bg-elevated border border-border rounded overflow-hidden">
          <button
            onClick={() => setShowSummary(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm hover:bg-bg-secondary transition-colors"
          >
            <span className="font-medium text-text-primary">AI Summary</span>
            <div className="flex items-center gap-2">
              <SentimentBadge sentiment={article.summarySentiment} />
              <svg className={`w-4 h-4 text-text-tertiary transition-transform ${showSummary ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </button>
          {showSummary && (
            <div className="px-5 pb-5 space-y-3 border-t border-border">
              {article.summaryTldr && (
                <p className="text-sm text-text-secondary leading-relaxed pt-3">{article.summaryTldr}</p>
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
            </div>
          )}
        </section>
      )}

      {/* Translated content */}
      {article.translatedContent && (
        <section
          id="article-content"
          className={`${FONT_CLASS[fontSize]} ${serifFont ? 'font-serif' : ''} text-text-secondary leading-relaxed space-y-3 transition-[font-size]`}
          onMouseUp={() => {
            const sel = window.getSelection();
            const text = sel?.toString().trim() ?? '';
            if (!sel || !text) { setQuotePopup(null); return; }
            const range = sel.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            setQuotePopup({ text, x: rect.left + rect.width / 2 + window.scrollX, y: rect.top + window.scrollY - 8 });
          }}
        >
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

      {/* Article metadata (collapsible) */}
      {(() => {
        const [metaOpen, setMetaOpen] = useState(false);
        return (
          <section className="border border-border rounded overflow-hidden">
            <button
              onClick={() => setMetaOpen(m => !m)}
              className="flex items-center justify-between w-full px-4 py-2.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors bg-bg-elevated"
            >
              <span>Article Metadata</span>
              <svg className={`w-3 h-3 transition-transform ${metaOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {metaOpen && (
              <dl className="px-4 py-3 space-y-1.5 text-xs text-text-tertiary font-mono border-t border-border">
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-text-tertiary/60">Article ID</dt><dd>{article.id}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-text-tertiary/60">Published</dt><dd>{new Date(article.publishedAt).toLocaleString()}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-text-tertiary/60">Ingested</dt><dd>{article.createdAt ? new Date(article.createdAt).toLocaleString() : '—'}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-text-tertiary/60">Words</dt><dd>{wordCount.toLocaleString()}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-text-tertiary/60">Source lang</dt><dd>{article.sourceLanguage ?? '—'}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-text-tertiary/60">Translation</dt><dd>{article.translationStatus}</dd></div>
                <div className="flex gap-2"><dt className="w-32 shrink-0 text-text-tertiary/60">Summary</dt><dd>{article.summaryStatus}</dd></div>
                <div className="flex gap-2 items-start"><dt className="w-32 shrink-0 text-text-tertiary/60">Original URL</dt><dd className="break-all"><a href={article.originalUrl} target="_blank" rel="noopener noreferrer" className="hover:text-accent-primary transition-colors">{article.originalUrl}</a></dd></div>
              </dl>
            )}
          </section>
        );
      })()}

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

      {/* Also from this source */}
      {fromSameSource && fromSameSource.length > 0 && (
        <>
          <hr className="divider-line border-0 my-6" />
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-text-tertiary">More from {article.sourceName}</h2>
            <div className="space-y-1">
              {fromSameSource.map((a) => (
                <a
                  key={a.id}
                  href={`/article/${a.id}`}
                  className="block py-2 px-3 rounded-lg hover:bg-bg-elevated transition-colors group"
                >
                  <div className="text-sm text-text-secondary group-hover:text-text-primary transition-colors line-clamp-2 leading-snug">
                    {a.translatedTitle || a.originalTitle}
                  </div>
                  <div className="text-xs text-text-tertiary mt-0.5">
                    {new Date(a.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    {a.summaryTldr && <span className="ml-2 opacity-70 line-clamp-1">{a.summaryTldr.slice(0, 80)}{a.summaryTldr.length > 80 ? '…' : ''}</span>}
                  </div>
                </a>
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
