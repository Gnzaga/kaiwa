export default function BrushDivider({ className = '' }: { className?: string }) {
  return (
    <svg
      className={`w-full ${className}`}
      height="4"
      viewBox="0 0 800 4"
      preserveAspectRatio="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="brush-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="15%" stopColor="var(--color-accent-primary)" />
          <stop offset="50%" stopColor="var(--color-accent-secondary)" />
          <stop offset="85%" stopColor="var(--color-accent-primary)" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path
        d="M0,2 C100,0.5 200,3.5 300,2 C400,0.5 500,3.5 600,2 C700,0.5 750,3 800,2"
        stroke="url(#brush-grad)"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
