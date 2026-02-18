'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface NoteEntry {
  articleId: number;
  note: string;
  updatedAt: string | null;
  isRead: boolean | null;
  isStarred: boolean | null;
  title: string;
  originalUrl: string;
  publishedAt: string;
  sourceName: string | null;
  regionId: string | null;
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotesPage() {
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const copyNote = useCallback((entry: NoteEntry) => {
    const date = new Date(entry.publishedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const text = [
      `# ${entry.title}`,
      '',
      `> ${entry.note.split('\n').join('\n> ')}`,
      '',
      `— ${entry.sourceName ?? 'Unknown'}, ${date}`,
      entry.originalUrl,
    ].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(entry.articleId);
      setTimeout(() => setCopiedId(null), 2000);
    }).catch(() => {});
  }, []);

  const { data: notes, isLoading } = useQuery<NoteEntry[]>({
    queryKey: ['user-notes'],
    queryFn: () => fetch('/api/user/notes').then((r) => r.json()),
    staleTime: 60000,
  });

  const filtered = (notes ?? []).filter((n) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return n.note.toLowerCase().includes(q) || n.title.toLowerCase().includes(q) || (n.sourceName ?? '').toLowerCase().includes(q);
  });

  const allNotes = Array.isArray(notes) ? notes : [];

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-text-primary">Notes</h1>
        <p className="text-xs text-text-tertiary">
          {isLoading ? 'Loading...' : `${allNotes.length} article${allNotes.length !== 1 ? 's' : ''} with notes`}
        </p>
      </header>

      {allNotes.length > 0 && (
        <input
          type="text"
          placeholder="Search notes or titles..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
          data-shortcut-focus
        />
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-bg-secondary border border-border rounded animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && allNotes.length === 0 && (
        <div className="text-center py-16 space-y-2">
          <div className="text-3xl text-text-tertiary">✏</div>
          <p className="text-text-secondary font-medium">No notes yet</p>
          <p className="text-xs text-text-tertiary">Open any article and press <kbd className="font-mono px-1 py-0.5 bg-bg-elevated border border-border rounded text-[10px]">n</kbd> to add a note</p>
        </div>
      )}

      {!isLoading && allNotes.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-text-tertiary text-center py-8">No notes match &ldquo;{search}&rdquo;</p>
      )}

      <div className="space-y-3">
        {filtered.map((entry) => (
          <div key={entry.articleId} className="bg-bg-secondary border border-border rounded-lg p-4 space-y-2 hover:border-accent-primary/50 transition-colors">
            {/* Article title + meta */}
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/article/${entry.articleId}`}
                className="text-sm font-medium text-text-primary hover:text-accent-primary transition-colors leading-snug line-clamp-2"
              >
                {entry.title}
              </Link>
              {entry.updatedAt && (
                <span className="text-[10px] text-text-tertiary font-mono shrink-0 mt-0.5">
                  {relativeTime(entry.updatedAt)}
                </span>
              )}
            </div>

            {/* Note text */}
            <blockquote className="border-l-2 border-accent-primary/40 pl-3 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {entry.note}
            </blockquote>

            {/* Footer meta */}
            <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
              {entry.sourceName && (
                <Link
                  href={`/articles?source=${encodeURIComponent(entry.sourceName)}`}
                  className="hover:text-accent-primary transition-colors"
                >
                  {entry.sourceName}
                </Link>
              )}
              <span>{new Date(entry.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
              {entry.isStarred && <span className="text-accent-secondary">★</span>}
              {entry.isRead && <span className="text-text-tertiary">read</span>}
              <div className="ml-auto flex items-center gap-3">
                <button
                  onClick={() => copyNote(entry)}
                  className="hover:text-accent-primary transition-colors"
                  title="Copy note as markdown"
                >
                  {copiedId === entry.articleId ? 'Copied!' : 'Copy'}
                </button>
                <Link
                  href={`/article/${entry.articleId}`}
                  className="hover:text-accent-primary transition-colors"
                >
                  Edit note →
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
