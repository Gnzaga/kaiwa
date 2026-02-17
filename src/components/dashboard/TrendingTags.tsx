'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface TagStat {
  tag: string;
  count: number;
}

export default function TrendingTags() {
  const { data, isLoading } = useQuery<TagStat[]>({
    queryKey: ['trending-tags'],
    queryFn: () => fetch('/api/tags/trending').then(r => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-2">
        <div className="h-4 w-32 bg-bg-elevated rounded animate-pulse" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-6 bg-bg-elevated rounded-full animate-pulse" style={{ width: `${50 + i * 15}px` }} />
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const max = data[0].count;

  return (
    <div>
      <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Trending Today</h2>
      <div className="flex flex-wrap gap-1.5">
        {data.map((item) => {
          const intensity = Math.ceil((item.count / max) * 4);
          const sizeClass = intensity >= 4 ? 'text-sm font-semibold' : intensity >= 3 ? 'text-sm' : intensity >= 2 ? 'text-xs' : 'text-xs';
          const opacityClass = intensity >= 3 ? 'opacity-100' : intensity >= 2 ? 'opacity-80' : 'opacity-60';
          return (
            <Link
              key={item.tag}
              href={`/search?q=${encodeURIComponent(item.tag)}`}
              className={`px-2.5 py-1 bg-bg-secondary border border-border rounded-full text-text-primary hover:border-accent-primary hover:text-accent-primary transition-colors ${sizeClass} ${opacityClass}`}
              title={`${item.count} article${item.count !== 1 ? 's' : ''}`}
            >
              {item.tag}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
