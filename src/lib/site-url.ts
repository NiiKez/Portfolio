/**
 * Canonical site origin used for `metadataBase`, OG/canonical URLs, the sitemap,
 * and robots. Uses an explicit `NEXT_PUBLIC_SITE_URL`, and only falls back to
 * localhost for local development.
 *
 * Keeping this in one place ensures metadata, sitemap, and robots all agree —
 * previously `layout.tsx` fell straight to localhost while sitemap/robots
 * resolved the origin differently, so the OG and canonical tags could silently
 * point at localhost.
 *
 * In production we refuse to fall back to localhost: if `NEXT_PUBLIC_SITE_URL`
 * is unset we throw so the build/boot fails loudly instead of silently shipping
 * localhost canonical/OG/sitemap/robots URLs (and a localhost magic-link
 * `redirect_to`). An empty/whitespace-only `NEXT_PUBLIC_SITE_URL` is treated as
 * unset.
 *
 * Read at call time (never cached at module load) so route handlers and
 * metadata pick up the runtime-injected value rather than a build-time snapshot.
 */
export function getBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (explicit) return explicit;

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'getBaseUrl(): NEXT_PUBLIC_SITE_URL must be set in production. ' +
        'No canonical origin could be resolved, refusing to fall back to ' +
        'http://localhost which would poison OG/canonical/sitemap/robots URLs ' +
        'and the magic-link redirect_to.',
    );
  }

  return 'http://localhost:3000';
}
