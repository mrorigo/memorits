import { SearchStrategy, SearchQuery, SearchResult, ISearchStrategy, ISearchService, StrategyNotFoundError, DatabaseQueryResult, SearchStrategyConfiguration } from './types';
import { SearchCapability, SearchStrategyMetadata, SearchError, SearchStrategyError, SearchDatabaseError, SearchValidationError, SearchTimeoutError, SearchConfigurationError, SearchErrorCategory } from './SearchStrategy';
import { SearchIndexManager, IndexHealth, IndexHealthReport } from './SearchIndexManager';
import { LikeSearchStrategy } from './LikeSearchStrategy';
import { RecentMemoriesStrategy } from './RecentMemoriesStrategy';
import { RelationshipSearchStrategy } from './strategies/RelationshipSearchStrategy';
import { CategoryFilterStrategy } from './filtering/CategoryFilterStrategy';
import { TemporalFilterStrategy } from './filtering/TemporalFilterStrategy';
import { MetadataFilterStrategy } from './filtering/MetadataFilterStrategy';
import { AdvancedFilterEngine } from './filtering/AdvancedFilterEngine';
import { DatabaseManager } from '../database/DatabaseManager';
import { SearchStrategyConfigManager } from './SearchStrategyConfigManager';
import { logError } from '../utils/Logger';

/**
 * Enhanced SQLite FTS5 search strategy implementation with BM25 ranking and metadata filtering
 */
class SQLiteFTSStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.FTS5;
  readonly priority = 10;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;
  readonly description = 'SQLite FTS5 full-text search with BM25 ranking';
  readonly capabilities = [
    SearchCapability.KEYWORD_SEARCH,
    SearchCapability.RELEVANCE_SCORING,
    SearchCapability.FILTERING,
    SearchCapability.SORTING,
  ] as const;

  // FTS5-specific configuration
  private readonly bm25Weights = {
    title: 2.0,      // Weight for title/summary matches
    content: 1.0,    // Weight for content matches
    category: 1.5,    // Weight for category matches
  };

  private readonly maxResultsPerQuery = 1000;
  private readonly queryTimeout = 10000; // 10 seconds
  private readonly resultBatchSize = 100;
  private readonly databaseManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.databaseManager = dbManager;

    // Ensure FTS support is initialized for SQLite FTS strategy
    this.initializeFTSSupport();
  }

  private async initializeFTSSupport(): Promise<void> {
    try {
      // Check if FTS is already enabled
      if (this.databaseManager.isFTSEnabled()) {
        return;
      }

      // Try to get FTS status which will trigger initialization
      const ftsStatus = await this.databaseManager.getFTSStatus();

      if (!ftsStatus.enabled) {
        console.warn('FTS5 not available in this SQLite build, FTS strategy will be disabled');
      }
    } catch (error) {
      console.warn('FTS5 initialization failed, FTS strategy will not be available:', error);
    }
  }

  canHandle(query: SearchQuery): boolean {
    // Can handle text-based queries with optional metadata filters
    // But only if FTS5 is actually available
    if (!query.text || query.text.trim().length === 0) {
      return false;
    }

    // Check if FTS5 is available by checking if the table exists
    try {
      // This is a simple check - if FTS5 initialization failed, don't use this strategy
      return this.databaseManager.isFTSEnabled();
    } catch {
      return false;
    }
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Build FTS query with advanced features
      const ftsQuery = this.buildFTSQuery(query);
      const sql = this.buildFTSSQL(query, ftsQuery);
      const parameters = this.getQueryParameters(query);

      // Execute query with timeout and error handling
      const results = await this.executeFTSQuery(sql, parameters, query);
      const processedResults = this.processFTSResults(results, query);

      // Log performance metrics with enhanced context
      const duration = Date.now() - startTime;
      console.log(`FTS5 search completed in ${duration}ms, found ${processedResults.length} results`, {
        strategy: this.name,
        query: query.text,
        resultCount: processedResults.length,
        executionTime: duration,
        parameters: {
          limit: query.limit,
          offset: query.offset,
          hasFilters: !!query.filters,
          hasFilterExpression: !!query.filterExpression,
        }
      });

      return processedResults;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Enhanced error context with detailed information
      const errorContext = {
        strategy: this.name,
        operation: 'fts_search',
        query: query.text,
        parameters: {
          limit: query.limit,
          offset: query.offset,
          filters: query.filters,
          hasFilterExpression: !!query.filterExpression,
          executionTime: duration,
        },
        executionTime: duration,
        timestamp: new Date(),
        severity: this.categorizeFTSError(error) as 'low' | 'medium' | 'high' | 'critical',
      };

      // Log detailed error information
      console.error(`FTS5 search failed after ${duration}ms:`, {
        error: error instanceof Error ? error.message : String(error),
        strategy: this.name,
        query: query.text,
        executionTime: duration,
        errorCategory: this.categorizeFTSError(error),
        databaseState: this.getDatabaseState(),
      });

      throw new SearchStrategyError(
        this.name,
        `FTS5 strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        'fts_search',
        errorContext,
        error instanceof Error ? error : undefined
      );
    }
  }

  async execute(query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    return this.search(query);
  }

  async validateConfiguration(): Promise<boolean> {
    return true;
  }

  getMetadata(): SearchStrategyMetadata {
    return {
      name: this.name,
      version: '2.0.0',
      description: this.description,
      capabilities: [...this.capabilities],
      supportedMemoryTypes: [...this.supportedMemoryTypes],
      configurationSchema: {
        type: 'object',
        properties: {
          priority: { type: 'number', minimum: 0, maximum: 100 },
          timeout: { type: 'number', minimum: 1000, maximum: 30000 },
          maxResults: { type: 'number', minimum: 1, maximum: 1000 },
          bm25Weights: {
            type: 'object',
            properties: {
              title: { type: 'number', minimum: 0, maximum: 10 },
              content: { type: 'number', minimum: 0, maximum: 10 },
              category: { type: 'number', minimum: 0, maximum: 10 }
            },
          },
        },
        required: ['priority', 'timeout', 'maxResults']
      },
      performanceMetrics: {
        averageResponseTime: 50,
        throughput: 1000,
        memoryUsage: 15,
      },
    };
  }

  /**
   * Build sophisticated FTS5 query with Porter stemming and advanced syntax
   */
  private buildFTSQuery(query: SearchQuery): string {
    const { text } = query;
    let ftsQuery = text.trim();

    // Apply Porter stemming and clean the query
    ftsQuery = this.applyPorterStemming(ftsQuery);

    // Handle phrase queries with quotes
    ftsQuery = this.handlePhraseQueries(ftsQuery);

    return ftsQuery;
  }

  /**
   * Apply Porter stemming tokenization to the query
   */
  private applyPorterStemming(query: string): string {
    // Clean and normalize the query for FTS5 with Porter stemming
    let cleanQuery = query
      .replace(/[^\w\s"()]/g, ' ') // Remove special characters except quotes and parentheses
      .replace(/\s+/g, ' ')        // Normalize whitespace
      .trim();

    // Handle boolean operators (AND, OR, NOT)
    cleanQuery = cleanQuery
      .replace(/\bAND\b/gi, ' AND ')
      .replace(/\bOR\b/gi, ' OR ')
      .replace(/\bNOT\b/gi, ' NOT ');

    return cleanQuery;
  }

  /**
   * Handle phrase queries by preserving quoted strings
   */
  private handlePhraseQueries(query: string): string {
    // Find quoted phrases and convert them to FTS5 phrase syntax
    const phraseRegex = /"([^"]+)"/g;
    return query.replace(phraseRegex, '"$1"');
  }

  /**
   * Build metadata filtering conditions for FTS query
   */
  private buildMetadataConditions(filters?: Record<string, unknown>): string[] {
    if (!filters) return [];

    const conditions: string[] = [];

    // Filter by memory type
    if (filters.memoryType) {
      conditions.push(`memory_type:${filters.memoryType}`);
    }

    // Filter by category
    if (filters.category) {
      conditions.push(`category_primary:${filters.category}`);
    }

    // Filter by importance score range
    if (filters.minImportance || filters.maxImportance) {
      const minScore = filters.minImportance || 0;
      const maxScore = filters.maxImportance || 1;
      conditions.push(`importance_score:[${minScore} TO ${maxScore}]`);
    }

    // Filter by date range
    if (filters.createdAfter || filters.createdBefore) {
      const after = filters.createdAfter ? new Date(filters.createdAfter as string).getTime() / 1000 : '*';
      const before = filters.createdBefore ? new Date(filters.createdBefore as string).getTime() / 1000 : '*';
      conditions.push(`created_at:[${after} TO ${before}]`);
    }

    return conditions;
  }

  /**
   * Build optimized FTS5 SQL query with BM25 ranking
   */
  private buildFTSSQL(query: SearchQuery, ftsQuery: string): string {
    const limit = Math.min(query.limit || 10, this.maxResultsPerQuery);
    const offset = query.offset || 0;

    // Build ORDER BY clause with BM25 ranking
    const orderByClause = this.buildOrderByClause(query);

    // Build WHERE clause with metadata filtering
    const whereClause = this.buildWhereClause(query);

    return `
      SELECT
        fts.rowid as memory_id,
        fts.content as searchable_content,
        fts.metadata,
        bm25(memory_fts, ${this.bm25Weights.content}, ${this.bm25Weights.title}, ${this.bm25Weights.category}) as search_score,
        json_extract(fts.metadata, '$.memory_type') as memory_type,
        json_extract(fts.metadata, '$.category_primary') as category_primary,
        json_extract(fts.metadata, '$.importance_score') as importance_score,
        json_extract(fts.metadata, '$.created_at') as created_at,
        '${this.name}' as search_strategy
      FROM memory_fts fts
      WHERE memory_fts MATCH ?
      ${whereClause}
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;
  }

  /**
   * Build ORDER BY clause with BM25 ranking and secondary sorting
   */
  private buildOrderByClause(query: SearchQuery): string {
    let orderBy = 'ORDER BY bm25(memory_fts, 1.0, 1.0, 1.0) DESC';

    // Add secondary sorting criteria
    if (query.sortBy) {
      const direction = query.sortBy.direction.toUpperCase();
      orderBy += `, ${query.sortBy.field} ${direction}`;
    } else {
      // Default secondary sort by importance and recency
      orderBy += ', importance_score DESC, created_at DESC';
    }

    return orderBy;
  }

  /**
   * Build additional WHERE clause for metadata filtering
   */
  private buildWhereClause(query: SearchQuery): string {
    const conditions: string[] = [];

    // Add namespace filtering - use the database manager's namespace if available
    const dbManager = this.databaseManager as any;
    if (dbManager && dbManager.namespace) {
      conditions.push(`json_extract(fts.metadata, '$.namespace') = '${dbManager.namespace}'`);
    }

    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  /**
   * Get query parameters for prepared statement
   */
  private getQueryParameters(query: SearchQuery): unknown[] {
    const limit = Math.min(query.limit || 10, this.maxResultsPerQuery);
    const offset = query.offset || 0;

    return [
      this.buildFTSQuery(query), // FTS query string
      limit,                     // LIMIT
      offset                     // OFFSET
    ];
  }

  /**
    * Execute FTS query with comprehensive error handling and timeout
    */
  private async executeFTSQuery(sql: string, parameters: unknown[], query: SearchQuery): Promise<unknown[]> {
    const dbManager = this.databaseManager as any;
    const db = dbManager?.prisma || this.databaseManager;

    return Promise.race([
      db.$queryRawUnsafe(sql, ...parameters),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new SearchTimeoutError(
          this.name,
          this.queryTimeout,
          'fts_database_query',
          { query: query.text, sql: sql.substring(0, 100) + '...' }
        )), this.queryTimeout);
      })
    ]);
  }

  /**
   * Process FTS results and transform to SearchResult format
   */
  private processFTSResults(results: unknown[], query: SearchQuery): SearchResult[] {
    const searchResults: SearchResult[] = [];

    for (const row of results as DatabaseQueryResult[]) {
      try {
        const metadata = JSON.parse(row.metadata);

        // Calculate normalized score with BM25 weighting
        const rawScore = row.search_score || 0;
        const normalizedScore = this.normalizeBM25Score(rawScore, query);

        searchResults.push({
          id: row.memory_id,
          content: row.searchable_content,
          metadata: {
            summary: metadata.summary || '',
            category: row.category_primary,
            importanceScore: row.importance_score || 0.5,
            memoryType: row.memory_type,
            createdAt: new Date(row.created_at),
            rawBM25Score: rawScore,
            ...metadata
          },
          score: normalizedScore,
          strategy: this.name,
          timestamp: new Date(row.created_at),
        });

      } catch (error) {
        console.warn('Error processing FTS result row:', {
          rowId: row.memory_id,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }
    }

    return searchResults;
  }

  /**
   * Normalize BM25 scores to 0-1 range with query-specific adjustments
   */
  private normalizeBM25Score(rawScore: number, query: SearchQuery): number {
    // Apply BM25 score normalization and query complexity weighting
    const baseScore = Math.min(rawScore / 1000, 1.0); // Normalize to 0-1 range

    // Boost score for exact phrase matches
    if (query.text.includes('"')) {
      return Math.min(baseScore * 1.2, 1.0);
    }

    // Boost score for longer, more specific queries
    if (query.text.split(' ').length > 3) {
      return Math.min(baseScore * 1.1, 1.0);
    }

    return baseScore;
  }

  /**
   * Get configuration schema for this strategy
   */
  protected getConfigurationSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        priority: { type: 'number', minimum: 0, maximum: 100 },
        timeout: { type: 'number', minimum: 1000, maximum: 30000 },
        maxResults: { type: 'number', minimum: 1, maximum: 1000 },
        bm25Weights: {
          type: 'object',
          properties: {
            title: { type: 'number', minimum: 0, maximum: 10 },
            content: { type: 'number', minimum: 0, maximum: 10 },
            category: { type: 'number', minimum: 0, maximum: 10 }
          }
        }
      },
      required: ['priority', 'timeout', 'maxResults']
    };
  }

  /**
   * Get performance metrics for this strategy
   */
  protected getPerformanceMetrics(): SearchStrategyMetadata['performanceMetrics'] {
    return {
      averageResponseTime: 50,
      throughput: 1000,
      memoryUsage: 15
    };
  }

  /**
    * Validate strategy-specific configuration
    */
   protected validateStrategyConfiguration(): boolean {
     // Validate BM25 weights
     const weights = this.bm25Weights;
     if (weights.title < 0 || weights.content < 0 || weights.category < 0) {
       return false;
     }

     // Validate query timeout
     if (this.queryTimeout < 1000 || this.queryTimeout > 30000) {
       return false;
     }

     return true;
   }

   /**
    * Categorize FTS-specific errors for better error handling
    */
   private categorizeFTSError(error: unknown): string {
     const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

     if (errorMessage.includes('no such table') || errorMessage.includes('table not found')) {
       return 'critical'; // FTS table missing
     }

     if (errorMessage.includes('syntax error') || errorMessage.includes('malformed query')) {
       return 'high'; // Query syntax issues
     }

     if (errorMessage.includes('database locked') || errorMessage.includes('busy')) {
       return 'medium'; // Temporary database issues
     }

     if (errorMessage.includes('out of memory') || errorMessage.includes('too many terms')) {
       return 'high'; // Resource issues
     }

     return 'medium'; // Default category
   }

   /**
    * Get database state for error context
    */
   private getDatabaseState(): Record<string, unknown> {
     try {
       const dbManager = this.databaseManager as any;
       return {
         connectionStatus: dbManager?.isConnected ? 'connected' : 'disconnected',
         ftsEnabled: dbManager?.isFTSEnabled ? dbManager.isFTSEnabled() : false,
         lastError: dbManager?.lastError,
       };
     } catch {
       return {
         connectionStatus: 'error',
       };
     }
   }

}

