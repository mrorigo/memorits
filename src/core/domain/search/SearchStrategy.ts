import { DatabaseManager } from '../../infrastructure/database/DatabaseManager';
import { logError, logInfo } from '../../infrastructure/config/Logger';

// SearchStrategy interface and base classes

/**
 * Search capability enumeration for strategy features
 */
export enum SearchCapability {
  KEYWORD_SEARCH = 'keyword_search',
  SEMANTIC_SEARCH = 'semantic_search',
  FILTERING = 'filtering',
  SORTING = 'sorting',
  RELEVANCE_SCORING = 'relevance_scoring',
  CATEGORIZATION = 'categorization',
  TEMPORAL_FILTERING = 'temporal_filtering',
  TIME_RANGE_PROCESSING = 'time_range_processing',
  TEMPORAL_PATTERN_MATCHING = 'temporal_pattern_matching',
  TEMPORAL_AGGREGATION = 'temporal_aggregation',
}

/**
 * Search query interface for strategy operations
 */
export interface SearchQuery {
  /** The search text/query string */
  text: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip for pagination */
  offset?: number;
  /** Key-value pairs for simple filtering */
  filters?: Record<string, unknown>;
  /**
   * Advanced filter expression that will be parsed and executed by AdvancedFilterEngine.
   * This field accepts filter expressions as strings that support complex boolean logic,
   * field comparisons, and nested conditions. When provided, this takes precedence over
   * the simple filters field for more sophisticated filtering requirements.
   */
  filterExpression?: string;
  /** Sort configuration for results */
  sortBy?: {
    /** Field name to sort by */
    field: string;
    /** Sort direction */
    direction: 'asc' | 'desc';
  };
  /** Whether to include metadata in search results */
  includeMetadata?: boolean;
  /** Additional context information for the search operation */
  context?: Record<string, unknown>;
}

/**
 * Search result interface with standardized structure
 */
export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  strategy: string;
  timestamp: Date;
  error?: string;
  context?: Record<string, unknown>;
}

/**
 * Enhanced error context interface for comprehensive debugging
 */
export interface EnhancedErrorContext {
  strategy: string;
  operation: string;
  query: string;
  parameters: Record<string, unknown>;
  executionTime: number;
  timestamp: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  databaseState?: {
    connectionStatus: 'connected' | 'disconnected' | 'error';
    lastError?: string;
    queryCount?: number;
  };
  systemContext?: {
    memoryUsage?: number;
    availableMemory?: number;
    cpuUsage?: number;
  };
  retryCount?: number;
  fallbackStrategy?: string;
  originalError?: Error;
}

/**
 * Standardized error context interface for consistent debugging
 */
export interface SearchErrorContext {
  strategy: string;
  operation: string;
  query?: string;
  parameters?: Record<string, unknown>;
  duration?: number;
  timestamp: Date;
  executionTime?: number;
  databaseState?: {
    connectionStatus: 'connected' | 'disconnected' | 'error';
    lastError?: string;
    queryCount?: number;
  };
  systemContext?: {
    memoryUsage?: number;
    availableMemory?: number;
    cpuUsage?: number;
  };
  systemState?: {
    memoryUsage: number;
    activeConnections: number;
    databaseStatus: string;
  };
  errorCategory?: 'low' | 'medium' | 'high' | 'critical';
  recoveryAttempts?: number;
  circuitBreakerState?: 'closed' | 'open' | 'half-open';
}

/**
 * Enhanced error categories for better error classification
 */
export enum SearchErrorCategory {
  VALIDATION = 'validation',
  EXECUTION = 'execution',
  DATABASE = 'database',
  TIMEOUT = 'timeout',
  CONFIGURATION = 'configuration',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  NETWORK = 'network',
  PARSE = 'parse',
  TRANSFORMATION = 'transformation',
  UNKNOWN = 'unknown'
}

/**
 * Search strategy metadata for runtime information
 */
export interface SearchStrategyMetadata {
  name: string;
  version: string;
  description: string;
  capabilities: SearchCapability[];
  supportedMemoryTypes: ('short_term' | 'long_term')[];
  configurationSchema?: Record<string, unknown>;
  performanceMetrics?: {
    averageResponseTime: number;
    throughput: number;
    memoryUsage: number;
  };
}

/**
 * Search strategy configuration interface
 */
