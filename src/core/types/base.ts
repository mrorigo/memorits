/**
 * Unified Base Configuration and Performance Types
 *
 * This file consolidates common interfaces and types used across the memori-ts
 * project to eliminate DRY principle violations and improve maintainability.
 */

import { z } from 'zod';

// ===== BASE CONFIGURATION INTERFACES =====

/**
 * Base configuration interface for all system components
 * Provides common configuration options that all components should support
 */
export interface BaseConfig {
  /** Whether this component is enabled */
  enabled: boolean;
  /** Debug mode for additional logging and validation */
  debugMode?: boolean;
  /** Performance monitoring and optimization settings */
  performance?: {
    /** Enable performance metrics collection */
    enableMetrics: boolean;
    /** Enable result caching */
    enableCaching: boolean;
    /** Maximum cache size (number of entries) */
    cacheSize: number;
    /** Enable parallel execution where possible */
    enableParallelExecution: boolean;
  };
  /** Security and audit settings */
  security?: {
    /** Enable security audit logging */
    enableAuditLogging: boolean;
    /** Data retention period in days */
    dataRetentionDays: number;
    /** Enable data encryption at rest */
    encryptionEnabled: boolean;
  };
}

/**
 * Provider-specific configuration interface
 * Extends BaseConfig with provider-specific options
 */
export interface ProviderConfig extends BaseConfig {
  /** API key for external service authentication */
  apiKey: string;
  /** Base URL for API endpoints */
  baseUrl?: string;
  /** Request timeout in milliseconds */
  timeout: number;
  /** Number of retry attempts for failed requests */
  retryAttempts: number;
  /** Model name or identifier */
  model?: string;
}

/**
 * Search strategy configuration interface
 * Extends BaseConfig with search-specific options
 */
export interface SearchStrategyConfig extends BaseConfig {
  /** Unique name identifier for the strategy */
  strategyName: string;
  /** Priority for strategy execution order (0-100, higher = more priority) */
  priority: number;
  /** Strategy-specific timeout in milliseconds */
  timeout: number;
  /** Maximum number of results to return */
  maxResults: number;
  /** Scoring weights for result ranking */
  scoring: {
    /** Base relevance weight */
    baseWeight: number;
    /** Recency boost weight */
    recencyWeight: number;
    /** Importance score weight */
    importanceWeight: number;
    /** Relationship strength weight */
    relationshipWeight: number;
  };
  /** Strategy-specific configuration options */
  strategySpecific?: Record<string, unknown>;
}

/**
 * Database configuration interface
 * Extends BaseConfig with database-specific options
 */
export interface DatabaseConfig extends BaseConfig {
  /** Database connection URL */
  url: string;
  /** Enable Full-Text Search support */
  enableFTS: boolean;
  /** Enable database performance monitoring */
  enablePerformanceMonitoring: boolean;
  /** Connection pool size */
  connectionPoolSize: number;
  /** Query timeout in milliseconds */
  queryTimeout: number;
}

// ===== PERFORMANCE METRICS INTERFACES =====

/**
 * Unified performance metrics interface for all components
 * Consolidates the various performance metrics structures found across modules
 */
