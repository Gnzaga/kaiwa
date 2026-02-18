'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export default function QuickSync() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ created?: number; skipped?: number } | null>(null);
  const queryClient = useQueryClient();

  async function doSync() {
    if (status === 'syncing') return;
    setStatus('syncing');
    setResult(null);
    try {
      const data = await fetch('/api/articles/sync', { method: 'POST' }).then(r => r.json());
      setResult({ created: data.created ?? 0, skipped: data.skipped ?? 0 });
      setStatus('done');
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
      setTimeout(() => setStatus('idle'), 4000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <button
      onClick={doSync}
      disabled={status === 'syncing'}
      title="Sync latest articles from feeds"
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs border rounded transition-colors ${
        status === 'done'
          ? 'border-accent-primary text-accent-primary'
          : status === 'error'
          ? 'border-accent-highlight text-accent-highlight'
          : 'border-border text-text-tertiary hover:text-text-primary hover:border-accent-primary'
      } disabled:opacity-50`}
    >
      <span className={status === 'syncing' ? 'animate-spin' : ''}>⟳</span>
      {status === 'syncing' && 'Syncing…'}
      {status === 'done' && result && `+${result.created} new`}
      {status === 'error' && 'Failed'}
      {status === 'idle' && 'Sync'}
    </button>
  );
}