export interface SearchStrategyConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  maxResults: number;
  minScore: number;
  options?: Record<string, unknown>;
}

/**
 * SearchStrategy interface
 */
export interface ISearchStrategy {
  readonly name: string;
  readonly description: string;
  readonly capabilities: readonly SearchCapability[];
  readonly priority: number;
  readonly supportedMemoryTypes: readonly ('short_term' | 'long_term')[];

  canHandle(query: SearchQuery): boolean;
  search(query: SearchQuery): Promise<SearchResult[]>;
  execute(query: SearchQuery, dbManager: DatabaseManager): Promise<SearchResult[]>;
  getMetadata(): SearchStrategyMetadata;
  validateConfiguration(): Promise<boolean>;
}

/**
 * Abstract base class with common functionality for search strategies
 */
export abstract class BaseSearchStrategy implements ISearchStrategy {
  protected readonly config: SearchStrategyConfig;
  protected readonly databaseManager: DatabaseManager;

  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly capabilities: readonly SearchCapability[];
  abstract readonly priority: number;
  abstract readonly supportedMemoryTypes: readonly ('short_term' | 'long_term')[];

  constructor(config: SearchStrategyConfig, databaseManager: DatabaseManager) {
    this.config = config;
    this.databaseManager = databaseManager;
  }

  abstract canHandle(query: SearchQuery): boolean;
  abstract search(query: SearchQuery): Promise<SearchResult[]>;
  abstract execute(query: SearchQuery, dbManager: DatabaseManager): Promise<SearchResult[]>;

  /**
   * Get metadata about this search strategy
   */
  getMetadata(): SearchStrategyMetadata {
    return {
      name: this.name,
      version: '1.0.0',
      description: this.description,
      capabilities: [...this.capabilities],
      supportedMemoryTypes: ['short_term', 'long_term'],
      configurationSchema: this.getConfigurationSchema(),
      performanceMetrics: this.getPerformanceMetrics(),
    };
  }

  /**
   * Validate the current configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      if (!this.config.enabled) {
        return true; // Disabled strategies are considered valid
      }

      if (this.config.priority < 0 || this.config.priority > 100) {
        throw new Error('Priority must be between 0 and 100');
      }

      if (this.config.timeout < 1000 || this.config.timeout > 30000) {
        throw new Error('Timeout must be between 1000ms and 30000ms');
      }

      if (this.config.maxResults < 1 || this.config.maxResults > 1000) {
        throw new Error('MaxResults must be between 1 and 1000');
      }

      if (this.config.minScore < 0 || this.config.minScore > 1) {
        throw new Error('MinScore must be between 0 and 1');
      }

      return this.validateStrategyConfiguration();
    } catch (error) {
      logError(`Configuration validation failed for ${this.name}`, {
        component: 'BaseSearchStrategy',
        operation: 'validateConfiguration',
        strategy: this.name,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  /**
   * Create a standardized search result
   */
  protected createSearchResult(
    id: string,
    content: string,
    metadata: Record<string, unknown>,
    score: number,
  ): SearchResult {
    return {
      id,
      content,
      metadata: {
        strategy: this.name,
        createdAt: new Date(),
        ...metadata,
      },
      score: Math.max(0, Math.min(1, score)), // Clamp score between 0 and 1
      strategy: this.name,
      timestamp: new Date(),
    };
  }

  /**
   * Create an error search result
   */
  protected createErrorResult(
    error: string,
    context: Record<string, unknown> = {},
  ): SearchResult {
    return {
      id: '',
      content: '',
      metadata: {
        error: true,
        strategy: this.name,
        ...context,
      },
      score: 0,
      strategy: this.name,
      timestamp: new Date(),
      error,
    };
  }

