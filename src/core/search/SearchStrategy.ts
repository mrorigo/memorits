// SearchStrategy interface and base classes as specified in PARITY_1.md section 2.3

/**
 * Search capability enumeration for strategy features
 */
export enum SearchCapability {
    KEYWORD_SEARCH = 'keyword_search',
    SEMANTIC_SEARCH = 'semantic_search',
    FILTERING = 'filtering',
    SORTING = 'sorting',
    RELEVANCE_SCORING = 'relevance_scoring',
    CATEGORIZATION = 'categorization'
}

/**
 * Search query interface for strategy operations
 */
export interface SearchQuery {
    text: string;
    limit?: number;
    offset?: number;
    filters?: Record<string, unknown>;
    sortBy?: {
        field: string;
        direction: 'asc' | 'desc';
    };
    includeMetadata?: boolean;
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
 * SearchStrategy interface as specified in PARITY_1.md section 2.3
 */
export interface ISearchStrategy {
    readonly name: string;
    readonly description: string;
    readonly capabilities: readonly SearchCapability[];

    canHandle(query: SearchQuery): boolean;
    search(query: SearchQuery): Promise<SearchResult[]>;
    getMetadata(): SearchStrategyMetadata;
    validateConfiguration(): Promise<boolean>;
}

/**
 * Abstract base class with common functionality for search strategies
 */
export abstract class BaseSearchStrategy implements ISearchStrategy {
    protected readonly config: SearchStrategyConfig;
    protected readonly databaseManager: any; // DatabaseManager type would be imported
    protected readonly logger: any; // Logger type would be imported

    abstract readonly name: string;
    abstract readonly description: string;
    abstract readonly capabilities: readonly SearchCapability[];

    constructor(config: SearchStrategyConfig, databaseManager: any, logger?: any) {
        this.config = config;
        this.databaseManager = databaseManager;
        this.logger = logger || console;
    }

    abstract canHandle(query: SearchQuery): boolean;
    abstract search(query: SearchQuery): Promise<SearchResult[]>;

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
            performanceMetrics: this.getPerformanceMetrics()
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
            this.logger.error(`Configuration validation failed for ${this.name}:`, error);
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
        context: Record<string, unknown> = {}
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
        this.logger.info(`Search operation: ${operation}`, {
            strategy: this.name,
            duration: `${duration}ms`,
            resultCount,
            timestamp: new Date().toISOString(),
        });
    }

    /**
     * Handle search errors with context
     */
    protected handleSearchError(error: unknown, context: Record<string, unknown>): SearchError {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const searchError = new SearchError(
            `Search strategy ${this.name} failed: ${errorMessage}`,
            this.name,
            context,
        );

        this.logger.error('Search error:', {
            strategy: this.name,
            error: errorMessage,
            context,
            stack: error instanceof Error ? error.stack : undefined,
        });

        return searchError;
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
        strategy: string
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
        context: Record<string, unknown> = {}
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
        strategy: string
    ): SearchResult[] {
        return results.map(result =>
            SearchResultBuilder.createSuccessful(
                result.id,
                result.content,
                result.metadata || {},
                result.score,
                strategy,
            )
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
        normalizationFactor: number = 1
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
 * Specialized error classes for search operations
 */
export class SearchError extends Error {
    constructor(
        message: string,
        public readonly strategy?: string,
        public readonly context?: Record<string, unknown>,
        public readonly cause?: Error,
    ) {
        super(message);
        this.name = 'SearchError';
    }
}

export class SearchStrategyError extends SearchError {
    constructor(strategy: string, message: string, context?: Record<string, unknown>, cause?: Error) {
        super(`Strategy ${strategy} error: ${message}`, strategy, context, cause);
        this.name = 'SearchStrategyError';
    }
}

export class SearchValidationError extends SearchError {
    constructor(message: string, field?: string, value?: unknown) {
        super(`Validation error: ${message}${field ? ` (field: ${field})` : ''}${value ? ` (value: ${value})` : ''}`);
        this.name = 'SearchValidationError';
    }
}

export class SearchTimeoutError extends SearchError {
    constructor(strategy: string, timeout: number, context?: Record<string, unknown>) {
        super(`Search strategy '${strategy}' timed out after ${timeout}ms`, strategy, context);
        this.name = 'SearchTimeoutError';
    }
}

export class SearchConfigurationError extends SearchError {
    constructor(strategy: string, message: string, config?: Record<string, unknown>) {
        super(`Configuration error for ${strategy}: ${message}`, strategy, config);
        this.name = 'SearchConfigurationError';
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
                cap => !validCapabilities.includes(cap)
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