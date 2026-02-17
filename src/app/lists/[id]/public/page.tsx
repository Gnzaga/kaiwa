'use client';

import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';

interface PublicListResponse {
  list: {
    id: number;
    name: string;
    description: string | null;
    isPublic: boolean;
    createdAt: string;
  };
  data: {
    itemId: number;
    articleId: number;
    originalTitle: string;
    translatedTitle: string | null;
    originalUrl: string;
    publishedAt: string;
    summaryTldr: string | null;
    summaryTags: string[] | null;
    imageUrl: string | null;
    feedSourceName: string | null;
  }[];
}

export default function PublicListPage() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery<PublicListResponse>({
    queryKey: ['public-list', id],
    queryFn: () => fetch(`/api/reading-lists/${id}/public`).then(r => r.json()),
  });

  if (isLoading) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-bg-secondary border border-border rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 md:p-8 max-w-3xl mx-auto text-center py-20">
        <p className="text-text-tertiary text-sm">This reading list is not available.</p>
      </div>
    );
  }

  const { list, data: items } = data;

  return (
    <div className="p-6 md:p-8 max-w-3xl mx-auto space-y-6">
      <header className="space-y-1 border-b border-border pb-4">
        <div className="flex items-center gap-2 text-xs text-text-tertiary mb-2">
          <span className="px-1.5 py-0.5 border border-border rounded text-[10px] uppercase font-mono">Public List</span>
          <span>Shared via Kaiwa</span>
        </div>
        <h1 className="text-2xl font-semibold text-text-primary">{list.name}</h1>
        {list.description && <p className="text-sm text-text-secondary">{list.description}</p>}
        <p className="text-xs text-text-tertiary">{items.length} article{items.length !== 1 ? 's' : ''}</p>
      </header>

      <div className="space-y-3">
        {items.map((item) => {
          const title = item.translatedTitle || item.originalTitle;
          return (
            <div key={item.itemId} className="bg-bg-secondary border border-border rounded p-4 space-y-1.5">
              <a
                href={item.originalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-base font-medium text-text-primary hover:text-accent-primary transition-colors"
              >
                {title}
              </a>
              <div className="flex items-center gap-3 text-xs text-text-tertiary">
                {item.feedSourceName && <span>{item.feedSourceName}</span>}
                <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
              </div>
              {item.summaryTldr && (
                <p className="text-sm text-text-secondary line-clamp-2">{item.summaryTldr}</p>
              )}
              {item.summaryTags && item.summaryTags.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {item.summaryTags.slice(0, 5).map((tag) => (
                    <span key={tag} className="px-1.5 py-0.5 text-[10px] border border-border rounded text-text-tertiary">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <Link
                href={`/article/${item.articleId}`}
                className="text-xs text-accent-primary hover:text-accent-highlight transition-colors"
              >
                Read on Kaiwa →
              </Link>
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <p className="text-center text-text-tertiary text-sm py-12">No articles in this list.</p>
      )}
    </div>
  );
}
