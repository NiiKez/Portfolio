import { describe, expect, it, vi } from 'vitest';

// Configure a deliberately MIXED-CASE + padded admin email so the assertions
// prove BOTH sides of the comparison are normalized, not just the input.
vi.mock('@/lib/env', () => ({
  env: { ADMIN_EMAIL: '  Admin@Example.COM  ' },
}));

import { isAdminEmail } from '@/lib/admin-email';

describe('isAdminEmail', () => {
  it('matches the exact configured email', () => {
    expect(isAdminEmail('Admin@Example.COM')).toBe(true);
  });

  it('matches case-insensitively (env is mixed-case, input is lowercase)', () => {
    expect(isAdminEmail('admin@example.com')).toBe(true);
  });

  it('matches case-insensitively (input is upper-case)', () => {
    expect(isAdminEmail('ADMIN@EXAMPLE.COM')).toBe(true);
  });

  it('tolerates surrounding whitespace on the input', () => {
    expect(isAdminEmail('   admin@example.com   ')).toBe(true);
  });

  it('rejects a different email', () => {
    expect(isAdminEmail('intruder@example.com')).toBe(false);
  });

  it('rejects an email that only differs in the local part', () => {
    expect(isAdminEmail('admin2@example.com')).toBe(false);
  });

  it.each([null, undefined, ''])('rejects falsy input %s', (value) => {
    expect(isAdminEmail(value)).toBe(false);
  });
});
