import winston, { format } from 'winston';

import { config } from './config';

export default winston.createLogger({
  level: config.logLevel,
  format: format.combine(
    format.splat(),
    format.colorize(),
    format.timestamp(),
    format.printf(
      ({ timestamp, level, module, message }) =>
        `[${timestamp}] ${level}${module ? ' [' + module + ']' : ''}: ${message}`,
    ),
  ),
  transports: [new winston.transports.Console()],
});
