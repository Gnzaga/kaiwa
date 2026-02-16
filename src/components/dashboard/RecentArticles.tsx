'use client';

import { useQuery } from '@tanstack/react-query';
import type { Article } from '@/db/schema';
import ArticleCard from '@/components/articles/ArticleCard';
import Link from 'next/link';

interface RecentResponse {
  data: (Article & { feedSourceName?: string; imageUrl?: string | null })[];
  total: number;
  page: number;
  pageSize: number;
}

interface Region {
  id: string;
  name: string;
  flagEmoji: string;
  categories: { id: string; slug: string; name: string }[];
}

function RegionColumn({ region }: { region: Region }) {
  const { data, isLoading } = useQuery<RecentResponse>({
    queryKey: ['recent', region.id],
    queryFn: () =>
      fetch(`/api/articles?region=${region.id}&pageSize=6&sort=newest`).then((r) => r.json()),
  });

  const articles = data?.data ?? [];
  const heroArticle = articles[0];
  const rest = articles.slice(1);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          {region.flagEmoji} {region.name}
        </h2>
        <Link
          href={`/region/${region.id}`}
          className="text-xs text-text-tertiary hover:text-accent-primary transition-colors"
        >
          View all &rarr;
        </Link>
      </div>
      <hr className="divider-line border-0" />
      {isLoading && (
        <div className="space-y-2">
          <div className="aspect-[16/9] bg-bg-secondary border border-border rounded-xl animate-pulse" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 bg-bg-secondary border border-border rounded-lg animate-pulse" />
          ))}
        </div>
      )}
      {data && articles.length === 0 && (
        <p className="text-sm text-text-tertiary py-4">No articles yet</p>
      )}
      {heroArticle && (
        <div className="space-y-2">
          <ArticleCard
            article={heroArticle}
            sourceName={heroArticle.feedSourceName}
            variant={heroArticle.imageUrl ? 'hero' : 'default'}
          />
          {rest.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              sourceName={article.feedSourceName}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function RecentArticles() {
  const { data: regions, isLoading } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then((r) => r.json()),
  });

  if (isLoading || !regions) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-3">
            <div className="h-6 bg-bg-secondary rounded w-32 animate-pulse" />
            <div className="aspect-[16/9] bg-bg-secondary border border-border rounded-xl animate-pulse" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div key={j} className="h-16 bg-bg-secondary border border-border rounded-lg animate-pulse" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {Array.isArray(regions) && regions.map((region) => (
        <RegionColumn key={region.id} region={region} />
      ))}
    </div>
  );
}
