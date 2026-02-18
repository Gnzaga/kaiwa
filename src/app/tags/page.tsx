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
  const [sortAlpha, setSortAlpha] = useState(false);
  const [letterFilter, setLetterFilter] = useState<string | null>(null);

  const { data: tags, isLoading } = useQuery<TagCount[]>({
    queryKey: ['tags'],
    queryFn: () => fetch('/api/tags').then((r) => r.json()),
  });

  const filtered = (tags ?? [])
    .filter((t) => !search.trim() || t.tag.toLowerCase().includes(search.toLowerCase()))
    .filter((t) => !letterFilter || t.tag.toLowerCase().startsWith(letterFilter.toLowerCase()))
    .slice()
    .sort((a, b) => sortAlpha ? a.tag.localeCompare(b.tag) : 0);
  const maxCount = tags ? Math.max(...tags.map((t) => Number(t.count)), 1) : 1;
  // Letters that actually have tags
  const availableLetters = tags
    ? [...new Set(tags.map(t => t.tag[0]?.toUpperCase()).filter(Boolean))].sort()
    : [];

  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold text-text-primary">Browse by Tag</h1>
        <p className="text-xs text-text-tertiary mt-1">
          {tags ? `${tags.length} tags · ${tags.reduce((s, t) => s + Number(t.count), 0).toLocaleString()} tag assignments` : 'Loading...'}
        </p>
      </header>

      <div className="mb-5 space-y-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="text"
            placeholder="Filter tags..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setLetterFilter(null); }}
            className="bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary w-56"
          />
          <button
            onClick={() => setSortAlpha(v => !v)}
            className={`px-3 py-1.5 text-xs border rounded transition-colors ${sortAlpha ? 'border-accent-primary text-accent-primary' : 'border-border text-text-tertiary hover:text-text-primary'}`}
          >
            {sortAlpha ? 'A–Z' : 'By count'}
          </button>
          {(search || letterFilter) && filtered.length === 0 && (
            <span className="text-xs text-text-tertiary">No tags match</span>
          )}
          {(search || letterFilter) && filtered.length > 0 && (
            <span className="text-xs text-text-tertiary">{filtered.length} tags</span>
          )}
        </div>
        {availableLetters.length > 5 && (
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setLetterFilter(null)}
              className={`w-7 h-7 text-xs rounded border font-mono transition-colors ${!letterFilter ? 'border-accent-primary text-accent-primary' : 'border-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary'}`}
            >All</button>
            {availableLetters.map(l => (
              <button
                key={l}
                onClick={() => setLetterFilter(letterFilter === l ? null : l)}
                className={`w-7 h-7 text-xs rounded border font-mono transition-colors ${letterFilter === l ? 'border-accent-primary text-accent-primary bg-accent-primary/10' : 'border-border text-text-tertiary hover:border-accent-primary hover:text-accent-primary'}`}
              >{l}</button>
            ))}
          </div>
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
