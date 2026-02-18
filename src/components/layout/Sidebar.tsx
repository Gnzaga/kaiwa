'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useSession, signOut } from 'next-auth/react';

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
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());
  const pathname = usePathname();

  // Auto-expand the active region when navigating to a region URL
  useEffect(() => {
    const match = pathname.match(/^\/region\/([^/]+)/);
    if (match) {
      setExpandedRegions((prev) => {
        if (prev.has(match[1])) return prev;
        const next = new Set(prev);
        next.add(match[1]);
        return next;
      });
    }
  }, [pathname]);
  const { data: session } = useSession();

  const { data: regions } = useQuery<Region[]>({
    queryKey: ['regions'],
    queryFn: () => fetch('/api/regions').then((r) => r.json()),
  });

  const { data: unreadCounts } = useQuery<Record<string, number>>({
    queryKey: ['unread-counts'],
    queryFn: () => fetch('/api/regions/unread-counts').then((r) => r.json()),
    refetchInterval: 60000, // refresh every 60s
  });

  function toggleRegion(regionId: string) {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(regionId)) next.delete(regionId);
      else next.add(regionId);
      return next;
    });
  }

  const totalUnread = unreadCounts
    ? Object.values(unreadCounts).reduce((sum, n) => sum + n, 0)
    : 0;

  // Update document title with unread count
  const baseTitle = useRef(typeof document !== 'undefined' ? document.title.replace(/^\(\d+\+?\)\s*/, '') : 'Kaiwa');
  useEffect(() => {
    if (totalUnread > 0) {
      document.title = `(${totalUnread > 999 ? '999+' : totalUnread}) ${baseTitle.current}`;
    } else {
      document.title = baseTitle.current;
    }
  }, [totalUnread]);

  const userName = session?.user?.name;
  const userImage = session?.user?.image;
  const initials = userName
    ? userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <aside
      id="kaiwa-sidebar"
      className={`hidden md:flex flex-col h-screen bg-bg-secondary border-r border-border transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 h-16 border-b border-border shrink-0">
        <div className="relative shrink-0">
          <span className="text-accent-primary text-xl">{'\u26E9'}</span>
          {collapsed && totalUnread > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent-primary" />
          )}
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-text-primary font-semibold tracking-widest text-lg">KAIWA</span>
            {totalUnread > 0 && (
              <span className="ml-auto text-xs font-mono text-text-tertiary">
                {totalUnread > 999 ? '999+' : totalUnread} unread
              </span>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* Dashboard */}
        <NavItem href="/" label="Dashboard" icon={DashboardIcon} collapsed={collapsed} pathname={pathname} />
        <NavItem href="/articles" label="All Articles" icon={AllArticlesIcon} collapsed={collapsed} pathname={pathname} badge={totalUnread} />

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
                    {unreadCounts?.[region.id] ? (
                      <span className="text-[10px] font-mono bg-accent-primary/20 text-accent-primary rounded-full px-1.5 py-0.5 leading-none">
                        {unreadCounts[region.id] > 99 ? '99+' : unreadCounts[region.id]}
                      </span>
                    ) : null}
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

        {/* Starred */}
        <NavItem href="/starred" label="Starred" icon={StarIcon} collapsed={collapsed} pathname={pathname} />

        {/* Stats */}
        <NavItem href="/stats" label="Stats" icon={StatsIcon} collapsed={collapsed} pathname={pathname} />

        {/* Archived */}
        <NavItem href="/archived" label="Archived" icon={ArchiveIcon} collapsed={collapsed} pathname={pathname} />

        {/* My Lists */}
        <NavItem href="/lists" label="My Lists" icon={ListIcon} collapsed={collapsed} pathname={pathname} />

        {/* Feeds */}
        <NavItem href="/feeds" label="Feeds" icon={FeedIcon} collapsed={collapsed} pathname={pathname} />

        {/* Tags */}
        <NavItem href="/tags" label="Tags" icon={TagIcon} collapsed={collapsed} pathname={pathname} />

        {/* Search */}
        <NavItem href="/search" label="Search" icon={SearchIcon} collapsed={collapsed} pathname={pathname} />

        {/* Settings */}
        <NavItem href="/settings" label="Settings" icon={SettingsIcon} collapsed={collapsed} pathname={pathname} />

        {/* Admin (only for admins) */}
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {(session as any)?.isAdmin && (
          <NavItem href="/admin" label="Admin" icon={AdminIcon} collapsed={collapsed} pathname={pathname} />
        )}
      </nav>

      {/* User info */}
      {session?.user && (
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2">
            {userImage ? (
              <img
                src={userImage}
                alt=""
                className="w-8 h-8 rounded-full shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-accent-primary/20 text-accent-primary flex items-center justify-center text-xs font-medium shrink-0">
                {initials}
              </div>
            )}
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <div className="text-sm text-text-primary truncate">{userName}</div>
                <button
                  onClick={() => signOut()}
                  className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Collapse toggle */}
      <button
        onClick={() => {
          const next = !collapsed;
          setCollapsed(next);
          localStorage.setItem('sidebar-collapsed', String(next));
        }}
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
  badge,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsed: boolean;
  pathname: string;
  badge?: number;
}) {
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 px-4 py-2.5 mx-2 rounded-r-sm transition-colors relative ${
        isActive
          ? 'bg-bg-elevated text-text-primary border-l-2 border-accent-primary'
          : 'text-text-secondary hover:text-text-primary hover:bg-bg-elevated border-l-2 border-transparent'
      }`}
    >
      <Icon className="w-5 h-5 shrink-0" />
      {!collapsed && <span className="text-sm flex-1">{label}</span>}
      {!collapsed && badge != null && badge > 0 && (
        <span className="text-[10px] font-mono bg-accent-primary/20 text-accent-primary rounded-full px-1.5 py-0.5 leading-none">
          {badge > 999 ? '999+' : badge}
        </span>
      )}
    </Link>
  );
}

/* Icon components */

function AllArticlesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
    </svg>
  );
}

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
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

function AdminIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
    </svg>
  );
}

function FeedIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 19.5v-.75a7.5 7.5 0 00-7.5-7.5H4.5m0-6.75h.75c7.87 0 14.25 6.38 14.25 14.25v.75M6 18.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
    </svg>
  );
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" />
    </svg>
  );
}

function StatsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  );
}

function TagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L9.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
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