  /**
   * Log search operation metrics
   */
  protected logSearchOperation(operation: string, duration: number, resultCount: number): void {
    logInfo(`Search operation: ${operation}`, {
      component: 'BaseSearchStrategy',
      operation,
      strategy: this.name,
      duration: `${duration}ms`,
      resultCount,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Handle search errors with enhanced context and structured logging
   */
  protected handleSearchError(
    error: unknown,
    operation: string,
    context?: Record<string, unknown>,
    category: SearchErrorCategory = SearchErrorCategory.EXECUTION,
  ): SearchError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const startTime = context?.startTime as number || Date.now();
    const executionTime = Date.now() - startTime;

    // Determine severity based on error type and context
    const severity = this.determineErrorSeverity(error, category, executionTime);

    // Build comprehensive error context
    const errorContext: EnhancedErrorContext = {
      strategy: this.name,
      operation,
      query: context?.query as string || '',
      parameters: context || {},
      executionTime,
      timestamp: new Date(),
      severity,
      databaseState: this.getDatabaseState(),
      systemContext: this.getSystemContext(),
      originalError: error instanceof Error ? error : undefined,
    };

    const searchError = new SearchError(
      `Search strategy ${this.name} failed during ${operation}: ${errorMessage}`,
      this.name,
      errorContext,
      error instanceof Error ? error : undefined,
      category,
    );

    // Enhanced structured logging
    logError('Search strategy error', {
      component: 'BaseSearchStrategy',
      operation: 'handleSearchError',
      strategy: this.name,
      ...searchError.getErrorSummary()
    });

    return searchError;
  }

  /**
   * Handle database-specific errors with database context
   */
  protected handleDatabaseError(
    error: unknown,
    operation: string,
    query?: string,
    context?: Record<string, unknown>,
  ): SearchDatabaseError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    const dbContext: SearchErrorContext = {
      strategy: this.name,
      operation,
      query,
      parameters: context,
      timestamp: new Date(),
      databaseState: this.getDatabaseState(),
    };

    // Use dbContext to avoid unused variable warning
    logError('Database error context', {
      component: 'BaseSearchStrategy',
      operation: 'handleDatabaseError',
      strategy: this.name,
      dbContext
    });

    const dbError = new SearchDatabaseError(
      this.name,
      errorMessage,
      operation,
      context,
      error instanceof Error ? error : undefined,
    );

    logError('Database error', {
      component: 'BaseSearchStrategy',
      operation: 'handleDatabaseError',
      strategy: this.name,
      ...dbError.getErrorSummary()
    });

    return dbError;
  }

  /**
   * Handle validation errors with field-specific context
   */
  protected handleValidationError(
    message: string,
    field?: string,
    value?: unknown,
    context?: Record<string, unknown>,
  ): SearchValidationError {
    const validationError = new SearchValidationError(
      message,
      field,
      value,
      this.name,
      context,
    );

    logError('Validation error', {
      component: 'BaseSearchStrategy',
      operation: 'handleValidationError',
      strategy: this.name,
      ...validationError.getErrorSummary()
    });

    return validationError;
  }

  /**
   * Handle timeout errors with timeout context
   */
  protected handleTimeoutError(
    timeout: number,
    operation: string,
    context?: Record<string, unknown>,
  ): SearchTimeoutError {
    const timeoutError = new SearchTimeoutError(
      this.name,
      timeout,
      operation,
      context,
    );

    logError('Timeout error', {
      component: 'BaseSearchStrategy',
      operation: 'handleTimeoutError',
      strategy: this.name,
      ...timeoutError.getErrorSummary()
    });

    return timeoutError;
  }

  /**
   * Get current database state for error context
   */
  private getDatabaseState(): SearchErrorContext['databaseState'] {
    try {
      const dbManager = this.databaseManager as any;
      return {
        connectionStatus: dbManager?.isConnected ? 'connected' : 'disconnected',
        lastError: dbManager?.lastError,
        queryCount: dbManager?.queryCount,
      };
    } catch {
      return {
        connectionStatus: 'error',
      };
    }
  }

  /**
   * Determine error severity based on error type and context
   */
  private determineErrorSeverity(
    error: unknown,
    category: SearchErrorCategory,
    executionTime: number,
  ): 'low' | 'medium' | 'high' | 'critical' {
    // Critical errors - database connection failures, authentication issues
    if (category === SearchErrorCategory.DATABASE ||
      category === SearchErrorCategory.AUTHENTICATION ||
      category === SearchErrorCategory.AUTHORIZATION) {
      return 'critical';
    }

    // High severity - timeouts, configuration errors
    if (category === SearchErrorCategory.TIMEOUT ||
      category === SearchErrorCategory.CONFIGURATION) {
      return 'high';
    }

    // Medium severity - execution errors with long execution time
    if (category === SearchErrorCategory.EXECUTION && executionTime > 10000) {
      return 'medium';
    }

    // Low severity - validation errors, parse errors
    if (category === SearchErrorCategory.VALIDATION ||
      category === SearchErrorCategory.PARSE) {
      return 'low';
    }

    // Default to medium for unknown cases
    return 'medium';
  }

  /**
   * Get system context for error reporting
   */
  private getSystemContext(): EnhancedErrorContext['systemContext'] {
    try {
      // Access process information for memory usage (Node.js environment)
      if (typeof process !== 'undefined' && process.memoryUsage) {
        return {
          memoryUsage: process.memoryUsage().heapUsed,
          availableMemory: process.memoryUsage().heapTotal,
        };
      }
      return {};
    } catch {
      return {};
    }
  }

  /**
   * Execute operation with standardized error handling and timeout
   */
  protected async executeWithErrorHandling<T>(
    operation: string,
    operationFn: () => Promise<T>,
    context?: Record<string, unknown>,
    timeoutMs?: number,
  ): Promise<T> {
    const startTime = Date.now();
    const timeout = timeoutMs || this.config.timeout;

    const enhancedContext = { ...context, startTime };

    try {
      // Execute with timeout
      const result = await Promise.race([
        operationFn(),
        new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(this.handleTimeoutError(timeout, operation, enhancedContext));
          }, timeout);
        }),
      ]);

      // Log successful operation
      const duration = Date.now() - startTime;
      logInfo(`Search operation completed: ${operation}`, {
        component: 'BaseSearchStrategy',
        operation,
        strategy: this.name,
        duration: `${duration}ms`,
        success: true,
        timestamp: new Date().toISOString(),
      });

      return result;
    } catch (error) {
      if (error instanceof SearchError) {
        throw error; // Already properly formatted
      }

      // Handle unknown errors
      throw this.handleSearchError(error, operation, enhancedContext);
    }
  }

  /**
   * Validate strategy-specific configuration
   */
  protected abstract validateStrategyConfiguration(): boolean;

  /**
   * Get configuration schema for this strategy
   */
  protected abstract getConfigurationSchema(): Record<string, unknown>;

  /**
   * Get performance metrics for this strategy
   */
  protected abstract getPerformanceMetrics(): SearchStrategyMetadata['performanceMetrics'];
}

