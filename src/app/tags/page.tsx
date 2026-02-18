'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

interface TagCount {
  tag: string;
  count: number;
}

export default function TagsPage() {
  const router = useRouter();
  const [search, setSearch] = useState('');

  const { data: tags, isLoading } = useQuery<TagCount[]>({
    queryKey: ['tags'],
    queryFn: () => fetch('/api/tags').then((r) => r.json()),
  });

  const filtered = search.trim()
    ? (tags ?? []).filter((t) => t.tag.toLowerCase().includes(search.toLowerCase()))
    : (tags ?? []);
  const maxCount = tags ? Math.max(...tags.map((t) => Number(t.count)), 1) : 1;

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-text-primary">Browse by Tag</h1>
        <p className="text-xs text-text-tertiary mt-1">
          {tags ? `${tags.length} tags · ${tags.reduce((s, t) => s + Number(t.count), 0).toLocaleString()} tag assignments` : 'Loading...'}
        </p>
      </header>

      <div className="mb-5">
        <input
          type="text"
          placeholder="Filter tags..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary w-56"
        />
        {search && filtered.length === 0 && (
          <span className="ml-3 text-xs text-text-tertiary">No tags match</span>
        )}
        {search && filtered.length > 0 && (
          <span className="ml-3 text-xs text-text-tertiary">{filtered.length} tags</span>
        )}
      </div>

      {isLoading && (
        <div className="flex flex-wrap gap-3">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-8 bg-bg-secondary border border-border rounded-full animate-pulse" style={{ width: `${60 + Math.random() * 80}px` }} />
          ))}
        </div>
      )}

      {tags && (
        <div className="flex flex-wrap gap-2">
          {filtered.map(({ tag, count }) => {
            const weight = Number(count) / maxCount;
            const size = weight > 0.7 ? 'text-base' : weight > 0.4 ? 'text-sm' : 'text-xs';
            const opacity = weight > 0.5 ? 'opacity-100' : weight > 0.25 ? 'opacity-80' : 'opacity-60';
            return (
              <button
                key={tag}
                onClick={() => router.push(`/articles?tag=${encodeURIComponent(tag)}`)}
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
