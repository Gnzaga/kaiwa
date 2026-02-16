'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import ArticleList from '@/components/articles/ArticleList';

interface Region {
  id: string;
  name: string;
  flagEmoji: string;
  categories: { id: string; slug: string; name: string }[];
}

export default function CategoryPage() {
  const params = useParams();
  const regionId = params.regionId as string;
  const categorySlug = params.categorySlug as string;

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then((r) => r.json()),
  });

  const region = Array.isArray(regions) ? regions.find((r) => r.id === regionId) : undefined;
  const category = region?.categories.find((c) => c.slug === categorySlug);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-text-tertiary">
          <Link href={`/region/${regionId}`} className="hover:text-text-secondary transition-colors">
            {region ? `${region.flagEmoji} ${region.name}` : regionId.toUpperCase()}
          </Link>
          <span>/</span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary">
          {category?.name ?? categorySlug}
        </h1>
      </header>
      <ArticleList regionId={regionId} categorySlug={categorySlug} />
    </div>
  );
}
