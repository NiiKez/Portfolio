import Link from 'next/link';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** One row in a {@link RankedList} — a `label → views` entry with optional trim. */
export type RankedListItem = {
  label: string;
  views: number;
  /** Optional muted secondary line (e.g. the raw path under a humanized title). */
  sub?: string;
  /** Optional href; wraps the label in a link (Next `Link` for internal paths). */
  href?: string;
  /** Optional 16px favicon rendered before the label (used for referrers). */
  iconUrl?: string;
};

/** Show at most this many rows; the caller pre-sorts by views. */
const MAX_ROWS = 8;

function isExternalHref(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

/**
 * A ranked `label → views` list rendered as a mini bar chart (Plausible/Fathom
 * style): each row carries a thin proportion bar whose fill width tracks its
 * share of the busiest entry. Server component — no client JS. Used for both
 * "Top pages" and "Top referrers".
 *
 * `maxViews` lets several lists share one scale; when omitted each list scales
 * to its own busiest row.
 */
export function RankedList({
  items,
  maxViews,
}: {
  items: RankedListItem[];
  maxViews?: number;
}): ReactNode {
  const rows = items.slice(0, MAX_ROWS);
  const max = maxViews ?? rows.reduce((m, r) => (r.views > m ? r.views : m), 0);

  return (
    <ul className="space-y-3">
      {rows.map((item, idx) => {
        // Guard against divide-by-zero on an empty / all-zero series.
        const pct = max > 0 ? Math.min((item.views / max) * 100, 100) : 0;

        const labelClass = 'block truncate text-foreground';
        let label: ReactNode;
        if (item.href && isExternalHref(item.href)) {
          label = (
            <a
              href={item.href}
              target="_blank"
              rel="noreferrer noopener"
              className={cn(labelClass, 'hover:underline')}
            >
              {item.label}
            </a>
          );
        } else if (item.href) {
          label = (
            <Link
              href={item.href}
              className={cn(labelClass, 'hover:underline')}
            >
              {item.label}
            </Link>
          );
        } else {
          label = <span className={labelClass}>{item.label}</span>;
        }

        return (
          <li key={`${item.label}-${idx}`} className="text-sm">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-2">
                {item.iconUrl && (
                  // A bare favicon (16px, external host) needs no next/image.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.iconUrl}
                    width={16}
                    height={16}
                    loading="lazy"
                    alt=""
                    className="size-4 shrink-0 rounded-sm"
                  />
                )}
                <div className="min-w-0">
                  {label}
                  {item.sub && (
                    <p
                      className={cn(
                        'truncate text-xs text-muted-foreground',
                        // A path-like sub reads better monospaced.
                        item.sub.startsWith('/') && 'font-mono',
                      )}
                    >
                      {item.sub}
                    </p>
                  )}
                </div>
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {item.views.toLocaleString()}
              </span>
            </div>

            {/* Proportion bar — a muted track with a primary-tinted fill. */}
            <div
              className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-foreground/5"
              aria-hidden
            >
              <div
                className="h-full rounded-full bg-primary/40"
                style={{ width: `${pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
