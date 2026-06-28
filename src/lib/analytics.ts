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
 * RFC-4122 UUID shape (any version), matching the `z.uuid()` gate the
 * `/projects/[id]` route applies before it renders — a non-UUID id 404s there,
 * so only this shape is ever a real project-detail page.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The site's fixed set of static public routes (everything else is `/projects/{id}`). */
const STATIC_PUBLIC_ROUTES = new Set(['/', '/about', '/projects']);

// Drop a single trailing slash (except the root) so `/about/` matches `/about`.
function stripTrailingSlash(path: string): string {
  return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
}

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
 * Extract the project id from a `/projects/{uuid}` detail path, or `null` if the
 * path isn't a project-detail route. The ingest uses this to confirm the project
 * actually exists before counting the view, so a probe at a fake or deleted id
 * (e.g. the all-zeros UUID that scanners love) doesn't inflate the numbers.
 */
export function projectIdFromPath(path: string): string | null {
  const normalized = stripTrailingSlash(path);
  if (!normalized.startsWith('/projects/')) return null;
  const id = normalized.slice('/projects/'.length);
  return UUID_RE.test(id) ? id : null;
}

/**
 * Whether a path is one of the site's ACTUAL public routes. The portfolio has a
 * small, fixed route set, so anything outside it — `/cmd_sco`, `/.env`,
 * `/wp-login.php`, and the rest of the automated-scanner probes that hit any
 * public host within minutes of going live — is not a real page view and must
 * not inflate the admin traffic counts.
 *
 * This is a tighter gate than `isTrackablePath` (which only strips admin/api and
 * non-relative junk): a path must match a known route SHAPE. `/projects/{id}`
 * still requires a real UUID, mirroring the route's own `z.uuid()` guard (the
 * page 404s on a non-UUID id). Whether that project actually EXISTS is verified
 * server-side in the ingest — this validates the shape only.
 *
 * NOTE: this is an allowlist. When a new public route is added, list it here (in
 * `STATIC_PUBLIC_ROUTES`) or its views will not be counted.
 */
export function isKnownPublicRoute(path: string): boolean {
  if (!isTrackablePath(path)) return false;
  const normalized = stripTrailingSlash(path);
  return (
    STATIC_PUBLIC_ROUTES.has(normalized) || projectIdFromPath(path) !== null
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

/** One day of the traffic sparkline — an ISO `YYYY-MM-DD` date and its count. */
export type DailyViews = { date: string; views: number };

/** Parsed shape of the `portfolio.page_view_summary` RPC result. */
export type PageViewSummary = {
  days: number;
  total: number;
  previousTotal: number;
  topPaths: PageViewRow[];
  topReferrers: PageViewRow[];
  daily: DailyViews[];
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

// Coerce the RPC's `daily` series the same way `toRows` does its rows: skip any
// entry that isn't a `{ date: string, views: number }` object, preserving the
// (chronological) order the RPC sends. An absent/non-array value is an empty
// series, never a throw.
function toDaily(value: unknown): DailyViews[] {
  if (!Array.isArray(value)) return [];
  const rows: DailyViews[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    const date = record.date;
    const views = record.views;
    if (typeof date === 'string' && typeof views === 'number') {
      rows.push({ date, views });
    }
  }
  return rows;
}

/**
 * Defensively coerce the JSON returned by `page_view_summary` into a typed
 * summary. The RPC is hand-written SQL, so this tolerates a missing/shape-
 * shifted payload (e.g. before the migration is applied) by returning zeros and
 * empty lists rather than throwing in the dashboard render. The `previous_total`
 * and `daily` fields are newer additions, so an older/unmigrated RPC that omits
 * them defaults to `0` / `[]`.
 */
export function parsePageViewSummary(raw: unknown): PageViewSummary {
  const record =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    days: typeof record.days === 'number' ? record.days : 0,
    total: typeof record.total === 'number' ? record.total : 0,
    previousTotal:
      typeof record.previous_total === 'number' ? record.previous_total : 0,
    topPaths: toRows(record.top_paths, 'path'),
    topReferrers: toRows(record.top_referrers, 'referrer'),
    daily: toDaily(record.daily),
  };
}

/** Friendly labels for the site's fixed static routes in the dashboard list. */
const STATIC_PATH_LABELS = new Map<string, string>([
  ['/', 'Home'],
  ['/about', 'About'],
  ['/projects', 'Projects'],
]);

/**
 * Mean page views per day over the window, rounded to one decimal place.
 * Returns `0` for a non-positive day count so an absent/zeroed window can't
 * divide by zero in the dashboard.
 */
export function averagePerDay(summary: {
  total: number;
  days: number;
}): number {
  if (summary.days <= 0) return 0;
  return Math.round((summary.total / summary.days) * 10) / 10;
}

/**
 * The single day with the most views, or `null` when there's nothing to rank —
 * an empty series, or every day sitting at zero. Ties resolve to the earliest
 * day (the first chronological peak wins), since the series arrives in order.
 */
export function busiestDay(daily: DailyViews[]): DailyViews | null {
  let best: DailyViews | null = null;
  for (const day of daily) {
    // Strict `>` keeps the earliest of any tie, and the `> 0` floor means an
    // all-zero series yields `null` rather than a spurious "busiest" day.
    if (day.views > 0 && (best === null || day.views > best.views)) {
      best = day;
    }
  }
  return best;
}

/**
 * Percentage change from the previous equal-length window to the current one,
 * with a direction. Returns `null` when there's no positive baseline to compare
 * against (the UI hides the trend rather than render `Infinity`/`NaN`). `pct` is
 * signed — negative when traffic fell — so callers display `Math.abs(pct)` next
 * to an arrow keyed off `direction`.
 */
export function trafficTrend(
  total: number,
  previousTotal: number,
): { pct: number; direction: 'up' | 'down' | 'flat' } | null {
  if (previousTotal <= 0) return null;
  const pct = Math.round(((total - previousTotal) / previousTotal) * 100);
  const direction =
    total === previousTotal ? 'flat' : total > previousTotal ? 'up' : 'down';
  return { pct, direction };
}

/**
 * Turn a stored pathname into a human label for the dashboard's "Top pages"
 * list. The fixed routes get friendly names; a `/projects/{uuid}` path resolves
 * to the project title when known, and otherwise stays raw so an unknown/probe
 * id is visibly distinct rather than silently relabelled. A single trailing
 * slash is normalised the same way the tracking helpers do.
 */
export function humanizePath(
  path: string,
  projectTitles: Map<string, string>,
): string {
  const staticLabel = STATIC_PATH_LABELS.get(stripTrailingSlash(path));
  if (staticLabel) return staticLabel;
  const id = projectIdFromPath(path);
  if (id) return projectTitles.get(id) ?? path;
  return path;
}

/**
 * A Google S2 favicon URL for a referrer host, used to brand the dashboard's
 * "Top sources" rows. The host is encoded so it can't break out of the query
 * string.
 */
export function faviconUrl(host: string): string {
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=32`;
}
