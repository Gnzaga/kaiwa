const sentimentConfig: Record<string, { label: string; icon: string; className: string }> = {
  bullish: { label: 'Bullish', icon: '\u25B2', className: 'sentiment-bullish' },
  bearish: { label: 'Bearish', icon: '\u25BC', className: 'sentiment-bearish' },
  neutral: { label: 'Neutral', icon: '\u2014', className: 'sentiment-neutral' },
  restrictive: { label: 'Restrictive', icon: '\u25BC', className: 'sentiment-restrictive' },
  permissive: { label: 'Permissive', icon: '\u25B2', className: 'sentiment-permissive' },
  positive: { label: 'Positive', icon: '\u25B2', className: 'sentiment-positive' },
  negative: { label: 'Negative', icon: '\u25BC', className: 'sentiment-negative' },
  mixed: { label: 'Mixed', icon: '\u25C6', className: 'sentiment-mixed' },
};

export default function SentimentBadge({ sentiment }: { sentiment: string | null }) {
  if (!sentiment) return null;
  const config = sentimentConfig[sentiment];
  if (!config) return null;

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${config.className}`}>
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  );
}
