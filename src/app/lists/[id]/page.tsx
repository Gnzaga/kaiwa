'use client';

import { use, useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ListDetail {
  list: {
    id: number;
    name: string;
    description: string | null;
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

  const removeMutation = useMutation({
    mutationFn: (articleId: number) =>
      fetch(`/api/reading-lists/${id}/items`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articleId }),
      }).then(r => r.json()),
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
        <h1 className="text-2xl font-semibold text-text-primary">{data.list.name}</h1>
        {data.list.description && <p className="text-sm text-text-tertiary">{data.list.description}</p>}
        <p className="text-xs text-text-tertiary">{data.total} article{data.total !== 1 ? 's' : ''}</p>
      </header>

      {data.data.length > 0 ? (
        <div className="space-y-3">
          {data.data.map(item => (
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
                <div className="flex items-center gap-2 mt-1.5 text-xs text-text-tertiary">
                  {item.feedSourceName && <span>{item.feedSourceName}</span>}
                  <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
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
