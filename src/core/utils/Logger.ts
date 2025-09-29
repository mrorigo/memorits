import winston from 'winston';

// Define log levels
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// Sensitive fields that should be redacted in logs
export const SENSITIVE_FIELDS = Object.freeze([
  'apiKey', 'password', 'token', 'secret', 'auth', 'credential',
  'accessToken', 'refreshToken', 'sessionId', 'key', 'authorization'
]);

// Redaction utility functions
export class DataRedactor {
  private static sensitiveFields = new Set(SENSITIVE_FIELDS.map(field => field.toLowerCase()));

  /**
   * Check if a field name contains sensitive information
   */
  private static isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    return this.sensitiveFields.has(lowerFieldName) ||
           // Only match sensitive fields that are either exact matches or end with the sensitive term
           // This prevents matching compound words like "credentials" when looking for "credential"
           Array.from(this.sensitiveFields).some(field => {
             const exactMatch = lowerFieldName === field;
             const suffixMatch = lowerFieldName.endsWith('_' + field) || lowerFieldName.endsWith(field);
             return exactMatch || suffixMatch;
           });
  }

  /**
   * Redact sensitive data from a string value
   */
  private static redactString(value: string): string {
    // Check if the string looks like an API key, token, or secret
    // Common patterns: hex strings, base64-like, or very long alphanumeric
    if (value.length > 20 && /^[a-zA-Z0-9+/=_-]+$/.test(value)) {
      return '[REDACTED]';
    }

    // Check for common secret patterns
    if (value.includes('sk-') || value.includes('pk-') || value.includes('Bearer ')) {
      return '[REDACTED]';
    }

    return value;
  }

  /**
   * Recursively redact sensitive data from objects and arrays
   */
  static redact(data: any, visited: Set<any> = new Set()): any {
    if (data === null || data === undefined) {
      return data;
    }

    // Handle circular references
    if (visited.has(data)) {
      return '[Circular Reference]';
    }

    if (typeof data === 'string') {
      return this.redactString(data);
    }

    if (Array.isArray(data)) {
      const newVisited = new Set(visited);
      return data.map(item => this.redact(item, newVisited));
    }

    if (typeof data === 'object') {
      const newVisited = new Set(visited);
      newVisited.add(data);

      const redacted: any = {};

      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          redacted[key] = '[REDACTED]';
        } else {
          redacted[key] = this.redact(value, newVisited);
        }
      }

      return redacted;
    }

    return data;
  }

  /**
   * Check if an object contains functions
   */
  private static containsFunctions(obj: any): boolean {
    if (!obj || typeof obj !== 'object') {
      return false;
    }

    for (const key of Object.getOwnPropertyNames(obj)) {
      if (typeof (obj as any)[key] === 'function') {
        return true;
      }
    }
    return false;
  }

  /**
   * Create a safe object representation for logging
   */
  private static createSafeObject(data: any): any {
    try {
      const safeObj: any = {};
      for (const key of Object.getOwnPropertyNames(data)) {
        const value = (data as any)[key];
        if (this.isSensitiveField(key)) {
          safeObj[key] = '[REDACTED]';
        } else {
          // For non-serializable values, just mark them as such
          try {
            const jsonResult = JSON.stringify(value);
            // Functions return undefined when JSON.stringified, so check for that
            if (typeof value === 'function' || jsonResult === undefined) {
              safeObj[key] = '[Non-serializable]';
            } else {
              safeObj[key] = this.redact(value);
            }
          } catch {
            safeObj[key] = '[Non-serializable]';
          }
        }
      }
      return safeObj;
    } catch {
      return '[Unable to serialize]';
    }
  }

  /**
   * Create a safe version for logging that preserves structure but redacts sensitive data
   */
  static sanitizeForLogging(data: any): any {
    // Check if data contains functions (which are not JSON serializable)
    if (data && typeof data === 'object') {
      if (this.containsFunctions(data)) {
        return this.createSafeObject(data);
      }
    }

    try {
      // First try to serialize to check for other non-serializable objects
      JSON.stringify(data);
      return this.redact(data);
    } catch {
      // If data can't be JSON serialized, try to create a safe representation
      if (data && typeof data === 'object') {
        try {
          return this.createSafeObject(data);
        } catch {
          return '[Unable to serialize]';
        }
      }
      return typeof data === 'string' ? this.redactString(data) : '[Unable to serialize]';
    }
  }
}

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
   * Log error message with automatic redaction of sensitive data
   */
  error(message: string, context?: LogContext, bypassRedaction?: boolean): void {
    // In test environment, silently consume logs to avoid console output
    if (this.config.environment === 'test') {
      return;
    }
    const sanitizedContext = bypassRedaction ? context : DataRedactor.sanitizeForLogging(context);
    this.logger.error(message, sanitizedContext);
  }

  /**
   * Log warning message with automatic redaction of sensitive data
   */
  warn(message: string, context?: LogContext, bypassRedaction?: boolean): void {
    // In test environment, silently consume logs to avoid console output
    if (this.config.environment === 'test') {
      return;
    }
    const sanitizedContext = bypassRedaction ? context : DataRedactor.sanitizeForLogging(context);
    this.logger.warn(message, sanitizedContext);
  }

  /**
   * Log info message with automatic redaction of sensitive data
   */
  info(message: string, context?: LogContext, bypassRedaction?: boolean): void {
    // In test environment, silently consume logs to avoid console output
    if (this.config.environment === 'test') {
      return;
    }
    const sanitizedContext = bypassRedaction ? context : DataRedactor.sanitizeForLogging(context);
    this.logger.info(message, sanitizedContext);
  }

  /**
   * Log debug message with automatic redaction of sensitive data
   */
  debug(message: string, context?: LogContext, bypassRedaction?: boolean): void {
    // In test environment, silently consume logs to avoid console output
    if (this.config.environment === 'test') {
      return;
    }
    const sanitizedContext = bypassRedaction ? context : DataRedactor.sanitizeForLogging(context);
    this.logger.debug(message, sanitizedContext);
  }

  /**
   * Log raw message without any redaction (bypass security measures)
   * Use with caution - only for debugging in development
   */
  rawError(message: string, context?: LogContext): void {
    this.error(message, context, true);
  }

  /**
   * Log raw warning without any redaction (bypass security measures)
   * Use with caution - only for debugging in development
   */
  rawWarn(message: string, context?: LogContext): void {
    this.warn(message, context, true);
  }

  /**
   * Log raw info without any redaction (bypass security measures)
   * Use with caution - only for debugging in development
   */
  rawInfo(message: string, context?: LogContext): void {
    this.info(message, context, true);
  }

  /**
   * Log raw debug without any redaction (bypass security measures)
   * Use with caution - only for debugging in development
   */
  rawDebug(message: string, context?: LogContext): void {
    this.debug(message, context, true);
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

// Raw logging functions that bypass redaction (use with caution)
export const logRawError = (message: string, context?: LogContext) => logger.rawError(message, context);
export const logRawWarn = (message: string, context?: LogContext) => logger.rawWarn(message, context);
export const logRawInfo = (message: string, context?: LogContext) => logger.rawInfo(message, context);
export const logRawDebug = (message: string, context?: LogContext) => logger.rawDebug(message, context);

// Create specialized loggers for different components
export const createComponentLogger = (componentName: string, context?: LogContext): Logger => {
  return logger.child({ component: componentName, ...context });
};