/**
 * Semantic search strategy (placeholder for future implementation)
 */
class SemanticSearchStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.SEMANTIC;
  readonly priority = 8;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;
  readonly description = 'Semantic search using embeddings (placeholder implementation)';
  readonly capabilities = [SearchCapability.SEMANTIC_SEARCH] as const;

  canHandle(query: SearchQuery): boolean {
    return Boolean(query.text && query.text.trim().length > 0);
  }

  getMetadata(): import('./SearchStrategy').SearchStrategyMetadata {
    return {
      name: this.name,
      version: '1.0.0',
      description: this.description,
      capabilities: [...this.capabilities],
      supportedMemoryTypes: [...this.supportedMemoryTypes],
      configurationSchema: {
        type: 'object',
        properties: {
          priority: { type: 'number', minimum: 0, maximum: 100 },
          timeout: { type: 'number', minimum: 1000, maximum: 30000 }
        }
      },
      performanceMetrics: {
        averageResponseTime: 200,
        throughput: 100,
        memoryUsage: 50
      }
    };
  }

  async validateConfiguration(): Promise<boolean> {
    return true;
  }

  async search(_query: SearchQuery): Promise<SearchResult[]> {
    // Placeholder implementation - would use embeddings for semantic search
    console.log('Semantic search not yet implemented, skipping...');
    return [];
  }

  async execute(_query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    return this.search(_query);
  }
}

