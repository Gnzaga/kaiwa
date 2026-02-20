'use client';

import type { ResearchReport as ReportType } from '@/hooks/useResearchStream';

const SENTIMENT_COLORS: Record<string, string> = {
  positive: 'text-green-400 bg-green-400/10 border-green-400/30',
  negative: 'text-red-400 bg-red-400/10 border-red-400/30',
  neutral: 'text-text-secondary bg-bg-secondary border-border',
  mixed: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
};

export default function ResearchReport({ report }: { report: ReportType }) {
  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-text-primary">Summary</h2>
        <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
          {report.summary}
        </div>
      </div>

      {/* Key Findings */}
      {report.key_findings.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Key Findings</h2>
          <ul className="space-y-2">
            {report.key_findings.map((finding, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary">
                <span className="text-accent-primary mt-0.5 shrink-0">&bull;</span>
                <span>{finding}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Regional Perspectives */}
      {Object.keys(report.regional_perspectives).length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-text-primary">Regional Perspectives</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(report.regional_perspectives).map(([region, perspective]) => (
              <div key={region} className="p-3 bg-bg-secondary border border-border rounded-lg">
                <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">
                  {REGION_LABELS[region] || region}
                </div>
                <div className="text-sm text-text-secondary">{perspective}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags + Sentiment */}
      <div className="flex flex-wrap items-center gap-2">
        {report.sentiment && (
          <span className={`text-xs px-2 py-0.5 rounded-full border ${SENTIMENT_COLORS[report.sentiment] || SENTIMENT_COLORS.neutral}`}>
            {report.sentiment}
          </span>
        )}
        {report.tags.map((tag) => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-bg-secondary border border-border text-text-tertiary">
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

const REGION_LABELS: Record<string, string> = {
  jp: 'Japan',
  us: 'United States',
  ph: 'Philippines',
  tw: 'Taiwan',
  cn: 'China',
  kr: 'South Korea',
  eu: 'Europe',
};
