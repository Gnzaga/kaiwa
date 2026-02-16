'use client';

import { useQuery } from '@tanstack/react-query';

interface Stats {
  articlesToday: number;
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
    { label: 'Articles Today', labelJa: '\u4ECA\u65E5\u306E\u8A18\u4E8B', value: data?.articlesToday ?? 0 },
    { label: 'Translations Pending', labelJa: '\u7FFB\u8A33\u5F85\u3061', value: data?.translationsPending ?? 0 },
    { label: 'Summaries Pending', labelJa: '\u8981\u7D04\u5F85\u3061', value: data?.summariesPending ?? 0 },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
          <div className="text-[10px] text-text-tertiary font-jp mt-0.5">{stat.labelJa}</div>
        </div>
      ))}
    </div>
  );
}
