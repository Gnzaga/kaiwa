'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface Stats {
  articlesToday: number;
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

  const stats = [
    { label: 'Articles Today', value: data?.articlesToday ?? 0, href: '/articles?datePreset=today' },
    { label: 'Total Articles', value: data?.totalArticles?.toLocaleString() ?? '—', href: '/articles' },
    { label: 'Translations Pending', value: data?.translationsPending ?? 0, href: null },
    { label: 'Summaries Pending', value: data?.summariesPending ?? 0, href: null },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat) => {
        const inner = (
          <>
            <div className="text-xs text-text-tertiary mb-1">{stat.label}</div>
            <div className="text-3xl font-mono font-medium text-text-primary">
              {isLoading ? (
                <span className="inline-block w-12 h-8 bg-bg-elevated rounded animate-pulse" />
              ) : (
                stat.value
              )}
            </div>
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
