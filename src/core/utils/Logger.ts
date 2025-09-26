import winston from 'winston';

// Define log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Define log context interface for structured logging
export interface LogContext {
  [key: string]: any;
}

// Define logger configuration interface
export interface LoggerConfig {
  level: LogLevel;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logDir?: string;
  environment: 'development' | 'production' | 'test';
}

// Create custom format for development (human-readable)
const developmentFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const context = Object.keys(meta).length > 0 ? ` | ${JSON.stringify(meta)}` : '';
    return `${timestamp} [${level}]: ${message}${context}`;
  }),
);

// Create custom format for production (structured JSON)
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.json(),
  winston.format.metadata({
    fillExcept: ['message', 'level', 'timestamp'],
  }),
);

// Create file transport
const createFileTransport = (logDir: string, level: LogLevel) => {
  return new winston.transports.File({
    filename: `${logDir}/memori-${level}.log`,
    level,
    format: productionFormat,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  });
};

// Create console transport
const createConsoleTransport = (format: winston.Logform.Format) => {
  return new winston.transports.Console({
    format,
    level: 'debug', // Always show debug and above on console
  });
};

/**
 * Simple, KISS-compliant Winston Logger implementation
 * Optimized for developer experience with type safety and intuitive API
 */
export class Logger {
  private logger: winston.Logger;
  private config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = {
      level: 'info',
      enableFileLogging: true,
      enableConsoleLogging: true,
      logDir: './logs',
      environment: 'development',
      ...config,
    };

    // Create transports based on configuration
    const transports: winston.transport[] = [];

    if (this.config.enableConsoleLogging && this.config.environment !== 'test') {
      const format = this.config.environment === 'production' ? productionFormat : developmentFormat;
      transports.push(createConsoleTransport(format));
    }

    if (this.config.enableFileLogging && this.config.environment !== 'test') {
      // Create file transports for different levels
      ['error', 'warn', 'info', 'debug'].forEach((level) => {
        if (level <= this.config.level) {
          transports.push(createFileTransport(this.config.logDir!, level as LogLevel));
        }
      });
    }

    this.logger = winston.createLogger({
      level: this.config.level,
      transports,
      exitOnError: false,
    });
  }

  /**
   * Log error message
   */
  error(message: string, context?: LogContext): void {
    // In test environment, silently consume logs to avoid console output
    if (this.config.environment === 'test') {
      return;
    }
    this.logger.error(message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    // In test environment, silently consume logs to avoid console output
    if (this.config.environment === 'test') {
      return;
    }
    this.logger.warn(message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    // In test environment, silently consume logs to avoid console output
    if (this.config.environment === 'test') {
      return;
    }
    this.logger.info(message, context);
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    // In test environment, silently consume logs to avoid console output
    if (this.config.environment === 'test') {
      return;
    }
    this.logger.debug(message, context);
  }

  /**
   * Create a child logger with predefined context
   */
  child(context: LogContext): Logger {
    const childLogger = this.logger.child(context);
    const childInstance = new (Logger as any)();
    childInstance.logger = childLogger;
    childInstance.config = this.config;
    return childInstance;
  }

  /**
   * Update logger configuration
   */
  updateConfig(newConfig: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Recreate logger with new configuration
    const transports: winston.transport[] = [];

    if (this.config.enableConsoleLogging && this.config.environment !== 'test') {
      const format = this.config.environment === 'production' ? productionFormat : developmentFormat;
      transports.push(createConsoleTransport(format));
    }

    if (this.config.enableFileLogging && this.config.environment !== 'test') {
      ['error', 'warn', 'info', 'debug'].forEach((level) => {
        if (level <= this.config.level) {
          transports.push(createFileTransport(this.config.logDir!, level as LogLevel));
        }
      });
    }

    this.logger.configure({
      level: this.config.level,
      transports,
    });
  }
}

// Default logger instance
export const logger = new Logger({
  environment: process.env.NODE_ENV === 'test' ? 'test' : 'development',
  enableConsoleLogging: process.env.NODE_ENV !== 'test',
});

// Convenience functions for backward compatibility and easier usage
export const logError = (message: string, context?: LogContext) => logger.error(message, context);
export const logWarn = (message: string, context?: LogContext) => logger.warn(message, context);
export const logInfo = (message: string, context?: LogContext) => logger.info(message, context);
export const logDebug = (message: string, context?: LogContext) => logger.debug(message, context);

// Create specialized loggers for different components
export const createComponentLogger = (componentName: string, context?: LogContext): Logger => {
  return logger.child({ component: componentName, ...context });
};