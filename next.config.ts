import type { NextConfig } from 'next';

// NOTE: Content-Security-Policy is intentionally NOT set here. It carries a
// per-request nonce (`script-src 'nonce-…'`) and so is built and attached in
// `src/middleware.ts` instead — a static `headers()` value cannot vary per
// request. Only the request-invariant security headers live here.
const securityHeaders = [
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
    // Deny-by-default for powerful features the site never uses. Beyond
    // camera/mic/geolocation, this also disables payment, USB/serial/Bluetooth,
    // and the Topics API (interest-cohort/browsing-topics) so an injected or
    // third-party script cannot reach them.
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=(), browsing-topics=()',
  },
];

const nextConfig: NextConfig = {
  // Drop the `X-Powered-By: Next.js` header — standard hardening that removes a
  // free framework-fingerprinting signal from every response.
  poweredByHeader: false,
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
