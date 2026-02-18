import { auth } from '@/lib/auth';
import StatsBar from '@/components/dashboard/StatsBar';
import RecentArticles from '@/components/dashboard/RecentArticles';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TopSources from '@/components/dashboard/TopSources';
import RegionsGlance from '@/components/dashboard/RegionsGlance';
import TrendingTags from '@/components/dashboard/TrendingTags';
import BrushDivider from '@/components/ui/BrushDivider';
import SurpriseButton from '@/components/dashboard/SurpriseButton';
import ReadingStatus from '@/components/dashboard/ReadingStatus';
import RecentlyViewed from '@/components/dashboard/RecentlyViewed';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDateLabel(): string {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name;
  const greeting = getGreeting();
  const dateLabel = getDateLabel();

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <header className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs text-text-tertiary mb-0.5">{dateLabel}</p>
          <h1 className="text-2xl font-semibold text-text-primary">
            {name ? `${greeting}, ${name}` : greeting}
          </h1>
          <ReadingStatus />
        </div>
        <SurpriseButton />
      </header>

      <StatsBar />
      <RegionsGlance />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity />
          <TrendingTags />
        </div>
        <div className="space-y-4">
          <TopSources />
          <RecentlyViewed />
        </div>
      </div>
      <BrushDivider />
      <RecentArticles />
    </div>
  );
}
