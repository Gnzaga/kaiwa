'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const SHORTCUTS_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      ['g h', 'Go home'],
      ['g n', 'All articles'],
      ['g s', 'Starred'],
      ['g r', 'Archived'],
      ['g l', 'Reading lists'],
      ['g x', 'Stats'],
      ['g f', 'Feeds'],
      ['g t', 'Tags'],
      ['g a', 'Admin'],
      ['g /', 'Search'],
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      ['/', 'Focus search'],
      ['R', 'Random unread'],
      ['t', 'Scroll to top'],
      ['b', 'Go back'],
      ['k', 'Command palette'],
      ['?', 'This help'],
    ],
  },
  {
    title: 'Article List',
    shortcuts: [
      ['j / k', 'Select next/prev'],
      ['Enter', 'Open selected'],
      ['m', 'Toggle read'],
      ['*', 'Toggle star'],
      ['x', 'Archive selected'],
      ['v', 'Toggle view mode'],
      ['u', 'Toggle unread filter'],
      ['f', 'Toggle filters'],
      ['[ / ]', 'Prev/next page'],
    ],
  },
  {
    title: 'Article Detail',
    shortcuts: [
      ['s', 'Toggle star'],
      ['r', 'Toggle read'],
      ['a', 'Toggle archive'],
      ['o', 'Open original'],
      ['c', 'Copy link'],
      ['d', 'Copy TL;DR'],
      ['i', 'Toggle original'],
      ['l', 'Reading list'],
      ['f', 'Focus mode'],
      ['n / p', 'Next/prev article'],
    ],
  },
];

export default function GlobalShortcuts() {
  const router = useRouter();
  const gPressed = useRef(false);
  const gTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      // Escape — close help modal
      if (e.key === 'Escape' && showHelp) {
        setShowHelp(false);
        return;
      }

      // ? — toggle global shortcuts help (only when not in article detail which has its own ?)
      if (e.key === '?' && !isInput) {
        // If article detail's shortcuts are already showing, don't also show global
        const articleShortcutsOpen = document.querySelector('[data-shortcuts-modal]');
        if (!articleShortcutsOpen) {
          setShowHelp(v => !v);
        }
        return;
      }

      if (isInput) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // / — focus first focusable search/filter input on page
      if (e.key === '/') {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>('[data-shortcut-focus], input[type="search"], input[placeholder*="earch" i]');
        if (input) { input.focus(); input.select(); }
        else router.push('/search');
        return;
      }

      // R (shift+r) — random unread article
      if (e.key === 'R') {
        fetch('/api/articles/random').then(r => r.json()).then(d => { if (d.id) router.push(`/article/${d.id}`); });
        return;
      }

      // t — scroll to top
      if (e.key === 't') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }

      // b — go back
      if (e.key === 'b') {
        window.history.back();
        return;
      }

      // g-chord navigation
      if (e.key === 'g') {
        gPressed.current = true;
        if (gTimer.current) clearTimeout(gTimer.current);
        gTimer.current = setTimeout(() => { gPressed.current = false; }, 1000);
        return;
      }

      if (gPressed.current) {
        gPressed.current = false;
        if (gTimer.current) clearTimeout(gTimer.current);
        switch (e.key) {
          case 'h': router.push('/'); break;
          case 's': router.push('/starred'); break;
          case 't': router.push('/tags'); break;
          case 'l': router.push('/lists'); break;
          case 'x': router.push('/stats'); break;
          case 'a': router.push('/admin'); break;
          case 'f': router.push('/feeds'); break;
          case 'n': router.push('/articles'); break;
          case 'r': router.push('/archived'); break;
          case '/': router.push('/search'); break;
        }
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [router, showHelp]);

  if (!showHelp) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setShowHelp(false)}
    >
      <div
        className="bg-bg-secondary border border-border rounded-xl p-6 shadow-xl w-[640px] max-w-[90vw] max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-text-primary">Keyboard Shortcuts</h3>
          <button onClick={() => setShowHelp(false)} className="text-text-tertiary hover:text-text-primary text-xs">✕ close</button>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-5">
          {SHORTCUTS_GROUPS.map(({ title, shortcuts }) => (
            <div key={title} className="space-y-2">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border pb-1">{title}</div>
              {shortcuts.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-text-tertiary">{label}</span>
                  <kbd className="font-mono text-[10px] bg-bg-elevated border border-border rounded px-1.5 py-0.5 text-text-secondary whitespace-nowrap">{key}</kbd>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-[10px] text-text-tertiary mt-5 text-center">Press <kbd className="font-mono bg-bg-elevated border border-border rounded px-1 py-0.5">?</kbd> or <kbd className="font-mono bg-bg-elevated border border-border rounded px-1 py-0.5">Esc</kbd> to dismiss</p>
      </div>
    </div>
  );
}
