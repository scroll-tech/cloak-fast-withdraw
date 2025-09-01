import winston, { format } from 'winston';

export default winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: format.combine(
    format.colorize(),
    format.timestamp(),
    format.printf(
      ({ timestamp, level, module, message }) =>
        `[${timestamp}] ${level}${module ? ' [' + module + ']' : ''}: ${message}`,
    ),
  ),
  transports: [new winston.transports.Console()],
});
