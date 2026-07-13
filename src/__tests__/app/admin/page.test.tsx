import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The dashboard is an async server component. Mock the Supabase server client so
// the three count queries resolve and the analytics RPC returns a controllable
// payload; the Traffic card render branches are the focus here.
const fromMock = vi.fn(() => ({
  select: vi.fn(() => Promise.resolve({ count: 3 })),
}));
const rpcMock = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: fromMock, rpc: rpcMock })),
}));

vi.mock('@/lib/profile', () => ({ profile: { name: 'Test Admin' } }));

import AdminDashboardPage from '@/app/admin/(dashboard)/page';

beforeEach(() => {
  vi.clearAllMocks();
});

async function renderWith(data: unknown) {
  rpcMock.mockResolvedValue({ data });
  render(await AdminDashboardPage());
}

function totalParagraph() {
  return screen.getByText('page views').closest('p');
}

describe('AdminDashboardPage — Traffic card', () => {
  it('shows the empty state when there are no page views', async () => {
    await renderWith({ days: 30, total: 0, top_paths: [], top_referrers: [] });

    expect(screen.getByText('Traffic')).toBeVisible();
    expect(screen.getByText('Last 30 days')).toBeVisible();
    expect(totalParagraph()).toHaveTextContent('0');
    expect(screen.getByText('No page views recorded yet.')).toBeVisible();
    expect(screen.queryByText('Top pages')).not.toBeInTheDocument();
  });

  it('renders the total, top pages, and top referrers when populated', async () => {
    await renderWith({
      days: 30,
      total: 142,
      top_paths: [
        { path: '/', views: 100 },
        { path: '/projects', views: 42 },
      ],
      top_referrers: [{ referrer: 'news.ycombinator.com', views: 12 }],
    });

    expect(totalParagraph()).toHaveTextContent('142');
    expect(screen.getByText('Top pages')).toBeVisible();
    expect(screen.getByText('/projects')).toBeVisible();
    expect(screen.getByText('Top referrers')).toBeVisible();
    expect(screen.getByText('news.ycombinator.com')).toBeVisible();
    expect(
      screen.queryByText('No page views recorded yet.'),
    ).not.toBeInTheDocument();
  });

  it('shows a no-referrers note when there are paths but no referrers', async () => {
    await renderWith({
      days: 30,
      total: 5,
      top_paths: [{ path: '/', views: 5 }],
      top_referrers: [],
    });

    expect(screen.getByText('Top pages')).toBeVisible();
    expect(screen.getByText('No external referrers yet.')).toBeVisible();
  });

  it('caps the top-pages list at 8 rows', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      path: `/p${i}`,
      views: 12 - i,
    }));
    await renderWith({
      days: 30,
      total: 78,
      top_paths: many,
      top_referrers: [],
    });

    expect(screen.getByText('/p0')).toBeVisible();
    expect(screen.getByText('/p7')).toBeVisible();
    expect(screen.queryByText('/p8')).not.toBeInTheDocument();
  });

  it('degrades to zeros when the RPC returns no data (pre-migration)', async () => {
    await renderWith(null);

    expect(screen.getByText('Last 30 days')).toBeVisible();
    expect(totalParagraph()).toHaveTextContent('0');
    expect(screen.getByText('No page views recorded yet.')).toBeVisible();
  });
});
