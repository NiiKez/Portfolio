import 'server-only';

import { logger } from '@/lib/logger';
import { serializeError } from '@/lib/serialize-error';

/**
 * Builds a `.catch()` handler for a best-effort storage cleanup (removing an
 * orphaned upload after a compensating failure, or an old file after a swap).
 *
 * These removals must never fail the action — an orphaned object is far less
 * harmful than a broken write — but until now a failed cleanup was swallowed
 * with `.catch(() => undefined)`, so leaked objects (which count against the
 * bucket quota) accumulated with no trace. This keeps the failure best-effort
 * (it never rethrows) while making it observable at `warn`.
 *
 * Usage: `await storage.from(bucket).remove(paths).catch(logStorageCleanupFailure('videos.set', { projectId }))`
 */
export function logStorageCleanupFailure(
  context: string,
  meta?: Record<string, unknown>,
) {
  return (error: unknown): undefined => {
    logger.warn(`${context}: orphaned storage cleanup failed`, {
      ...meta,
      err: serializeError(error),
    });
    return undefined;
  };
}
