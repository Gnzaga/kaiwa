const statusConfig: Record<string, { color: string; pulse: boolean }> = {
  pending: { color: 'bg-text-tertiary', pulse: false },
  translating: { color: 'bg-warning', pulse: true },
  summarizing: { color: 'bg-warning', pulse: true },
  complete: { color: 'bg-success', pulse: false },
  error: { color: 'bg-accent-highlight', pulse: false },
};

export default function StatusIndicator({
  status,
  tooltip,
}: {
  status: string;
  tooltip?: string;
}) {
  const config = statusConfig[status] ?? statusConfig.pending;

  return (
    <span className="relative inline-flex" title={tooltip}>
      <span
        className={`inline-block h-2 w-2 rounded-full ${config.color} ${config.pulse ? 'animate-pulse' : ''}`}
      />
    </span>
  );
}