/**
 * Utility class for creating standardized search results
 */
export class SearchResultBuilder {
  /**
     * Create a successful search result
     */
  static createSuccessful(
    id: string,
    content: string,
    metadata: Record<string, unknown>,
    score: number,
    strategy: string,
  ): SearchResult {
    return {
      id,
      content,
      metadata: {
        strategy,
        success: true,
        createdAt: new Date(),
        ...metadata,
      },
      score: Math.max(0, Math.min(1, score)),
      strategy,
      timestamp: new Date(),
    };
  }

  /**
     * Create an error search result
     */
  static createError(
    error: string,
    strategy: string,
    context: Record<string, unknown> = {},
  ): SearchResult {
    return {
      id: '',
      content: '',
      metadata: {
        strategy,
        success: false,
        error: true,
        createdAt: new Date(),
        ...context,
      },
      score: 0,
      strategy,
      timestamp: new Date(),
      error,
    };
  }

  /**
     * Create a batch of search results
     */
  static createBatch(
    results: Array<{
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
      score: number;
    }>,
    strategy: string,
  ): SearchResult[] {
    return results.map(result =>
      SearchResultBuilder.createSuccessful(
        result.id,
        result.content,
        result.metadata || {},
        result.score,
        strategy,
      ),
    );
  }

  /**
     * Create results with normalized scores
     */
  static createWithNormalizedScores(
    results: Array<{
      id: string;
      content: string;
      metadata?: Record<string, unknown>;
      rawScore: number;
    }>,
    strategy: string,
    normalizationFactor: number = 1,
  ): SearchResult[] {
    return results.map(result => {
      const normalizedScore = Math.max(0, Math.min(1, result.rawScore / normalizationFactor));
      return SearchResultBuilder.createSuccessful(
        result.id,
        result.content,
        result.metadata || {},
        normalizedScore,
        strategy,
      );
    });
  }
}

/**
 * Enhanced error classes for search operations with standardized context
 */
export class SearchError extends Error {
  public readonly category: SearchErrorCategory;
  public readonly timestamp: Date;
  public readonly context?: SearchErrorContext;

