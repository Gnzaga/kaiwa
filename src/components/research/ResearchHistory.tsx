'use client';

import { useQuery } from '@tanstack/react-query';

interface ResearchTaskSummary {
  id: string;
  query: string;
  status: string;
  error?: string;
  created_at: string;
  completed_at?: string;
}

function relativeTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_STYLES: Record<string, string> = {
  running: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/30',
  complete: 'bg-green-400/10 text-green-400 border-green-400/30',
  error: 'bg-red-400/10 text-red-400 border-red-400/30',
};

export default function ResearchHistory({
  onSelect,
}: {
  onSelect: (taskId: string) => void;
}) {
  const { data, isLoading } = useQuery<{ data: ResearchTaskSummary[] }>({
    queryKey: ['research-history'],
    queryFn: () => fetch('/api/research?limit=10').then((r) => r.json()),
    staleTime: 30000,
  });

  const tasks = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-bg-secondary border border-border rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-text-tertiary">Recent Research</h3>
      <div className="space-y-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            onClick={() => onSelect(task.id)}
            className="w-full text-left p-3 bg-bg-secondary border border-border rounded-lg hover:border-accent-primary/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-sm text-text-primary line-clamp-1 flex-1">
                {task.query}
              </div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full border shrink-0 ${STATUS_STYLES[task.status] || STATUS_STYLES.complete}`}>
                {task.status}
              </span>
            </div>
            <div className="text-xs text-text-tertiary mt-1">
              {relativeTime(task.created_at)}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
