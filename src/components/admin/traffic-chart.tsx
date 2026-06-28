import type { ReactNode } from 'react';

import type { DailyViews } from '@/lib/analytics';

// All geometry is expressed in viewBox units; the SVG is stretched to fill its
// container width (`preserveAspectRatio="none"`) so the chart is responsive
// regardless of how many days it spans, while the height stays a fixed ~72px.
const BAR_AREA = 60; // drawing-area height (bars grow up from the baseline)
const SLOT = 6; // horizontal units allotted to each day
const BAR_W = 4; // bar width within its slot (1u of gutter on each side)
const MIN_BAR = 2; // minimum visible height so a non-zero day never vanishes

/** Format an ISO `YYYY-MM-DD` as e.g. "Jun 14" in UTC (date-only, no TZ drift). */
function formatDay(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * A compact, dependency-free daily page-views bar chart. Pure inline SVG so it
 * renders as a server component (no client JS) — hover brightening is plain CSS.
 * Returns `null` for an empty series; the parent owns the empty-state copy.
 */
export function TrafficChart({ data }: { data: DailyViews[] }): ReactNode {
  if (data.length === 0) return null;

  const max = data.reduce((m, d) => (d.views > m ? d.views : m), 0);
  const vbWidth = data.length * SLOT;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${vbWidth} ${BAR_AREA}`}
        width="100%"
        height={72}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Daily page views over the last ${data.length} days`}
        className="block w-full text-primary"
      >
        {/* Faint baseline so an all-zero series still reads as a flat axis. */}
        <line
          x1={0}
          y1={BAR_AREA}
          x2={vbWidth}
          y2={BAR_AREA}
          className="stroke-border"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
        {data.map((d, i) => {
          // Guard against divide-by-zero on an all-zero series (max === 0).
          const height =
            max > 0 && d.views > 0
              ? Math.max((d.views / max) * BAR_AREA, MIN_BAR)
              : 0;
          const label = `${formatDay(d.date)}: ${d.views} ${
            d.views === 1 ? 'view' : 'views'
          }`;
          return (
            <g
              key={d.date}
              className="fill-primary opacity-[0.55] transition-opacity duration-150 hover:opacity-100"
            >
              <rect
                x={i * SLOT + (SLOT - BAR_W) / 2}
                y={BAR_AREA - height}
                width={BAR_W}
                height={height}
                rx={1.25}
              >
                <title>{label}</title>
              </rect>
            </g>
          );
        })}
      </svg>

      {data.length > 1 && (
        <figcaption className="mt-2 flex justify-between text-xs tabular-nums text-muted-foreground">
          <span>{formatDay(data[0]!.date)}</span>
          <span>{formatDay(data[data.length - 1]!.date)}</span>
        </figcaption>
      )}
    </figure>
  );
}
