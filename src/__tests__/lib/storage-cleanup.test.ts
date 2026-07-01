import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { logger } from '@/lib/logger';
import { logStorageCleanupFailure } from '@/lib/storage-cleanup';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logStorageCleanupFailure', () => {
  it('returns a handler that logs at warn and resolves to undefined (best-effort)', () => {
    const handler = logStorageCleanupFailure('videos.set', { projectId: 'p1' });

    const result = handler(new Error('storage 500'));

    expect(result).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'videos.set: orphaned storage cleanup failed',
      expect.objectContaining({
        projectId: 'p1',
        err: expect.objectContaining({ message: 'storage 500' }),
      }),
    );
  });

  it('works as a real Promise .catch() handler without rethrowing', async () => {
    const handler = logStorageCleanupFailure('screenshots.delete');

    // A rejected removal piped through the handler must settle, not reject.
    await expect(
      Promise.reject(new Error('boom')).catch(handler),
    ).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
