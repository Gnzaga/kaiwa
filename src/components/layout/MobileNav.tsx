'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

interface Region {
  id: string;
  name: string;
  flagEmoji: string;
  categories: { id: string; slug: string; name: string }[];
}

export default function MobileNav() {
  const pathname = usePathname();
  const [showRegions, setShowRegions] = useState(false);

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then((r) => r.json()),
  });

  const { data: unreadCounts } = useQuery<Record<string, number>>({
    queryKey: ['unread-counts'],
    queryFn: () => fetch('/api/regions/unread-counts').then((r) => r.json()),
    refetchInterval: 60000,
  });
  const totalUnread = unreadCounts ? Object.values(unreadCounts).reduce((s, n) => s + n, 0) : 0;

  const isHome = pathname === '/';
  const isRegion = pathname.startsWith('/region/');
  const isSearch = pathname.startsWith('/search');
  const isLists = pathname.startsWith('/lists');
  const isSettings = pathname.startsWith('/settings');

  return (
    <>
      {/* Region sheet overlay */}
      {showRegions && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setShowRegions(false)}
          />
          <div className="absolute bottom-16 left-0 right-0 bg-bg-secondary border-t border-border rounded-t-xl p-4 max-h-[60vh] overflow-y-auto animate-fade-in">
            <h3 className="text-sm font-medium text-text-primary mb-3">Regions</h3>
            <div className="space-y-1">
              {Array.isArray(regions) && regions.map((region) => (
                <Link
                  key={region.id}
                  href={`/region/${region.id}`}
                  onClick={() => setShowRegions(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded transition-colors ${
                    pathname.startsWith(`/region/${region.id}`)
                      ? 'bg-bg-elevated text-text-primary'
                      : 'text-text-secondary'
                  }`}
                >
                  <span className="text-lg">{region.flagEmoji}</span>
                  <span className="text-sm">{region.name}</span>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex md:hidden items-center justify-around bg-bg-secondary border-t border-border h-16 px-2">
        <Link
          href="/"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded transition-colors relative ${
            isHome ? 'text-accent-primary' : 'text-text-tertiary'
          }`}
        >
          <div className="relative">
            <HomeIcon className="w-5 h-5" />
            {totalUnread > 0 && (
              <span className="absolute -top-1 -right-2 text-[9px] font-mono bg-accent-primary text-white rounded-full px-1 leading-tight min-w-[14px] text-center">
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
          <span className="text-[10px]">Home</span>
        </Link>

        <button
          onClick={() => setShowRegions(!showRegions)}
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded transition-colors ${
            isRegion ? 'text-accent-primary' : 'text-text-tertiary'
          }`}
        >
          <GlobeIcon className="w-5 h-5" />
          <span className="text-[10px]">Regions</span>
        </button>

        <Link
          href="/lists"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded transition-colors ${
            isLists ? 'text-accent-primary' : 'text-text-tertiary'
          }`}
        >
          <ListIcon className="w-5 h-5" />
          <span className="text-[10px]">Lists</span>
        </Link>

        <Link
          href="/search"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded transition-colors ${
            isSearch ? 'text-accent-primary' : 'text-text-tertiary'
          }`}
        >
          <SearchIcon className="w-5 h-5" />
          <span className="text-[10px]">Search</span>
        </Link>

        <Link
          href="/settings"
          className={`flex flex-col items-center gap-0.5 py-1 px-2 rounded transition-colors ${
            isSettings ? 'text-accent-primary' : 'text-text-tertiary'
          }`}
        >
          <SettingsIcon className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
        </Link>
      </nav>
    </>
  );
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}

function ListIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
