'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface SourceStat {
  name: string;
  count: number;
}

export default function TopSources() {
  const { data, isLoading } = useQuery<SourceStat[]>({
    queryKey: ['stats-sources'],
    queryFn: () => fetch('/api/stats/sources').then(r => r.json()),
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <div className="bg-bg-secondary border border-border rounded p-4 space-y-2">
        <div className="h-4 w-28 bg-bg-elevated rounded animate-pulse" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-5 bg-bg-elevated rounded animate-pulse" style={{ width: `${60 + i * 8}%` }} />
        ))}
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const max = data[0].count;

  return (
    <div className="bg-bg-secondary border border-border rounded p-4 accent-line-top">
      <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Top Sources Today</h2>
      <div className="space-y-2">
        {data.slice(0, 5).map((source, i) => (
          <div key={source.name} className="flex items-center gap-2">
            <span className="text-xs text-text-tertiary w-4 text-right font-mono">{i + 1}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-0.5">
                <Link
                  href={`/articles?source=${encodeURIComponent(source.name)}`}
                  className="text-xs text-text-primary hover:text-accent-primary transition-colors truncate"
                >
                  {source.name}
                </Link>
                <span className="text-xs text-text-tertiary font-mono ml-2 shrink-0">{source.count}</span>
              </div>
              <div className="h-0.5 bg-bg-elevated rounded overflow-hidden">
                <div
                  className="h-full bg-accent-primary/60 rounded transition-all"
                  style={{ width: `${(source.count / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
