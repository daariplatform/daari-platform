import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'منصة داري — لوحة تحكم المعمل',
  description: 'إدارة الخزانات والزبائن والسائقين والمحاسبة',
  // PWA — manifest gives Chrome/Safari the "Add to Home Screen" prompt
  // and tells the OS how to render the launcher icon + splash screen.
  manifest: '/manifest.json',
  // iOS-specific PWA hints. Safari ignores the manifest's display:standalone
  // and theme_color — these meta-tags are how the dashboard gets app-like
  // chrome on iPhone after add-to-home-screen.
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'داري للمعمل',
  },
  icons: {
    icon: '/favicon.png',
    apple: '/icons/icon-192.png',
  },
};

export const viewport: Viewport = {
  // Theme colour tints the iOS status bar + Android Chrome address bar
  // to the brand teal, completing the "this looks like an app" illusion.
  themeColor: '#0e9384',
  width: 'device-width',
  initialScale: 1,
  // Lock pinch-zoom on installed PWA so the layout doesn't get mangled
  // by accidental zoom; the dashboard already uses 16px+ for inputs.
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
