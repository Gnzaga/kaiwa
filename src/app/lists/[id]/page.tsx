'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ListDetail {
  list: {
    id: number;
    name: string;
    description: string | null;
    isPublic: boolean;
  };
  data: {
    itemId: number;
    note: string | null;
    sortOrder: number;
    addedAt: string;
    articleId: number;
    originalTitle: string;
    translatedTitle: string | null;
    originalUrl: string;
    publishedAt: string;
    translationStatus: string;
    summaryTldr: string | null;
    summaryTags: string[] | null;
    imageUrl: string | null;
    feedSourceName: string | null;
    feedRegionId: string | null;
    isRead: boolean;
    readingMinutes: number | null;
  }[];
  total: number;
  page: number;
  pageSize: number;
}

export default function ReadingListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ListDetail>({
    queryKey: ['reading-list', id],
    queryFn: () => fetch(`/api/reading-lists/${id}`).then(r => r.json()),
  });

  const [editingNote, setEditingNote] = useState<number | null>(null); // articleId being edited
  const [noteText, setNoteText] = useState('');
  const [editingName, setEditingName] = useState(false);
  const [nameText, setNameText] = useState('');
  const [listFilter, setListFilter] = useState('');
  const [listSort, setListSort] = useState<'order' | 'newest_added' | 'oldest_added' | 'published' | 'shuffle'>('order');
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const removeMutation = useMutation({
    mutationFn: (articleId: number) =>
      fetch(`/api/reading-lists/${id}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reading-list', id] }),
  });

  const renameMutation = useMutation({
    mutationFn: (name: string) =>
      fetch(`/api/reading-lists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-list', id] });
      queryClient.invalidateQueries({ queryKey: ['reading-lists'] });
      setEditingName(false);
    },
  });

  const visibilityMutation = useMutation({
    mutationFn: (isPublic: boolean) =>
      fetch(`/api/reading-lists/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic }),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reading-list', id] }),
  });

  const markAllReadMutation = useMutation({
    mutationFn: () =>
      fetch(`/api/reading-lists/${id}/mark-all-read`, { method: 'POST' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reading-list', id] }),
  });

  const noteMutation = useMutation({
    mutationFn: ({ articleId, note }: { articleId: number; note: string }) =>
      fetch(`/api/reading-lists/${id}/items`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId, note }),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-list', id] });
      setEditingNote(null);
    },
  });

  function exportList() {
    if (!data) return;
    const exportData = {
      name: data.list.name,
      description: data.list.description,
      exportedAt: new Date().toISOString(),
      articles: data.data.map((item) => ({
        title: item.translatedTitle || item.originalTitle,
        originalTitle: item.originalTitle,
        url: item.originalUrl,
        source: item.feedSourceName,
        publishedAt: item.publishedAt,
        addedAt: item.addedAt,
        tldr: item.summaryTldr,
        tags: item.summaryTags,
        note: item.note,
      })),
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.list.name.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-4">
        <div className="h-8 bg-bg-secondary rounded w-48 animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-24 bg-bg-secondary border border-border rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data?.list) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <p className="text-sm text-text-tertiary">List not found</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header className="space-y-1">
        <Link href="/lists" className="text-xs text-text-tertiary hover:text-text-secondary transition-colors">
          &larr; All Lists
        </Link>
        {editingName ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={nameText}
              onChange={(e) => setNameText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && nameText.trim()) renameMutation.mutate(nameText.trim());
                if (e.key === 'Escape') setEditingName(false);
              }}
              className="text-2xl font-semibold bg-transparent border-b border-accent-primary text-text-primary focus:outline-none"
            />
            <button
              onClick={() => nameText.trim() && renameMutation.mutate(nameText.trim())}
              className="text-xs text-accent-primary hover:text-accent-highlight"
            >Save</button>
            <button onClick={() => setEditingName(false)} className="text-xs text-text-tertiary">Cancel</button>
          </div>
        ) : (
          <h1
            className="text-2xl font-semibold text-text-primary cursor-pointer hover:text-accent-primary transition-colors"
            onClick={() => { setNameText(data.list.name); setEditingName(true); }}
            title="Click to rename"
          >
            {data.list.name}
          </h1>
        )}
        {data.list.description && <p className="text-sm text-text-tertiary">{data.list.description}</p>}
        <div className="flex items-center gap-3 flex-wrap">
          {(() => {
            const readCount = data.data.filter(i => i.isRead).length;
            const total = data.total;
            const pct = total > 0 ? Math.round((readCount / total) * 100) : 0;
            const totalMins = data.data.reduce((s, i) => s + (Number(i.readingMinutes) || 0), 0);
            const etaLabel = totalMins >= 60 ? `~${Math.round(totalMins / 60)}h` : totalMins > 0 ? `~${totalMins}m` : null;
            return (
              <div className="flex items-center gap-2">
                <p className="text-xs text-text-tertiary">{total} article{total !== 1 ? 's' : ''}</p>
                {etaLabel && (
                  <><span className="text-xs text-text-tertiary opacity-50">·</span><span className="text-xs text-text-tertiary">{etaLabel} reading</span></>
                )}
                {total > 0 && (
                  <>
                    <span className="text-xs text-text-tertiary opacity-50">·</span>
                    <span className="text-xs text-text-tertiary">{readCount}/{total} read</span>
                    <div className="w-16 h-1 bg-bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-accent-secondary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-text-tertiary font-mono">{pct}%</span>
                  </>
                )}
              </div>
            );
          })()}
          {data.data.length > 0 && (
            <>
              <button
                onClick={exportList}
                className="text-xs text-text-tertiary hover:text-text-primary border border-border rounded px-2 py-1 transition-colors"
              >
                Export JSON
              </button>
              <button
                onClick={() => {
                  const urls = data.data.map(item => item.originalUrl).join('\n');
                  navigator.clipboard.writeText(urls);
                }}
                className="text-xs text-text-tertiary hover:text-text-primary border border-border rounded px-2 py-1 transition-colors"
              >
                Copy URLs
              </button>
              <button
                onClick={() => {
                  const md = `# ${data.list.name}\n\n` +
                    data.data.map(item => {
                      const title = item.translatedTitle || item.originalTitle;
                      return `- [${title}](${item.originalUrl})${item.summaryTldr ? `\n  > ${item.summaryTldr}` : ''}`;
                    }).join('\n');
                  navigator.clipboard.writeText(md);
                }}
                className="text-xs text-text-tertiary hover:text-text-primary border border-border rounded px-2 py-1 transition-colors"
              >
                Copy Markdown
              </button>
            </>
          )}
          {data.data.length > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="text-xs text-text-tertiary hover:text-text-primary border border-border rounded px-2 py-1 transition-colors disabled:opacity-50"
            >
              {markAllReadMutation.isPending ? 'Marking...' : 'Mark all read'}
            </button>
          )}
          <button
            onClick={() => visibilityMutation.mutate(!data.list.isPublic)}
            disabled={visibilityMutation.isPending}
            className={`text-xs border rounded px-2 py-1 transition-colors ${data.list.isPublic ? 'border-accent-primary text-accent-primary hover:text-accent-highlight' : 'border-border text-text-tertiary hover:text-text-primary'}`}
          >
            {data.list.isPublic ? 'Public (click to make private)' : 'Make Public'}
          </button>
          {data.list.isPublic && (
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/lists/${id}/public`)}
              className="text-xs text-text-tertiary hover:text-text-primary border border-border rounded px-2 py-1 transition-colors"
            >
              Copy Share Link
            </button>
          )}
        </div>
      </header>

      {data.data.length > 2 && (
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Filter articles..."
            value={listFilter}
            onChange={(e) => setListFilter(e.target.value)}
            className="flex-1 bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary"
          />
          <select
            value={listSort}
            onChange={(e) => { const v = e.target.value as typeof listSort; setListSort(v); if (v === 'shuffle') setShuffleSeed(Date.now()); }}
            className="bg-bg-elevated border border-border rounded px-2 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
          >
            <option value="order">Manual order</option>
            <option value="newest_added">Newest added</option>
            <option value="oldest_added">Oldest added</option>
            <option value="published">Published date</option>
            <option value="shuffle">Shuffle</option>
          </select>
        </div>
      )}

      {data.data.length > 0 ? (
        <div className="space-y-3">
          {[...data.data]
            .filter(item => !listFilter || (item.translatedTitle || item.originalTitle).toLowerCase().includes(listFilter.toLowerCase()))
            .sort((a, b) => {
              if (listSort === 'newest_added') return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
              if (listSort === 'oldest_added') return new Date(a.addedAt).getTime() - new Date(b.addedAt).getTime();
              if (listSort === 'published') return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
              if (listSort === 'shuffle') {
                const ha = (a.articleId * 2654435761 + shuffleSeed) >>> 0;
                const hb = (b.articleId * 2654435761 + shuffleSeed) >>> 0;
                return ha - hb;
              }
              return a.sortOrder - b.sortOrder;
            })
            .map(item => (
            <div key={item.itemId} className="flex items-start gap-4 bg-bg-elevated border border-border rounded px-5 py-4">
              {item.imageUrl && (
                <img
                  src={item.imageUrl}
                  alt=""
                  className="w-16 h-16 object-cover rounded shrink-0"
                  loading="lazy"
                />
              )}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/article/${item.articleId}`}
                  className="text-sm font-medium text-text-primary hover:text-accent-primary transition-colors line-clamp-2"
                >
                  {item.translatedTitle || item.originalTitle}
                </Link>
                {item.summaryTldr && (
                  <p className="text-xs text-text-tertiary mt-1 line-clamp-2">{item.summaryTldr}</p>
                )}
                {item.summaryTags && item.summaryTags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {item.summaryTags.slice(0, 4).map((tag: string) => (
                      <Link
                        key={tag}
                        href={`/articles?tag=${encodeURIComponent(tag)}`}
                        className="text-[10px] px-1.5 py-0.5 bg-bg-secondary border border-border rounded text-text-tertiary hover:text-accent-primary hover:border-accent-primary transition-colors"
                      >
                        {tag}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1.5 text-xs text-text-tertiary">
                  {item.feedSourceName && <span>{item.feedSourceName}</span>}
                  <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                  {item.isRead && (
                    <span className="text-accent-primary opacity-70" title="Read">✓ read</span>
                  )}
                </div>
                {/* Note display / edit */}
                {editingNote === item.articleId ? (
                  <div className="mt-2 flex flex-col gap-1.5">
                    <textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Add a note..."
                      className="w-full text-xs bg-bg-secondary border border-border rounded px-2 py-1.5 text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary resize-none"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => noteMutation.mutate({ articleId: item.articleId, note: noteText })}
                        disabled={noteMutation.isPending}
                        className="text-xs text-accent-primary hover:text-accent-highlight transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingNote(null)}
                        className="text-xs text-text-tertiary hover:text-text-secondary transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : item.note ? (
                  <p className="mt-1.5 text-xs text-text-secondary italic border-l-2 border-accent-primary/40 pl-2">{item.note}</p>
                ) : null}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <button
                  onClick={() => removeMutation.mutate(item.articleId)}
                  className="text-xs text-text-tertiary hover:text-accent-highlight transition-colors"
                >
                  Remove
                </button>
                <button
                  onClick={() => {
                    setEditingNote(item.articleId);
                    setNoteText(item.note ?? '');
                  }}
                  className="text-xs text-text-tertiary hover:text-accent-primary transition-colors"
                >
                  {item.note ? 'Edit note' : 'Add note'}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">No articles in this list yet.</p>
      )}
    </div>
  );
}