  constructor(
    message: string,
    public readonly strategy?: string,
    context?: Record<string, unknown> | SearchErrorContext,
    public readonly cause?: Error,
    category: SearchErrorCategory = SearchErrorCategory.UNKNOWN,
  ) {
    super(message);
    this.name = 'SearchError';
    this.category = category;
    this.timestamp = new Date();

    // Handle both old and new context formats
    if (context && 'strategy' in context && 'operation' in context) {
      this.context = context as SearchErrorContext;
    } else if (context) {
      // Convert old context format to new standardized format
      this.context = {
        strategy: this.strategy || 'unknown',
        operation: 'unknown',
        timestamp: this.timestamp,
        parameters: context,
      };
    }
  }

  /**
     * Get a structured error summary for logging
     */
  getErrorSummary(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      strategy: this.strategy,
      category: this.category,
      timestamp: this.timestamp.toISOString(),
      context: this.context,
      stack: this.stack,
      cause: this.cause?.message,
    };
  }
}

export class SearchStrategyError extends SearchError {
  constructor(
    strategy: string,
    message: string,
    operation: string = 'search',
    context?: Record<string, unknown>,
    cause?: Error,
  ) {
    const errorContext: SearchErrorContext = {
      strategy,
      operation,
      timestamp: new Date(),
      parameters: context,
    };

    super(
      `Strategy ${strategy} error: ${message}`,
      strategy,
      errorContext,
      cause,
      SearchErrorCategory.EXECUTION,
    );
    this.name = 'SearchStrategyError';
  }
}

export class SearchValidationError extends SearchError {
  constructor(
    message: string,
    field?: string,
    value?: unknown,
    strategy?: string,
    context?: Record<string, unknown>,
  ) {
    const fieldInfo = field ? ` (field: ${field})` : '';
    const valueInfo = value !== undefined ? ` (value: ${value})` : '';
    const fullMessage = `Validation error: ${message}${fieldInfo}${valueInfo}`;

    const errorContext: SearchErrorContext = {
      strategy: strategy || 'unknown',
      operation: 'validation',
      timestamp: new Date(),
      parameters: { ...context, field, value },
    };

    super(
      fullMessage,
      strategy,
      errorContext,
      undefined,
      SearchErrorCategory.VALIDATION,
    );
    this.name = 'SearchValidationError';
  }
}

export class SearchTimeoutError extends SearchError {
  constructor(
    strategy: string,
    timeout: number,
    operation: string = 'search',
    context?: Record<string, unknown>,
  ) {
    const errorContext: SearchErrorContext = {
      strategy,
      operation,
      timestamp: new Date(),
      parameters: { ...context, timeout },
    };

    super(
      `Search strategy '${strategy}' timed out after ${timeout}ms`,
      strategy,
      errorContext,
      undefined,
      SearchErrorCategory.TIMEOUT,
    );
    this.name = 'SearchTimeoutError';
  }
}

export class SearchConfigurationError extends SearchError {
  constructor(
    strategy: string,
    message: string,
    config?: Record<string, unknown>,
    context?: Record<string, unknown>,
  ) {
    const errorContext: SearchErrorContext = {
      strategy,
      operation: 'configuration',
      timestamp: new Date(),
      parameters: { ...context, config },
    };

    super(
      `Configuration error for ${strategy}: ${message}`,
      strategy,
      errorContext,
      undefined,
      SearchErrorCategory.CONFIGURATION,
    );
    this.name = 'SearchConfigurationError';
  }
}

export class SearchDatabaseError extends SearchError {
  constructor(
    strategy: string,
    message: string,
    operation: string = 'database_query',
    context?: Record<string, unknown>,
    cause?: Error,
  ) {
    const errorContext: SearchErrorContext = {
      strategy,
      operation,
      timestamp: new Date(),
      parameters: context,
    };

    super(
      `Database error in ${strategy}: ${message}`,
      strategy,
      errorContext,
      cause,
      SearchErrorCategory.DATABASE,
    );
    this.name = 'SearchDatabaseError';
  }
}

