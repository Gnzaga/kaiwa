'use client';

import { useQuery } from '@tanstack/react-query';
import type { Article } from '@/db/schema';
import ArticleCard from '@/components/articles/ArticleCard';
import BrushDivider from '@/components/ui/BrushDivider';

interface RecentResponse {
  data: (Article & { sourceName?: string })[];
  total: number;
  page: number;
  pageSize: number;
}

function CategoryColumn({
  category,
  labelJa,
  labelEn,
}: {
  category: 'law' | 'economics';
  labelJa: string;
  labelEn: string;
}) {
  const { data, isLoading } = useQuery<RecentResponse>({
    queryKey: ['recent', category],
    queryFn: () =>
      fetch(`/api/articles?category=${category}&pageSize=5&sort=newest`).then((r) => r.json()),
  });

  return (
    <section className="space-y-3">
      <div className="watermark" data-kanji={labelJa}>
        <h2 className="text-lg font-medium text-text-primary relative z-10">
          <span className="font-jp text-accent-primary mr-2">{labelJa}</span>
          <span className="text-text-secondary text-sm">{labelEn}</span>
        </h2>
      </div>
      <BrushDivider />
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
      <CategoryColumn category="law" labelJa={'\u6CD5\u5F8B'} labelEn="Law" />
      <CategoryColumn category="economics" labelJa={'\u7D4C\u6E08'} labelEn="Economics" />
    </div>
  );
}
