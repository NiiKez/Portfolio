import { render, cleanup } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pathnameMock = vi.fn(() => '/projects');
vi.mock('next/navigation', () => ({
  usePathname: () => pathnameMock(),
}));

import { PageViewTracker } from '@/components/page-view-tracker';

const sendBeaconMock =
  vi.fn<(url: string | URL, data?: BodyInit | null) => boolean>();

beforeEach(() => {
  vi.clearAllMocks();
  pathnameMock.mockReturnValue('/projects');
  Object.defineProperty(navigator, 'sendBeacon', {
    value: sendBeaconMock,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document, 'referrer', {
    value: '',
    configurable: true,
  });
});

afterEach(() => {
  cleanup();
});

async function readBeaconBody(blob: unknown): Promise<Record<string, unknown>> {
  const text = await (blob as Blob).text();
  return JSON.parse(text);
}

describe('PageViewTracker', () => {
  it('beacons the current path to /api/track on mount', async () => {
    render(<PageViewTracker />);

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
    const [endpoint, blob] = sendBeaconMock.mock.calls[0]!;
    expect(endpoint).toBe('/api/track');
    expect(await readBeaconBody(blob)).toEqual({ path: '/projects' });
  });

  it('includes document.referrer when present', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://news.ycombinator.com/',
      configurable: true,
    });

    render(<PageViewTracker />);

    const [, blob] = sendBeaconMock.mock.calls[0]!;
    expect(await readBeaconBody(blob)).toEqual({
      path: '/projects',
      referrer: 'https://news.ycombinator.com/',
    });
  });

  it('does not track admin routes', () => {
    pathnameMock.mockReturnValue('/admin/projects');

    render(<PageViewTracker />);

    expect(sendBeaconMock).not.toHaveBeenCalled();
  });

  it('does not re-beacon when re-rendered on the same path', () => {
    const { rerender } = render(<PageViewTracker />);
    rerender(<PageViewTracker />);

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
  });

  it('beacons again with the new path on client-side navigation', async () => {
    const { rerender } = render(<PageViewTracker />);

    pathnameMock.mockReturnValue('/about');
    rerender(<PageViewTracker />);

    expect(sendBeaconMock).toHaveBeenCalledTimes(2);
    expect(await readBeaconBody(sendBeaconMock.mock.calls[1]![1])).toEqual({
      path: '/about',
    });
  });

  it('attaches the referrer only to the first beacon, not later navigations', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://news.ycombinator.com/',
      configurable: true,
    });

    const { rerender } = render(<PageViewTracker />);
    pathnameMock.mockReturnValue('/about');
    rerender(<PageViewTracker />);

    expect(sendBeaconMock).toHaveBeenCalledTimes(2);
    // First page view carries the external entry referrer...
    expect(await readBeaconBody(sendBeaconMock.mock.calls[0]![1])).toEqual({
      path: '/projects',
      referrer: 'https://news.ycombinator.com/',
    });
    // ...the in-app navigation does NOT (document.referrer is now stale).
    expect(await readBeaconBody(sendBeaconMock.mock.calls[1]![1])).toEqual({
      path: '/about',
    });
  });

  it('dedupes the Strict Mode double-invoked mount effect (one beacon)', () => {
    render(
      <StrictMode>
        <PageViewTracker />
      </StrictMode>,
    );

    expect(sendBeaconMock).toHaveBeenCalledTimes(1);
  });

  it('swallows a rejected keepalive fetch without throwing', () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);

    expect(() => render(<PageViewTracker />)).not.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.unstubAllGlobals();
  });

  it('falls back to a keepalive fetch when sendBeacon is unavailable', async () => {
    Object.defineProperty(navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
      writable: true,
    });
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null));
    vi.stubGlobal('fetch', fetchMock);

    render(<PageViewTracker />);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [endpoint, init] = fetchMock.mock.calls[0]!;
    expect(endpoint).toBe('/api/track');
    expect(init!.method).toBe('POST');
    expect(init!.keepalive).toBe(true);
    expect(JSON.parse(init!.body as string)).toEqual({ path: '/projects' });

    vi.unstubAllGlobals();
  });
});
