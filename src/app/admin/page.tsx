'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';

interface Metrics {
  articles: {
    total: number;
    translated: number;
    translating: number;
    translationPending: number;
    translationError: number;
    summarized: number;
    summarizing: number;
    summaryPending: number;
    summaryError: number;
  };
  users: { total: number; admins: number };
  feeds: { total: number; enabled: number; userSubmitted: number };
  queues: Record<string, number>;
  sessions: { active: number };
}

interface UserInfo {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  isAdmin: boolean;
  articleStates: number;
  readingLists: number;
  feeds: number;
}

export default function AdminPage() {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const isAdmin = (session as Record<string, unknown> | null)?.isAdmin;

  const { data: metrics, isLoading } = useQuery<Metrics>({
    queryKey: ['admin-metrics'],
    queryFn: () => fetch('/api/admin/metrics').then(r => r.json()),
    enabled: !!isAdmin,
    refetchInterval: 10000, // Live refresh every 10s
  });

  const { data: userList } = useQuery<UserInfo[]>({
    queryKey: ['admin-users'],
    queryFn: () => fetch('/api/admin/users').then(r => r.json()),
    enabled: !!isAdmin,
  });

  const bulkMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/admin/articles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        return data;
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-metrics'] }),
  });

  const toggleAdminMutation = useMutation({
    mutationFn: (body: { userId: string; isAdmin: boolean }) =>
      fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin-users'] }),
  });

  if (!isAdmin) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <p className="text-sm text-text-tertiary">Admin access required.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-bg-secondary border border-border rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Admin Panel</h1>
        <p className="text-xs text-text-tertiary mt-1">Auto-refreshes every 10s</p>
      </header>

      {/* Overview metrics */}
      <section className="space-y-3">
        <h2 className="text-base font-medium text-text-primary">Overview</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Total Articles" value={metrics?.articles.total} />
          <MetricCard label="Users" value={metrics?.users.total} />
          <MetricCard label="Active Sessions" value={metrics?.sessions.active} />
          <MetricCard label="Feeds (enabled)" value={`${metrics?.feeds.enabled}/${metrics?.feeds.total}`} />
        </div>
      </section>

      {/* Pipeline status */}
      <section className="space-y-3">
        <h2 className="text-base font-medium text-text-primary">Pipeline Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <MetricCard label="Translation Complete" value={metrics?.articles.translated} color="text-accent-secondary" />
          <MetricCard label="Translating" value={metrics?.articles.translating} color="text-accent-primary" />
          <MetricCard label="Translation Pending" value={metrics?.articles.translationPending} />
          <MetricCard label="Translation Errors" value={metrics?.articles.translationError} color="text-accent-highlight" />
          <MetricCard label="Summary Complete" value={metrics?.articles.summarized} color="text-accent-secondary" />
          <MetricCard label="Summarizing" value={metrics?.articles.summarizing} color="text-accent-primary" />
          <MetricCard label="Summary Pending" value={metrics?.articles.summaryPending} />
          <MetricCard label="Summary Errors" value={metrics?.articles.summaryError} color="text-accent-highlight" />
        </div>
      </section>

      {/* Queue readouts */}
      {metrics?.queues && Object.keys(metrics.queues).length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-medium text-text-primary">Queue Depths</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(metrics.queues).map(([name, size]) => (
              <MetricCard key={name} label={name} value={size} />
            ))}
          </div>
        </section>
      )}

      {/* Bulk operations */}
      <section className="space-y-3">
        <h2 className="text-base font-medium text-text-primary">Bulk Operations</h2>
        {bulkMutation.isSuccess && (
          <p className="text-xs text-accent-secondary">
            {(bulkMutation.data as Record<string, unknown>)?.queued
              ? `Queued ${(bulkMutation.data as Record<string, unknown>).queued} articles for ${(bulkMutation.data as Record<string, unknown>).action}`
              : 'Operation complete'}
          </p>
        )}
        {bulkMutation.isError && (
          <p className="text-xs text-accent-highlight">{(bulkMutation.error as Error).message}</p>
        )}
        <div className="flex flex-wrap gap-3">
          <AdminButton
            onClick={() => bulkMutation.mutate({ action: 'requeue-translate', filter: 'error' })}
            disabled={bulkMutation.isPending}
          >
            Re-translate Errors
          </AdminButton>
          <AdminButton
            onClick={() => bulkMutation.mutate({ action: 'requeue-summarize', filter: 'error' })}
            disabled={bulkMutation.isPending}
          >
            Re-summarize Errors
          </AdminButton>
          <AdminButton
            onClick={() => bulkMutation.mutate({ action: 'requeue-scrape', filter: 'error' })}
            disabled={bulkMutation.isPending}
          >
            Re-scrape Errors
          </AdminButton>
          <AdminButton
            onClick={() => bulkMutation.mutate({ action: 'reset-errors' })}
            disabled={bulkMutation.isPending}
            variant="danger"
          >
            Reset All Errors to Pending
          </AdminButton>
          <AdminButton
            onClick={() => bulkMutation.mutate({ action: 'requeue-translate', filter: 'pending' })}
            disabled={bulkMutation.isPending}
          >
            Queue All Pending Translations
          </AdminButton>
          <AdminButton
            onClick={() => bulkMutation.mutate({ action: 'requeue-summarize', filter: 'pending' })}
            disabled={bulkMutation.isPending}
          >
            Queue All Pending Summaries
          </AdminButton>
        </div>
      </section>

      {/* User management */}
      <section className="space-y-3">
        <h2 className="text-base font-medium text-text-primary">Users ({userList?.length ?? 0})</h2>
        {userList && userList.length > 0 ? (
          <div className="space-y-2">
            {userList.map(user => (
              <div key={user.id} className="flex items-center justify-between bg-bg-elevated border border-border rounded px-4 py-3">
                <div className="flex items-center gap-3">
                  {user.image ? (
                    <img src={user.image} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-medium">
                      {user.name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-text-primary">
                      {user.name ?? 'Unnamed'}
                      {user.isAdmin && <span className="ml-2 text-xs text-accent-primary">(admin)</span>}
                    </div>
                    <div className="text-xs text-text-tertiary">
                      {user.email} &middot; {user.articleStates} states &middot; {user.readingLists} lists &middot; {user.feeds} feeds
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => toggleAdminMutation.mutate({ userId: user.id, isAdmin: !user.isAdmin })}
                  className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                >
                  {user.isAdmin ? 'Remove Admin' : 'Make Admin'}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No users found</p>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value?: number | string | null;
  color?: string;
}) {
  return (
    <div className="bg-bg-elevated border border-border rounded p-4">
      <div className="text-xs text-text-tertiary mb-1">{label}</div>
      <div className={`text-2xl font-mono ${color ?? 'text-text-primary'}`}>
        {value ?? 0}
      </div>
    </div>
  );
}

function AdminButton({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'danger';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 text-sm border rounded transition-colors disabled:opacity-50 ${
        variant === 'danger'
          ? 'border-accent-highlight text-accent-highlight hover:bg-accent-highlight hover:text-bg-primary'
          : 'border-border text-text-secondary hover:text-text-primary hover:border-accent-primary'
      }`}
    >
      {children}
    </button>
  );
}