/**
 * Main SearchService implementation that orchestrates multiple search strategies
 */
export class SearchService implements ISearchService {
     private strategies: Map<SearchStrategy, ISearchStrategy> = new Map();
     private dbManager!: DatabaseManager;
     private advancedFilterEngine?: AdvancedFilterEngine;
     private configManager: SearchStrategyConfigManager;
     private searchIndexManager?: SearchIndexManager;

    constructor(dbManager: DatabaseManager, configManager?: SearchStrategyConfigManager) {
      this.dbManager = dbManager;
      this.advancedFilterEngine = new AdvancedFilterEngine();
      this.configManager = configManager || new SearchStrategyConfigManager();
      this.initializeStrategies();
    }

  /**
    * Initialize all available search strategies
    */
   private async initializeStrategies(): Promise<void> {
     try {
       // Initialize configuration manager and load configurations
       await this.initializeStrategyConfigurations();

       // Initialize strategies with their configurations
       await this.initializeFTSStrategy();
       await this.initializeLikeStrategy();
       await this.initializeRecentStrategy();
       await this.initializeSemanticStrategy();
       await this.initializeCategoryFilterStrategy();
       await this.initializeTemporalFilterStrategy();
       await this.initializeMetadataFilterStrategy();
       await this.initializeRelationshipStrategy();

     } catch (error) {
       console.error('Failed to initialize search strategies:', error);
       // Fall back to basic initialization
       this.initializeStrategiesFallback();
     }
   }

   /**
    * Initialize strategy configurations
    */
   private async initializeStrategyConfigurations(): Promise<void> {
     const strategyNames = Object.values(SearchStrategy);

     for (const strategyName of strategyNames) {
       try {
         // Try to load existing configuration
         let config = await this.configManager.loadConfiguration(strategyName);

         // If no configuration exists, use default
         if (!config) {
           config = this.configManager.getDefaultConfiguration(strategyName);
           // Save the default configuration for future use
           await this.configManager.saveConfiguration(strategyName, config);
         }

         // Cache the configuration for this strategy
         (this as any)[`${strategyName}_config`] = config;
       } catch (error) {
         console.warn(`Failed to load configuration for ${strategyName}, using defaults:`, error);
         // Use default configuration as fallback
         const config = this.configManager.getDefaultConfiguration(strategyName);
         (this as any)[`${strategyName}_config`] = config;
       }
     }
   }

   /**
    * Initialize FTS5 strategy with configuration
    */
   private async initializeFTSStrategy(): Promise<void> {
     const config = (this as any)[`${SearchStrategy.FTS5}_config`] as SearchStrategyConfiguration;

     if (config?.enabled) {
       const ftsStrategy = new SQLiteFTSStrategy(this.dbManager);

       // Apply FTS5-specific configuration
       if (config.strategySpecific) {
         const ftsConfig = config.strategySpecific as any;
         if (ftsConfig.bm25Weights) {
           // Update BM25 weights if configured
           (ftsStrategy as any).bm25Weights = { ... (ftsStrategy as any).bm25Weights, ...ftsConfig.bm25Weights };
         }
         if (ftsConfig.queryTimeout) {
           (ftsStrategy as any).queryTimeout = ftsConfig.queryTimeout;
         }
         if (ftsConfig.resultBatchSize) {
           (ftsStrategy as any).resultBatchSize = ftsConfig.resultBatchSize;
         }
       }

       this.strategies.set(SearchStrategy.FTS5, ftsStrategy);
     }
   }

   /**
    * Initialize LIKE strategy with configuration
    */
   private async initializeLikeStrategy(): Promise<void> {
     const config = (this as any)[`${SearchStrategy.LIKE}_config`] as SearchStrategyConfiguration;

     if (config?.enabled) {
       const likeStrategy = new LikeSearchStrategy(this.dbManager);

       // Apply LIKE-specific configuration
       if (config.strategySpecific) {
         const likeConfig = config.strategySpecific as any;

         // Update LIKE configuration
         if (likeConfig.wildcardSensitivity) {
           (likeStrategy as any).likeConfig.wildcardSensitivity = likeConfig.wildcardSensitivity;
         }
         if (likeConfig.maxWildcardTerms) {
           (likeStrategy as any).likeConfig.maxWildcardTerms = likeConfig.maxWildcardTerms;
         }
         if (likeConfig.enablePhraseSearch !== undefined) {
           (likeStrategy as any).likeConfig.enablePhraseSearch = likeConfig.enablePhraseSearch;
         }
         if (likeConfig.caseSensitive !== undefined) {
           (likeStrategy as any).likeConfig.caseSensitive = likeConfig.caseSensitive;
         }
         if (likeConfig.relevanceBoost) {
           (likeStrategy as any).likeConfig.relevanceBoost = { ... (likeStrategy as any).likeConfig.relevanceBoost, ...likeConfig.relevanceBoost };
         }
       }

       this.strategies.set(SearchStrategy.LIKE, likeStrategy);
     }
   }

