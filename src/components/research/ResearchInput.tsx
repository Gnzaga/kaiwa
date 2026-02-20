'use client';

import { useState } from 'react';

const EXAMPLE_QUERIES = [
  "What's going on with Iran right now?",
  'Japan economic policy changes',
  'Taiwan semiconductor industry',
  'US trade sanctions latest',
  'Philippines political developments',
];

interface ResearchFilters {
  region?: string;
  date_from?: string;
  date_to?: string;
}

export default function ResearchInput({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (query: string, filters?: ResearchFilters) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [region, setRegion] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || disabled) return;
    const filters: ResearchFilters = {};
    if (region) filters.region = region;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    onSubmit(query.trim(), Object.keys(filters).length > 0 ? filters : undefined);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask a question about current events..."
              disabled={disabled}
              className="w-full px-4 py-3 bg-bg-elevated border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent-primary disabled:opacity-50 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-3 border rounded-lg text-sm transition-colors ${
              showFilters
                ? 'border-accent-primary text-accent-primary bg-accent-primary/10'
                : 'border-border text-text-tertiary hover:text-text-secondary hover:border-border'
            }`}
            title="Toggle filters"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75" />
            </svg>
          </button>
          <button
            type="submit"
            disabled={!query.trim() || disabled}
            className="px-5 py-3 bg-accent-primary text-white rounded-lg text-sm font-medium hover:bg-accent-primary/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Research
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 p-3 bg-bg-secondary border border-border rounded-lg">
            <div>
              <label className="block text-xs text-text-tertiary mb-1">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="text-xs bg-bg-elevated border border-border rounded px-2 py-1.5 text-text-secondary focus:outline-none focus:border-accent-primary"
              >
                <option value="">All regions</option>
                <option value="jp">Japan</option>
                <option value="us">United States</option>
                <option value="ph">Philippines</option>
                <option value="tw">Taiwan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-xs bg-bg-elevated border border-border rounded px-2 py-1.5 text-text-secondary focus:outline-none focus:border-accent-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-text-tertiary mb-1">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-xs bg-bg-elevated border border-border rounded px-2 py-1.5 text-text-secondary focus:outline-none focus:border-accent-primary"
              />
            </div>
          </div>
        )}
      </form>

      {!disabled && !query && (
        <div className="space-y-2">
          <p className="text-xs text-text-tertiary">Try an example</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                onClick={() => setQuery(q)}
                className="px-3 py-1.5 text-xs border border-border rounded-full text-text-secondary hover:border-accent-primary hover:text-accent-primary transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
