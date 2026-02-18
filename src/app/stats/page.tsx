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
    readLastWeek: number;
    readThisMonth: number;
    readLastMonth: number;
    readThisYear: number;
  };
  topRegions: { regionId: string; regionName: string; flagEmoji: string; count: number }[];
  topSources: { sourceName: string; count: number }[];
  topTags: { tag: string; count: number }[];
  listCount: number;
  totalArticles: number;
  totalWordsRead: number;
  dailyActivity: { day: string; count: number }[];
  sentimentDist: { sentiment: string | null; count: number }[];
  hourlyActivity: { hour: number; count: number }[];
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

  const { totals, topRegions, topSources, topTags, listCount, totalArticles, totalWordsRead, dailyActivity, sentimentDist, hourlyActivity } = data ?? {
    totals: { totalRead: 0, totalStarred: 0, totalArchived: 0, readToday: 0, readThisWeek: 0, readLastWeek: 0, readThisMonth: 0, readLastMonth: 0, readThisYear: 0 },
    topRegions: [],
    topSources: [],
    topTags: [],
    listCount: 0,
    totalArticles: 0,
    totalWordsRead: 0,
    dailyActivity: [],
    sentimentDist: [],
    hourlyActivity: [],
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

  // Goal streak — consecutive days meeting daily goal (uses current goal vs historical counts)
  const dailyGoal = prefs?.dailyGoal ?? 0;
  const dailyActivityMap = new Map(dailyActivity.map(a => [a.day, Number(a.count)]));
  let goalStreak = 0;
  if (dailyGoal > 0) {
    const gCheckStart = (dailyActivityMap.get(todayStr) ?? 0) >= dailyGoal ? 0 : 1;
    for (let i = gCheckStart; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      if ((dailyActivityMap.get(ds) ?? 0) < dailyGoal) break;
      goalStreak++;
    }
  }

  // All-time longest streak from 365-day data
  let allTimeStreak = 0;
  let allTimeRun = 0;
  let prevDay: Date | null = null;
  for (const entry of dailyActivity) {
    const d = new Date(entry.day + 'T00:00:00');
    if (prevDay) {
      const gap = Math.round((d.getTime() - prevDay.getTime()) / 86400000);
      if (gap === 1) { allTimeRun++; }
      else { allTimeRun = 1; }
    } else { allTimeRun = 1; }
    allTimeStreak = Math.max(allTimeStreak, allTimeRun);
    prevDay = d;
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
          <a
            href="/api/user/reading-history"
            download
            className="px-3 py-1.5 text-xs border border-border rounded text-text-tertiary hover:text-text-primary hover:border-accent-primary transition-colors"
          >
            Export history
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
        const allTimeBest = dailyActivity.length > 0
          ? dailyActivity.reduce((best, d) => Number(d.count) > Number(best.count) ? d : best, dailyActivity[0])
          : null;
        const allTimeBestLabel = allTimeBest && Number(allTimeBest.count) > 0
          ? new Date(allTimeBest.day + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
          : null;
        return (
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Read Today" value={totals.readToday} highlight />
            <StatCard
              label="This Week"
              value={totals.readThisWeek}
              suffix={totals.readLastWeek > 0 ? (totals.readThisWeek >= totals.readLastWeek ? ` ↑${totals.readThisWeek - totals.readLastWeek} vs last` : ` ↓${totals.readLastWeek - totals.readThisWeek} vs last`) : undefined}
            />
            <StatCard
              label="This Month"
              value={totals.readThisMonth}
              suffix={totals.readLastMonth > 0 ? (totals.readThisMonth >= totals.readLastMonth ? ` ↑${totals.readThisMonth - totals.readLastMonth} vs last` : ` ↓${totals.readLastMonth - totals.readThisMonth} vs last`) : undefined}
            />
            <StatCard label="This Year" value={totals.readThisYear} />
            <StatCard label="Streak" value={streak} suffix={streak === 1 ? ' day' : ' days'} />
            {dailyGoal > 0 && <StatCard label="Goal Streak" value={goalStreak} suffix={goalStreak === 1 ? ' day' : ' days'} highlight={goalStreak > 0} />}
            <StatCard label="Best Streak (30d)" value={longestStreak} suffix={longestStreak === 1 ? ' day' : ' days'} />
            <StatCard label="Best Streak (all)" value={allTimeStreak} suffix={allTimeStreak === 1 ? ' day' : ' days'} />
            <StatCard label="Avg/Active Day" value={pace} suffix=" articles" />
            <StatCard label="Best Day (30d)" value={bestDay.count > 0 ? bestDay.count : '—'} suffix={bestDay.count > 0 ? ` · ${bestDayLabel}` : ''} />
            <StatCard label="All-Time Best" value={allTimeBest && Number(allTimeBest.count) > 0 ? Number(allTimeBest.count) : '—'} suffix={allTimeBestLabel ? ` · ${allTimeBestLabel}` : ''} />
            <StatCard label="Reading Lists" value={listCount} />
            <StatCard label="Total Read" value={totals.totalRead} />
            <StatCard label="Starred" value={totals.totalStarred} />
            <StatCard label="Archived" value={totals.totalArchived} />
            <StatCard label="Total in DB" value={totalArticles} />
            <StatCard label="Coverage" value={totalArticles > 0 ? `${Math.round((totals.totalRead / totalArticles) * 100)}%` : '0%'} />
            <StatCard label="Consistency" value={`${Math.round((activeDays / 30) * 100)}%`} suffix=" of 30d" />
            {(() => {
              const monthTotal = days.reduce((s, d) => s + d.count, 0);
              const vel = (monthTotal / 30).toFixed(1);
              return <StatCard label="Velocity" value={vel} suffix=" art/day" />;
            })()}
            <StatCard
              label="Words Read"
              value={totalWordsRead >= 1000000 ? `${(totalWordsRead / 1000000).toFixed(1)}M` : totalWordsRead >= 1000 ? `${Math.round(totalWordsRead / 1000)}k` : totalWordsRead}
            />
            {(() => {
              const hrs = totalWordsRead / 250 / 60;
              return <StatCard label="Hours Read" value={hrs >= 1 ? `${hrs.toFixed(1)}h` : `${Math.round(hrs * 60)}m`} />;
            })()}
            <StatCard label="Pages Read" value={Math.round(totalWordsRead / 250)} suffix=" pg" />
            {(() => {
              const totalRead = Number(totals.totalRead);
              if (totalRead === 0) return null;
              const avgWords = Math.round(totalWordsRead / totalRead);
              const avgMins = Math.max(1, Math.round(avgWords / 200));
              return <StatCard label="Avg Article" value={`${avgMins}m`} suffix={` · ${avgWords >= 1000 ? `${Math.round(avgWords / 100) / 10}k` : avgWords} wds`} />;
            })()}
            {(() => {
              const peak = hourlyActivity.length > 0
                ? hourlyActivity.reduce((best, h) => h.count > best.count ? h : best, hourlyActivity[0])
                : null;
              if (!peak) return null;
              const h = peak.hour;
              const ampm = h < 12 ? 'AM' : 'PM';
              const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
              return <StatCard label="Peak Hour" value={`${h12}${ampm}`} />;
            })()}
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

      {/* Weekly goal progress */}
      {prefs && prefs.dailyGoal > 0 && (() => {
        const weeklyGoal = prefs.dailyGoal * 7;
        const pct = Math.min(100, Math.round((totals.readThisWeek / weeklyGoal) * 100));
        const done = totals.readThisWeek >= weeklyGoal;
        return (
          <section className="bg-bg-elevated border border-border rounded p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-text-secondary font-medium">Weekly Goal</span>
              <span className={`font-mono ${done ? 'text-accent-secondary' : 'text-text-tertiary'}`}>
                {totals.readThisWeek}/{weeklyGoal} {done ? '✓' : `(${pct}%)`}
              </span>
            </div>
            <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${done ? 'bg-accent-secondary' : 'bg-accent-primary'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            {done && <p className="text-xs text-accent-secondary">Weekly goal reached!</p>}
          </section>
        );
      })()}

      {/* Activity heatmap — 52-week calendar */}
      {(() => {
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const activityMap = new Map<string, number>(dailyActivity.map((a) => [a.day, Number(a.count)]));
        const maxCount = Math.max(...dailyActivity.map((a) => Number(a.count)), 1);

        // Start from the Sunday 52 weeks back
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 52 * 7);
        startDate.setDate(startDate.getDate() - startDate.getDay());

        const heatWeeks: { date: Date; count: number; future: boolean }[][] = [];
        const curr = new Date(startDate);
        while (curr <= now) {
          const week: { date: Date; count: number; future: boolean }[] = [];
          for (let d = 0; d < 7; d++) {
            const ds = curr.toISOString().split('T')[0];
            week.push({ date: new Date(curr), count: activityMap.get(ds) ?? 0, future: curr > now });
            curr.setDate(curr.getDate() + 1);
          }
          heatWeeks.push(week);
        }

        const getCellBg = (count: number, future: boolean) => {
          if (future || count === 0) return 'bg-bg-elevated';
          const r = count / maxCount;
          if (r < 0.25) return 'bg-accent-secondary/25';
          if (r < 0.5) return 'bg-accent-secondary/55';
          if (r < 0.75) return 'bg-accent-primary/60';
          return 'bg-accent-primary';
        };

        // Month labels: show when month changes
        const monthLabels: { label: string; weekIdx: number }[] = [];
        let lastMonth = -1;
        heatWeeks.forEach((week, i) => {
          const m = week[0].date.getMonth();
          if (m !== lastMonth) {
            monthLabels.push({ label: week[0].date.toLocaleDateString('en-US', { month: 'short' }), weekIdx: i });
            lastMonth = m;
          }
        });

        return (
          <section className="space-y-2">
            <h2 className="text-base font-medium text-text-primary">Reading Activity</h2>
            <div className="overflow-x-auto pb-1">
              <div className="inline-flex gap-0.5">
                {/* Day-of-week labels */}
                <div className="flex flex-col gap-0.5 mr-1">
                  <div className="h-4" />
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                    <div key={i} className="h-3 w-3 flex items-center justify-center">
                      {i % 2 === 1 && <span className="text-[8px] text-text-tertiary">{d}</span>}
                    </div>
                  ))}
                </div>
                {/* Week columns */}
                {heatWeeks.map((week, wi) => {
                  const ml = monthLabels.find((m) => m.weekIdx === wi);
                  return (
                    <div key={wi} className="flex flex-col gap-0.5">
                      <div className="h-4 flex items-end">
                        {ml && <span className="text-[8px] text-text-tertiary whitespace-nowrap leading-none">{ml.label}</span>}
                      </div>
                      {week.map(({ date, count, future }, di) => (
                        <div
                          key={di}
                          title={future ? '' : `${date.toISOString().split('T')[0]}: ${count} article${count !== 1 ? 's' : ''}`}
                          className={`w-3 h-3 rounded-sm ${getCellBg(count, future)}`}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
              <span>Less</span>
              {['bg-bg-elevated', 'bg-accent-secondary/25', 'bg-accent-secondary/55', 'bg-accent-primary/60', 'bg-accent-primary'].map((bg, i) => (
                <div key={i} className={`w-3 h-3 rounded-sm ${bg}`} />
              ))}
              <span>More</span>
            </div>
          </section>
        );
      })()}

      {/* Monthly trend — last 12 months */}
      {dailyActivity.length > 0 && (() => {
        const now = new Date();
        const months: { label: string; key: string; count: number }[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = d.toLocaleDateString('en-US', { month: 'short' });
          months.push({ label, key, count: 0 });
        }
        dailyActivity.forEach(({ day, count }) => {
          const key = day.slice(0, 7);
          const m = months.find(m => m.key === key);
          if (m) m.count += Number(count);
        });
        const maxMonth = Math.max(...months.map(m => m.count), 1);
        const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        return (
          <section className="space-y-3">
            <h2 className="text-base font-medium text-text-primary">Monthly Trend</h2>
            <div className="flex items-end gap-1.5 h-20">
              {months.map(({ label, key, count }) => {
                const pct = (count / maxMonth) * 100;
                const isCurrent = key === currentKey;
                return (
                  <div key={key} className="flex flex-col items-center gap-1 flex-1" title={`${label}: ${count} articles`}>
                    <div className="w-full flex items-end justify-center h-16">
                      <div
                        className={`w-full rounded-t transition-all ${isCurrent ? 'bg-accent-primary' : 'bg-accent-primary/50'}`}
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <span className={`text-[9px] font-mono ${isCurrent ? 'text-accent-primary' : 'text-text-tertiary'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Day-of-week distribution */}
      {dailyActivity.length > 0 && (() => {
        const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const dowCounts = [0, 0, 0, 0, 0, 0, 0];
        dailyActivity.forEach(({ day, count }) => {
          const dow = new Date(day + 'T00:00:00').getDay();
          dowCounts[dow] += Number(count);
        });
        const maxDow = Math.max(...dowCounts, 1);
        const total = dowCounts.reduce((s, c) => s + c, 0);
        const peakDow = dowCounts.indexOf(Math.max(...dowCounts));
        return (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-text-primary">Reading by Day of Week</h2>
              <span className="text-xs text-text-tertiary">Peak: <span className="text-text-secondary font-medium">{DOW[peakDow]}</span></span>
            </div>
            <div className="flex items-end gap-1.5 h-20">
              {DOW.map((label, i) => {
                const pct = (dowCounts[i] / maxDow) * 100;
                const sharePct = total > 0 ? Math.round((dowCounts[i] / total) * 100) : 0;
                const isToday = new Date().getDay() === i;
                return (
                  <div key={label} className="flex flex-col items-center gap-1 flex-1" title={`${label}: ${dowCounts[i]} articles (${sharePct}%)`}>
                    <div className="w-full flex items-end justify-center h-16">
                      <div
                        className={`w-full rounded-t transition-all ${isToday ? 'bg-accent-primary' : i === peakDow ? 'bg-accent-primary/70' : 'bg-accent-secondary/40'}`}
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                    <span className={`text-[10px] font-mono ${isToday ? 'text-accent-primary' : 'text-text-tertiary'}`}>{label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })()}

      {/* Reading by Hour of Day */}
      {hourlyActivity.length > 0 && (() => {
        const byHour = Array.from({ length: 24 }, (_, h) => ({
          hour: h,
          count: hourlyActivity.find(x => x.hour === h)?.count ?? 0,
        }));
        const maxH = Math.max(...byHour.map(h => Number(h.count)), 1);
        const peakH = byHour.reduce((best, h) => Number(h.count) > Number(best.count) ? h : best, byHour[0]);
        const nowHour = new Date().getHours();
        return (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-medium text-text-primary">Reading by Hour</h2>
              <span className="text-xs text-text-tertiary">
                Peak: <span className="text-text-secondary font-medium">{peakH.hour === 0 ? '12AM' : peakH.hour < 12 ? `${peakH.hour}AM` : peakH.hour === 12 ? '12PM' : `${peakH.hour - 12}PM`}</span>
              </span>
            </div>
            <div className="flex items-end gap-px h-16">
              {byHour.map(({ hour, count }) => {
                const pct = (Number(count) / maxH) * 100;
                const isNow = hour === nowHour;
                const isPeak = hour === peakH.hour;
                return (
                  <div
                    key={hour}
                    className="flex-1"
                    title={`${hour === 0 ? '12AM' : hour < 12 ? `${hour}AM` : hour === 12 ? '12PM' : `${hour - 12}PM`}: ${count} articles`}
                  >
                    <div
                      className={`w-full rounded-sm transition-all ${isNow ? 'bg-accent-primary' : isPeak ? 'bg-accent-primary/70' : 'bg-accent-secondary/40'}`}
                      style={{ height: `${Math.max(count > 0 ? 4 : 1, pct)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[9px] text-text-tertiary font-mono">
              <span>12AM</span><span>6AM</span><span>12PM</span><span>6PM</span><span>11PM</span>
            </div>
          </section>
        );
      })()}

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

        {/* Top sources */}
        {topSources.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-medium text-text-primary">Top Sources</h2>
            <div className="space-y-2">
              {topSources.map((s) => {
                const maxCount = Math.max(...topSources.map((x) => Number(x.count)));
                const pct = Math.round((Number(s.count) / maxCount) * 100);
                return (
                  <div key={s.sourceName} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <a
                        href={`/articles?source=${encodeURIComponent(s.sourceName)}`}
                        className="text-text-secondary hover:text-accent-primary transition-colors truncate max-w-[200px]"
                      >
                        {s.sourceName}
                      </a>
                      <span className="text-text-tertiary font-mono shrink-0 ml-2">{s.count}</span>
                    </div>
                    <div className="h-1.5 bg-bg-elevated rounded-full overflow-hidden">
                      <div className="h-full bg-accent-secondary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

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
