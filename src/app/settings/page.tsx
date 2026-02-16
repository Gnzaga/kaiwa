'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
interface HealthStatus {
  miniflux: { ok: boolean; error?: string };
  libretranslate: { ok: boolean; error?: string };
  openwebui: { ok: boolean; error?: string };
}

interface QueueStatus {
  translationPending: number;
  summarizationPending: number;
}

interface Feed {
  id: number;
  name: string;
  url: string;
  category: 'law' | 'economics';
  sourceName: string;
  enabled: boolean;
}

interface SettingsData {
  pollingInterval: number;
  feeds: Feed[];
  health: HealthStatus;
  queue: QueueStatus;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['settings'] }),
  });

  const bulkAction = useMutation({
    mutationFn: (action: string) =>
      fetch('/api/settings/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      }).then((r) => r.json()),
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-32 bg-bg-secondary border border-border rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Settings</h1>
      </header>

      {/* Polling Interval */}
      <Section title="Polling Interval">
        <PollingControl
          value={data?.pollingInterval ?? 15}
          onChange={(v) => updateMutation.mutate({ pollingInterval: v })}
        />
      </Section>

      <hr className="divider-line border-0" />

      {/* Service Health */}
      <Section title="Service Health">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <HealthCard name="Miniflux" status={data?.health.miniflux} />
          <HealthCard name="LibreTranslate" status={data?.health.libretranslate} />
          <HealthCard name="OpenWebUI" status={data?.health.openwebui} />
        </div>
      </Section>

      <hr className="divider-line border-0" />

      {/* Queue Status */}
      <Section title="Queue Status">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-bg-elevated border border-border rounded p-4">
            <div className="text-xs text-text-tertiary mb-1">Translations Pending</div>
            <div className="text-2xl font-mono text-text-primary">{data?.queue.translationPending ?? 0}</div>
          </div>
          <div className="bg-bg-elevated border border-border rounded p-4">
            <div className="text-xs text-text-tertiary mb-1">Summaries Pending</div>
            <div className="text-2xl font-mono text-text-primary">{data?.queue.summarizationPending ?? 0}</div>
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button
            onClick={() => bulkAction.mutate('retranslate')}
            disabled={bulkAction.isPending}
            className="px-4 py-2 text-sm border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors disabled:opacity-50"
          >
            Bulk Re-translate
          </button>
          <button
            onClick={() => bulkAction.mutate('resummarize')}
            disabled={bulkAction.isPending}
            className="px-4 py-2 text-sm border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors disabled:opacity-50"
          >
            Bulk Re-summarize
          </button>
        </div>
      </Section>

      <hr className="divider-line border-0" />

      {/* Feed Management */}
      <Section title="Feeds">
        {data?.feeds && data.feeds.length > 0 ? (
          <div className="space-y-2">
            {data.feeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center justify-between bg-bg-elevated border border-border rounded px-4 py-3"
              >
                <div>
                  <div className="text-sm text-text-primary">{feed.name}</div>
                  <div className="text-xs text-text-tertiary">{feed.sourceName} &middot; {feed.category}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`inline-block h-2 w-2 rounded-full ${feed.enabled ? 'bg-success' : 'bg-text-tertiary'}`} />
                  <button
                    onClick={() => updateMutation.mutate({ feedId: feed.id, enabled: !feed.enabled })}
                    className="text-xs text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {feed.enabled ? 'Disable' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No feeds configured</p>
        )}
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="text-base font-medium text-text-primary">{title}</h2>
      {children}
    </section>
  );
}

function PollingControl({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [local, setLocal] = useState(value);

  return (
    <div className="flex items-center gap-4">
      <input
        type="number"
        min={1}
        max={120}
        value={local}
        onChange={(e) => setLocal(Number(e.target.value))}
        className="w-20 bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono focus:outline-none focus:border-accent-primary"
      />
      <span className="text-sm text-text-tertiary">minutes</span>
      {local !== value && (
        <button
          onClick={() => onChange(local)}
          className="px-3 py-1.5 text-xs border border-accent-primary text-accent-primary rounded hover:bg-accent-primary hover:text-text-primary transition-colors"
        >
          Save
        </button>
      )}
    </div>
  );
}

function HealthCard({
  name,
  status,
}: {
  name: string;
  status?: { ok: boolean; error?: string };
}) {
  const ok = status?.ok ?? false;

  return (
    <div className="bg-bg-elevated border border-border rounded p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block h-2 w-2 rounded-full ${ok ? 'bg-success' : 'bg-accent-highlight'}`} />
        <span className="text-sm text-text-primary">{name}</span>
      </div>
      <div className={`text-xs ${ok ? 'text-text-tertiary' : 'text-accent-highlight'}`}>
        {ok ? 'Connected' : status?.error || 'Unreachable'}
      </div>
    </div>
  );
}
