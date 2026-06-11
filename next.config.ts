import type { NextConfig } from 'next';

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).host
  : '*.supabase.co';

// React/Turbopack use eval() in dev for debugging (Fast Refresh, callstacks).
// Allow 'unsafe-eval' only in development; keep production locked down.
const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: https://${supabaseHost}`,
  // Demo videos stream from the Supabase `videos` bucket; blob: covers the
  // admin uploader's local object-URL preview before upload.
  `media-src 'self' blob: https://${supabaseHost}`,
  "font-src 'self'",
  `connect-src 'self' https://${supabaseHost} wss://${supabaseHost}`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // HSTS is only honoured by browsers over HTTPS (ignored on http://localhost),
  // so it is safe to send on every response. We set it in-app here since this
  // deploys behind a Node server. `preload` is intentionally omitted — it is
  // a hard-to-reverse commitment that requires every subdomain to be HTTPS.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  async redirects() {
    // The standalone /skills page was removed; its content now lives on /about.
    return [{ source: '/skills', destination: '/about', permanent: true }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
};

export default nextConfig;
