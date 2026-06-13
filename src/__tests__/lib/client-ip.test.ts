import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { getClientIp } from '@/lib/client-ip';

function makeRequest(headers: Record<string, string> = {}) {
  const request = new NextRequest('http://localhost:3000/api/auth/send-otp');
  for (const [name, value] of Object.entries(headers)) {
    request.headers.set(name, value);
  }
  return request;
}

describe('getClientIp', () => {
  it('prefers x-real-ip (the value set by the trusted proxy)', () => {
    const ip = getClientIp(
      makeRequest({
        'x-real-ip': '203.0.113.7',
        // A forged, attacker-controlled forwarded chain must be ignored.
        'x-forwarded-for': '1.2.3.4, 5.6.7.8',
      }),
    );

    expect(ip).toBe('203.0.113.7');
  });

  it('falls back to the rightmost x-forwarded-for entry when x-real-ip is absent', () => {
    // Leftmost (9.9.9.9) is client-spoofable; the trusted proxy appends the real
    // peer (10.0.0.1) on the right, so that is the value we key on.
    const ip = getClientIp(
      makeRequest({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }),
    );

    expect(ip).toBe('10.0.0.1');
  });

  it('uses the single x-forwarded-for entry when there is only one', () => {
    const ip = getClientIp(makeRequest({ 'x-forwarded-for': '198.51.100.2' }));

    expect(ip).toBe('198.51.100.2');
  });

  it('takes the rightmost (trusted-hop) entry from a 3-entry forwarded chain', () => {
    // With one trusted proxy in front, only the RIGHTMOST entry is trustworthy:
    // it is the peer our proxy actually saw. Everything to its left (here a
    // spoofed value and the real client) is client-appendable and must be
    // ignored — pinning the single-trusted-proxy assumption.
    const ip = getClientIp(
      makeRequest({
        'x-forwarded-for': '203.0.113.1, 198.51.100.5, 10.0.0.9',
      }),
    );

    expect(ip).toBe('10.0.0.9');
  });

  it('ignores a blank x-real-ip and uses x-forwarded-for instead', () => {
    const ip = getClientIp(
      makeRequest({
        'x-real-ip': '   ',
        'x-forwarded-for': '198.51.100.9',
      }),
    );

    expect(ip).toBe('198.51.100.9');
  });

  it('returns "unknown" when x-forwarded-for has no usable entries', () => {
    const ip = getClientIp(makeRequest({ 'x-forwarded-for': ' , , ' }));

    expect(ip).toBe('unknown');
  });

  it('returns "unknown" when neither header is present', () => {
    expect(getClientIp(makeRequest())).toBe('unknown');
  });
});