   /**
    * Initialize Recent Memories strategy with configuration
    */
   private async initializeRecentStrategy(): Promise<void> {
     const config = (this as any)[`${SearchStrategy.RECENT}_config`] as SearchStrategyConfiguration;

     if (config?.enabled) {
       const strategyConfig = {
         enabled: config.enabled,
         priority: config.priority,
         timeout: config.timeout,
         maxResults: config.maxResults,
         minScore: config.scoring?.baseWeight || 0.1
       };

       const recentStrategy = new RecentMemoriesStrategy(strategyConfig, this.dbManager);

       // Apply strategy-specific configuration
       if (config.strategySpecific) {
         const recentConfig = config.strategySpecific as any;
         // Update time windows if configured
         if (recentConfig.timeWindows) {
           (recentStrategy as any).timeWindows = { ... (recentStrategy as any).timeWindows, ...recentConfig.timeWindows };
         }
         if (recentConfig.maxAge) {
           (recentStrategy as any).maxAge = recentConfig.maxAge;
         }
       }

       this.strategies.set(SearchStrategy.RECENT, recentStrategy);
     }
   }

   /**
    * Initialize Semantic strategy with configuration
    */
   private async initializeSemanticStrategy(): Promise<void> {
     const config = (this as any)[`${SearchStrategy.SEMANTIC}_config`] as SearchStrategyConfiguration;

     if (config?.enabled) {
       const semanticStrategy = new SemanticSearchStrategy();

       // Apply semantic-specific configuration
       if (config.strategySpecific) {
         // Store configuration for runtime use
         (semanticStrategy as any).config = config.strategySpecific;
       }

       this.strategies.set(SearchStrategy.SEMANTIC, semanticStrategy);
     }
   }

   /**
    * Initialize Category Filter strategy with configuration
    */
   private async initializeCategoryFilterStrategy(): Promise<void> {
     const config = (this as any)[`${SearchStrategy.CATEGORY_FILTER}_config`] as SearchStrategyConfiguration;

     if (config?.enabled) {
       const hierarchyConfig = config.strategySpecific?.hierarchy as any || {};
       const performanceConfig = config.strategySpecific?.performance as any || {};

       const categoryConfig = {
         hierarchy: {
           maxDepth: 5,
           enableCaching: true,
           ...hierarchyConfig,
         },
         performance: {
           enableQueryOptimization: true,
           enableResultCaching: true,
           maxExecutionTime: 10000,
           batchSize: 100,
           ...performanceConfig,
         },
       };

       const categoryStrategy = new CategoryFilterStrategy(categoryConfig, this.dbManager);
       this.strategies.set(SearchStrategy.CATEGORY_FILTER, categoryStrategy);
     }
   }

   /**
    * Initialize Temporal Filter strategy with configuration
    */
   private async initializeTemporalFilterStrategy(): Promise<void> {
     const config = (this as any)[`${SearchStrategy.TEMPORAL_FILTER}_config`] as SearchStrategyConfiguration;

     if (config?.enabled) {
       const naturalLanguageConfig = config.strategySpecific?.naturalLanguage as any || {};
       const temporalPerformanceConfig = config.strategySpecific?.performance as any || {};

       const temporalConfig = {
         naturalLanguage: {
           enableParsing: true,
           enablePatternMatching: true,
           confidenceThreshold: 0.3,
           ...naturalLanguageConfig,
         },
         performance: {
           enableQueryOptimization: true,
           enableResultCaching: true,
           maxExecutionTime: 10000,
           batchSize: 100,
           ...temporalPerformanceConfig,
         },
       };

       const temporalStrategy = new TemporalFilterStrategy(temporalConfig, this.dbManager);
       this.strategies.set(SearchStrategy.TEMPORAL_FILTER, temporalStrategy);
     }
   }

   /**
    * Initialize Metadata Filter strategy with configuration
    */
   private async initializeMetadataFilterStrategy(): Promise<void> {
     const config = (this as any)[`${SearchStrategy.METADATA_FILTER}_config`] as SearchStrategyConfiguration;

     if (config?.enabled) {
       const fieldsConfig = config.strategySpecific?.fields as any || {};
       const validationConfig = config.strategySpecific?.validation as any || {};
       const metadataPerformanceConfig = config.strategySpecific?.performance as any || {};

       const metadataConfig = {
         fields: {
           enableNestedAccess: true,
           maxDepth: 5,
           enableTypeValidation: true,
           enableFieldDiscovery: true,
           ...fieldsConfig,
         },
         validation: {
           strictValidation: false,
           enableCustomValidators: true,
           failOnInvalidMetadata: false,
           ...validationConfig,
         },
         performance: {
           enableQueryOptimization: true,
           enableResultCaching: true,
           maxExecutionTime: 10000,
           batchSize: 100,
           cacheSize: 100,
           ...metadataPerformanceConfig,
         },
       };

       const metadataStrategy = new MetadataFilterStrategy(metadataConfig, this.dbManager);
       this.strategies.set(SearchStrategy.METADATA_FILTER, metadataStrategy);
     }
   }

   /**
    * Initialize Relationship strategy with configuration
    */
   private async initializeRelationshipStrategy(): Promise<void> {
     const config = (this as any)[`${SearchStrategy.RELATIONSHIP}_config`] as SearchStrategyConfiguration;

     if (config?.enabled) {
       const relationshipStrategy = new RelationshipSearchStrategy(this.dbManager);

       // Apply relationship-specific configuration
       if (config.strategySpecific) {
         const relationshipConfig = config.strategySpecific as any;

         // Update relationship configuration
         if (relationshipConfig.maxDepth) {
           (relationshipStrategy as any).maxDepth = relationshipConfig.maxDepth;
         }
         if (relationshipConfig.minRelationshipStrength !== undefined) {
           (relationshipStrategy as any).minRelationshipStrength = relationshipConfig.minRelationshipStrength;
         }
         if (relationshipConfig.minRelationshipConfidence !== undefined) {
           (relationshipStrategy as any).minRelationshipConfidence = relationshipConfig.minRelationshipConfidence;
         }
         if (relationshipConfig.includeRelationshipPaths !== undefined) {
           (relationshipStrategy as any).includeRelationshipPaths = relationshipConfig.includeRelationshipPaths;
         }
         if (relationshipConfig.traversalStrategy) {
           (relationshipStrategy as any).traversalStrategy = relationshipConfig.traversalStrategy;
         }
       }

       this.strategies.set(SearchStrategy.RELATIONSHIP, relationshipStrategy);
     }
   }