export class SearchParseError extends SearchError {
  constructor(
    strategy: string,
    message: string,
    operation: string = 'parse',
    context?: Record<string, unknown>,
    cause?: Error,
  ) {
    const errorContext: SearchErrorContext = {
      strategy,
      operation,
      timestamp: new Date(),
      parameters: context,
    };

    super(
      `Parse error in ${strategy}: ${message}`,
      strategy,
      errorContext,
      cause,
      SearchErrorCategory.PARSE,
    );
    this.name = 'SearchParseError';
  }
}

/**
 * Strategy validation utilities
 */
export class StrategyValidator {
  /**
     * Validate a search strategy implementation
     */
  static async validateStrategy(strategy: ISearchStrategy): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      // Check basic interface compliance
      if (!strategy.name || typeof strategy.name !== 'string') {
        errors.push('Strategy must have a valid name');
      }

      if (!strategy.description || typeof strategy.description !== 'string') {
        errors.push('Strategy must have a valid description');
      }

      if (!Array.isArray(strategy.capabilities)) {
        errors.push('Strategy must have capabilities array');
      }

      // Validate capabilities
      const validCapabilities = Object.values(SearchCapability);
      const invalidCapabilities = strategy.capabilities.filter(
        cap => !validCapabilities.includes(cap),
      );

      if (invalidCapabilities.length > 0) {
        errors.push(`Invalid capabilities: ${invalidCapabilities.join(', ')}`);
      }

      // Test canHandle method
      const testQuery: SearchQuery = { text: 'test' };
      const canHandleResult = strategy.canHandle(testQuery);
      if (typeof canHandleResult !== 'boolean') {
        errors.push('canHandle method must return a boolean');
      }

      // Test configuration validation
      const configValid = await strategy.validateConfiguration();
      if (typeof configValid !== 'boolean') {
        errors.push('validateConfiguration method must return a boolean');
      }

      // Test metadata
      const metadata = strategy.getMetadata();
      if (!metadata.name || !metadata.capabilities) {
        errors.push('getMetadata must return valid metadata object');
      }

