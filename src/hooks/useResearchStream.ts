'use client';

import { useCallback, useRef, useState } from 'react';

export interface ResearchEvent {
  type: string;
  [key: string]: unknown;
}

export interface WebSource {
  url: string;
  title: string;
  relevance_reason: string;
}

export interface ResearchReport {
  summary: string;
  key_findings: string[];
  regional_perspectives: Record<string, string>;
  tags: string[];
  sentiment: string;
  top_articles: { article_id: number; relevance_reason: string }[];
  web_sources?: WebSource[];
}

export interface ResearchArticle {
  id: number;
  original_title: string;
  translated_title?: string | null;
  published_at: string;
  summary_tldr?: string | null;
  summary_tags?: string[] | null;
  summary_sentiment?: string | null;
  original_url: string;
  image_url?: string | null;
  feed_source_name?: string;
  feed_region_id?: string;
  relevance_reason?: string;
}

export interface ResearchResult {
  report: ResearchReport;
  articles: ResearchArticle[];
}

type Status = 'idle' | 'connecting' | 'streaming' | 'complete' | 'error';

export function useResearchStream() {
  const [status, setStatus] = useState<Status>('idle');
  const [events, setEvents] = useState<ResearchEvent[]>([]);
  const [result, setResult] = useState<ResearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const start = useCallback(async (query: string, filters?: { region?: string; date_from?: string; date_to?: string }) => {
    // Reset
    setEvents([]);
    setResult(null);
    setError(null);
    setStatus('connecting');

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, filters: filters || null }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }

      const { id } = await res.json();
      setTaskId(id);
      setStatus('streaming');

      // Connect SSE
      const es = new EventSource(`/api/research/${id}/stream`);
      eventSourceRef.current = es;

      es.addEventListener('status', (e) => {
        try {
          const data = JSON.parse(e.data);
          setEvents((prev) => [...prev, data]);
        } catch { /* ignore parse errors */ }
      });

      es.addEventListener('result', (e) => {
        try {
          const data = JSON.parse(e.data);
          setResult(data);
        } catch { /* ignore */ }
      });

      es.addEventListener('done', () => {
        setStatus('complete');
        es.close();
        eventSourceRef.current = null;
      });

      es.onerror = () => {
        // EventSource will auto-reconnect on some errors, but if
        // the stream is already done this is expected
        if (es.readyState === EventSource.CLOSED) {
          setStatus((prev) => prev === 'streaming' ? 'error' : prev);
          es.close();
          eventSourceRef.current = null;
        }
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setStatus('error');
    }
  }, []);

  const cancel = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStatus('idle');
  }, []);

  const reset = useCallback(() => {
    cancel();
    setEvents([]);
    setResult(null);
    setError(null);
    setTaskId(null);
    setStatus('idle');
  }, [cancel]);

  return { status, events, result, error, taskId, start, cancel, reset };
}
