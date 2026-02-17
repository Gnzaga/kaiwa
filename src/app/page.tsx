import { auth } from '@/lib/auth';
import StatsBar from '@/components/dashboard/StatsBar';
import RecentArticles from '@/components/dashboard/RecentArticles';
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
      <BrushDivider />
      <RecentArticles />
    </div>
  );
}
