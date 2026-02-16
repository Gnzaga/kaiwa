import StatsBar from '@/components/dashboard/StatsBar';
import RecentArticles from '@/components/dashboard/RecentArticles';
import BrushDivider from '@/components/ui/BrushDivider';

export default function DashboardPage() {
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <header className="watermark" data-kanji={'\u4F1A\u8A71'}>
        <h1 className="text-2xl font-semibold text-text-primary relative z-10">
          <span className="font-jp text-accent-primary mr-2">{'\u30C0\u30C3\u30B7\u30E5\u30DC\u30FC\u30C9'}</span>
          <span className="text-text-secondary text-sm">Dashboard</span>
        </h1>
      </header>

      <StatsBar />
      <BrushDivider />
      <RecentArticles />
    </div>
  );
}