export interface PerformanceMetrics {
  /** Total number of operations performed */
  totalOperations: number;
  /** Number of successful operations */
  successfulOperations: number;
  /** Number of failed operations */
  failedOperations: number;
  /** Average operation time in milliseconds */
  averageOperationTime: number;
  /** Timestamp of the last operation */
  lastOperationTime: Date;
  /** Error rate as a percentage (0-100) */
  errorRate: number;
  /** Current memory usage in bytes */
  memoryUsage: number;
  /** Peak memory usage in bytes */
  peakMemoryUsage: number;
  /** Breakdown of operations by type */
  operationBreakdown: Map<string, number>;
  /** Breakdown of errors by type */
  errorBreakdown: Map<string, number>;
  /** Performance trends over time */
  trends: PerformanceTrend[];
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Performance trend data structure
 * Tracks performance changes over time for analysis
 */
export interface PerformanceTrend {
  /** Timestamp when this trend data was recorded */
  timestamp: Date;
  /** Operation time at this point */
  operationTime: number;
  /** Memory usage at this point */
  memoryUsage: number;
  /** Number of operations in this period */
  operationCount: number;
  /** Number of errors in this period */
  errorCount: number;
  /** Component or module name */
  component: string;
}

/**
 * Performance monitoring configuration
 * Unified configuration for all performance monitoring features
 */
export interface PerformanceMonitoringConfig {
  /** Whether performance monitoring is enabled */
  enabled: boolean;
  /** Interval for collecting performance data (milliseconds) */
  collectionInterval: number;
  /** How long to retain performance data (milliseconds) */
  retentionPeriod: number;
  /** Threshold for identifying slow operations (milliseconds) */
  slowOperationThreshold: number;
  /** Alert thresholds for different metrics */
  alertThresholds: {
    /** Maximum acceptable response time */
    maxResponseTime: number;
    /** Maximum acceptable error rate (0-1) */
    maxErrorRate: number;
    /** Maximum acceptable memory usage */
    maxMemoryUsage: number;
  };
}

// ===== LOGGER CONFIGURATION =====

/**
 * Unified logger configuration
 * Consolidates logger configurations found across modules
 */
export interface LoggerConfig {
  /** Logging level */
  level: LogLevel;
  /** Whether to enable console output */
  enableConsole: boolean;
  /** Whether to enable file output */
  enableFile: boolean;
  /** Log file path (if file output enabled) */
  filePath?: string;
  /** Maximum log file size in bytes */
  maxFileSize?: number;
  /** Number of backup log files to keep */
  maxFiles?: number;
  /** Whether to enable JSON formatting */
  jsonFormat: boolean;
  /** Whether to include timestamps */
  includeTimestamp: boolean;
  /** Whether to include component names */
  includeComponent: boolean;
}

/**
 * Log levels enumeration
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
  TRACE = 'trace'
}

// ===== ERROR HANDLING INTERFACES =====

/**
 * Unified error context interface
 * Provides consistent error context across all modules
 */
export interface ErrorContext {
  /** Component or module where error occurred */
  component: string;
  /** Operation being performed when error occurred */
  operation: string;
  /** Error severity level */
  severity: 'low' | 'medium' | 'high' | 'critical';
  /** Timestamp when error occurred */
  timestamp: Date;
  /** Additional context information */
  context?: Record<string, unknown>;
  /** Error code for programmatic handling */
  code?: string;
  /** Whether this error is recoverable */
  recoverable: boolean;
}

/**
 * Base error class for all memori-ts errors
 * Provides consistent error structure and context
 */
export abstract class MemoriError extends Error {
  public readonly context: ErrorContext;
  public readonly originalError?: Error;

  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.context = context;
    this.originalError = originalError;
  }

  /**
   * Get a structured error representation for logging
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      context: this.context,
      originalError: this.originalError?.message,
      stack: this.stack,
    };
  }
}

/**
 * Configuration validation error
 */
export class ConfigurationError extends MemoriError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, { ...context, severity: 'high', recoverable: false }, originalError);
  }
}

/**
 * Security-related error
 */
export class SecurityError extends MemoriError {
  constructor(message: string, context: ErrorContext, originalError?: Error) {
    super(message, { ...context, severity: 'critical', recoverable: false }, originalError);
  }
}

// ===== VALIDATION SCHEMAS =====

/**
 * Zod schema for BaseConfig validation
 */
export const BaseConfigSchema = z.object({
  enabled: z.boolean().default(true),
  debugMode: z.boolean().default(false),
  performance: z.object({
    enableMetrics: z.boolean().default(true),
    enableCaching: z.boolean().default(true),
    cacheSize: z.number().min(0).max(10000).default(1000),
    enableParallelExecution: z.boolean().default(false),
  }).optional(),
  security: z.object({
    enableAuditLogging: z.boolean().default(true),
    dataRetentionDays: z.number().min(1).max(3650).default(365),
    encryptionEnabled: z.boolean().default(false),
  }).optional(),
});

/**
 * Zod schema for ProviderConfig validation
 */
export const ProviderConfigSchema = BaseConfigSchema.extend({
  apiKey: z.string().min(1, 'API key is required'),
  baseUrl: z.string().url().optional(),
  timeout: z.number().min(1000).max(300000).default(30000),
  retryAttempts: z.number().min(0).max(10).default(3),
  model: z.string().optional(),
});

/**
 * Zod schema for SearchStrategyConfig validation
 */
