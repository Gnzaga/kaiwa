'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import ArticleList from '@/components/articles/ArticleList';

function ArticlesContent() {
  const params = useSearchParams();
  const source = params.get('source') ?? undefined;
  const tag = params.get('tag') ?? undefined;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">All Articles</h1>
        {(source || tag) && (
          <p className="text-xs text-text-tertiary mt-1">
            {source && <>Filtered by source: <span className="text-accent-primary">{source}</span></>}
            {tag && <>{source ? ' · ' : ''}Tag: <span className="text-accent-primary">{tag}</span></>}
          </p>
        )}
      </header>
      <ArticleList initialSource={source} initialTag={tag} />
    </div>
  );
}

export default function AllArticlesPage() {
  return (
    <Suspense fallback={<div className="p-6 md:p-8 max-w-4xl mx-auto"><div className="h-10 bg-bg-secondary border border-border rounded animate-pulse" /></div>}>
      <ArticlesContent />
    </Suspense>
  );
}
