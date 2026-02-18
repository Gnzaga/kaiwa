'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';

interface StatsResponse {
  totals: {
    totalRead: number;
    totalStarred: number;
    totalArchived: number;
    readToday: number;
    readThisWeek: number;
    readThisMonth: number;
    readThisYear: number;
  };
  topRegions: { regionId: string; regionName: string; flagEmoji: string; count: number }[];
  topTags: { tag: string; count: number }[];
  listCount: number;
  dailyActivity: { day: string; count: number }[];
  sentimentDist: { sentiment: string | null; count: number }[];
}

export default function StatsPage() {
  const { data, isLoading } = useQuery<StatsResponse>({
    queryKey: ['user-stats'],
    queryFn: () => fetch('/api/user/stats').then((r) => r.json()),
  });
  const { data: prefs } = useQuery<{ dailyGoal: number }>({
    queryKey: ['user-prefs'],
    queryFn: () => fetch('/api/user/preferences').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });
  const [digestCopied, setDigestCopied] = useState(false);

  const copyDigest = async () => {
    const resp = await fetch('/api/user/digest').then(r => r.json());
    if (resp.markdown) {
      await navigator.clipboard.writeText(resp.markdown);
      setDigestCopied(true);
      setTimeout(() => setDigestCopied(false), 2500);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 bg-bg-secondary border border-border rounded animate-pulse" />
        ))}
      </div>
    );
  }

  const { totals, topRegions, topTags, listCount, dailyActivity, sentimentDist } = data ?? {
    totals: { totalRead: 0, totalStarred: 0, totalArchived: 0, readToday: 0, readThisWeek: 0, readThisMonth: 0, readThisYear: 0 },
    topRegions: [],
    topTags: [],
    listCount: 0,
    dailyActivity: [],
    sentimentDist: [],
  };

  const SENTIMENT_COLOR: Record<string, string> = {
    positive: '#4ade80',
    negative: '#ff2d55',
    neutral: '#888888',
    mixed: '#f59e0b',
    bullish: '#22d3ee',
    bearish: '#ff2d55',
    restrictive: '#a855f7',
    permissive: '#4ade80',
  };
  const sentimentTotal = sentimentDist.reduce((s, d) => s + Number(d.count), 0);

  // Build 30-day calendar grid
  const today = new Date();
  const days: { date: string; count: number }[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const entry = dailyActivity.find((a) => a.day === dateStr);
    days.push({ date: dateStr, count: entry ? Number(entry.count) : 0 });
  }
  const maxDay = Math.max(...days.map((d) => d.count), 1);

  // Calculate current reading streak (consecutive days ending today/yesterday)
  let streak = 0;
  const todayStr = today.toISOString().split('T')[0];
  const activitySet = new Set(dailyActivity.map((a) => a.day));
  const checkStart = activitySet.has(todayStr) ? 0 : 1; // start from yesterday if not read today
  for (let i = checkStart; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (!activitySet.has(d.toISOString().split('T')[0])) break;
    streak++;
  }

  // Longest streak in 30-day window
  let longestStreak = 0;
  let runLen = 0;
  for (const day of days) {
    if (day.count > 0) { runLen++; longestStreak = Math.max(longestStreak, runLen); }
    else runLen = 0;
  }

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto space-y-8">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Your Stats</h1>
          <p className="text-xs text-text-tertiary mt-1">Reading activity overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyDigest}
            className={`px-3 py-1.5 text-xs border rounded transition-colors ${digestCopied ? 'border-accent-primary text-accent-primary' : 'border-border text-text-tertiary hover:text-text-primary hover:border-accent-primary'}`}
          >
            {digestCopied ? 'Digest copied!' : 'Copy weekly digest'}
          </button>
          <a
            href="/api/user/starred-export"
            download
            className="px-3 py-1.5 text-xs border border-border rounded text-text-tertiary hover:text-text-primary hover:border-accent-primary transition-colors"
          >
            Export starred
          </a>
        </div>
      </header>

      {/* Overview cards */}
      {(() => {
        const activeDays = days.filter(d => d.count > 0).length;
        const pace = activeDays > 0 ? (days.reduce((s, d) => s + d.count, 0) / activeDays).toFixed(1) : '0';
        const bestDay = days.reduce((best, d) => d.count > best.count ? d : best, { date: '', count: 0 });
        const bestDayLabel = bestDay.count > 0
          ? new Date(bestDay.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
          : '—';
        return (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Read Today" value={totals.readToday} highlight />
            <StatCard label="This Week" value={totals.readThisWeek} />
            <StatCard label="This Month" value={totals.readThisMonth} />
            <StatCard label="This Year" value={totals.readThisYear} />
            <StatCard label="Streak" value={streak} suffix={streak === 1 ? ' day' : ' days'} />
            <StatCard label="Best Streak (30d)" value={longestStreak} suffix={longestStreak === 1 ? ' day' : ' days'} />
            <StatCard label="Avg/Active Day" value={pace} suffix=" articles" />
            <StatCard label="Best Day (30d)" value={bestDay.count > 0 ? bestDay.count : '—'} suffix={bestDay.count > 0 ? ` · ${bestDayLabel}` : ''} />
            <StatCard label="Reading Lists" value={listCount} />
            <StatCard label="Total Read" value={totals.totalRead} />
            <StatCard label="Starred" value={totals.totalStarred} />
            <StatCard label="Archived" value={totals.totalArchived} />
          </section>
        );
      })()}

      {/* Daily goal progress */}
      {prefs && prefs.dailyGoal > 0 && (() => {
        const goal = prefs.dailyGoal;
        const pct = Math.min(100, Math.round((totals.readToday / goal) * 100));
        const done = totals.readToday >= goal;
        return (
          <section className="bg-bg-elevated border border-border rounded p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary font-medium">Daily Goal</span>
              <span className={`font-mono ${done ? 'text-accent-secondary' : 'text-text-tertiary'}`}>
                {totals.readToday}/{goal} {done ? '✓' : `(${pct}%)`}
              </span>
            </div>
            <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${done ? 'bg-accent-secondary' : 'bg-accent-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {done && <p className="text-xs text-accent-secondary">Goal reached today!</p>}
          </section>
        );
      })()}

      {/* Activity heatmap */}
      <section className="space-y-3">
        <h2 className="text-base font-medium text-text-primary">30-Day Activity</h2>
        <div className="flex gap-1 flex-wrap">
          {days.map(({ date, count }) => {
            const intensity = count === 0 ? 0 : Math.ceil((count / maxDay) * 4);
            const bg = ['bg-bg-elevated', 'bg-accent-secondary/30', 'bg-accent-secondary/50', 'bg-accent-primary/60', 'bg-accent-primary'][intensity];
            return (
              <div
                key={date}
                title={`${date}: ${count} articles`}
                className={`w-7 h-7 rounded-sm ${bg} border border-border/50 flex items-center justify-center`}
              >
                {count > 0 && (
                  <span className="text-[9px] font-mono text-text-primary/70">{count}</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-text-tertiary">Each square = one day. Darker = more articles read.</p>
      </section>

      {/* Top regions + tags side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* Top regions */}
        <section className="space-y-3">
          <h2 className="text-base font-medium text-text-primary">Top Regions</h2>
          {topRegions.length === 0 ? (
            <p className="text-sm text-text-tertiary">No data yet</p>
          ) : (
            <div className="space-y-2">
              {topRegions.map((r) => {
                const maxCount = Math.max(...topRegions.map((x) => Number(x.count)));
                const pct = Math.round((Number(r.count) / maxCount) * 100);
                return (
                  <div key={r.regionId} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary">{r.flagEmoji} {r.regionName}</span>
                      <span className="text-text-tertiary font-mono">{r.count}</span>
                    </div>
                    <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-accent-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Top tags */}
        <section className="space-y-3">
          <h2 className="text-base font-medium text-text-primary">Top Tags</h2>
          {topTags.length === 0 ? (
            <p className="text-sm text-text-tertiary">No data yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topTags.map(({ tag, count }, i) => (
                <a
                  key={tag}
                  href={`/articles?tag=${encodeURIComponent(tag)}`}
                  className={`px-2.5 py-1 border rounded-full text-xs transition-colors hover:border-accent-primary hover:text-accent-primary ${i === 0 ? 'bg-accent-primary/10 border-accent-primary/40 text-accent-primary font-medium' : 'bg-bg-elevated border-border text-text-secondary'}`}
                >
                  {tag} <span className="font-mono opacity-70">{count}</span>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* Sentiment distribution */}
        {sentimentDist.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-medium text-text-primary">Sentiment Distribution</h2>
            <div className="flex rounded-lg overflow-hidden h-4">
              {sentimentDist.map(({ sentiment, count }) => (
                <div
                  key={sentiment ?? 'unknown'}
                  style={{
                    width: `${(Number(count) / sentimentTotal) * 100}%`,
                    backgroundColor: SENTIMENT_COLOR[sentiment ?? ''] ?? '#555555',
                  }}
                  title={`${sentiment ?? 'unknown'}: ${count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {sentimentDist.map(({ sentiment, count }) => (
                <div key={sentiment ?? 'unknown'} className="flex items-center gap-1.5 text-xs text-text-secondary">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: SENTIMENT_COLOR[sentiment ?? ''] ?? '#555555' }}
                  />
                  <span className="capitalize">{sentiment ?? 'unknown'}</span>
                  <span className="text-text-tertiary font-mono">{Math.round((Number(count) / sentimentTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, highlight, suffix }: { label: string; value: number | string; highlight?: boolean; suffix?: string }) {
  return (
    <div className="bg-bg-elevated border border-border rounded p-4">
      <div className="text-xs text-text-tertiary mb-1">{label}</div>
      <div className={`text-2xl font-mono ${highlight ? 'text-accent-primary' : 'text-text-primary'}`}>
        {value}{suffix && <span className="text-sm font-sans text-text-secondary">{suffix}</span>}
      </div>
    </div>
  );
}
