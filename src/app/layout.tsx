import type { Metadata } from 'next';
import './globals.css';
import QueryProvider from '@/components/providers/QueryProvider';
import AuthSessionProvider from '@/components/providers/SessionProvider';
import Sidebar from '@/components/layout/Sidebar';
import MobileNav from '@/components/layout/MobileNav';
import GlobalShortcuts from '@/components/ui/GlobalShortcuts';
import KeyboardShortcutsHelp from '@/components/ui/KeyboardShortcutsHelp';
import ScrollToTop from '@/components/ui/ScrollToTop';
import { ToastProvider } from '@/components/ui/Toast';

export const metadata: Metadata = {
  title: 'Kaiwa - Multi-National Media Intelligence',
  description: 'Real-time international news aggregation with AI-powered translation and analysis',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-bg-primary text-text-primary font-sans antialiased">
        <AuthSessionProvider>
          <QueryProvider>
          <ToastProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
                {children}
              </main>
            </div>
            <MobileNav />
            <GlobalShortcuts />
            <KeyboardShortcutsHelp />
            <ScrollToTop />
          </ToastProvider>
          </QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
