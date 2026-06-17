import type { Metadata } from 'next';
import { headers } from 'next/headers';
import {
  DM_Serif_Display,
  Instrument_Sans,
  Geist_Mono,
} from 'next/font/google';

import { Footer } from '@/components/footer';
import { Header } from '@/components/header';
import { PageViewTracker } from '@/components/page-view-tracker';
import { ThemeProvider } from '@/components/theme-provider';
import { getBaseUrl } from '@/lib/site-url';

import './globals.css';

// The per-request CSP nonce (set by `src/middleware.ts`) is read below via
// `headers()`, which opts every route into dynamic rendering. This is required:
// nonce-based CSP is incompatible with cached/static HTML, since a cached page
// would embed a stale nonce that no longer matches the per-request CSP header.
export const dynamic = 'force-dynamic';

const dmSerifDisplay = DM_Serif_Display({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
});

const instrumentSans = Instrument_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
  weight: ['400', '500', '600'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL(getBaseUrl()),
  title: {
    default: 'Portfolio',
    template: '%s | Portfolio',
  },
  description:
    'A personal portfolio showcasing my skills, projects, and professional experience.',
  openGraph: {
    type: 'website',
    siteName: 'Portfolio',
    title: 'Portfolio',
    description:
      'A personal portfolio showcasing my skills, projects, and professional experience.',
    url: '/',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Portfolio',
    description:
      'A personal portfolio showcasing my skills, projects, and professional experience.',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Set per request by `src/middleware.ts`; passed to next-themes so its
  // pre-paint inline script carries the nonce and is not blocked by the CSP.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html
      lang="en"
      className={`${dmSerifDisplay.variable} ${instrumentSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-md focus:outline-none"
        >
          Skip to content
        </a>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
          nonce={nonce}
        >
          <Header />
          <main id="main-content" className="flex-1">
            {children}
          </main>
          <Footer />
          <PageViewTracker />
        </ThemeProvider>
      </body>
    </html>
  );
}
