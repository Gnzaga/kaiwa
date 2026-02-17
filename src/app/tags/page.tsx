'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface TagCount {
  tag: string;
  count: number;
}

export default function TagsPage() {
  const router = useRouter();

  const { data: tags, isLoading } = useQuery<TagCount[]>({
    queryKey: ['tags'],
    queryFn: () => fetch('/api/tags').then((r) => r.json()),
  });

  const maxCount = tags ? Math.max(...tags.map((t) => Number(t.count)), 1) : 1;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Browse by Tag</h1>
        <p className="text-xs text-text-tertiary mt-1">
          {tags ? `${tags.length} tags from AI summaries` : 'Loading...'}
        </p>
      </header>

      {isLoading && (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-8 bg-bg-secondary border border-border rounded-full animate-pulse" style={{ width: `${60 + Math.random() * 80}px` }} />
          ))}
        </div>
      )}

      {tags && (
        <div className="flex flex-wrap gap-2">
          {tags.map(({ tag, count }) => {
            const weight = Number(count) / maxCount;
            const size = weight > 0.7 ? 'text-base' : weight > 0.4 ? 'text-sm' : 'text-xs';
            const opacity = weight > 0.5 ? 'opacity-100' : weight > 0.25 ? 'opacity-80' : 'opacity-60';
            return (
              <button
                key={tag}
                onClick={() => router.push(`/search?q=${encodeURIComponent(tag)}`)}
                className={`${size} ${opacity} px-3 py-1.5 bg-bg-secondary border border-border rounded-full text-text-secondary hover:text-text-primary hover:border-accent-primary hover:bg-bg-elevated transition-colors`}
              >
                {tag}
                <span className="ml-1.5 text-text-tertiary font-mono text-xs">{count}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
