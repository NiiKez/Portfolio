import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TrafficChart } from '@/components/admin/traffic-chart';
import type { DailyViews } from '@/lib/analytics';

describe('TrafficChart', () => {
  it('renders nothing for an empty series', () => {
    const { container } = render(<TrafficChart data={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders one bar per data point', () => {
    const data: DailyViews[] = [
      { date: '2026-06-12', views: 3 },
      { date: '2026-06-13', views: 1 },
      { date: '2026-06-14', views: 7 },
    ];

    const { container } = render(<TrafficChart data={data} />);

    expect(container.querySelectorAll('rect')).toHaveLength(3);
  });

  it('gives each bar a native <title> tooltip with a humanized, pluralized label', () => {
    const data: DailyViews[] = [
      { date: '2026-06-13', views: 1 },
      { date: '2026-06-14', views: 7 },
    ];

    const { container } = render(<TrafficChart data={data} />);

    // Each shape carries its own <title> child (a per-bar native tooltip).
    const titles = Array.from(container.querySelectorAll('rect > title')).map(
      (t) => t.textContent,
    );
    // Singular for exactly one view, plural otherwise; date formatted in UTC.
    expect(titles).toEqual(['Jun 13: 1 view', 'Jun 14: 7 views']);
  });

  it('renders first and last date captions for a multi-day series', () => {
    const data: DailyViews[] = [
      { date: '2026-06-01', views: 2 },
      { date: '2026-06-02', views: 4 },
      { date: '2026-06-03', views: 6 },
    ];

    render(<TrafficChart data={data} />);

    expect(screen.getByText('Jun 1')).toBeInTheDocument();
    expect(screen.getByText('Jun 3')).toBeInTheDocument();
  });

  it('omits the caption for a single-day series', () => {
    const { container } = render(
      <TrafficChart data={[{ date: '2026-06-14', views: 5 }]} />,
    );

    expect(container.querySelector('figcaption')).toBeNull();
    expect(container.querySelectorAll('rect')).toHaveLength(1);
  });

  it('does not throw on an all-zero series and still renders every bar flat', () => {
    const data: DailyViews[] = [
      { date: '2026-06-12', views: 0 },
      { date: '2026-06-13', views: 0 },
    ];

    const { container } = render(<TrafficChart data={data} />);

    const bars = container.querySelectorAll('rect');
    expect(bars).toHaveLength(2);
    // All-zero days collapse to a flat baseline (height 0), never NaN.
    bars.forEach((bar) => {
      expect(bar.getAttribute('height')).toBe('0');
    });
  });
});
