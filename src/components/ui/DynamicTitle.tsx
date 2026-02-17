'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export default function DynamicTitle() {
  const { data: unreadCounts } = useQuery<Record<string, number>>({
    queryKey: ['unread-counts'],
    queryFn: () => fetch('/api/regions/unread-counts').then((r) => r.json()),
    refetchInterval: 60000,
    staleTime: 30000,
  });

  const total = unreadCounts
    ? Object.values(unreadCounts).reduce((sum, n) => sum + n, 0)
    : 0;

  useEffect(() => {
    const base = 'KAIWA';
    document.title = total > 0 ? `(${total > 999 ? '999+' : total}) ${base}` : base;
  }, [total]);

  return null;
}
