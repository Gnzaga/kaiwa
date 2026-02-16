import StatsBar from '@/components/dashboard/StatsBar';
import RecentArticles from '@/components/dashboard/RecentArticles';
import BrushDivider from '@/components/ui/BrushDivider';

export default function DashboardPage() {
  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
      </header>

      <StatsBar />
      <BrushDivider />
      <RecentArticles />
    </div>
  );
}
