'use client';

import { useQuery } from '@tanstack/react-query';
import type { Article } from '@/db/schema';
import ArticleCard from '@/components/articles/ArticleCard';

interface RecentResponse {
  data: (Article & { sourceName?: string })[];
  total: number;
  page: number;
  pageSize: number;
}

function CategoryColumn({
  category,
  label,
}: {
  category: 'law' | 'economics';
  label: string;
}) {
  const { data, isLoading } = useQuery<RecentResponse>({
    queryKey: ['recent', category],
    queryFn: () =>
      fetch(`/api/articles?category=${category}&pageSize=5&sort=newest`).then((r) => r.json()),
  });

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-medium text-text-primary">{label}</h2>
      <hr className="divider-line border-0" />
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 bg-bg-secondary border border-border rounded animate-pulse" />
          ))}
        </div>
      )}
      {data && data.data.length === 0 && (
        <p className="text-sm text-text-tertiary py-4">No articles yet</p>
      )}
      {data && (
        <div className="space-y-2">
          {data.data.map((article) => (
            <ArticleCard key={article.id} article={article} sourceName={article.sourceName} />
          ))}
        </div>
      )}
    </section>
  );
}

export default function RecentArticles() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <CategoryColumn category="law" label="Law" />
      <CategoryColumn category="economics" label="Economics" />
    </div>
  );
}
