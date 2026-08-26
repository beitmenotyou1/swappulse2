/**
 * Structured Logger
 *
 * Provides consistent, structured logging across all SwapPulse services.
 * Logs are output as JSON to stdout for easy parsing by log aggregators.
 *
 * Log Levels (in order of severity):
 * - debug:   Detailed diagnostic information
 * - info:    General operational information
 * - warn:    Something unexpected happened but the system continued
 * - error:   A failure occurred, may require intervention
 *
 * @author SwapPulse
 * @version 1.0.0
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  data?: Record<string, any>;
  duration_ms?: number;
  error?: string;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LOG_LEVEL: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

class Logger {
  private service: string;
  private minLevel: number;

  constructor(service: string, minLevel: LogLevel = MIN_LOG_LEVEL) {
    this.service = service;
    this.minLevel = LOG_LEVELS[minLevel];
  }

  private log(level: LogLevel, message: string, data?: Record<string, any>): void {
    if (LOG_LEVELS[level] < this.minLevel) return;

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service: this.service,
      message,
    };

    if (data) entry.data = data;

    const output = JSON.stringify(entry);

    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }

  debug(message: string, data?: Record<string, any>): void {
    this.log('debug', message, data);
  }

  info(message: string, data?: Record<string, any>): void {
    this.log('info', message, data);
  }

  warn(message: string, data?: Record<string, any>): void {
    this.log('warn', message, data);
  }

  error(message: string, error?: Error | unknown, data?: Record<string, any>): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: this.service,
      message,
    };

    if (data) entry.data = data;

    if (error instanceof Error) {
      entry.error = error.message;
      entry.data = { ...entry.data, stack: error.stack };
    } else if (error) {
      entry.error = String(error);
    }

    console.error(JSON.stringify(entry));
  }

  /**
   * Creates a child logger with additional context.
   * Useful for adding a sync_id or job_id to all log entries.
   */
  child(context: Record<string, any>): Logger {
    const childLogger = new Logger(this.service, MIN_LOG_LEVEL);
    const parentLog = childLogger.log.bind(childLogger);

    childLogger.log = (level: LogLevel, message: string, data?: Record<string, any>) => {
      parentLog(level, message, { ...context, ...data });
    };

    return childLogger;
  }

  /**
   * Wraps an async function and logs its duration.
   */
  async timed<T>(
    message: string,
    fn: () => Promise<T>,
    data?: Record<string, any>,
  ): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const duration = Date.now() - start;
      this.debug(`${message} (completed)`, { ...data, duration_ms: duration });
      return result;
    } catch (error) {
      const duration = Date.now() - start;
      this.error(`${message} (failed)`, error, { ...data, duration_ms: duration });
      throw error;
    }
  }
}

/**
 * Creates a logger for a specific service.
 *
 * @param service Service name (e.g., 'catalog-sync', 'pricing-sync')
 * @returns Logger instance
 */
export function createLogger(service: string): Logger {
  return new Logger(service);
}

export default Logger;