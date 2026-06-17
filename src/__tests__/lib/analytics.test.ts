import { describe, expect, it } from 'vitest';

import {
  isTrackablePath,
  parsePageViewSummary,
  sanitizePath,
  sanitizeReferrer,
} from '@/lib/analytics';

describe('isTrackablePath', () => {
  it('accepts public relative paths', () => {
    expect(isTrackablePath('/')).toBe(true);
    expect(isTrackablePath('/projects')).toBe(true);
    expect(isTrackablePath('/projects/abc')).toBe(true);
  });

  it('rejects admin, api, and non-relative paths', () => {
    expect(isTrackablePath('/admin')).toBe(false);
    expect(isTrackablePath('/admin/projects')).toBe(false);
    expect(isTrackablePath('/api/track')).toBe(false);
    expect(isTrackablePath('https://evil.test/')).toBe(false);
    expect(isTrackablePath('projects')).toBe(false);
  });

  it('rejects protocol-relative and backslash-prefixed paths', () => {
    expect(isTrackablePath('//evil.test')).toBe(false);
    expect(isTrackablePath('//evil.test/path')).toBe(false);
    expect(isTrackablePath('/\\evil.test')).toBe(false);
  });
});

describe('sanitizePath', () => {
  it('strips query strings and hashes', () => {
    expect(sanitizePath('/projects?utm=x&id=42')).toBe('/projects');
    expect(sanitizePath('/about#contact')).toBe('/about');
  });

  it('returns the clean path for a plain route', () => {
    expect(sanitizePath('/projects/my-app')).toBe('/projects/my-app');
  });

  it('rejects non-strings, empty, admin/api, and over-long paths', () => {
    expect(sanitizePath(undefined)).toBeNull();
    expect(sanitizePath(42)).toBeNull();
    expect(sanitizePath('')).toBeNull();
    expect(sanitizePath('?just=query')).toBeNull();
    expect(sanitizePath('/admin/projects')).toBeNull();
    expect(sanitizePath('/api/track')).toBeNull();
    expect(sanitizePath('//evil.test')).toBeNull();
    expect(sanitizePath('not-relative')).toBeNull();
    expect(sanitizePath('/' + 'a'.repeat(1024))).toBeNull();
  });

  it('accepts a path exactly at the max-length boundary (1024)', () => {
    const maxPath = '/' + 'a'.repeat(1023); // 1024 chars total
    expect(sanitizePath(maxPath)).toBe(maxPath);
  });
});

describe('sanitizeReferrer', () => {
  it('reduces a full URL to its bare host', () => {
    expect(sanitizeReferrer('https://news.ycombinator.com/item?id=1')).toBe(
      'news.ycombinator.com',
    );
    expect(sanitizeReferrer('http://google.com/')).toBe('google.com');
  });

  it('accepts a bare host string', () => {
    expect(sanitizeReferrer('twitter.com')).toBe('twitter.com');
    expect(sanitizeReferrer('  LinkedIn.com  ')).toBe('linkedin.com');
  });

  it('drops same-host (internal navigation) referrers', () => {
    expect(
      sanitizeReferrer('https://fatihoncu.me/projects', 'fatihoncu.me'),
    ).toBeNull();
    expect(sanitizeReferrer('fatihoncu.me', 'fatihoncu.me')).toBeNull();
  });

  it('rejects empty, non-string, non-http schemes, and garbage hosts', () => {
    expect(sanitizeReferrer('')).toBeNull();
    expect(sanitizeReferrer('   ')).toBeNull();
    expect(sanitizeReferrer(null)).toBeNull();
    expect(sanitizeReferrer('javascript:alert(1)')).toBeNull();
    expect(sanitizeReferrer('mailto:a@b.com')).toBeNull();
    expect(sanitizeReferrer('not a host!!')).toBeNull();
  });

  it('rejects an over-long host', () => {
    expect(sanitizeReferrer('a'.repeat(256) + '.com')).toBeNull();
  });

  it('strips a port so counts do not split on host:port', () => {
    expect(sanitizeReferrer('https://news.ycombinator.com:8080/x')).toBe(
      'news.ycombinator.com',
    );
    // A digit-led host has no valid URL scheme, so it falls to the bare-host
    // branch where the port is stripped too.
    expect(sanitizeReferrer('1.2.3.4:8080')).toBe('1.2.3.4');
  });

  it('drops an internal referrer even when selfHost carries a port', () => {
    expect(
      sanitizeReferrer('https://fatihoncu.me/projects', 'fatihoncu.me:443'),
    ).toBeNull();
  });

  it('drops an internal referrer when selfHost is mixed-case', () => {
    // `url.hostname` is always lowercased, but a proxy may forward a mixed-case
    // Host header; the self-host comparison must be case-insensitive or own-site
    // navigation gets mislabelled as an external referrer.
    expect(
      sanitizeReferrer('https://fatihoncu.me/projects', 'FatihOncu.me'),
    ).toBeNull();
  });
});

describe('parsePageViewSummary', () => {
  it('coerces a well-formed RPC payload', () => {
    const summary = parsePageViewSummary({
      days: 30,
      total: 123,
      top_paths: [
        { path: '/', views: 80 },
        { path: '/projects', views: 43 },
      ],
      top_referrers: [{ referrer: 'google.com', views: 12 }],
    });

    expect(summary).toEqual({
      days: 30,
      total: 123,
      topPaths: [
        { label: '/', views: 80 },
        { label: '/projects', views: 43 },
      ],
      topReferrers: [{ label: 'google.com', views: 12 }],
    });
  });

  it('returns safe zeros/empties for null or malformed input', () => {
    const empty = { days: 0, total: 0, topPaths: [], topReferrers: [] };
    expect(parsePageViewSummary(null)).toEqual(empty);
    expect(parsePageViewSummary(undefined)).toEqual(empty);
    expect(parsePageViewSummary('nope')).toEqual(empty);
    expect(parsePageViewSummary({ total: 'x', top_paths: 'y' })).toEqual(empty);
  });

  it('skips rows with the wrong shape', () => {
    const summary = parsePageViewSummary({
      total: 5,
      top_paths: [
        { path: '/', views: 5 },
        { path: '/x' }, // missing views
        { views: 3 }, // missing path
        null,
        'garbage',
      ],
    });
    expect(summary.topPaths).toEqual([{ label: '/', views: 5 }]);
  });

  it('passes numeric views through as-is without range filtering', () => {
    // The RPC owns the data contract; the parser only checks the JS type, so a
    // (theoretical) negative count is retained rather than dropped or zeroed.
    const summary = parsePageViewSummary({
      total: 3,
      top_paths: [{ path: '/', views: -5 }],
    });
    expect(summary.topPaths).toEqual([{ label: '/', views: -5 }]);
  });
});
