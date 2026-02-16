export default function Tag({ label }: { label: string }) {
  return (
    <span className="inline-block rounded-full bg-bg-elevated px-3 py-1 text-xs text-text-secondary border border-transparent hover:border-accent-primary transition-colors">
      {label}
    </span>
  );
}
