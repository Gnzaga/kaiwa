'use client';

import { useQuery } from '@tanstack/react-query';

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
    { label: 'Articles Today', value: data?.articlesToday ?? 0 },
    { label: 'Total Articles', value: data?.totalArticles?.toLocaleString() ?? '—' },
    { label: 'Translations Pending', value: data?.translationsPending ?? 0 },
    { label: 'Summaries Pending', value: data?.summariesPending ?? 0 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-bg-secondary border border-border rounded p-4 accent-line-top"
        >
          <div className="text-xs text-text-tertiary mb-1">{stat.label}</div>
          <div className="text-3xl font-mono font-medium text-text-primary">
            {isLoading ? (
              <span className="inline-block w-12 h-8 bg-bg-elevated rounded animate-pulse" />
            ) : (
              stat.value
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
