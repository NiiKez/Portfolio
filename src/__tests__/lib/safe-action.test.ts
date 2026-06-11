import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    ADMIN_EMAIL: 'admin@example.com',
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

const authGetUser = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: authGetUser },
  })),
}));

import { logger } from '@/lib/logger';
import { safeAction } from '@/lib/safe-action';

const schema = z.object({ title: z.string().min(1) });

const adminUser = { id: 'admin-uid', email: 'admin@example.com' };

beforeEach(() => {
  vi.clearAllMocks();
  authGetUser.mockResolvedValue({ data: { user: adminUser } });
});

describe('safeAction auth', () => {
  it('returns Unauthorized and does not call the handler when there is no user', async () => {
    authGetUser.mockResolvedValue({ data: { user: null } });
    const handler = vi.fn();
    const action = safeAction({ name: 'test', schema, handler });

    const result = await action({ title: 'hello' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(handler).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('returns Unauthorized when the user email is wrong', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'x', email: 'intruder@example.com' } },
    });
    const handler = vi.fn();
    const action = safeAction({ name: 'test', schema, handler });

    const result = await action({ title: 'hello' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(handler).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('returns Unauthorized when the user email is undefined', async () => {
    authGetUser.mockResolvedValue({
      data: { user: { id: 'x', email: undefined } },
    });
    const handler = vi.fn();
    const action = safeAction({ name: 'test', schema, handler });

    const result = await action({ title: 'hello' });

    expect(result).toEqual({ success: false, error: 'Unauthorized' });
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('safeAction validation', () => {
  it('returns a formatted "field: message" error and does not call the handler on invalid input', async () => {
    const handler = vi.fn();
    const action = safeAction({ name: 'test', schema, handler });

    const result = await action({ title: '' });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('title:');
    }
    expect(handler).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledTimes(1);
  });

  it('returns the bare message when the zod issue has no path', async () => {
    // A top-level (non-object) schema produces an issue with an empty path.
    const rootSchema = z.string().min(1);
    const handler = vi.fn();
    const action = safeAction({ name: 'root', schema: rootSchema, handler });

    const result = await action('');

    expect(result.success).toBe(false);
    if (!result.success) {
      // No path prefix (e.g. "title: ...") is prepended; the bare zod issue
      // message is returned verbatim because the issue path is empty.
      const raw = rootSchema.safeParse('');
      expect(raw.success).toBe(false);
      if (!raw.success) {
        expect(result.error).toBe(raw.error.issues[0]!.message);
      }
      expect(result.error).not.toMatch(/^\w+:\s/);
      expect(result.error.length).toBeGreaterThan(0);
    }
    expect(handler).not.toHaveBeenCalled();
  });
});

describe('safeAction success', () => {
  it('runs the handler with parsed data + {user} and returns actionSuccess', async () => {
    const handler = vi.fn(async () => ({ ok: true }));
    const action = safeAction({ name: 'test', schema, handler });

    const result = await action({ title: 'hello' });

    expect(result).toEqual({ success: true, data: { ok: true } });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(
      { title: 'hello' },
      { user: adminUser },
    );
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });
});

describe('safeAction error handling', () => {
  it('returns a generic error and logs when the handler throws', async () => {
    const handler = vi.fn(async () => {
      throw new Error('boom');
    });
    const action = safeAction({ name: 'test', schema, handler });

    const result = await action({ title: 'hello' });

    expect(result).toEqual({
      success: false,
      error: 'Something went wrong. Please try again.',
    });
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('returns a generic error and logs when getUser itself rejects', async () => {
    authGetUser.mockRejectedValue(new Error('network down'));
    const handler = vi.fn();
    const action = safeAction({ name: 'test', schema, handler });

    const result = await action({ title: 'hello' });

    expect(result).toEqual({
      success: false,
      error: 'Something went wrong. Please try again.',
    });
    expect(handler).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(1);
  });
});
