'use client';

import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';

interface Region {
  id: string;
  name: string;
  flagEmoji: string;
}

export type SearchMode = 'keyword' | 'hybrid' | 'semantic';

export interface SearchFilters {
  query: string;
  region: string;
  dateRange: '' | '24h' | '7d' | '30d';
  sentiment: string;
  mode: SearchMode;
}

export default function SearchBar({
  onSearch,
}: {
  onSearch: (filters: SearchFilters) => void;
}) {
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState<string>('');
  const [dateRange, setDateRange] = useState<SearchFilters['dateRange']>('');
  const [sentiment, setSentiment] = useState('');
  const [mode, setMode] = useState<SearchMode>('keyword');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then((r) => r.json()),
  });

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch({ query, region, dateRange, sentiment, mode });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, region, dateRange, sentiment, mode, onSearch]);

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
      {/* Search input */}
      <div className="relative flex-1">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <input
          type="text"
          placeholder="Search articles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-bg-elevated border border-border rounded pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
        />
      </div>

      {/* Region filter */}
      <select
        value={region}
        onChange={(e) => setRegion(e.target.value)}
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
      >
        <option value="">All Regions</option>
        {Array.isArray(regions) && regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.flagEmoji} {r.name}
          </option>
        ))}
      </select>

      {/* Date range */}
      <select
        value={dateRange}
        onChange={(e) => setDateRange(e.target.value as SearchFilters['dateRange'])}
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
      >
        <option value="">All Time</option>
        <option value="24h">Last 24 Hours</option>
        <option value="7d">Last 7 Days</option>
        <option value="30d">Last 30 Days</option>
      </select>

      {/* Sentiment filter */}
      <select
        value={sentiment}
        onChange={(e) => setSentiment(e.target.value)}
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
      >
        <option value="">All Sentiment</option>
        <option value="positive">Positive</option>
        <option value="negative">Negative</option>
        <option value="neutral">Neutral</option>
        <option value="mixed">Mixed</option>
        <option value="bullish">Bullish</option>
        <option value="bearish">Bearish</option>
        <option value="restrictive">Restrictive</option>
        <option value="permissive">Permissive</option>
      </select>

      {/* Search mode toggle */}
      <div className="flex rounded border border-border overflow-hidden text-sm">
        {(['keyword', 'hybrid', 'semantic'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-3 py-2 capitalize transition-colors ${
              mode === m
                ? 'bg-accent-primary text-white'
                : 'bg-bg-elevated text-text-secondary hover:text-text-primary'
            }`}
          >
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}