   /**
    * Fallback strategy initialization (when configuration loading fails)
    */
   private initializeStrategiesFallback(): void {
     this.strategies.set(SearchStrategy.FTS5, new SQLiteFTSStrategy(this.dbManager));
     this.strategies.set(SearchStrategy.LIKE, new LikeSearchStrategy(this.dbManager));
     this.strategies.set(SearchStrategy.RECENT, new RecentMemoriesStrategy({
       enabled: true,
       priority: 3,
       timeout: 5000,
       maxResults: 100,
       minScore: 0.1
     }, this.dbManager));
     this.strategies.set(SearchStrategy.SEMANTIC, new SemanticSearchStrategy());

     // Add Category Filter Strategy
     this.strategies.set(SearchStrategy.CATEGORY_FILTER, new CategoryFilterStrategy({
       hierarchy: {
         maxDepth: 5,
         enableCaching: true,
       },
       performance: {
         enableQueryOptimization: true,
         enableResultCaching: true,
         maxExecutionTime: 10000,
         batchSize: 100,
       },
     }, this.dbManager));

     // Add Temporal Filter Strategy
     this.strategies.set(SearchStrategy.TEMPORAL_FILTER, new TemporalFilterStrategy({
       naturalLanguage: {
         enableParsing: true,
         enablePatternMatching: true,
         confidenceThreshold: 0.3,
       },
       performance: {
         enableQueryOptimization: true,
         enableResultCaching: true,
         maxExecutionTime: 10000,
         batchSize: 100,
       },
     }, this.dbManager));

     // Add Metadata Filter Strategy
     this.strategies.set(SearchStrategy.METADATA_FILTER, new MetadataFilterStrategy({
       fields: {
         enableNestedAccess: true,
         maxDepth: 5,
         enableTypeValidation: true,
         enableFieldDiscovery: true,
       },
       validation: {
         strictValidation: false,
         enableCustomValidators: true,
         failOnInvalidMetadata: false,
       },
       performance: {
         enableQueryOptimization: true,
         enableResultCaching: true,
         maxExecutionTime: 10000,
         batchSize: 100,
         cacheSize: 100
       },
     }, this.dbManager));

     // Add Relationship Search Strategy
     this.strategies.set(SearchStrategy.RELATIONSHIP, new RelationshipSearchStrategy(this.dbManager));
   }

  /**
   * Main search method that orchestrates multiple strategies
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];
      const seenIds = new Set<string>();

      // Determine strategy execution order based on query characteristics
      const strategyOrder = this.determineStrategyOrder(query);

      for (const strategyName of strategyOrder) {
        const strategy = this.strategies.get(strategyName);
        if (!strategy) continue;

        try {
          const strategyResults = await this.executeStrategy(strategy, query);

          // Deduplicate results across strategies
          for (const result of strategyResults) {
            if (!seenIds.has(result.id)) {
              seenIds.add(result.id);
              results.push(result);
            }
          }

          // Stop if we have enough results
          if (results.length >= (query.limit || 10)) break;

        } catch (error) {
          // Enhanced error handling with fallback logic
          const shouldRetry = this.shouldRetryStrategy(strategyName, error);
          const shouldFallback = this.shouldFallbackToAlternative(strategyName, error);

          if (shouldRetry) {
            try {
              console.warn(`Retrying strategy ${strategyName} after error:`, error);
              const retryResults = await this.executeStrategyWithRetry(strategy, query, 2);
              for (const result of retryResults) {
                if (!seenIds.has(result.id)) {
                  seenIds.add(result.id);
                  results.push(result);
                }
              }
            } catch (retryError) {
              console.warn(`Retry failed for strategy ${strategyName}:`, retryError);
              if (shouldFallback) {
                await this.executeFallbackStrategy(strategyName, query, results, seenIds);
              }
            }
          } else if (shouldFallback) {
            await this.executeFallbackStrategy(strategyName, query, results, seenIds);
          } else {
            console.warn(`Strategy ${strategyName} failed and no retry/fallback available:`, error);
          }
          continue;
        }
      }

      // Apply advanced filtering if filterExpression is provided
      if (query.filterExpression && this.advancedFilterEngine) {
        try {
          const filteredResults = await this.applyAdvancedFilter(results, query.filterExpression);
          return this.rankAndSortResults(filteredResults, query);
        } catch (error) {
          console.warn('Advanced filter execution failed, falling back to regular results:', error);
          // Fall back to regular results if filtering fails
        }
      }

      return this.rankAndSortResults(results, query);

    } catch (error) {
      throw new SearchError(
        `Search operation failed: ${error instanceof Error ? error.message : String(error)}`,
        'search_service',
        {
          strategy: 'search_service',
          operation: 'orchestrated_search',
          query: query.text,
          parameters: { limit: query.limit, offset: query.offset },
          timestamp: new Date(),
        },
        error instanceof Error ? error : undefined,
        SearchErrorCategory.EXECUTION,
      );
    }
  }

  /**
   * Search with a specific strategy
   */
  async searchWithStrategy(query: SearchQuery, strategy: SearchStrategy): Promise<SearchResult[]> {
    const searchStrategy = this.strategies.get(strategy);
    if (!searchStrategy) {
      throw new StrategyNotFoundError(strategy);
    }

    try {
      const results = await this.executeStrategy(searchStrategy, query);
      return this.rankAndSortResults(results, query);
    } catch (error) {
      throw new SearchStrategyError(
        strategy,
        `Strategy ${strategy} failed: ${error instanceof Error ? error.message : String(error)}`,
        'search_with_strategy',
        { query: query.text, limit: query.limit, offset: query.offset },
        error instanceof Error ? error : undefined,
      );
    }
  }

