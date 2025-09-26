import { SearchStrategy, SearchQuery, SearchResult, ISearchStrategy, ISearchService, SearchError, StrategyNotFoundError } from './types';
import { SearchCapability, SearchStrategyMetadata, SearchStrategyConfig } from './SearchStrategy';
import { LikeSearchStrategy } from './LikeSearchStrategy';
import { RecentMemoriesStrategy } from './RecentMemoriesStrategy';
import { CategoryFilterStrategy } from './filtering/CategoryFilterStrategy';
import { TemporalFilterStrategy } from './filtering/TemporalFilterStrategy';
import { MetadataFilterStrategy } from './filtering/MetadataFilterStrategy';
import { DatabaseManager } from '../database/DatabaseManager';

/**
 * Main SearchService implementation that orchestrates multiple search strategies
 */
export class SearchService implements ISearchService {
  private strategies: Map<SearchStrategy, ISearchStrategy> = new Map();
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
    this.initializeStrategies();
  }

  /**
   * Initialize all available search strategies
   */
  private initializeStrategies(): void {
    this.strategies.set(SearchStrategy.FTS5, new SQLiteFTSStrategy(this.dbManager));
    this.strategies.set(SearchStrategy.LIKE, new LikeSearchStrategy(this.dbManager));
    // this.strategies.set(SearchStrategy.RECENT, new RecentMemoriesStrategy({}, this.dbManager));
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
          console.warn(`Strategy ${strategyName} failed:`, error);
          continue;
        }
      }

      return this.rankAndSortResults(results, query);

    } catch (error) {
      throw new SearchError(
        `Search operation failed: ${error instanceof Error ? error.message : String(error)}`,
        undefined,
        query,
        error instanceof Error ? error : undefined,
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
      throw new SearchError(
        `Strategy ${strategy} failed: ${error instanceof Error ? error.message : String(error)}`,
        strategy,
        query,
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

    // Add FTS5 as primary strategy for keyword searches
    strategies.push(SearchStrategy.FTS5);

    // Add category filter strategy for category-based queries
    const categoryQuery = query as any;
    if (categoryQuery.categories || this.hasCategoryIndicators(query.text)) {
      strategies.splice(1, 0, SearchStrategy.CATEGORY_FILTER); // Insert after FTS5
    }

    // Add temporal filter strategy for temporal queries
    if (this.hasTemporalIndicators(query.text) || this.hasTemporalFilters(query)) {
      strategies.splice(2, 0, SearchStrategy.TEMPORAL_FILTER); // Insert after category filter
    }

    // Add metadata filter strategy for metadata-based queries
    const metadataQuery = query as any;
    if (metadataQuery.metadataFilters || this.hasMetadataIndicators(query.text)) {
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
        setTimeout(() => reject(new Error(`Strategy ${strategy.name} timed out`)), timeout);
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
 }

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
    SearchCapability.SORTING
  ] as const;

  // FTS5-specific configuration
  private readonly bm25Weights = {
    title: 2.0,      // Weight for title/summary matches
    content: 1.0,    // Weight for content matches
    category: 1.5    // Weight for category matches
  };

  private readonly maxResultsPerQuery = 1000;
  private readonly queryTimeout = 10000; // 10 seconds
  private readonly resultBatchSize = 100;
  private readonly databaseManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.databaseManager = dbManager;
  }

  canHandle(query: SearchQuery): boolean {
    // Can handle text-based queries with optional metadata filters
    return Boolean(query.text && query.text.trim().length > 0);
  }

  async execute(query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Build FTS query with advanced features
      const ftsQuery = this.buildFTSQuery(query);
      const sql = this.buildFTSSQL(query, ftsQuery);
      const parameters = this.getQueryParameters(query);

      // Execute query with timeout and error handling
      const results = await this.executeFTSQuery(sql, parameters, query);
      const processedResults = this.processFTSResults(results, query);

      // Log performance metrics
      const duration = Date.now() - startTime;
      console.log(`FTS5 search completed in ${duration}ms, found ${processedResults.length} results`);

      return processedResults;

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`FTS5 search failed after ${duration}ms:`, error);

      throw new SearchError(
        `FTS5 strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        query,
        error instanceof Error ? error : undefined
      );
    }
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
            }
          }
        },
        required: ['priority', 'timeout', 'maxResults']
      },
      performanceMetrics: {
        averageResponseTime: 50,
        throughput: 1000,
        memoryUsage: 15
      }
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

    // Add namespace filtering if available
    if ((this.databaseManager as any).currentNamespace) {
      conditions.push(`json_extract(fts.metadata, '$.namespace') = '${(this.databaseManager as any).currentNamespace}'`);
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
    const db = (this.databaseManager as any).prisma || this.databaseManager;

    return Promise.race([
      db.$queryRawUnsafe(sql, ...parameters),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error(`FTS query timed out after ${this.queryTimeout}ms`)), this.queryTimeout);
      })
    ]);
  }

  /**
   * Process FTS results and transform to SearchResult format
   */
  private processFTSResults(results: unknown[], query: SearchQuery): SearchResult[] {
    const searchResults: SearchResult[] = [];

    for (const row of results as any[]) {
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
            importanceScore: parseFloat(row.importance_score) || 0.5,
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

  async execute(_query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    // Placeholder implementation - would use embeddings for semantic search
    console.log('Semantic search not yet implemented, skipping...');
    return [];
  }
}