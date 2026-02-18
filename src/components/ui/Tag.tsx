import Link from 'next/link';

export default function Tag({ label, onClick }: { label: string; onClick?: (label: string) => void }) {
  const className =
    'inline-block rounded-full bg-bg-elevated px-3 py-1 text-xs text-text-secondary border border-transparent hover:border-accent-primary hover:text-text-primary transition-colors cursor-pointer';

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(label); }}
        className={className}
      >
        {label}
      </button>
    );
  }

  return (
    <Link
      href={`/articles?tag=${encodeURIComponent(label)}`}
      onClick={(e) => e.stopPropagation()}
      className={className}
    >
      {label}
    </Link>
  );
}
