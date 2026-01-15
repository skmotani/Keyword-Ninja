import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/Navbar';
import { DevModeProvider } from '@/contexts/DevModeContext';
import { AutoDevOverlay } from '@/components/AutoDevOverlay';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SEO Keyword Intelligence Platform',
  description: 'Manage clients, competitors, and keywords for SEO research',
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
            <Navbar />
            <main className="max-w-6xl mx-auto px-4 py-8">
              {children}
            </main>
            <AutoDevOverlay />
          </DevModeProvider>
        </Providers>
      </body>
    </html>
  );
}
