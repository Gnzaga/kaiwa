'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const NAV_KEY = 'kaiwa-article-nav';

export function setArticleNavList(ids: number[]) {
  if (typeof window !== 'undefined') {
    sessionStorage.setItem(NAV_KEY, JSON.stringify(ids));
  }
}

function getNavList(): number[] {
  if (typeof window === 'undefined') return [];
  try { return JSON.parse(sessionStorage.getItem(NAV_KEY) ?? '[]'); } catch { return []; }
}

export default function ArticleNav({ currentId }: { currentId: number }) {
  const router = useRouter();
  const [prevId, setPrevId] = useState<number | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);

  useEffect(() => {
    const list = getNavList();
    const idx = list.indexOf(currentId);
    if (idx === -1) return;
    setPrevId(idx > 0 ? list[idx - 1] : null);
    setNextId(idx < list.length - 1 ? list[idx + 1] : null);
  }, [currentId]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'ArrowLeft' && prevId) router.push(`/article/${prevId}`);
      if (e.key === 'ArrowRight' && nextId) router.push(`/article/${nextId}`);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [prevId, nextId, router]);

  if (!prevId && !nextId) return null;

  return (
    <div className="flex items-center justify-between gap-4 mt-8 pt-4 border-t border-border">
      {prevId ? (
        <button
          onClick={() => router.push(`/article/${prevId}`)}
          className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="10 3 5 8 10 13" />
          </svg>
          Previous
        </button>
      ) : <div />}
      {nextId ? (
        <button
          onClick={() => router.push(`/article/${nextId}`)}
          className="flex items-center gap-1.5 text-sm text-text-tertiary hover:text-text-primary transition-colors"
        >
          Next
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polyline points="6 3 11 8 6 13" />
          </svg>
        </button>
      ) : <div />}
    </div>
  );
}
