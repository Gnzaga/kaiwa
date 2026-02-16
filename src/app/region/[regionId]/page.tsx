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

export default function RegionPage() {
  const params = useParams();
  const regionId = params.regionId as string;

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then((r) => r.json()),
  });

  const region = Array.isArray(regions) ? regions.find((r) => r.id === regionId) : undefined;

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-4xl mx-auto">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold text-text-primary">
          {region ? `${region.flagEmoji} ${region.name}` : regionId.toUpperCase()}
        </h1>
        {region && (
          <div className="flex flex-wrap gap-2">
            {region.categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/region/${regionId}/${cat.slug}`}
                className="px-3 py-1 text-xs border border-border rounded text-text-secondary hover:text-text-primary hover:border-accent-primary transition-colors"
              >
                {cat.name}
              </Link>
            ))}
          </div>
        )}
      </header>
      <ArticleList regionId={regionId} />
    </div>
  );
}
