import 'server-only';

import { createLogger, format, transports, type Logger } from 'winston';

// NODE-RUNTIME ONLY. Winston uses Node APIs (`process.stdout`, `os`) and cannot
// run on the Edge runtime, so this module must never enter the middleware import
// chain (`src/middleware.ts` runs on Edge). Keep logging out of middleware and
// its transitive imports; use `console.*` there if ever needed.
const isProd = process.env.NODE_ENV === 'production';

// Tie every prod log line to the deploy it came from (Azure Container Apps sets
// these on the running revision) so a line can be traced to a specific release.
const deployMeta = {
  env: process.env.NODE_ENV,
  ...(process.env.CONTAINER_APP_REVISION && {
    revision: process.env.CONTAINER_APP_REVISION,
  }),
};

const devFormat = format.combine(
  format.colorize(),
  format.timestamp({ format: 'HH:mm:ss' }),
  format.errors({ stack: true }),
  format.splat(),
  format.simple(),
);

const prodFormat = format.combine(
  format.timestamp(),
  format.errors({ stack: true }),
  format.splat(),
  format.json(),
);

export const logger: Logger = createLogger({
  level: isProd ? 'info' : 'debug',
  defaultMeta: { service: 'portfolio', ...deployMeta },
  format: isProd ? prodFormat : devFormat,
  transports: [new transports.Console()],
  // A logging failure must never take the process down.
  exitOnError: false,
});
