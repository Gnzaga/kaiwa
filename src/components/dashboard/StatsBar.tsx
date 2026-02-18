'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface Stats {
  articlesToday: number;
  articlesThisHour: number;
  totalArticles: number;
  translationsPending: number;
  summariesPending: number;
}

export default function StatsBar() {
  const { data, isLoading } = useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: () => fetch('/api/stats').then((r) => r.json()),
    refetchInterval: 30000,
  });

  function backlogColor(n: number | undefined): string {
    if (n == null) return '';
    if (n === 0) return 'text-success';
    if (n < 30) return '';
    if (n < 100) return 'text-accent-secondary';
    return 'text-accent-highlight';
  }

  const stats = [
    {
      label: 'Articles Today',
      value: data?.articlesToday ?? 0,
      sub: data?.articlesThisHour != null ? `${data.articlesThisHour} this hour` : undefined,
      href: '/articles?datePreset=today',
      colorClass: '',
    },
    { label: 'Total Articles', value: data?.totalArticles?.toLocaleString() ?? '—', href: '/articles', colorClass: '' },
    { label: 'Translations Pending', value: data?.translationsPending ?? 0, href: null, colorClass: backlogColor(data?.translationsPending) },
    { label: 'Summaries Pending', value: data?.summariesPending ?? 0, href: null, colorClass: backlogColor(data?.summariesPending) },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const inner = (
          <>
            <div className="text-xs text-text-tertiary mb-1">{stat.label}</div>
            <div className={`text-3xl font-mono font-medium ${stat.colorClass || 'text-text-primary'}`}>
              {isLoading ? (
                <span className="inline-block w-12 h-8 bg-bg-elevated rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </div>
            {'sub' in stat && stat.sub && (
              <div className="text-xs text-text-tertiary mt-1 opacity-70">{stat.sub}</div>
            )}
          </>
        );
        return stat.href ? (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-bg-secondary border border-border rounded p-4 accent-line-top hover:border-accent-primary transition-colors"
          >
            {inner}
          </Link>
        ) : (
          <div key={stat.label} className="bg-bg-secondary border border-border rounded p-4 accent-line-top">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
