/**
 * First-party, privacy-friendly page-view analytics — shared pure helpers.
 *
 * This module is deliberately free of `server-only` and of any Node/Supabase
 * import so it can be used in three places: the client beacon
 * (`page-view-tracker.tsx`), the server ingest route (`/api/track`), and the
 * admin dashboard summary parsing. It stores no cookies and no PII — only a
 * bounded pathname and the bare referrer host — so the site needs no cookie
 * banner.
 */

/** Same-origin endpoint the browser beacons each page view to. */
export const TRACK_ENDPOINT = '/api/track';

/** Upper bound on a stored path; longer values are dropped, not truncated. */
const MAX_PATH_LENGTH = 1024;
/** Upper bound on a stored referrer host. */
const MAX_REFERRER_LENGTH = 255;

/**
 * Whether a route should be recorded. We never track the admin UI (it's the
 * owner browsing their own CMS) or API noise — only public visitor paths.
 */
export function isTrackablePath(path: string): boolean {
  return (
    path.startsWith('/') &&
    // Reject protocol-relative ("//host") or backslash-prefixed ("/\host")
    // values: a browser resolves these to an EXTERNAL origin, so they are not
    // same-origin routes. `usePathname()` never produces them — they only reach
    // us via direct API abuse — and storing one would put a misleading external
    // host in the admin "Top pages" list.
    !/^\/[/\\]/.test(path) &&
    !path.startsWith('/admin') &&
    !path.startsWith('/api')
  );
}

/**
 * Normalise a client-supplied path to a clean, bounded pathname. Query strings
 * and hashes are stripped (they can carry PII and explode cardinality), the
 * value must be a trackable relative path, and over-long values are rejected.
 * Returns `null` for anything that should not be recorded.
 */
export function sanitizePath(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const path = raw.split(/[?#]/)[0]!;
  if (path.length === 0 || path.length > MAX_PATH_LENGTH) return null;
  if (!isTrackablePath(path)) return null;
  return path;
}

/**
 * Reduce a referrer to its bare host, dropping internal navigation and anything
 * that isn't an http(s) origin. Accepts either a full URL (what the browser's
 * `document.referrer` provides) or a bare host string. `selfHost` is the
 * request's own host: same-host referrers are internal navigation, not traffic
 * sources, so they're dropped. Returns `null` when there's nothing worth
 * storing — never the raw value, so no query string or path can leak through.
 */
export function sanitizeReferrer(
  raw: unknown,
  selfHost?: string,
): string | null {
  if (typeof raw !== 'string' || raw.trim() === '') return null;

  let host: string;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    // `hostname` (not `host`) drops any port, so the same referrer can't split
    // into "x.com" and "x.com:8080" rows. The WHATWG parser lowercases it.
    host = url.hostname;
  } catch {
    // Not a full URL — accept a bare host (e.g. "news.ycombinator.com").
    const candidate = raw.trim().toLowerCase();
    if (!/^[a-z0-9.-]+(?::\d+)?$/.test(candidate)) return null;
    host = candidate.replace(/:\d+$/, '');
  }

  if (!host || host.length > MAX_REFERRER_LENGTH) return null;
  // Drop internal navigation. Normalise the self-host (strip any port AND lower-
  // case it) so a `Host: site:443` or mixed-case header still matches the
  // always-lowercased referrer host for the same site — otherwise own-site
  // navigation would be logged as an external traffic source.
  if (selfHost && host === selfHost.toLowerCase().replace(/:\d+$/, '')) {
    return null;
  }
  return host;
}

/** One ranked `{ label, views }` row in the dashboard summary. */
export type PageViewRow = { label: string; views: number };

/** Parsed shape of the `portfolio.page_view_summary` RPC result. */
export type PageViewSummary = {
  days: number;
  total: number;
  topPaths: PageViewRow[];
  topReferrers: PageViewRow[];
};

function toRows(value: unknown, key: 'path' | 'referrer'): PageViewRow[] {
  if (!Array.isArray(value)) return [];
  const rows: PageViewRow[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const label = record[key];
    const views = record.views;
    if (typeof label === 'string' && typeof views === 'number') {
      rows.push({ label, views });
    }
  }
  return rows;
}

/**
 * Defensively coerce the JSON returned by `page_view_summary` into a typed
 * summary. The RPC is hand-written SQL, so this tolerates a missing/shape-
 * shifted payload (e.g. before the migration is applied) by returning zeros and
 * empty lists rather than throwing in the dashboard render.
 */
export function parsePageViewSummary(raw: unknown): PageViewSummary {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    days: typeof record.days === 'number' ? record.days : 0,
    total: typeof record.total === 'number' ? record.total : 0,
    topPaths: toRows(record.top_paths, 'path'),
    topReferrers: toRows(record.top_referrers, 'referrer'),
  };
}
