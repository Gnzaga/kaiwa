'use client';

import type { ResearchEvent } from '@/hooks/useResearchStream';

const EVENT_ICONS: Record<string, string> = {
  searching: '\u{1F50D}',
  found: '\u{1F4E6}',
  reading: '\u{1F4D6}',
  analyzing: '\u{1F9E0}',
  expanding: '\u{1F500}',
  web_searching: '\u{1F310}',
  web_found: '\u{1F517}',
  web_reading: '\u{1F4F0}',
  web_read: '\u{2705}',
  error: '\u{26A0}',
};

function EventLabel({ event }: { event: ResearchEvent }) {
  switch (event.type) {
    case 'searching':
      return (
        <span>
          Searching <span className="font-mono text-accent-primary">&quot;{event.query as string}&quot;</span>
          <span className="text-text-tertiary ml-1">({event.mode as string})</span>
        </span>
      );
    case 'found':
      return (
        <span>
          Found <span className="font-medium text-text-primary">{event.new_articles as number}</span> new articles
          <span className="text-text-tertiary ml-1">({event.total as number} total)</span>
        </span>
      );
    case 'reading':
      return (
        <span>
          Reading summaries for <span className="font-medium text-text-primary">{event.count as number}</span> articles
        </span>
      );
    case 'analyzing':
      return (
        <span>
          Analyzing findings
          <span className="text-text-tertiary ml-1">(iteration {event.iteration as number})</span>
        </span>
      );
    case 'expanding':
      return (
        <span className="space-y-1">
          <span className="block">{event.reasoning as string}</span>
          {Array.isArray(event.new_queries) && event.new_queries.length > 0 && (
            <span className="flex flex-wrap gap-1 mt-1">
              {(event.new_queries as string[]).map((q, i) => (
                <span key={i} className="text-[11px] font-mono bg-bg-secondary px-1.5 py-0.5 rounded border border-border">
                  {q}
                </span>
              ))}
            </span>
          )}
        </span>
      );
    case 'web_searching':
      return (
        <span>
          Web searching <span className="font-mono text-accent-primary">&quot;{event.query as string}&quot;</span>
        </span>
      );
    case 'web_found':
      return (
        <span>
          Found <span className="font-medium text-text-primary">{event.new_results as number}</span> web results
          <span className="text-text-tertiary ml-1">({event.total as number} total)</span>
        </span>
      );
    case 'web_reading':
      return (
        <span>
          Reading <span className="font-medium text-text-primary">{event.count as number}</span> web pages
        </span>
      );
    case 'web_read':
      return (
        <span>
          Read <span className="font-medium text-text-primary">{event.count as number}</span> of {event.total as number} pages
        </span>
      );
    case 'error':
      return <span className="text-accent-highlight">{event.message as string}</span>;
    default:
      return <span>{JSON.stringify(event)}</span>;
  }
}

export default function ResearchProgress({
  events,
  isActive,
}: {
  events: ResearchEvent[];
  isActive: boolean;
}) {
  if (events.length === 0 && !isActive) return null;

  return (
    <div className="relative pl-6">
      {/* Vertical timeline line */}
      <div className="absolute left-2 top-1 bottom-1 w-px bg-border" />

      <div className="space-y-3">
        {events.map((event, idx) => (
          <div key={idx} className="relative flex items-start gap-3">
            {/* Timeline dot */}
            <div className="absolute -left-4 mt-0.5 w-4 h-4 flex items-center justify-center text-xs z-10">
              <span className="relative z-10">
                {EVENT_ICONS[event.type] || '\u{2022}'}
              </span>
            </div>
            <div className="text-sm text-text-secondary leading-relaxed">
              <EventLabel event={event} />
            </div>
          </div>
        ))}

        {isActive && (
          <div className="relative flex items-start gap-3">
            <div className="absolute -left-4 mt-0.5 w-4 h-4 flex items-center justify-center z-10">
              <span className="w-2 h-2 bg-accent-primary rounded-full animate-pulse" />
            </div>
            <div className="text-sm text-text-tertiary">Working...</div>
          </div>
        )}
      </div>
    </div>
  );
}
