'use client';

import { useEffect, useRef } from 'react';
import type { ResearchEvent } from '@/hooks/useResearchStream';
import type { ThinkingState } from '@/hooks/useResearchStream';

const EVENT_PREFIX: Record<string, string> = {
  planning: 'PLAN',
  searching: 'SEARCH',
  found: 'FOUND',
  reading: 'READ',
  analyzing: 'ANALYZE',
  expanding: 'EXPAND',
  compiling: 'COMPILE',
  web_searching: 'WEB:SEARCH',
  web_found: 'WEB:FOUND',
  web_reading: 'WEB:READ',
  web_read: 'WEB:DONE',
  error: 'ERROR',
};

const EVENT_COLOR: Record<string, string> = {
  planning: 'text-yellow-400',
  searching: 'text-accent-primary',
  found: 'text-text-secondary',
  reading: 'text-accent-primary',
  analyzing: 'text-yellow-400',
  expanding: 'text-text-tertiary',
  compiling: 'text-yellow-400',
  web_searching: 'text-accent-primary',
  web_found: 'text-text-secondary',
  web_reading: 'text-accent-primary',
  web_read: 'text-text-secondary',
  error: 'text-red-400',
};

// Node types that show thinking text
const THINKING_NODES = new Set(['planning', 'analyzing', 'compiling']);

function formatElapsed(startTime: number, ts: number): string {
  if (!startTime || !ts) return '';
  const secs = Math.floor((ts - startTime) / 1000);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `+${m}:${s.toString().padStart(2, '0')}`;
}

function EventDetail({ event }: { event: ResearchEvent }) {
  switch (event.type) {
    case 'planning':
      return <span className="text-text-tertiary">iteration {event.iteration as number}</span>;
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
    case 'compiling':
      return <span className="text-text-tertiary">generating report</span>;
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

function ThinkingBox({ thinking }: { thinking: ThinkingState }) {
  const scrollRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [thinking.text]);

  return (
    <div className="ml-[100px] pl-6 my-1">
      <pre
        ref={scrollRef}
        className="text-text-tertiary text-[11px] leading-relaxed bg-bg-primary/50 border border-border/50 rounded px-3 py-2 max-h-48 overflow-y-auto whitespace-pre-wrap break-words"
      >
        {thinking.text}
        <span className="animate-pulse">&#x258C;</span>
      </pre>
    </div>
  );
}

// Contextual label for the "working" indicator based on last event
const WORKING_LABEL: Record<string, string> = {
  searching: 'executing search...',
  found: 'processing results...',
  reading: 'reading articles...',
  web_searching: 'searching the web...',
  web_found: 'processing web results...',
  web_reading: 'reading web pages...',
  web_read: 'processing pages...',
  expanding: 'preparing next iteration...',
};

export default function ResearchProgress({
  events,
  isActive,
  thinking,
  startTime,
}: {
  events: ResearchEvent[];
  isActive: boolean;
  thinking?: ThinkingState | null;
  startTime?: number;
}) {
  if (events.length === 0 && !isActive) return null;

  const lastEvent = events[events.length - 1];
  // Show thinking box only when the last event is a thinking-capable type
  // This avoids React batching issues where status+progress events arrive together
  const showThinking = isActive && !!thinking && !!lastEvent && THINKING_NODES.has(lastEvent.type);
  const showWorking = isActive && !showThinking;

  return (
    <div className="font-mono text-xs space-y-0.5">
      {events.map((event, idx) => (
        <div key={idx}>
          <div className="flex items-start gap-0">
            <span className={`shrink-0 w-[100px] text-right pr-2 ${EVENT_COLOR[event.type] || 'text-text-tertiary'}`}>
              {EVENT_PREFIX[event.type] || event.type}
            </span>
            <span className="text-text-tertiary shrink-0 mr-2">|</span>
            <span className="text-text-secondary leading-relaxed flex-1">
              <EventDetail event={event} />
            </span>
            {startTime && (event._ts as number) ? (
              <span className="shrink-0 text-text-tertiary ml-2">
                {formatElapsed(startTime, event._ts as number)}
              </span>
            ) : null}
          </div>
          {/* Show thinking box after the last event when it's a thinking-capable type */}
          {idx === events.length - 1 && showThinking && thinking && (
            <ThinkingBox thinking={thinking} />
          )}
        </div>
      ))}

      {showWorking && (
        <div className="flex items-start gap-0">
          <span className="shrink-0 w-[100px] text-right pr-2 text-text-tertiary animate-pulse">...</span>
          <span className="text-text-tertiary shrink-0 mr-2">|</span>
          <span className="text-text-tertiary">
            {(lastEvent && WORKING_LABEL[lastEvent.type]) || 'working'}
          </span>
        </div>
      )}
    </div>
  );
}
