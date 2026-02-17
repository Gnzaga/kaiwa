'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export default function GlobalShortcuts() {
  const router = useRouter();
  const gPressed = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // / — focus first search input on page
      if (e.key === '/' && !isInput) {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('input[type="search"], input[placeholder*="earch"]');
        if (input) { input.focus(); input.select(); }
        else router.push('/search');
        return;
      }

      // g-chord navigation
      if (!isInput && e.key === 'g') {
        gPressed.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => { gPressed.current = false; }, 1000);
        return;
      }

      if (gPressed.current && !isInput) {
        gPressed.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        switch (e.key) {
          case 'h': router.push('/'); break;
          case 's': router.push('/starred'); break;
          case 't': router.push('/tags'); break;
          case 'l': router.push('/lists'); break;
          case 'x': router.push('/stats'); break;
          case 'a': router.push('/admin'); break;
        }
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [router]);

  return null;
}
