/**
 * Content-Security-Policy construction for the per-request nonce flow.
 *
 * The CSP is built fresh on every request in `src/middleware.ts` because
 * `script-src` carries a one-time nonce. It lives here (not in `next.config.ts`)
 * so it can be unit-tested and shared, and because static `headers()` config
 * cannot vary per request.
 *
 * This module reads `process.env` directly (mirroring how `next.config.ts` built
 * the old static CSP) rather than importing `@/lib/env`, so it has no
 * `server-only` coupling and stays trivially testable. It is only ever imported
 * by the middleware (Edge runtime), so it never reaches the client bundle.
 */

/**
 * Generates a fresh, unguessable CSP nonce: 16 random bytes, base64-encoded.
 * Uses Web Crypto + `btoa`, both available in the Edge runtime where middleware
 * runs (and in Node 20 used by the test runner).
 */
export function generateNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Builds the Content-Security-Policy for a given request nonce.
 *
 * `script-src` no longer uses `'unsafe-inline'`: every inline script — Next.js's
 * hydration bootstrap and next-themes' pre-paint theme script — must carry this
 * per-request nonce, so an injected `<script>` (or inline event handler) without
 * the nonce is blocked. `'strict-dynamic'` lets nonce-trusted scripts load the
 * app's own chunks while making the `'self'` source a fallback for browsers that
 * don't support `strict-dynamic`. `'unsafe-eval'` is added only in development
 * for React Fast Refresh.
 *
 * `style-src` keeps `'unsafe-inline'`: Tailwind and inline `style={{}}` props
 * depend on it, and CSS injection is far lower risk than script execution.
 */
export function buildCsp(nonce: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseHost = supabaseUrl
    ? new URL(supabaseUrl).host
    : '*.supabase.co';
  const isDev = process.env.NODE_ENV !== 'production';

  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
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
}
