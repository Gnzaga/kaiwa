'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface ReadingList {
  id: number;
  name: string;
  description: string | null;
  articleCount: number;
  createdAt: string;
}

export default function ListsPage() {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const { data: lists, isLoading } = useQuery<ReadingList[]>({
    queryKey: ['reading-lists'],
    queryFn: () => fetch('/api/reading-lists').then(r => r.json()),
  });

  const createMutation = useMutation({
    mutationFn: (body: { name: string; description?: string }) =>
      fetch('/api/reading-lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reading-lists'] });
      setNewName('');
      setNewDesc('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/reading-lists/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reading-lists'] }),
  });

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">My Lists</h1>
      </header>

      {/* Create new list */}
      <section className="bg-bg-elevated border border-border rounded p-5 space-y-3">
        <h2 className="text-sm font-medium text-text-primary">New Reading List</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            placeholder="List name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className="flex-1 bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
          />
          <input
            type="text"
            placeholder="Description (optional)"
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            className="flex-1 bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
          />
          <button
            onClick={() => newName.trim() && createMutation.mutate({ name: newName.trim(), description: newDesc.trim() || undefined })}
            disabled={!newName.trim() || createMutation.isPending}
            className="px-4 py-2 text-sm bg-accent-primary text-bg-primary rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            Create
          </button>
        </div>
      </section>

      {/* Lists */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-bg-secondary border border-border rounded animate-pulse" />
          ))}
        </div>
      ) : lists && lists.length > 0 ? (
        <div className="space-y-3">
          {lists.map(list => (
            <div key={list.id} className="flex items-center justify-between bg-bg-elevated border border-border rounded px-5 py-4">
              <Link href={`/lists/${list.id}`} className="flex-1 min-w-0">
                <div className="text-sm font-medium text-text-primary hover:text-accent-primary transition-colors">{list.name}</div>
                {list.description && <div className="text-xs text-text-tertiary mt-0.5 truncate">{list.description}</div>}
                <div className="text-xs text-text-tertiary mt-1">{list.articleCount} article{list.articleCount !== 1 ? 's' : ''}</div>
              </Link>
              <button
                onClick={() => deleteMutation.mutate(list.id)}
                className="text-xs text-text-tertiary hover:text-accent-highlight transition-colors ml-4"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">No reading lists yet. Create one above.</p>
      )}
    </div>
  );
}
