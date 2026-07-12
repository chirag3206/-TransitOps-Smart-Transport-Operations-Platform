/**
 * TransitOps — Winston Logger
 * Structured logging with console + file transports
 */
const { createLogger, format, transports } = require('winston');
const path = require('path');
const env = require('./env');

const { combine, timestamp, printf, colorize, errors, json, splat } = format;

// Custom log format for development (human-readable)
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp, stack }) => {
    if (stack) return `${timestamp} ${level}: ${message}\n${stack}`;
    return `${timestamp} ${level}: ${message}`;
  })
);

// JSON format for production
const prodFormat = combine(
  timestamp(),
  errors({ stack: true }),
  splat(),
  json()
);

const logger = createLogger({
  level: env.isDev ? 'debug' : 'info',
  format: env.isDev ? devFormat : prodFormat,
  defaultMeta: { service: 'transitops-api' },
  transports: [
    new transports.Console(),
  ],
  exitOnError: false,
});

// Production: also write to log files
if (env.isProd) {
  logger.add(new transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    maxsize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
  }));
  logger.add(new transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    maxsize: 10 * 1024 * 1024, // 10MB
    maxFiles: 10,
  }));
}

// Morgan stream for HTTP request logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
