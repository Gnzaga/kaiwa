'use client';

import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';

const LAST_SYNC_KEY = 'kaiwa-last-sync';

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function QuickSync() {
  const [status, setStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<{ created?: number; skipped?: number } | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const stored = localStorage.getItem(LAST_SYNC_KEY);
    if (stored) setLastSync(parseInt(stored, 10));
  }, []);

  async function doSync() {
    if (status === 'syncing') return;
    setStatus('syncing');
    setResult(null);
    try {
      const data = await fetch('/api/articles/sync', { method: 'POST' }).then(r => r.json());
      setResult({ created: data.created ?? 0, skipped: data.skipped ?? 0 });
      setStatus('done');
      const now = Date.now();
      setLastSync(now);
      localStorage.setItem(LAST_SYNC_KEY, String(now));
      queryClient.invalidateQueries({ queryKey: ['articles'] });
      queryClient.invalidateQueries({ queryKey: ['unread-counts'] });
      setTimeout(() => setStatus('idle'), 4000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 3000);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {lastSync && status === 'idle' && (
        <span className="text-[10px] text-text-tertiary hidden sm:inline" title={new Date(lastSync).toLocaleString()}>
          {relativeTime(lastSync)}
        </span>
      )}
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
    </div>
  );
}
