'use client';

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

  if (!data) return null;

  const readToday = Number(data.totals.readToday ?? 0);
  const goal = prefs?.dailyGoal ?? 10;
  const goalMet = goal > 0 && readToday >= goal;
  const totalUnread = unreadCounts ? Object.values(unreadCounts).reduce((sum, n) => sum + n, 0) : 0;

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

  return (
    <Link href="/stats" className="flex items-center gap-3 text-xs text-text-tertiary hover:text-text-secondary transition-colors">
      <span className={goalMet ? 'text-success font-medium' : ''}>
        {goal > 0 ? `${readToday}/${goal} today` : `${readToday} read today`}
      </span>
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
    </Link>
  );
}
