'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useResearchStream } from '@/hooks/useResearchStream';
import type { ResearchResult } from '@/hooks/useResearchStream';
import ResearchInput from '@/components/research/ResearchInput';
import ResearchProgress from '@/components/research/ResearchProgress';
import ResearchReport from '@/components/research/ResearchReport';
import ResearchArticleList from '@/components/research/ResearchArticleList';
import ResearchHistory from '@/components/research/ResearchHistory';

function ResearchPageContent() {
  const searchParams = useSearchParams();
  const { status, events, result, error, taskId, thinking, startTime, start, reset } = useResearchStream();
  const [viewingResult, setViewingResult] = useState<ResearchResult | null>(null);
  const [viewingQuery, setViewingQuery] = useState<string | null>(null);

  // Load a completed task from history
  const handleSelectHistory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/research/${id}`);
      if (!res.ok) return;
      const task = await res.json();
      if (task.status === 'complete' && task.report) {
        setViewingResult({ report: task.report, articles: task.articles || [] });
        setViewingQuery(task.query);
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-start if URL has ?q= param
  useEffect(() => {
    const q = searchParams.get('q');
    if (q && status === 'idle') {
      start(q);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(
    (query: string, filters?: { region?: string; date_from?: string; date_to?: string }) => {
      setViewingResult(null);
      setViewingQuery(null);
      start(query, filters);
    },
    [start],
  );

  const handleNewResearch = useCallback(() => {
    setViewingResult(null);
    setViewingQuery(null);
    reset();
  }, [reset]);

  const isActive = status === 'connecting' || status === 'streaming';
  const displayResult = result || viewingResult;
  const isIdle = status === 'idle' && !viewingResult;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Research</h1>
          <p className="text-sm text-text-tertiary mt-1">
            Ask questions and get AI-synthesized reports from your article database
          </p>
        </div>
        {(status !== 'idle' || viewingResult) && (
          <button
            onClick={handleNewResearch}
            className="px-3 py-1.5 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
          >
            New Research
          </button>
        )}
      </header>

      {/* Input */}
      <ResearchInput onSubmit={handleSubmit} disabled={isActive} />

      {/* Error */}
      {status === 'error' && error && (
        <div className="p-4 bg-red-400/10 border border-red-400/30 rounded-lg text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Progress */}
      {(isActive || (status === 'complete' && events.length > 0)) && (
        <div className="p-4 bg-bg-secondary border border-border rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-text-primary">
              {isActive ? 'Researching...' : 'Research Complete'}
            </h3>
            {taskId && (
              <span className="text-[10px] font-mono text-text-tertiary">{taskId}</span>
            )}
          </div>
          <ResearchProgress events={events} isActive={isActive} thinking={thinking} startTime={startTime} />
        </div>
      )}

      {/* Report */}
      {displayResult && (
        <div className="space-y-6">
          {viewingQuery && (
            <div className="text-sm text-text-tertiary">
              Results for: <span className="text-text-primary font-medium">&quot;{viewingQuery}&quot;</span>
            </div>
          )}
          <div className="p-6 bg-bg-secondary border border-border rounded-lg">
            <ResearchReport report={displayResult.report} />
          </div>
          <ResearchArticleList articles={displayResult.articles} />
        </div>
      )}

      {/* History (only show when idle and no result displayed) */}
      {isIdle && (
        <ResearchHistory onSelect={handleSelectHistory} />
      )}
    </div>
  );
}

export default function ResearchPage() {
  return (
    <Suspense fallback={<div className="p-6 md:p-8 max-w-4xl mx-auto"><div className="h-10 bg-bg-secondary border border-border rounded animate-pulse" /></div>}>
      <ResearchPageContent />
    </Suspense>
  );
}
