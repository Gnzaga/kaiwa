'use client';

import ArticleList from '@/components/articles/ArticleList';

export default function StarredPage() {
  return (
    <div className="p-6 md:p-8 max-w-4xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-text-primary">Starred</h1>
        <p className="text-xs text-text-tertiary mt-1">Articles you&apos;ve starred</p>
      </header>
      <ArticleList isStarred hideFilters={false} emptyMessage={
        <><div className="text-3xl mb-2">★</div><p className="font-medium text-text-secondary">No starred articles yet</p><p className="text-xs mt-1">Star articles to save them here</p></>
      } />
    </div>
  );
}
