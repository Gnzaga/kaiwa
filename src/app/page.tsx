import { auth } from '@/lib/auth';
import StatsBar from '@/components/dashboard/StatsBar';
import RecentArticles from '@/components/dashboard/RecentArticles';
import RecentActivity from '@/components/dashboard/RecentActivity';
import TopSources from '@/components/dashboard/TopSources';
import RegionsGlance from '@/components/dashboard/RegionsGlance';
import BrushDivider from '@/components/ui/BrushDivider';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default async function DashboardPage() {
  const session = await auth();
  const name = session?.user?.name;
  const greeting = getGreeting();

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold text-text-primary">
          {name ? `${greeting}, ${name}` : greeting}
        </h1>
      </header>

      <StatsBar />
      <RegionsGlance />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecentActivity />
        </div>
        <TopSources />
      </div>
      <BrushDivider />
      <RecentArticles />
    </div>
  );
}
