'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

export default function ThemeApplier() {
  const { data: prefs } = useQuery<{ theme: string }>({
    queryKey: ['user-prefs'],
    queryFn: () => fetch('/api/user/preferences').then((r) => r.json()),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const theme = prefs?.theme ?? 'dark';
    const html = document.documentElement;

    function apply(t: string) {
      if (t === 'light') {
        html.setAttribute('data-theme', 'light');
      } else if (t === 'dark') {
        html.removeAttribute('data-theme');
      } else {
        // system: follow OS preference
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) html.removeAttribute('data-theme');
        else html.setAttribute('data-theme', 'light');
      }
    }

    apply(theme);

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply('system');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [prefs?.theme]);

  return null;
}
