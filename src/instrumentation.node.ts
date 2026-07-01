import { logger } from '@/lib/logger';
import { serializeError } from '@/lib/serialize-error';

/**
 * Node.js-runtime-only instrumentation side-effects: process-level crash logging
 * and a boot line. Imported dynamically from `register()` in `instrumentation.ts`
 * ONLY when `NEXT_RUNTIME === 'nodejs'`, so the Node-only `process.on` /
 * `process.version` APIs (and winston) never reach the Edge bundle.
 *
 * ES module caching runs this body once per process; the global flag additionally
 * guards against attaching duplicate listeners across dev HMR re-imports.
 */
const REGISTERED = Symbol.for('portfolio.instrumentation.registered');
const globalWithFlag = globalThis as typeof globalThis & {
  [REGISTERED]?: boolean;
};

if (!globalWithFlag[REGISTERED]) {
  globalWithFlag[REGISTERED] = true;

  // A structured breadcrumb before the process dies — without this, a crash loop
  // leaves only Node's default unstructured stderr dump.
  process.on('unhandledRejection', (reason) => {
    logger.error('process: unhandledRejection', {
      err: serializeError(reason),
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('process: uncaughtException', {
      err: serializeError(error),
    });
  });

  // One boot line: confirms the process started and which deploy it is.
  logger.info('process: server started', { node: process.version });
}
