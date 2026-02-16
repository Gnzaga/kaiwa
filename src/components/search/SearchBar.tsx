'use client';

import { useState, useEffect, useRef } from 'react';

export interface SearchFilters {
  query: string;
  category: '' | 'law' | 'economics';
  dateRange: '' | '24h' | '7d' | '30d';
}

export default function SearchBar({
  onSearch,
}: {
  onSearch: (filters: SearchFilters) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<SearchFilters['category']>('');
  const [dateRange, setDateRange] = useState<SearchFilters['dateRange']>('');
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch({ query, category, dateRange });
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, category, dateRange, onSearch]);

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
          placeholder="\u691C\u7D22 Search articles..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full bg-bg-elevated border border-border rounded pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary transition-colors"
        />
      </div>

      {/* Category filter */}
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as SearchFilters['category'])}
        className="bg-bg-elevated border border-border rounded px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-primary"
      >
        <option value="">All Categories</option>
        <option value="law">{'\u6CD5\u5F8B'} Law</option>
        <option value="economics">{'\u7D4C\u6E08'} Economics</option>
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
    </div>
  );
}
