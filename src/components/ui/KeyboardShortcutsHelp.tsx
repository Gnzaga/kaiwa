'use client';

import { useEffect, useState } from 'react';

const shortcuts = [
  { key: '?', description: 'Show this help' },
  { key: '⌘K', description: 'Quick search (command palette)' },
  { key: '/', description: 'Focus search' },
  { key: 'g h', description: 'Go to Dashboard' },
  { key: 'g s', description: 'Go to Starred' },
  { key: 'g t', description: 'Go to Tags' },
  { key: 'g l', description: 'Go to Lists' },
  { key: 'g x', description: 'Go to Stats' },
  { key: 'g f', description: 'Go to Feeds' },
  { key: 'g r', description: 'Go to Archived' },
  { key: 'g /', description: 'Go to Search' },
  { key: '← →', description: 'Prev / Next article' },
  { key: 's', description: 'Star / Unstar article' },
  { key: 'r', description: 'Mark Read / Unread' },
  { key: 'a', description: 'Archive / Unarchive' },
];

export default function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '?') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-bg-elevated border border-border rounded-xl p-6 w-80 space-y-4 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-text-primary">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="text-text-tertiary hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">{description}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-bg-secondary border border-border rounded text-text-primary">
                {key}
              </kbd>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-tertiary">Press <kbd className="font-mono">?</kbd> or Esc to close</p>
      </div>
    </div>
  );
}
