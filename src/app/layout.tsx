import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ProfileProvider } from '@/context/ProfileContext';
import Navbar from '@/components/Navbar';
import ProfilePickerModal from '@/components/ProfilePickerModal';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'ColocPot - Tickets de caisse & Pot Commun',
  description: 'Scannez vos tickets de caisse froissés, isolez vos achats perso et équilibrez les comptes de votre colocation.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ColocPot',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16a34a',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icon.svg" />
      </head>
      <body className={`${inter.className} antialiased`}>
        <ProfileProvider>
          <Navbar />
          <ProfilePickerModal />
          <main className="mx-auto max-w-5xl px-3 sm:px-6 py-4 sm:py-6">
            {children}
          </main>
        </ProfileProvider>
      </body>
    </html>
  );
}
