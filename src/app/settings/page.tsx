'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/Toast';

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
  regionId: string;
  categoryId: string;
  sourceLanguage: string;
  sourceName: string;
  enabled: boolean;
  submittedByUserId: string | null;
}

interface SettingsData {
  pollingInterval: number;
  feeds: Feed[];
  health: HealthStatus;
  queue: QueueStatus;
}

interface Region {
  id: string;
  name: string;
  categories: { id: string; slug: string; name: string }[];
}

interface UserPrefs {
  defaultRegionId: string | null;
  theme: string;
  articlesPerPage: number;
  autoMarkRead: boolean;
  dailyGoal: number;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data, isLoading } = useQuery<SettingsData>({
    queryKey: ['settings'],
    queryFn: () => fetch('/api/settings').then((r) => r.json()),
  });

  const { data: myFeeds } = useQuery<Feed[]>({
    queryKey: ['my-feeds'],
    queryFn: () => fetch('/api/feeds/mine').then(r => r.json()),
  });

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then(r => r.json()),
  });

  const { data: prefs } = useQuery<UserPrefs>({
    queryKey: ['user-preferences'],
    queryFn: () => fetch('/api/user/preferences').then(r => r.json()),
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

  const deleteFeedMutation = useMutation({
    mutationFn: (id: number) =>
      fetch(`/api/feeds/${id}`, { method: 'DELETE' }).then(r => r.json()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['my-feeds'] }),
  });

  const prefsMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/user/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(r => r.json()),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-preferences'] }); toast('Preferences saved'); },
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

      {/* My Preferences */}
      <Section title="My Preferences">
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <label className="text-sm text-text-secondary w-40">Default Region</label>
            <select
              value={prefs?.defaultRegionId ?? ''}
              onChange={e => prefsMutation.mutate({ defaultRegionId: e.target.value || null })}
              className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
            >
              <option value="">None</option>
              {Array.isArray(regions) && regions.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-text-secondary w-40">Theme</label>
            <select
              value={prefs?.theme ?? 'system'}
              onChange={e => prefsMutation.mutate({ theme: e.target.value })}
              className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
            >
              <option value="system">System</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-text-secondary w-40">Articles Per Page</label>
            <input
              type="number"
              min={5}
              max={100}
              value={prefs?.articlesPerPage ?? 20}
              onChange={e => prefsMutation.mutate({ articlesPerPage: Number(e.target.value) })}
              className="w-20 bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono focus:outline-none focus:border-accent-primary"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-text-secondary w-40">Daily Reading Goal</label>
            <input
              type="number"
              min={0}
              max={100}
              value={prefs?.dailyGoal ?? 10}
              onChange={e => prefsMutation.mutate({ dailyGoal: Number(e.target.value) })}
              className="w-20 bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary font-mono focus:outline-none focus:border-accent-primary"
            />
            <span className="text-xs text-text-tertiary">articles/day (0 = disabled)</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm text-text-secondary w-40">Auto-mark Read</label>
            <button
              onClick={() => prefsMutation.mutate({ autoMarkRead: !(prefs?.autoMarkRead ?? true) })}
              role="switch"
              aria-checked={prefs?.autoMarkRead ?? true}
              className={`relative w-10 h-5 rounded-full transition-colors ${(prefs?.autoMarkRead ?? true) ? 'bg-accent-primary' : 'bg-bg-elevated border border-border'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${(prefs?.autoMarkRead ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
            <span className="text-xs text-text-tertiary">Mark articles as read when opened</span>
          </div>
        </div>
      </Section>

      <hr className="divider-line border-0" />

      {/* My Feeds */}
      <Section title="My Feeds">
        <AddFeedForm
          regions={regions ?? []}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['my-feeds'] })}
        />
        {myFeeds && myFeeds.length > 0 ? (
          <div className="space-y-2 mt-4">
            {myFeeds.map(feed => (
              <div
                key={feed.id}
                className="flex items-center justify-between bg-bg-elevated border border-border rounded px-4 py-3"
              >
                <div>
                  <div className="text-sm text-text-primary">{feed.name}</div>
                  <div className="text-xs text-text-tertiary">{feed.url}</div>
                </div>
                <button
                  onClick={() => deleteFeedMutation.mutate(feed.id)}
                  className="text-xs text-text-tertiary hover:text-accent-highlight transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary mt-3">No feeds submitted yet.</p>
        )}
      </Section>

      <hr className="divider-line border-0" />

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

      {/* Keyboard Shortcuts */}
      <Section title="Keyboard Shortcuts">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
          {[
            ['?', 'Global shortcuts help'],
            ['⌘K', 'Command palette'],
            ['/', 'Focus search'],
            ['R', 'Random unread article'],
            ['t', 'Scroll to top'],
            ['b', 'Go back'],
            ['g h', 'Go to Dashboard'],
            ['g s', 'Starred · g l Lists · g x Stats'],
            ['g f', 'Feeds · g t Tags · g /  Search'],
            ['j / k', 'Select next/prev article'],
            ['Enter', 'Open selected article'],
            ['m', 'Toggle read on selected'],
            ['* / x', 'Star / Archive selected'],
            ['S', 'Filter by selected source'],
            ['O', 'Open original URL (list)'],
            ['v', 'Toggle compact view'],
            ['u', 'Toggle unread filter'],
            ['f', 'Toggle filters panel'],
            ['[ ]', 'Prev / Next page'],
            ['s / r / a', 'Star / Read / Archive (detail)'],
            ['o', 'Open original source (detail)'],
            ['c / d', 'Copy link / Copy TL;DR'],
            ['i', 'Toggle original text'],
            ['l', 'Save to list picker'],
            ['← → / p n', 'Prev / Next article'],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
              <span className="text-sm text-text-secondary">{desc}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-bg-elevated border border-border rounded text-text-primary shrink-0 ml-2">{key}</kbd>
            </div>
          ))}
        </div>
      </Section>

      <hr className="divider-line border-0" />

      {/* Feed Management */}
      <Section title="All Feeds">
        {data?.feeds && data.feeds.length > 0 ? (
          <div className="space-y-2">
            {data.feeds.map((feed) => (
              <div
                key={feed.id}
                className="flex items-center justify-between bg-bg-elevated border border-border rounded px-4 py-3"
              >
                <div>
                  <div className="text-sm text-text-primary">{feed.name}</div>
                  <div className="text-xs text-text-tertiary">{feed.sourceName} &middot; {feed.regionId}/{feed.categoryId} &middot; {feed.sourceLanguage}</div>
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

function AddFeedForm({
  regions,
  onSuccess,
}: {
  regions: Region[];
  onSuccess: () => void;
}) {
  const [feedUrl, setFeedUrl] = useState('');
  const [regionId, setRegionId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [sourceLanguage, setSourceLanguage] = useState('en');

  const selectedRegion = regions.find(r => r.id === regionId);

  const submitMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      fetch('/api/feeds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).then(async r => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Failed to submit feed');
        return data;
      }),
    onSuccess: () => {
      setFeedUrl('');
      onSuccess();
    },
  });

  return (
    <div className="bg-bg-elevated border border-border rounded p-4 space-y-3">
      <h3 className="text-sm font-medium text-text-primary">Submit RSS Feed</h3>
      <input
        type="url"
        placeholder="https://example.com/feed.xml"
        value={feedUrl}
        onChange={e => setFeedUrl(e.target.value)}
        className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
      />
      <div className="flex flex-wrap gap-3">
        <select
          value={regionId}
          onChange={e => { setRegionId(e.target.value); setCategoryId(''); }}
          className="bg-bg-primary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="">Region...</option>
          {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          disabled={!regionId}
          className="bg-bg-primary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary disabled:opacity-50"
        >
          <option value="">Category...</option>
          {selectedRegion?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          value={sourceLanguage}
          onChange={e => setSourceLanguage(e.target.value)}
          className="bg-bg-primary border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
        >
          <option value="en">English</option>
          <option value="ja">Japanese</option>
          <option value="zh">Chinese</option>
          <option value="tl">Filipino</option>
        </select>
      </div>
      {submitMutation.isError && (
        <p className="text-xs text-accent-highlight">{(submitMutation.error as Error).message}</p>
      )}
      <button
        onClick={() => feedUrl.trim() && regionId && categoryId && submitMutation.mutate({ url: feedUrl.trim(), regionId, categoryId, sourceLanguage })}
        disabled={!feedUrl.trim() || !regionId || !categoryId || submitMutation.isPending}
        className="px-4 py-2 text-sm bg-accent-primary text-bg-primary rounded hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitMutation.isPending ? 'Submitting...' : 'Submit Feed'}
      </button>
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
