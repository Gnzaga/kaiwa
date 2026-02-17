'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface Region {
  id: string;
  name: string;
  flagEmoji: string;
}

export default function RegionsGlance() {
  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then(r => r.json()),
    staleTime: 10 * 60 * 1000,
  });

  const { data: unreadCounts } = useQuery<Record<string, number>>({
    queryKey: ['unread-counts'],
    queryFn: () => fetch('/api/regions/unread-counts').then(r => r.json()),
    refetchInterval: 60000,
  });

  if (!regions || regions.length === 0) return null;

  return (
    <div>
      <h2 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">Regions</h2>
      <div className="flex flex-wrap gap-2">
        {regions.map(region => {
          const count = unreadCounts?.[region.id] ?? 0;
          return (
            <Link
              key={region.id}
              href={`/region/${region.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary border border-border rounded-full text-sm hover:border-accent-primary hover:text-accent-primary transition-colors group"
            >
              <span>{region.flagEmoji}</span>
              <span className="text-text-primary group-hover:text-accent-primary transition-colors">{region.name}</span>
              {count > 0 && (
                <span className="text-[10px] font-mono bg-accent-primary/20 text-accent-primary rounded-full px-1.5 py-0.5 leading-none">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
