import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import { DevModeProvider } from '@/contexts/DevModeContext';
import { AutoDevOverlay } from '@/components/AutoDevOverlay';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Motani | Get Found. Grow Faster. Generate Revenue.',
  description: 'AI-Powered SEO that puts your business where the money is. Data analytics and automation to dominate SERP, Social, YouTube, and LLM Search.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <DevModeProvider>
            <div className="flex min-h-screen bg-gray-50">
              <Sidebar />
              <main className="flex-1 ml-64 transition-all duration-300">
                <div className="max-w-7xl mx-auto px-6 py-8">
                  {children}
                </div>
              </main>
            </div>
            <AutoDevOverlay />
          </DevModeProvider>
        </Providers>
      </body>
    </html>
  );
}
