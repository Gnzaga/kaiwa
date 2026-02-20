'use client';

import type { ResearchEvent } from '@/hooks/useResearchStream';

const EVENT_PREFIX: Record<string, string> = {
  searching: 'SEARCH',
  found: 'FOUND',
  reading: 'READ',
  analyzing: 'ANALYZE',
  expanding: 'EXPAND',
  web_searching: 'WEB:SEARCH',
  web_found: 'WEB:FOUND',
  web_reading: 'WEB:READ',
  web_read: 'WEB:DONE',
  error: 'ERROR',
};

const EVENT_COLOR: Record<string, string> = {
  searching: 'text-accent-primary',
  found: 'text-text-secondary',
  reading: 'text-accent-primary',
  analyzing: 'text-yellow-400',
  expanding: 'text-text-tertiary',
  web_searching: 'text-accent-primary',
  web_found: 'text-text-secondary',
  web_reading: 'text-accent-primary',
  web_read: 'text-text-secondary',
  error: 'text-red-400',
};

function EventDetail({ event }: { event: ResearchEvent }) {
  switch (event.type) {
    case 'searching':
      return (
        <>
          <span className="text-text-primary">{event.query as string}</span>
          <span className="text-text-tertiary ml-2">{event.mode as string}</span>
        </>
      );
    case 'found':
      return (
        <>
          <span className="text-text-primary">+{event.new_articles as number}</span>
          <span className="text-text-tertiary ml-2">{event.total as number} total</span>
        </>
      );
    case 'reading':
      return <span className="text-text-primary">{event.count as number} articles</span>;
    case 'analyzing':
      return <span className="text-text-tertiary">iteration {event.iteration as number}</span>;
    case 'expanding':
      return (
        <span className="space-y-1">
          <span className="block text-text-secondary">{event.reasoning as string}</span>
          {Array.isArray(event.new_queries) && event.new_queries.length > 0 && (
            <span className="flex flex-wrap gap-1.5 mt-1">
              {(event.new_queries as string[]).map((q, i) => (
                <span key={i} className="text-[11px] font-mono text-text-tertiary bg-bg-secondary px-1.5 py-0.5 rounded border border-border">
                  {q}
                </span>
              ))}
            </span>
          )}
        </span>
      );
    case 'web_searching':
      return <span className="text-text-primary">{event.query as string}</span>;
    case 'web_found':
      return (
        <>
          <span className="text-text-primary">+{event.new_results as number}</span>
          <span className="text-text-tertiary ml-2">{event.total as number} total</span>
        </>
      );
    case 'web_reading':
      return <span className="text-text-primary">{event.count as number} pages</span>;
    case 'web_read':
      return (
        <span className="text-text-tertiary">{event.count as number}/{event.total as number} succeeded</span>
      );
    case 'error':
      return <span className="text-red-400">{event.message as string}</span>;
    default:
      return <span className="text-text-tertiary">{JSON.stringify(event)}</span>;
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
    <div className="font-mono text-xs space-y-0.5">
      {events.map((event, idx) => (
        <div key={idx} className="flex items-start gap-0">
          <span className={`shrink-0 w-[100px] text-right pr-2 ${EVENT_COLOR[event.type] || 'text-text-tertiary'}`}>
            {EVENT_PREFIX[event.type] || event.type}
          </span>
          <span className="text-text-tertiary shrink-0 mr-2">|</span>
          <span className="text-text-secondary leading-relaxed">
            <EventDetail event={event} />
          </span>
        </div>
      ))}

      {isActive && (
        <div className="flex items-start gap-0">
          <span className="shrink-0 w-[100px] text-right pr-2 text-text-tertiary animate-pulse">...</span>
          <span className="text-text-tertiary shrink-0 mr-2">|</span>
          <span className="text-text-tertiary">working</span>
        </div>
      )}
    </div>
  );
}
