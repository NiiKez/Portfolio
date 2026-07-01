import type { Instrumentation } from 'next';

/**
 * Next.js instrumentation hook. `register()` runs once at server startup (in
 * BOTH the Node.js and Edge runtimes), and `onRequestError` fires for every
 * server-side error Next.js would otherwise reduce to an opaque `digest`.
 *
 * Winston (`@/lib/logger`) is Node-only. Every logger use here is guarded by
 * `process.env.NEXT_RUNTIME === 'nodejs'` and imported dynamically so winston
 * never loads in the Edge runtime. The process-level handlers additionally live
 * in `./instrumentation.node` — a module only imported under that guard — so the
 * Node-only `process.on`/`process.version` APIs never enter the Edge bundle.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}

export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { logger } = await import('@/lib/logger');
  const { serializeError } = await import('@/lib/serialize-error');

  // Server render / route-handler errors surface to the client only as a
  // `digest`; capture the real error here so it is diagnosable. `request.path`
  // is `req.url`, which carries the query string (e.g. the one-time PKCE `code`
  // on a throwing `/auth/callback`) — log only the pathname. Headers/cookies and
  // the request body are never logged.
  const pathname = request.path.split('?')[0];

  logger.error('request: unhandled server error', {
    path: pathname,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    renderSource: context.renderSource,
    err: serializeError(error),
  });
};
