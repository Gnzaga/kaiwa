'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
}

interface Region {
  id: string;
  name: string;
  flagEmoji: string;
  categories: Category[];
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then((r) => r.json()),
  });

  function toggleRegion(regionId: string) {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });
  }

  return (
    <aside
      className={`hidden md:flex flex-col h-screen bg-bg-secondary border-r border-border transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-border shrink-0">
        <span className="text-accent-primary text-xl">{'\u26E9'}</span>
        {!collapsed && (
          <span className="text-text-primary font-semibold tracking-widest text-lg">KAIWA</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* Dashboard */}
        <NavItem href="/" label="Dashboard" icon={DashboardIcon} collapsed={collapsed} pathname={pathname} />

        {/* Region groups */}
        {Array.isArray(regions) && regions.map((region) => {
          const isExpanded = expandedRegions.has(region.id);
          const isRegionActive = pathname.startsWith(`/region/${region.id}`);

          return (
            <div key={region.id} className="mt-1">
              <button
                onClick={() => collapsed ? undefined : toggleRegion(region.id)}
                className={`flex items-center gap-3 px-4 py-2 mx-2 rounded-r-sm w-[calc(100%-16px)] text-left transition-colors ${
                  isRegionActive
                    ? 'text-text-primary'
                    : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                }`}
              >
                <span className="text-base shrink-0">{region.flagEmoji}</span>
                {!collapsed && (
                  <>
                    <span className="text-sm flex-1">{region.name}</span>
                    <svg
                      className={`w-3 h-3 transition-transform text-text-tertiary ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </>
                )}
              </button>

              {!collapsed && isExpanded && (
                <div className="ml-6 border-l border-border">
                  <Link
                    href={`/region/${region.id}`}
                    className={`flex items-center gap-2 px-4 py-1.5 text-xs transition-colors ${
                      pathname === `/region/${region.id}`
                        ? 'text-accent-primary'
                        : 'text-text-tertiary hover:text-text-secondary'
                    }`}
                  >
                    All
                  </Link>
                  {region.categories.map((cat) => {
                    const catPath = `/region/${region.id}/${cat.slug}`;
                    const isCatActive = pathname === catPath;
                    return (
                      <Link
                        key={cat.id}
                        href={catPath}
                        className={`flex items-center gap-2 px-4 py-1.5 text-xs transition-colors ${
                          isCatActive
                            ? 'text-accent-primary'
                            : 'text-text-tertiary hover:text-text-secondary'
                        }`}
                      >
                        {cat.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        <hr className="divider-line border-0 mx-4 my-3" />

        {/* Search */}
        <NavItem href="/search" label="Search" icon={SearchIcon} collapsed={collapsed} pathname={pathname} />

        {/* Settings */}
        <NavItem href="/settings" label="Settings" icon={SettingsIcon} collapsed={collapsed} pathname={pathname} />
      </nav>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t border-border text-text-tertiary hover:text-text-primary transition-colors"
      >
        <svg
          className={`w-4 h-4 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </button>
    </aside>
  );
}

function NavItem({
  href,
  label,
  icon: Icon,
  collapsed,
  pathname,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  pathname: string;
}) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-r-sm transition-colors relative ${
        isActive
          ? 'bg-bg-elevated text-text-primary border-l-2 border-accent-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span className="text-sm">{label}</span>}
    </Link>
  );
}

/* Icon components */

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
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
