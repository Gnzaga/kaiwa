'use client';

export default function ArticleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <div className="text-center py-12 space-y-4">
        <p className="text-sm text-accent-highlight">Failed to load article</p>
        <p className="text-xs text-text-tertiary">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
