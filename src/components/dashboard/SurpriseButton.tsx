'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SurpriseButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSurprise = async () => {
    setLoading(true);
    try {
      const resp = await fetch('/api/articles/random').then(r => r.json());
      if (resp.id) {
        router.push(`/article/${resp.id}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleSurprise}
      disabled={loading}
      title="Navigate to a random unread article"
      className="px-3 py-1.5 text-xs border border-border rounded text-text-tertiary hover:text-accent-primary hover:border-accent-primary transition-colors disabled:opacity-40"
    >
      {loading ? '...' : 'Surprise me'}
    </button>
  );
}