  /**
   * Get all available strategies
   */
  getAvailableStrategies(): SearchStrategy[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get a specific strategy by name
   */
  getStrategy(name: string): ISearchStrategy | null {
    const strategy = this.strategies.get(name as SearchStrategy);
    return strategy || null;
  }

  /**
   * Determine the order of strategy execution based on query characteristics
   */
  private determineStrategyOrder(query: SearchQuery): SearchStrategy[] {
    const strategies: SearchStrategy[] = [];

    // If query is empty, prioritize recent memories
    if (!query.text || query.text.trim() === '') {
      return [SearchStrategy.RECENT];
    }

    // Add FTS5 as primary strategy for keyword searches (only if FTS5 is available)
    const fts5Strategy = this.strategies.get(SearchStrategy.FTS5);
    if (fts5Strategy && fts5Strategy.canHandle(query)) {
      strategies.push(SearchStrategy.FTS5);
    }

    // Add category filter strategy for category-based queries
    const queryFilters = query.filters || {};
    if (queryFilters.categories || this.hasCategoryIndicators(query.text)) {
      strategies.splice(1, 0, SearchStrategy.CATEGORY_FILTER); // Insert after FTS5
    }

    // Add temporal filter strategy for temporal queries
    if (this.hasTemporalIndicators(query.text) || this.hasTemporalFilters(query)) {
      strategies.splice(2, 0, SearchStrategy.TEMPORAL_FILTER); // Insert after category filter
    }

    // Add metadata filter strategy for metadata-based queries
    const filters = query.filters || {};
    if (filters.metadataFilters || this.hasMetadataIndicators(query.text)) {
      strategies.splice(3, 0, SearchStrategy.METADATA_FILTER); // Insert after temporal filter
    }

    // Add semantic search for complex queries
    if (this.isComplexQuery(query.text)) {
      strategies.push(SearchStrategy.SEMANTIC);
    }

    // Add LIKE as fallback
    strategies.push(SearchStrategy.LIKE);

    return strategies;
  }

  /**
    * Execute a single strategy with error handling
    */
  private async executeStrategy(strategy: ISearchStrategy, query: SearchQuery): Promise<SearchResult[]> {
    const timeout = 5000; // 5 second timeout

    return Promise.race([
      strategy.execute(query, this.dbManager),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new SearchTimeoutError(
          strategy.name,
          timeout,
          'strategy_execution',
          { query: query.text, strategy: strategy.name }
        )), timeout);
      })
    ]);
  }

  /**
   * Rank and sort results based on relevance and query criteria
   */
  private rankAndSortResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
    // Calculate composite scores for ranking
    results.forEach(result => {
      result.score = this.calculateCompositeScore(result, query);
    });

    // Sort by composite score
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = query.limit || 10;
    return results.slice(0, limit);
  }

  /**
   * Calculate composite score for ranking results
   */
  private calculateCompositeScore(result: SearchResult, query: SearchQuery): number {
    let score = result.score;

    // Boost score based on strategy priority
    const strategy = this.strategies.get(result.strategy as SearchStrategy);
    if (strategy) {
      score *= (1 + strategy.priority / 100);
    }

    // Apply query-specific boosts
    if (query.text && result.content.toLowerCase().includes(query.text.toLowerCase())) {
      score *= 1.2; // Boost exact matches
    }

    return score;
  }

  /**
    * Determine if a query is complex and should use semantic search
    */
  private isComplexQuery(query: string): boolean {
    const words = query.split(/\s+/).length;
    return words > 3 || query.includes('because') || query.includes('therefore') || query.includes('however');
  }

  /**
   * Check if query text contains category indicators
   */
  private hasCategoryIndicators(query: string): boolean {
    if (!query) return false;

    const categoryKeywords = [
      'category', 'type', 'kind', 'sort', 'classification',
      'programming', 'database', 'framework', 'language',
      'personal', 'work', 'project', 'learning', 'education',
    ];

    const lowerQuery = query.toLowerCase();
    return categoryKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Check if query text contains temporal indicators
   */
  private hasTemporalIndicators(query: string): boolean {
    if (!query) return false;

    const temporalKeywords = [
      'time', 'date', 'when', 'before', 'after', 'during',
      'recent', 'old', 'new', 'latest', 'earliest',
      'today', 'yesterday', 'tomorrow', 'week', 'month', 'year',
      'hour', 'minute', 'second', 'ago', 'since', 'until'
    ];

    const lowerQuery = query.toLowerCase();
    return temporalKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Check if query has temporal filters
   */
  private hasTemporalFilters(query: SearchQuery): boolean {
    if (!query.filters) return false;

    const temporalFields = ['createdAfter', 'createdBefore', 'since', 'until', 'age', 'timeRange'];
    return temporalFields.some(field => field in query.filters!);
  }

  /**
   * Check if query text contains metadata indicators
   */
  private hasMetadataIndicators(query: string): boolean {
    if (!query) return false;

    const metadataKeywords = [
      'metadata', 'meta', 'field', 'property', 'key', 'value',
      'json_extract', 'json_type', 'json_valid'
    ];

    const lowerQuery = query.toLowerCase();
    return metadataKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Apply advanced filter expression to search results
   */
  private async applyAdvancedFilter(results: SearchResult[], filterExpression: string): Promise<SearchResult[]> {
    if (!this.advancedFilterEngine || !filterExpression.trim()) {
      return results;
    }

    try {
      // Parse the filter expression
      const filterNode = this.advancedFilterEngine.parseFilter(filterExpression);

      // Execute the filter on the results
      const filterResult = await this.advancedFilterEngine.executeFilter(filterNode, results);

      // Return filtered results as SearchResult array
      return filterResult.filteredItems as SearchResult[];
    } catch (error) {
      console.error('Failed to apply advanced filter:', error);
      throw new SearchError(
        `Advanced filter execution failed: ${error instanceof Error ? error.message : String(error)}`,
        'search_service',
        {
          strategy: 'search_service',
          operation: 'advanced_filter',
          filterExpression,
          resultCount: results.length,
          timestamp: new Date(),
        },
        error instanceof Error ? error : undefined,
        SearchErrorCategory.EXECUTION,
      );
    }
  }

  /**
   * Determine if a strategy should be retried after failure
   */
  private shouldRetryStrategy(strategyName: SearchStrategy, error: unknown): boolean {
    // Retry on transient errors for certain strategies
    const retryableStrategies = [SearchStrategy.FTS5, SearchStrategy.LIKE];
    if (!retryableStrategies.includes(strategyName)) {
      return false;
    }

    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Retry on database busy/locked errors
    if (errorMessage.includes('database locked') || errorMessage.includes('busy') || errorMessage.includes('timeout')) {
      return true;
    }

    // Retry on network-related errors (if applicable)
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return true;
    }

    return false;
  }

  /**
   * Determine if fallback strategy should be used
   */
  private shouldFallbackToAlternative(strategyName: SearchStrategy, error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Always fallback for critical errors
    if (errorMessage.includes('no such table') || errorMessage.includes('database not found')) {
      return true;
    }

    // Fallback for configuration errors
    if (errorMessage.includes('configuration') || errorMessage.includes('invalid config')) {
      return true;
    }

    // Don't fallback for validation errors (user input issues)
    if (errorMessage.includes('validation') || errorMessage.includes('invalid query')) {
      return false;
    }

    return true; // Default to fallback for most cases
  }

  /**
   * Execute strategy with retry logic
   */
  private async executeStrategyWithRetry(strategy: ISearchStrategy, query: SearchQuery, maxRetries: number): Promise<SearchResult[]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeStrategy(strategy, query);
      } catch (error) {
        lastError = error;

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Execute fallback strategy when primary strategy fails
   */
  private async executeFallbackStrategy(failedStrategy: SearchStrategy, query: SearchQuery, results: SearchResult[], seenIds: Set<string>): Promise<void> {
    // Determine appropriate fallback strategy
    let fallbackStrategy: SearchStrategy;

    switch (failedStrategy) {
      case SearchStrategy.FTS5:
        fallbackStrategy = SearchStrategy.LIKE;
        break;
      case SearchStrategy.LIKE:
        fallbackStrategy = SearchStrategy.RECENT;
        break;
      default:
        fallbackStrategy = SearchStrategy.RECENT;
        break;
    }

    const fallbackStrategyInstance = this.strategies.get(fallbackStrategy);
    if (!fallbackStrategyInstance) {
      console.warn(`No fallback strategy available for ${failedStrategy}`);
      return;
    }

    try {
      console.log(`Executing fallback strategy ${fallbackStrategy} for failed strategy ${failedStrategy}`);
      const fallbackResults = await this.executeStrategy(fallbackStrategyInstance, query);

      // Add fallback results that haven't been seen before
      for (const result of fallbackResults) {
        if (!seenIds.has(result.id)) {
          seenIds.add(result.id);
          results.push(result);
        }
      }
    } catch (fallbackError) {
      console.warn(`Fallback strategy ${fallbackStrategy} also failed:`, fallbackError);
    }
  }

  /**
   * Get index health report
   */
  public async getIndexHealthReport(): Promise<IndexHealthReport> {
    const indexManager = this.getSearchIndexManager();
    return await indexManager.getIndexHealthReport();
  }

  /**
   * Check if index health is acceptable for search operations
   */
  public async isIndexHealthy(): Promise<boolean> {
    try {
      const report = await this.getIndexHealthReport();
      return report.health !== IndexHealth.CORRUPTED && report.health !== IndexHealth.CRITICAL;
    } catch (error) {
      logError('Failed to check index health', {
        component: 'SearchService',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Perform index optimization
   */
  public async optimizeIndex(): Promise<import('./SearchIndexManager').OptimizationResult> {
    const indexManager = this.getSearchIndexManager();
    return await indexManager.optimizeIndex();
  }

  /**
   * Create index backup
   */
  public async createIndexBackup(): Promise<import('./SearchIndexManager').BackupMetadata> {
    const indexManager = this.getSearchIndexManager();
    return await indexManager.createBackup();
  }

  /**
   * Restore index from backup
   */
  public async restoreIndexFromBackup(backupId: string): Promise<boolean> {
    const indexManager = this.getSearchIndexManager();
    return await indexManager.restoreFromBackup(backupId);
  }

  /**
   * Get search index manager instance
   */
  private getSearchIndexManager(): SearchIndexManager {
    if (!this.searchIndexManager) {
      this.searchIndexManager = new SearchIndexManager(this.dbManager);
    }
    return this.searchIndexManager;
  }

  /**
   * Get maintenance status
   */
  public getMaintenanceStatus(): {
    isOptimizing: boolean;
    lastHealthCheck: Date | null;
    nextHealthCheck: Date | null;
    nextOptimizationCheck: Date | null;
    nextBackup: Date | null;
  } {
    const indexManager = this.getSearchIndexManager();
    return indexManager.getMaintenanceStatus();
  }
}