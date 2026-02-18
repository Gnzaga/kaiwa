'use client';

import ArticleList from '@/components/articles/ArticleList';

export default function ArchivedPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Archived</h1>
        <p className="text-xs text-text-tertiary mt-1">Articles you&apos;ve archived</p>
      </header>
      <ArticleList isArchived emptyMessage={
        <><div className="text-3xl mb-2">■</div><p className="font-medium text-text-secondary">Nothing archived yet</p><p className="text-xs mt-1">Archive articles to declutter your feed</p></>
      } />
    </div>
  );
}
