import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { isSameOrigin } from '@/lib/same-origin';

function requestWith(headers: Record<string, string>) {
  const request = new NextRequest('http://site.test/api/x', { method: 'POST' });
  // `origin`/`host` are forbidden headers on the constructor — set after build.
  for (const [name, value] of Object.entries(headers)) {
    request.headers.set(name, value);
  }
  return request;
}

describe('isSameOrigin', () => {
  it('accepts a matching Origin and Host', () => {
    expect(
      isSameOrigin(
        requestWith({ origin: 'https://site.test', host: 'site.test' }),
      ),
    ).toBe(true);
  });

  it('tolerates a port on Host against a port-less Origin (proxy Host: site:443)', () => {
    expect(
      isSameOrigin(
        requestWith({ origin: 'https://site.test', host: 'site.test:443' }),
      ),
    ).toBe(true);
  });

  it('is case-insensitive on the host', () => {
    expect(
      isSameOrigin(
        requestWith({ origin: 'https://Site.Test', host: 'site.test' }),
      ),
    ).toBe(true);
  });

  it('rejects a cross-site Origin', () => {
    expect(
      isSameOrigin(
        requestWith({ origin: 'https://evil.example', host: 'site.test' }),
      ),
    ).toBe(false);
  });

  it('rejects a missing Origin', () => {
    expect(isSameOrigin(requestWith({ host: 'site.test' }))).toBe(false);
  });

  it('rejects the literal opaque Origin "null" WITHOUT throwing (no 500 oracle)', () => {
    // Sandboxed iframes / data: documents send `Origin: null`. `new URL('null')`
    // throws — this must be swallowed into a clean false, not surface as a 500.
    expect(() =>
      isSameOrigin(requestWith({ origin: 'null', host: 'site.test' })),
    ).not.toThrow();
    expect(
      isSameOrigin(requestWith({ origin: 'null', host: 'site.test' })),
    ).toBe(false);
  });

  it('rejects a malformed Origin without throwing', () => {
    expect(
      isSameOrigin(requestWith({ origin: ')(*&^', host: 'site.test' })),
    ).toBe(false);
  });
});
