'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import ArticleDetail from '@/components/articles/ArticleDetail';
import ReadingProgress from '@/components/ui/ReadingProgress';
import ArticleNav from '@/components/articles/ArticleNav';

export default function ArticlePage() {
  const params = useParams();
  const id = Number(params.id);

  if (!id || isNaN(id)) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto">
        <p className="text-text-tertiary">Invalid article ID</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto">
      <ReadingProgress />
      <Link
        href="/"
        className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors mb-6"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>
      <ArticleDetail id={id} />
      <ArticleNav currentId={id} />
    </div>
  );
}
