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
import DynamicTitle from '@/components/ui/DynamicTitle';
import CommandPalette from '@/components/ui/CommandPalette';

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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-accent-primary focus:text-white focus:rounded focus:text-sm"
        >
          Skip to main content
        </a>
        <AuthSessionProvider>
          <QueryProvider>
          <ToastProvider>
            <div className="flex min-h-screen">
              <Sidebar />
              <main id="main-content" className="flex-1 overflow-y-auto pb-20 md:pb-0">
                {children}
              </main>
            </div>
            <MobileNav />
            <GlobalShortcuts />
            <KeyboardShortcutsHelp />
            <ScrollToTop />
            <DynamicTitle />
            <CommandPalette />
          </ToastProvider>
          </QueryProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