export const SearchStrategyConfigSchema = BaseConfigSchema.extend({
  strategyName: z.string().min(1, 'Strategy name is required'),
  priority: z.number().min(0).max(100).default(50),
  timeout: z.number().min(1000).max(60000).default(10000),
  maxResults: z.number().min(1).max(10000).default(100),
  scoring: z.object({
    baseWeight: z.number().min(0).max(2).default(1.0),
    recencyWeight: z.number().min(0).max(2).default(0.2),
    importanceWeight: z.number().min(0).max(2).default(0.8),
    relationshipWeight: z.number().min(0).max(2).default(0.3),
  }),
  strategySpecific: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for DatabaseConfig validation
 */
export const DatabaseConfigSchema = BaseConfigSchema.extend({
  url: z.string().min(1, 'Database URL is required'),
  enableFTS: z.boolean().default(true),
  enablePerformanceMonitoring: z.boolean().default(true),
  connectionPoolSize: z.number().min(1).max(100).default(10),
  queryTimeout: z.number().min(1000).max(300000).default(30000),
});

/**
 * Zod schema for PerformanceMetrics validation
 */
export const PerformanceMetricsSchema = z.object({
  totalOperations: z.number().min(0).default(0),
  successfulOperations: z.number().min(0).default(0),
  failedOperations: z.number().min(0).default(0),
  averageOperationTime: z.number().min(0).default(0),
  lastOperationTime: z.date().default(() => new Date()),
  errorRate: z.number().min(0).max(100).default(0),
  memoryUsage: z.number().min(0).default(0),
  peakMemoryUsage: z.number().min(0).default(0),
  operationBreakdown: z.map(z.string(), z.number()).default(new Map()),
  errorBreakdown: z.map(z.string(), z.number()).default(new Map()),
  trends: z.array(z.object({
    timestamp: z.date(),
    operationTime: z.number(),
    memoryUsage: z.number(),
    operationCount: z.number(),
    errorCount: z.number(),
    component: z.string(),
  })).default([]),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Zod schema for LoggerConfig validation
 */
export const LoggerConfigSchema = z.object({
  level: z.nativeEnum(LogLevel).default(LogLevel.INFO),
  enableConsole: z.boolean().default(true),
  enableFile: z.boolean().default(false),
  filePath: z.string().optional(),
  maxFileSize: z.number().min(1024).max(1024 * 1024 * 100).default(1024 * 1024 * 10), // 10MB default
  maxFiles: z.number().min(1).max(100).default(5),
  jsonFormat: z.boolean().default(false),
  includeTimestamp: z.boolean().default(true),
  includeComponent: z.boolean().default(true),
});

// ===== UTILITY FUNCTIONS =====

/**
 * Type guard to check if a configuration object extends BaseConfig
 */
export function isBaseConfig(config: unknown): config is BaseConfig {
  return typeof config === 'object' &&
         config !== null &&
         'enabled' in config &&
         typeof (config as any).enabled === 'boolean';
}

/**
 * Type guard to check if a configuration object is a valid ProviderConfig
 */
export function isProviderConfig(config: unknown): config is ProviderConfig {
  return isBaseConfig(config) &&
         'apiKey' in config &&
         'timeout' in config &&
         'retryAttempts' in config;
}

/**
 * Type guard to check if a configuration object is a valid SearchStrategyConfig
 */
export function isSearchStrategyConfig(config: unknown): config is SearchStrategyConfig {
  return isBaseConfig(config) &&
         'strategyName' in config &&
         'priority' in config &&
         'maxResults' in config &&
         'scoring' in config;
}

/**
 * Type guard to check if metrics object is valid PerformanceMetrics
 */
export function isPerformanceMetrics(metrics: unknown): metrics is PerformanceMetrics {
  return typeof metrics === 'object' &&
         metrics !== null &&
         'totalOperations' in metrics &&
         'successfulOperations' in metrics &&
         'averageOperationTime' in metrics;
}

/**
 * Deep merge two configuration objects
 */
export function mergeConfigs<T extends BaseConfig>(base: T, override: Partial<T>): T {
  const merged = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value !== undefined) {
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Recursively merge nested objects
        (merged as any)[key] = mergeConfigs((merged as any)[key] || {}, value as any);
      } else {
        (merged as any)[key] = value;
      }
    }
  }

  return merged;
}

/**
 * Validate configuration against schema and return detailed results
 */
export function validateConfig<T>(
  config: unknown,
  schema: z.ZodSchema<T>
): { isValid: boolean; errors: string[]; warnings: string[]; validatedConfig?: T } {
  try {
    const validatedConfig = schema.parse(config);
    return {
      isValid: true,
      errors: [],
      warnings: [],
      validatedConfig,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
        warnings: [],
      };
    }

    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }
}