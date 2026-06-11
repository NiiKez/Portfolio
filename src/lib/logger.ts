import 'server-only';

import { createLogger, format, transports, type Logger } from 'winston';

const isProd = process.env.NODE_ENV === 'production';

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
  defaultMeta: { service: 'portfolio' },
  format: isProd ? prodFormat : devFormat,
  transports: [new transports.Console()],
});
