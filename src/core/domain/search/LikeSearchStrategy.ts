import { SearchCapability, SearchStrategyMetadata, SearchStrategyError } from './SearchStrategy';
import { SearchQuery, SearchResult, ISearchStrategy, SearchStrategy, DatabaseQueryResult } from './types';
import { DatabaseManager } from '../../infrastructure/database/DatabaseManager';
import { logError, logWarn, logInfo } from '../../infrastructure/config/Logger';

/**
 * Comprehensive LIKE-based search strategy implementation
 * Provides fallback search functionality when FTS5 is unavailable
 * Supports partial matching with configurable wildcards and metadata filtering
 */
export class LikeSearchStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.LIKE;
  readonly priority = 5;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;

  readonly description = 'LIKE-based search for partial matching and fallback';
  readonly capabilities = [
    SearchCapability.KEYWORD_SEARCH,
    SearchCapability.FILTERING,
    SearchCapability.RELEVANCE_SCORING,
  ] as const;

  // Configuration for LIKE search optimization
  private readonly likeConfig = {
    wildcardSensitivity: 'medium', // low, medium, high
    maxWildcardTerms: 10,
    enablePhraseSearch: true,
    caseSensitive: false,
    relevanceBoost: {
      exactMatch: 1.5,
      prefixMatch: 1.2,
      suffixMatch: 1.1,
      partialMatch: 1.0,
    },
  };

  private readonly databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  /**
   * Determines if this strategy can handle the given query
   */
  canHandle(query: SearchQuery): boolean {
    // Can handle any text-based query as fallback when FTS5 is unavailable
    return query.text.length > 0;
  }

  /**
   * Main search method implementing LIKE-based search (required by ISearchStrategy)
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Build LIKE query with proper escaping and wildcards
      const likeQuery = this.buildLikeQuery(query.text);
      const sql = this.buildLikeSQL(query, likeQuery);

      // Execute the query
      const results = await this.executeLikeQuery(sql);
      const processedResults = this.processLikeResults(results, query);

      // Log performance metrics
      const duration = Date.now() - startTime;
      logInfo(`LIKE search completed in ${duration}ms, found ${processedResults.length} results`, {
        component: 'LikeSearchStrategy',
        operation: 'execute',
        strategy: this.name,
        duration: `${duration}ms`,
        resultCount: processedResults.length
      });

      return processedResults;

    } catch (error) {
      const duration = Date.now() - startTime;

      // Enhanced error context with detailed information
      const errorContext = {
        strategy: this.name,
        operation: 'like_search',
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
        severity: this.categorizeLikeError(error) as 'low' | 'medium' | 'high' | 'critical',
      };

      // Log detailed error information
      logError(`LIKE search failed after ${duration}ms`, {
        component: 'LikeSearchStrategy',
        operation: 'search',
        strategy: this.name,
        query: query.text,
        executionTime: duration,
        errorCategory: this.categorizeLikeError(error),
        databaseState: this.getDatabaseState(),
        error: error instanceof Error ? error.message : String(error)
      });

      throw new SearchStrategyError(
        this.name,
        `LIKE strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        'like_search',
        errorContext,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Legacy execute method for backward compatibility
   */
  async execute(query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Build LIKE query with proper escaping and wildcards
      const likeQuery = this.buildLikeQuery(query.text);
      const sql = this.buildLikeSQL(query, likeQuery);

      // Execute the query
      const results = await this.executeLikeQuery(sql);
      const processedResults = this.processLikeResults(results, query);

      // Log performance metrics
      const duration = Date.now() - startTime;
      logInfo(`LIKE search completed in ${duration}ms, found ${processedResults.length} results`, {
        component: 'LikeSearchStrategy',
        operation: 'search',
        strategy: this.name,
        duration: `${duration}ms`,
        resultCount: processedResults.length
      });

      return processedResults;

    } catch (error) {
      const duration = Date.now() - startTime;
      logError(`LIKE search failed after ${duration}ms`, {
        component: 'LikeSearchStrategy',
        operation: 'execute',
        strategy: this.name,
        error: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`
      });

      throw new SearchStrategyError(
        this.name,
        `LIKE strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        'like_search',
        { query: query.text, duration: `${duration}ms` },
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Build optimized LIKE query with proper escaping and wildcards
   */
  private buildLikeQuery(searchText: string): string {
    let query = searchText.trim();

    if (!query) {
      throw new Error('Search text cannot be empty');
    }

    // Handle quoted phrases for exact matching
    if (this.likeConfig.enablePhraseSearch) {
      query = this.handleQuotedPhrases(query);
    }

    // Apply case sensitivity option
    if (!this.likeConfig.caseSensitive) {
      query = query.toLowerCase();
    }

    return query;
  }

  /**
   * Handle quoted phrases by preserving exact matches
   */
  private handleQuotedPhrases(query: string): string {
    const phraseRegex = /"([^"]+)"/g;
    return query.replace(phraseRegex, (match, phrase) => {
      // Replace spaces in phrases with wildcards for LIKE matching
      return phrase.replace(/\s+/g, '%');
    });
  }

  /**
   * Build optimized LIKE SQL with JOINs and metadata filtering
   */
  private buildLikeSQL(query: SearchQuery, likeQuery: string): string {
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Build WHERE clause with metadata filtering
    const whereClause = this.buildWhereClause(query);

    // Build ORDER BY clause for relevance scoring
    const orderByClause = this.buildOrderByClause(query);

    // Build search patterns for embedded queries
    const patterns: string[] = [];
    const cleanQuery = likeQuery.trim();

    if (cleanQuery) {
      // Exact match pattern
      patterns.push(cleanQuery);

      // Word-based patterns for individual terms
      const words = cleanQuery.split(/\s+/);
      for (const word of words) {
        if (word.length > 2) {
          patterns.push(word);
        }
      }

      // Prefix and suffix patterns for better matching
      if (cleanQuery.length > 3) {
        patterns.push(cleanQuery); // Already included above
      }
    }

    const patternConditions = this.buildPatternConditions(patterns);

    // Construct the main LIKE query with embedded patterns for simplicity
    const sql = `
            SELECT
                id as memory_id,
                searchableContent as searchable_content,
                summary,
                processedData as metadata,
                retentionType as memory_type,
                categoryPrimary as category_primary,
                importanceScore as importance_score,
                createdAt as created_at,
                '${this.name}' as search_strategy
            FROM (
                SELECT
                    id,
                    searchableContent,
                    summary,
                    processedData,
                    retentionType,
                    categoryPrimary,
                    importanceScore,
                    createdAt
                FROM short_term_memory
                WHERE ${patternConditions}
                   ${whereClause}

                UNION ALL

                SELECT
                    id,
                    searchableContent,
                    summary,
                    processedData,
                    retentionType,
                    categoryPrimary,
                    importanceScore,
                    createdAt
                FROM long_term_memory
                WHERE ${patternConditions}
                   ${whereClause}
            ) AS combined_memories
            ${orderByClause}
            LIMIT ${limit} OFFSET ${offset}
        `;

    return sql;
  }

  /**
   * Build content matching condition with proper LIKE syntax
   */
  private buildContentCondition(fieldName: string, searchValue: string): string {
    const conditions: string[] = [];

    // Exact phrase match (highest priority)
    if (searchValue.includes('%')) {
      conditions.push(`${fieldName} LIKE '%${this.escapeSqlString(searchValue)}%'`);
    } else {
      // Word-based matching with different strategies
      const words = searchValue.split(/\s+/);

      for (let i = 0; i < words.length && i < this.likeConfig.maxWildcardTerms; i++) {
        const word = words[i];
        if (word.length > 0) {
          conditions.push(`${fieldName} LIKE '%${this.escapeSqlString(word)}%'`);
        }
      }
    }

    return conditions.length > 1 ? `(${conditions.join(' OR ')})` : conditions[0];
  }

  /**
   * Build pattern conditions with embedded patterns (simpler approach)
   */
  private buildPatternConditions(patterns: string[]): string {
    const conditions: string[] = [];

    for (const pattern of patterns) {
      conditions.push(`searchableContent LIKE '%${this.escapeSqlString(pattern)}%'`);
      conditions.push(`summary LIKE '%${this.escapeSqlString(pattern)}%'`);
    }

    return `(${conditions.join(' OR ')})`;
  }

  /**
   * Build WHERE clause for metadata filtering
   */
  private buildWhereClause(query: SearchQuery): string {
    const conditions: string[] = [];

    // Add namespace filtering - use the database manager's namespace if available
    const dbManager = this.databaseManager as any;
    if (dbManager && dbManager.namespace) {
      conditions.push(`json_extract(metadata, '$.namespace') = '${dbManager.namespace}'`);
    }

    // Add filters from query if provided
    if (query.filters) {
      for (const [key, value] of Object.entries(query.filters)) {
        const condition = this.buildFilterCondition(key, value);
        if (condition) {
          conditions.push(condition);
        }
      }
    }

    return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  }

  /**
   * Build filter condition based on filter key-value pair
   */
  private buildFilterCondition(key: string, value: unknown): string | null {
    // Simple equality filter for basic implementation
    return `json_extract(metadata, '$.${key}') = '${this.escapeSqlString(String(value))}'`;
  }

  /**
   * Build ORDER BY clause for relevance scoring
   */
  private buildOrderByClause(query: SearchQuery): string {
    let orderBy = 'ORDER BY importance_score DESC, created_at DESC';

    // Add secondary sorting criteria
    if (query.sortBy) {
      const direction = query.sortBy.direction.toUpperCase();
      orderBy += `, ${query.sortBy.field} ${direction}`;
    }

    return orderBy;
  }



  /**
   * Execute LIKE query with comprehensive error handling
   */
  private async executeLikeQuery(sql: string): Promise<unknown[]> {
    const dbManager = this.databaseManager as any;
    const db = dbManager?.prisma || this.databaseManager;

    // Execute query with embedded patterns
    return await db.$queryRawUnsafe(sql);
  }

  /**
   * Process LIKE results and transform to SearchResult format
   */
  private processLikeResults(results: unknown[], query: SearchQuery): SearchResult[] {
    const searchResults: SearchResult[] = [];
    const likeQuery = this.buildLikeQuery(query.text);

    for (const row of results as DatabaseQueryResult[]) {
      try {
        const metadata = JSON.parse(row.metadata || '{}');

        // Calculate relevance score based on match quality
        const rawScore = this.calculateRelevanceScore(row, likeQuery, query);
        const normalizedScore = Math.max(0, Math.min(1, rawScore));

        searchResults.push({
          id: row.memory_id,
          content: row.searchable_content,
          metadata: {
            summary: row.summary || '',
            category: row.category_primary,
            importanceScore: row.importance_score || 0.5,
            memoryType: row.memory_type,
            createdAt: new Date(row.created_at),
            ...metadata,
          },
          score: normalizedScore,
          strategy: this.name,
          timestamp: new Date(row.created_at),
        });

      } catch (error) {
        logWarn('Error processing LIKE result row', {
          component: 'LikeSearchStrategy',
          operation: 'processLikeResults',
          rowId: row.memory_id,
          error: error instanceof Error ? error.message : String(error)
        });
        continue;
      }
    }

    return searchResults;
  }

  /**
   * Calculate relevance score based on match quality and position
   */
  private calculateRelevanceScore(row: DatabaseQueryResult, searchQuery: string, _query: SearchQuery): number {
    let score = 0.3; // Base score for LIKE matches

    const content = (row.searchable_content || '').toLowerCase();
    const summary = (row.summary || '').toLowerCase();
    const searchTerms = searchQuery.toLowerCase().split(/\s+/);

    // Score based on content matching
    for (const term of searchTerms) {
      if (term.length < 2) continue;

      // Exact match boost
      if (content.includes(term)) {
        score += this.likeConfig.relevanceBoost.exactMatch * 0.1;
      }

      // Prefix match boost
      if (content.startsWith(term)) {
        score += this.likeConfig.relevanceBoost.prefixMatch * 0.1;
      }

      // Summary match (higher weight)
      if (summary.includes(term)) {
        score += this.likeConfig.relevanceBoost.exactMatch * 0.15;
      }
    }

    // Boost based on importance score
    const importance = row.importance_score || 0.5;
    score *= (0.5 + importance);

    // Boost based on memory type (short_term might be more relevant)
    if (row.memory_type === 'short_term') {
      score *= 1.1;
    }

    return score;
  }

  /**
   * Escape SQL strings to prevent injection
   */
  private escapeSqlString(str: string): string {
    return str.replace(/'/g, '\'\'').replace(/\\/g, '\\\\');
  }

  /**
   * Get configuration schema for this strategy
   */
  protected getConfigurationSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        enabled: { type: 'boolean', default: true },
        priority: { type: 'number', minimum: 0, maximum: 100, default: 5 },
        timeout: { type: 'number', minimum: 1000, maximum: 30000, default: 5000 },
        maxResults: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
        minScore: { type: 'number', minimum: 0, maximum: 1, default: 0.1 },
        wildcardSensitivity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          default: 'medium',
        },
        enablePhraseSearch: { type: 'boolean', default: true },
        caseSensitive: { type: 'boolean', default: false },
      },
      required: ['enabled', 'priority', 'timeout', 'maxResults'],
    };
  }

  /**
   * Get performance metrics for this strategy
   */
  protected getPerformanceMetrics(): SearchStrategyMetadata['performanceMetrics'] {
    return {
      averageResponseTime: 100,
      throughput: 500,
      memoryUsage: 5,
    };
  }

  /**
    * Validate strategy-specific configuration
    */
  protected validateStrategyConfiguration(): boolean {
    // Validate wildcard sensitivity
    const validSensitivities = ['low', 'medium', 'high'];
    if (!validSensitivities.includes(this.likeConfig.wildcardSensitivity)) {
      return false;
    }

    // Validate max wildcard terms
    if (this.likeConfig.maxWildcardTerms < 1 || this.likeConfig.maxWildcardTerms > 50) {
      return false;
    }

    return true;
  }

  /**
   * Categorize LIKE-specific errors for better error handling
   */
  private categorizeLikeError(error: unknown): string {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    if (errorMessage.includes('syntax error') || errorMessage.includes('malformed query')) {
      return 'high'; // Query syntax issues
    }

    if (errorMessage.includes('database locked') || errorMessage.includes('busy')) {
      return 'medium'; // Temporary database issues
    }

    if (errorMessage.includes('out of memory') || errorMessage.includes('too many terms')) {
      return 'high'; // Resource issues
    }

    if (errorMessage.includes('empty query') || errorMessage.includes('no search text')) {
      return 'low'; // User input issues
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
   * Get metadata about this search strategy
   */
  getMetadata(): SearchStrategyMetadata {
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
          timeout: { type: 'number', minimum: 1000, maximum: 30000 },
        },
      },
      performanceMetrics: {
        averageResponseTime: 100,
        throughput: 500,
        memoryUsage: 5,
      },
    };
  }

  /**
   * Validate the current configuration
   */
  async validateConfiguration(): Promise<boolean> {
    // Validate wildcard sensitivity
    const validSensitivities = ['low', 'medium', 'high'];
    if (!validSensitivities.includes(this.likeConfig.wildcardSensitivity)) {
      return false;
    }

    // Validate max wildcard terms
    if (this.likeConfig.maxWildcardTerms < 1 || this.likeConfig.maxWildcardTerms > 50) {
      return false;
    }

    return true;
  }
}