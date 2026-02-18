'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface UserStats {
  totals: { readToday: number };
  dailyActivity: { day: string; count: number }[];
}

export default function ReadingStatus() {
  const { data } = useQuery<UserStats>({
    queryKey: ['user-stats'],
    queryFn: () => fetch('/api/user/stats').then(r => r.json()),
    staleTime: 60000,
  });
  const { data: prefs } = useQuery<{ dailyGoal: number }>({
    queryKey: ['user-prefs'],
    queryFn: () => fetch('/api/user/preferences').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: unreadCounts } = useQuery<Record<string, number>>({
    queryKey: ['unread-counts'],
    queryFn: () => fetch('/api/regions/unread-counts').then(r => r.json()),
    staleTime: 60000,
  });

  const [inProgressCount, setInProgressCount] = useState(0);
  useEffect(() => {
    let count = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('article-scroll-')) {
        const val = parseInt(localStorage.getItem(key) ?? '0', 10);
        if (val > 100) count++;
      }
    }
    setInProgressCount(count);
  }, []);

  if (!data) return null;

  const readToday = Number(data.totals.readToday ?? 0);
  const goal = prefs?.dailyGoal ?? 10;
  const goalMet = goal > 0 && readToday >= goal;
  const totalUnread = unreadCounts ? Object.values(unreadCounts).reduce((sum, n) => sum + n, 0) : 0;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];
  const readYesterday = Number(data.dailyActivity.find(a => a.day === yesterdayStr)?.count ?? 0);
  const vsYesterday = readToday > 0 && readYesterday > 0 ? readToday - readYesterday : null;

  // Calculate streak
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const activitySet = new Set(data.dailyActivity.map(a => a.day));
  const checkStart = activitySet.has(todayStr) ? 0 : 1;
  let streak = 0;
  for (let i = checkStart; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (!activitySet.has(d.toISOString().split('T')[0])) break;
    streak++;
  }

  // 7-day sparkline data
  const sparkDays: number[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    sparkDays.push(Number(data.dailyActivity.find(a => a.day === ds)?.count ?? 0));
  }
  const sparkMax = Math.max(...sparkDays, 1);

  return (
    <Link href="/stats" className="flex items-center gap-3 text-xs text-text-tertiary hover:text-text-secondary transition-colors">
      <span className={goalMet ? 'text-success font-medium' : ''}>
        {goal > 0 ? `${readToday}/${goal} today` : `${readToday} read today`}
      </span>
      {vsYesterday !== null && (
        <>
          <span className="text-border">·</span>
          <span className={vsYesterday > 0 ? 'text-success' : vsYesterday < 0 ? 'text-accent-highlight' : ''}>
            {vsYesterday > 0 ? `+${vsYesterday}` : vsYesterday} vs yesterday
          </span>
        </>
      )}
      {totalUnread > 0 && (
        <>
          <span className="text-border">·</span>
          <span>{totalUnread.toLocaleString()} unread</span>
        </>
      )}
      {streak > 0 && (
        <>
          <span className="text-border">·</span>
          <span>{streak} day{streak !== 1 ? 's' : ''} streak</span>
        </>
      )}
      {inProgressCount > 0 && (
        <>
          <span className="text-border">·</span>
          <span className="text-accent-secondary">{inProgressCount} in progress</span>
        </>
      )}
      <span className="flex items-end gap-px h-4 ml-1" title="7-day reading activity">
        {sparkDays.map((v, i) => (
          <span
            key={i}
            className={`w-1 rounded-sm ${v > 0 ? 'bg-accent-primary' : 'bg-border'}`}
            style={{ height: `${Math.max(2, Math.round((v / sparkMax) * 16))}px`, opacity: i === 6 ? 1 : 0.6 + i * 0.06 }}
          />
        ))}
      </span>
    </Link>
  );
}