      // Performance validation
      if (strategy.capabilities.includes(SearchCapability.KEYWORD_SEARCH)) {
        const startTime = Date.now();
        try {
          const results = await strategy.search(testQuery);
          const duration = Date.now() - startTime;

          if (duration > 5000) {
            warnings.push(`Strategy search took ${duration}ms, consider optimization`);
          }

          if (!Array.isArray(results)) {
            errors.push('search method must return an array of SearchResult');
          }
        } catch (error) {
          warnings.push(`Strategy threw error during test search: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

    } catch (error) {
      errors.push(`Strategy validation failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
     * Validate multiple strategies
     */
  static async validateStrategies(strategies: ISearchStrategy[]): Promise<ValidationResult> {
    const allErrors: string[] = [];
    const allWarnings: string[] = [];
    let allValid = true;

    for (const strategy of strategies) {
      const result = await this.validateStrategy(strategy);

      if (!result.isValid) {
        allValid = false;
        allErrors.push(...result.errors.map(error => `${strategy.name}: ${error}`));
      }

      allWarnings.push(...result.warnings.map(warning => `${strategy.name}: ${warning}`));
    }

    return {
      isValid: allValid,
      errors: allErrors,
      warnings: allWarnings,
    };
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Error handling utility for consistent error management across strategies
 */
export class SearchErrorHandler {
  private static readonly MAX_ERROR_CONTEXT_DEPTH = 3;
  private static readonly ERROR_LOG_SIZE_LIMIT = 10000;

  /**
     * Create a standardized error context with comprehensive information
     */
  static createErrorContext(
    strategy: string,
    operation: string,
    parameters?: Record<string, unknown>,
    additionalContext?: Record<string, unknown>,
  ): SearchErrorContext {
    return {
      strategy,
      operation,
      parameters: this.sanitizeParameters(parameters || {}),
      timestamp: new Date(),
      ...additionalContext,
    };
  }

  /**
     * Sanitize parameters to remove sensitive information and limit size
     */
  private static sanitizeParameters(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized: Record<string, unknown> = {};
    let totalSize = 0;

    for (const [key, value] of Object.entries(params)) {
      // Skip sensitive fields
      if (this.isSensitiveField(key)) {
        sanitized[key] = '[REDACTED]';
        continue;
      }

      // Convert value to string representation with size limit
      const stringValue = this.valueToString(value);
      if (totalSize + stringValue.length > this.ERROR_LOG_SIZE_LIMIT) {
        sanitized[key] = '[TRUNCATED]';
        break;
      }

      sanitized[key] = value;
      totalSize += stringValue.length;
    }

    return sanitized;
  }

  /**
     * Check if a field contains sensitive information
     */
  private static isSensitiveField(fieldName: string): boolean {
    const sensitiveFields = [
      'password', 'token', 'key', 'secret', 'auth', 'credential',
      'apiKey', 'accessToken', 'refreshToken', 'sessionId',
    ];
    return sensitiveFields.some(sensitive =>
      fieldName.toLowerCase().includes(sensitive.toLowerCase()),
    );
  }

  /**
     * Convert a value to string representation for logging
     */
  private static valueToString(value: unknown): string {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'string') {
      return value.length > 1000 ? value.substring(0, 1000) + '...' : value;
    }

    if (typeof value === 'object') {
      try {
        const jsonStr = JSON.stringify(value);
        return jsonStr.length > 1000 ? jsonStr.substring(0, 1000) + '...' : jsonStr;
      } catch {
        return '[Object - cannot stringify]';
      }
    }

    return String(value);
  }

  /**
     * Create enhanced logging metadata for errors
     */
  static createLoggingMetadata(
    error: Error,
    context: SearchErrorContext,
    additionalMetadata?: Record<string, unknown>,
  ): Record<string, unknown> {
    const metadata: Record<string, unknown> = {
      errorName: error.name,
      errorMessage: error.message,
      errorCategory: (error as SearchError).category || SearchErrorCategory.UNKNOWN,
      strategy: context.strategy,
      operation: context.operation,
      timestamp: context.timestamp.toISOString(),
      duration: context.duration,
      hasCause: !!error.cause,
      stackTrace: this.truncateStackTrace(error.stack),
      ...additionalMetadata,
    };

    // Add system information if available
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        metadata.memoryUsage = process.memoryUsage().heapUsed;
      }
    } catch {
      // Ignore process module errors
    }

    return metadata;
  }

  /**
     * Truncate stack trace to prevent excessive log size
     */
  private static truncateStackTrace(stack?: string): string | undefined {
    if (!stack) return undefined;

    const lines = stack.split('\n');
    if (lines.length <= this.MAX_ERROR_CONTEXT_DEPTH * 2) {
      return stack;
    }

    // Keep first few lines and last few lines of stack trace
    const firstLines = lines.slice(0, this.MAX_ERROR_CONTEXT_DEPTH);
    const lastLines = lines.slice(-this.MAX_ERROR_CONTEXT_DEPTH);

    return [...firstLines, '  ...', ...lastLines].join('\n');
  }

  /**
     * Determine error category based on error type and message
     */
  static categorizeError(error: unknown): SearchErrorCategory {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
      return SearchErrorCategory.TIMEOUT;
    }

    if (errorMessage.includes('validation') || errorMessage.includes('invalid') || errorMessage.includes('format')) {
      return SearchErrorCategory.VALIDATION;
    }

    if (errorMessage.includes('database') || errorMessage.includes('sql') || errorMessage.includes('connection')) {
      return SearchErrorCategory.DATABASE;
    }

    if (errorMessage.includes('network') || errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return SearchErrorCategory.NETWORK;
    }

    if (errorMessage.includes('parse') || errorMessage.includes('json') || errorMessage.includes('syntax')) {
      return SearchErrorCategory.PARSE;
    }

    if (errorMessage.includes('configuration') || errorMessage.includes('config') || errorMessage.includes('setting')) {
      return SearchErrorCategory.CONFIGURATION;
    }

    if (errorMessage.includes('authentication') || errorMessage.includes('auth') || errorMessage.includes('unauthorized')) {
      return SearchErrorCategory.AUTHENTICATION;
    }

    if (errorMessage.includes('authorization') || errorMessage.includes('permission') || errorMessage.includes('forbidden')) {
      return SearchErrorCategory.AUTHORIZATION;
    }

    if (errorMessage.includes('execution') || errorMessage.includes('runtime') || errorMessage.includes('failed')) {
      return SearchErrorCategory.EXECUTION;
    }

    return SearchErrorCategory.UNKNOWN;
  }
}
// Additional imports for enhanced error handling
// Note: performance import removed as it's not currently used