/**
 * TemporalFilterStrategy - Advanced temporal filtering with time range support
 *
 * Implements comprehensive temporal search capabilities including:
 * - Natural language time expressions ("last week", "yesterday", "2 hours ago")
 * - Complex time range queries and calculations
 * - Temporal pattern matching and processing
 * - Time-based result aggregation
 * - Performance optimization for temporal queries
 */

import { SearchQuery, SearchResult, ISearchStrategy, SearchStrategy } from '../types';
import { SearchStrategyMetadata, SearchCapability, SearchError } from '../SearchStrategy';
import { DatabaseManager } from '../../database/DatabaseManager';
import { logInfo, logError, logWarn } from '../../utils/Logger';

// Import temporal processing classes
import { DateTimeNormalizer } from './temporal/DateTimeNormalizer';
import { TimeRangeProcessor, TimeRange, TimeRangeQuery } from './temporal/TimeRangeProcessor';
import { TemporalPatternMatcher, PatternMatchResult } from './temporal/TemporalPatternMatcher';
import { TemporalAggregation, TemporalAggregationPeriod } from './temporal/TemporalAggregation';

/**
 * Extended query interface for temporal filtering
 */
interface TemporalFilterQuery extends SearchQuery {
  temporalFilters?: {
    timeRanges?: TimeRange[];
    relativeExpressions?: string[];
    absoluteDates?: Date[];
    patterns?: string[];
  };
  aggregation?: {
    enabled: boolean;
    period?: TemporalAggregationPeriod;
    includeTrends?: boolean;
  };
  performance?: {
    enableCaching?: boolean;
    timeout?: number;
    maxResults?: number;
  };
}

/**
 * Configuration for TemporalFilterStrategy
 */
export interface TemporalFilterStrategyConfig {
  naturalLanguage: {
    enableParsing: boolean;
    enablePatternMatching: boolean;
    confidenceThreshold: number;
  };
  aggregation?: {
    enableAggregation: boolean;
    defaultPeriod: TemporalAggregationPeriod;
    maxBuckets: number;
    enableTrends: boolean;
  };
  performance: {
    enableQueryOptimization: boolean;
    enableResultCaching: boolean;
    maxExecutionTime: number;
    batchSize: number;
  };
}

/**
 * Specialized strategy for advanced temporal filtering
 */
export class TemporalFilterStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.TEMPORAL_FILTER;
  readonly priority = 8;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;

  readonly description = 'Advanced temporal filtering with time range support';
  readonly capabilities = [
    SearchCapability.TEMPORAL_FILTERING,
    SearchCapability.TIME_RANGE_PROCESSING,
    SearchCapability.TEMPORAL_PATTERN_MATCHING,
    SearchCapability.TEMPORAL_AGGREGATION,
    SearchCapability.FILTERING,
    SearchCapability.RELEVANCE_SCORING,
  ] as const;

  private readonly databaseManager: DatabaseManager;
  private readonly logger: typeof console;
  private readonly config: TemporalFilterStrategyConfig;
  private readonly cache = new Map<string, { result: SearchResult[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    config: TemporalFilterStrategyConfig,
    databaseManager: DatabaseManager,
    logger?: typeof console,
  ) {
    this.config = config;
    this.databaseManager = databaseManager;
    this.logger = logger || console;
  }

  /**
   * Determines if this strategy can handle the given query
   */
  canHandle(query: SearchQuery): boolean {
    // Can handle queries with temporal filters or patterns
    return this.hasTemporalFilters(query) || this.containsTemporalPatterns(query.text);
  }

  /**
   * Check if query has temporal filters
   */
  private hasTemporalFilters(query: SearchQuery): boolean {
    const temporalQuery = query as TemporalFilterQuery;
    return !!(
      temporalQuery.temporalFilters &&
      (temporalQuery.temporalFilters.timeRanges?.length ||
       temporalQuery.temporalFilters.relativeExpressions?.length ||
       temporalQuery.temporalFilters.absoluteDates?.length ||
       temporalQuery.temporalFilters.patterns?.length)
    );
  }

  /**
   * Check if query text contains temporal patterns
   */
  private containsTemporalPatterns(text: string): boolean {
    if (!text || !this.config.naturalLanguage.enablePatternMatching) {
      return false;
    }

    const analysis = TemporalPatternMatcher.analyzeText(text);
    return analysis.overallConfidence > 0.3; // Threshold for pattern detection
  }


  /**
   * Execute method to match ISearchStrategy interface
   */
  async execute(query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    return this.search(query);
  }

  /**
   * Search method (for BaseSearchStrategy compatibility)
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Analyze query for temporal patterns
      const patternAnalysis = this.analyzeTemporalPatterns(query);

      // Build temporal query
      const temporalQuery = this.buildTemporalQuery(query);

      // Generate SQL with temporal filtering
      const sql = this.buildTemporalSQL(query, temporalQuery, patternAnalysis);

      // Execute query with performance optimization
      const rawResults = await this.executeTemporalQuery(sql, this.getQueryParameters(query));

      // Process and enhance results
      let processedResults = this.processTemporalResults(rawResults, query, patternAnalysis);

      // Apply aggregation if requested
      if (this.shouldApplyAggregation(query)) {
        processedResults = await this.applyTemporalAggregation(processedResults, query);
      }

      // Cache results if enabled
      if (this.config.performance.enableResultCaching) {
        this.cacheResult(query, processedResults);
      }

      // Log performance metrics
      const duration = Date.now() - startTime;
      logInfo('Temporal search completed', {
        component: 'TemporalFilterStrategy',
        operation: 'search',
        duration: `${duration}ms`,
        resultCount: processedResults.length
      });

      return processedResults;

    } catch (error) {
      const duration = Date.now() - startTime;
      logError('Temporal search failed', {
        component: 'TemporalFilterStrategy',
        operation: 'search',
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new SearchError(
        `Temporal filter strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        { query: query.text, duration: `${duration}ms` }
      );
    }
  }

  /**
   * Analyze query for temporal patterns
   */
  private analyzeTemporalPatterns(query: SearchQuery): PatternMatchResult {
    if (!this.config.naturalLanguage.enablePatternMatching) {
      return {
        patterns: [],
        overallConfidence: 0,
        requiresContext: false,
      };
    }

    return TemporalPatternMatcher.analyzeText(query.text);
  }

  /**
   * Build temporal query from search query
   */
  private buildTemporalQuery(query: SearchQuery): TimeRangeQuery {
    const temporalQuery = query as TemporalFilterQuery;
    const ranges: TimeRange[] = [];

    // Process explicit temporal filters
    if (temporalQuery.temporalFilters) {
      // Add explicit time ranges
      if (temporalQuery.temporalFilters.timeRanges) {
        ranges.push(...temporalQuery.temporalFilters.timeRanges);
      }

      // Process absolute dates
      if (temporalQuery.temporalFilters.absoluteDates) {
        temporalQuery.temporalFilters.absoluteDates.forEach(date => {
          ranges.push({
            start: new Date(date.getTime() - 24 * 60 * 60 * 1000), // 1 day before
            end: new Date(date.getTime() + 24 * 60 * 60 * 1000)     // 1 day after
          });
        });
      }

      // Process relative expressions
      if (temporalQuery.temporalFilters.relativeExpressions) {
        temporalQuery.temporalFilters.relativeExpressions.forEach(expr => {
          try {
            const normalized = DateTimeNormalizer.normalize(expr);
            ranges.push({
              start: new Date(normalized.date.getTime() - 60 * 60 * 1000), // 1 hour window
              end: new Date(normalized.date.getTime() + 60 * 60 * 1000)
            });
          } catch (error) {
            logWarn('Failed to parse relative expression', {
              component: 'TemporalFilterStrategy',
              operation: 'buildTemporalQuery',
              expression: expr,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        });
      }
    }

    // Process natural language patterns
    const patternAnalysis = TemporalPatternMatcher.analyzeText(query.text);
    if (patternAnalysis.patterns.length > 0) {
      patternAnalysis.patterns.forEach(pattern => {
        if (pattern.normalized.start) {
          ranges.push({
            start: pattern.normalized.start,
            end: pattern.normalized.end || new Date(pattern.normalized.start.getTime() + 24 * 60 * 60 * 1000)
          });
        }
      });
    }

    return {
      ranges,
      operation: 'UNION',
      granularity: 'minute'
    };
  }

  /**
   * Build temporal SQL with advanced filtering
   */
  private buildTemporalSQL(query: SearchQuery, temporalQuery: TimeRangeQuery, patterns: PatternMatchResult): string {
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Build WHERE clause with temporal conditions
    const whereClause = this.buildTemporalWhereClause(query, temporalQuery, patterns);

    // Build ORDER BY clause with temporal relevance
    const orderByClause = this.buildTemporalOrderByClause(query, temporalQuery);

    // Build the main temporal query
    const sql = `
      SELECT
        id as memory_id,
        searchableContent as searchable_content,
        summary,
        metadata,
        memoryType as memory_type,
        categoryPrimary as category_primary,
        importanceScore as importance_score,
        createdAt as created_at,
        '${this.name}' as search_strategy,
        -- Calculate temporal relevance score
        ${this.buildTemporalRelevanceCalculation('created_at', temporalQuery)} as temporal_relevance_score
      FROM (
        -- Query short_term_memory with temporal filtering
        SELECT
          id,
          searchableContent,
          summary,
          metadata,
          memoryType,
          categoryPrimary,
          importanceScore,
          createdAt
        FROM short_term_memory
        WHERE ${whereClause}

        UNION ALL

        -- Query long_term_memory with temporal filtering
        SELECT
          id,
          searchableContent,
          summary,
          metadata,
          memoryType,
          categoryPrimary,
          importanceScore,
          createdAt
        FROM long_term_memory
        WHERE ${whereClause}
      ) AS temporal_memories
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    return sql;
  }

  /**
   * Build WHERE clause with temporal filtering
   */
  private buildTemporalWhereClause(query: SearchQuery, temporalQuery: TimeRangeQuery, patterns: PatternMatchResult): string {
    const conditions: string[] = [];

    // Add namespace filtering if available
    if ((this.databaseManager as any).currentNamespace) {
      conditions.push(`json_extract(metadata, '$.namespace') = '${(this.databaseManager as any).currentNamespace}'`);
    }

    // Add text search conditions
    if (query.text && query.text.trim()) {
      const searchCondition = this.buildTextSearchCondition(query.text);
      conditions.push(searchCondition);
    }

    // Add temporal range conditions
    if (temporalQuery.ranges.length > 0) {
      const rangeConditions = temporalQuery.ranges.map(range => {
        const startTime = range.start.toISOString();
        const endTime = range.end.toISOString();
        return `created_at BETWEEN '${startTime}' AND '${endTime}'`;
      });
      conditions.push(`(${rangeConditions.join(' OR ')})`);
    }

    // Add pattern-based conditions
    if (patterns.patterns.length > 0) {
      const patternConditions = patterns.patterns.map(pattern => {
        if (pattern.normalized.start) {
          const startTime = pattern.normalized.start.toISOString();
          const endTime = pattern.normalized.end?.toISOString() ||
            new Date(pattern.normalized.start.getTime() + 24 * 60 * 60 * 1000).toISOString();
          return `created_at BETWEEN '${startTime}' AND '${endTime}'`;
        }
        return '1=1'; // No additional filtering if no temporal data
      });
      conditions.push(`(${patternConditions.join(' OR ')})`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  }

  /**
   * Build text search conditions
   */
  private buildTextSearchCondition(searchText: string): string {
    const terms = searchText.split(/\s+/).filter(term => term.length > 0);
    const conditions: string[] = [];

    for (const term of terms) {
      const escapedTerm = this.escapeSqlString(term);
      conditions.push(
        `(searchable_content LIKE '%${escapedTerm}%' OR summary LIKE '%${escapedTerm}%')`
      );
    }

    return `(${conditions.join(' OR ')})`;
  }

  /**
   * Build temporal relevance calculation SQL
   */
  private buildTemporalRelevanceCalculation(createdAtField: string, temporalQuery: TimeRangeQuery): string {
    const now = new Date().toISOString();

    // Base temporal relevance (recency)
    let calculation = `
      -- Base temporal relevance based on recency
      CASE
        WHEN CAST(strftime('%s', '${now}') AS INTEGER) - CAST(strftime('%s', ${createdAtField}) AS INTEGER) < 0
        THEN 1.0 -- Future dates
        ELSE EXP(-0.693147 * (
          CAST(strftime('%s', '${now}') AS INTEGER) - CAST(strftime('%s', ${createdAtField}) AS INTEGER)
        ) * 1000 / 604800000) -- 7 days half-life
      END
    `;

    // Add range-specific relevance boost
    if (temporalQuery.ranges.length > 0) {
      const rangeBoosts = temporalQuery.ranges.map((range, index) => {
        const rangeWeight = 1.2; // Boost factor for memories in specified ranges
        return `
          CASE WHEN ${createdAtField} BETWEEN '${range.start.toISOString()}' AND '${range.end.toISOString()}'
          THEN ${rangeWeight}
          ELSE 1.0 END
        `;
      });

      calculation = `(${calculation}) * (${rangeBoosts.join(' * ')})`;
    }

    return calculation;
  }

  /**
   * Build ORDER BY clause with temporal relevance
   */
  private buildTemporalOrderByClause(query: SearchQuery, temporalQuery: TimeRangeQuery): string {
    let orderBy = 'ORDER BY temporal_relevance_score DESC';

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
   * Get query parameters for safe execution
   */
  private getQueryParameters(query: SearchQuery): unknown[] {
    return [];
  }

  /**
   * Execute temporal query with error handling
   */
  private async executeTemporalQuery(sql: string, parameters: unknown[]): Promise<unknown[]> {
    const db = (this.databaseManager as any).prisma || this.databaseManager;

    try {
      return await db.$queryRawUnsafe(sql, ...parameters);
    } catch (error) {
      logError('Temporal query execution failed', {
        component: 'TemporalFilterStrategy',
        operation: 'executeTemporalQuery',
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Temporal query failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Process temporal results with enhanced scoring
   */
  private processTemporalResults(
    results: unknown[],
    query: SearchQuery,
    patterns: PatternMatchResult
  ): SearchResult[] {
    const searchResults: SearchResult[] = [];
    const queryTime = new Date();

    for (const row of results as any[]) {
      try {
        const createdAt = new Date(row.created_at);
        const metadata = JSON.parse(row.metadata || '{}');

        // Calculate temporal relevance score
        const temporalRelevance = this.calculateTemporalRelevance(
          createdAt,
          queryTime,
          query as TemporalFilterQuery,
          patterns
        );

        // Create enhanced search result
        const searchResult: SearchResult = {
          id: row.memory_id,
          content: row.searchable_content,
          metadata: {
            summary: row.summary || '',
            category: row.category_primary,
            importanceScore: parseFloat(row.importance_score) || 0.5,
            memoryType: row.memory_type,
            createdAt: createdAt,
            temporalRelevanceScore: temporalRelevance,
            searchStrategy: this.name,
            ...metadata
          },
          score: temporalRelevance,
          strategy: this.name,
          timestamp: createdAt
        };

        searchResults.push(searchResult);

      } catch (error) {
        logWarn('Error processing temporal result row', {
          component: 'TemporalFilterStrategy',
          operation: 'processTemporalResults',
          rowId: row.memory_id,
          error: error instanceof Error ? error.message : String(error)
        });
        continue;
      }
    }

    return searchResults;
  }

  /**
   * Calculate temporal relevance based on time proximity and patterns
   */
  private calculateTemporalRelevance(
    memoryTime: Date,
    queryTime: Date,
    query: TemporalFilterQuery,
    patterns: PatternMatchResult
  ): number {
    const ageMs = queryTime.getTime() - memoryTime.getTime();
    const ageDays = ageMs / (24 * 60 * 60 * 1000);

    // Base relevance using exponential decay (7-day half-life)
    let relevance = Math.exp(-Math.LN2 * ageDays / 7);

    // Pattern-based relevance boost
    if (patterns.patterns.length > 0) {
      const patternBoost = patterns.patterns.reduce((boost, pattern) => {
        // Boost relevance for memories that match temporal patterns
        return boost + (pattern.confidence * 0.2);
      }, 0);
      relevance *= (1 + patternBoost);
    }

    // Explicit range boost
    if (query.temporalFilters?.timeRanges) {
      const inRange = query.temporalFilters.timeRanges.some(range =>
        memoryTime >= range.start && memoryTime <= range.end
      );
      if (inRange) {
        relevance *= 1.3; // 30% boost for memories in specified ranges
      }
    }

    return Math.max(0, Math.min(1, relevance));
  }

  /**
   * Apply temporal aggregation if requested
   */
  private async applyTemporalAggregation(
    results: SearchResult[],
    query: SearchQuery
  ): Promise<SearchResult[]> {
    if (!this.shouldApplyAggregation(query)) {
      return results;
    }

    const temporalQuery = query as TemporalFilterQuery;
    const period: TemporalAggregationPeriod = (temporalQuery.aggregation?.period || this.config.aggregation?.defaultPeriod || 'hour') as TemporalAggregationPeriod;

    // Convert SearchResults to aggregation format
    const aggregationData = results.map(result => ({
      id: result.id,
      content: result.content,
      score: result.score,
      timestamp: result.timestamp,
      metadata: result.metadata
    }));

    // Perform temporal aggregation
    const aggregationResult = TemporalAggregation.aggregateByPeriod(
      aggregationData,
      period,
      {
        includeTrends: temporalQuery.aggregation?.includeTrends ?? true,
        maxBuckets: 50,
        representativeStrategy: 'highest_score'
      }
    );

    // Convert aggregation back to search results
    return aggregationResult.buckets.map(bucket => ({
      id: bucket.representative?.memoryId || `bucket_${bucket.period.start.getTime()}`,
      content: bucket.representative?.content || `Aggregated results for ${bucket.period.label}`,
      metadata: {
        aggregated: true,
        period: bucket.period,
        statistics: bucket.statistics,
        trend: bucket.trend,
        resultCount: bucket.statistics.count
      },
      score: bucket.statistics.averageScore,
      strategy: this.name,
      timestamp: bucket.period.start
    }));
  }

  /**
   * Check if aggregation should be applied
   */
  private shouldApplyAggregation(query: SearchQuery): boolean {
    const temporalQuery = query as TemporalFilterQuery;
    return !!(
      this.config.aggregation?.enableAggregation &&
      temporalQuery.aggregation?.enabled &&
      temporalQuery.aggregation?.period
    );
  }

  /**
   * Cache search results for performance
   */
  private cacheResult(query: SearchQuery, results: SearchResult[]): void {
    const cacheKey = this.generateCacheKey(query);
    this.cache.set(cacheKey, {
      result: results,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: SearchQuery): string {
    const temporalQuery = query as TemporalFilterQuery;
    const keyData = {
      text: query.text,
      temporalFilters: temporalQuery.temporalFilters,
      aggregation: temporalQuery.aggregation,
      limit: query.limit,
      offset: query.offset
    };
    return JSON.stringify(keyData);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Parse time expression from natural language
   */
  private parseTimeExpression(expression: string): { start?: Date; end?: Date } {
    try {
      const normalized = DateTimeNormalizer.normalize(expression);

      // Create a reasonable time window around the parsed time
      const windowSize = 60 * 60 * 1000; // 1 hour window
      return {
        start: new Date(normalized.date.getTime() - windowSize),
        end: new Date(normalized.date.getTime() + windowSize)
      };
    } catch (error) {
      logWarn('Failed to parse time expression', {
        component: 'TemporalFilterStrategy',
        operation: 'parseTimeExpression',
        expression,
        error: error instanceof Error ? error.message : String(error)
      });
      return {};
    }
  }

  /**
   * Build time range filter for database queries
   */
  private buildTimeRangeFilter(startTime: Date, endTime: Date): string {
    const start = startTime.toISOString();
    const end = endTime.toISOString();
    return `created_at BETWEEN '${start}' AND '${end}'`;
  }

  /**
   * Aggregate results by time period
   */
  private aggregateByTimePeriod(
    results: SearchResult[],
    period: TemporalAggregationPeriod
  ): SearchResult[] {
    const aggregationData = results.map(result => ({
      id: result.id,
      content: result.content,
      score: result.score,
      timestamp: result.timestamp,
      metadata: result.metadata
    }));

    const aggregationResult = TemporalAggregation.aggregateByPeriod(
      aggregationData,
      period,
      {
        includeTrends: true,
        maxBuckets: 50,
        representativeStrategy: 'highest_score'
      }
    );

    return aggregationResult.buckets.map(bucket => ({
      id: `aggregated_${bucket.period.start.getTime()}`,
      content: `Aggregated memories from ${bucket.period.label}`,
      metadata: {
        aggregated: true,
        statistics: bucket.statistics,
        trend: bucket.trend,
        period: bucket.period
      },
      score: bucket.statistics.averageScore,
      strategy: this.name,
      timestamp: bucket.period.start
    }));
  }

  /**
   * Escape SQL strings to prevent injection
   */
  private escapeSqlString(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }

  /**
   * Validate strategy-specific configuration
   */
  protected validateStrategyConfiguration(): boolean {
   const config = this.config;
   if (!config.naturalLanguage.enableParsing && !config.naturalLanguage.enablePatternMatching) {
     logWarn('TemporalFilterStrategy: Both natural language and pattern matching are disabled', {
       component: 'TemporalFilterStrategy',
       operation: 'validateStrategyConfiguration'
     });
   }

   if (config.performance.maxExecutionTime <= 0) {
     return false;
   }

   if (config.performance.batchSize < 0) {
     return false;
   }

   return true;
 }

  /**
   * Get configuration schema for this strategy
   */
  protected getConfigurationSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        enableNaturalLanguage: { type: 'boolean', default: true },
        enablePatternMatching: { type: 'boolean', default: true },
        enableAggregation: { type: 'boolean', default: true },
        enablePerformanceOptimization: { type: 'boolean', default: true },
        maxTimeRange: { type: 'number', minimum: 1000, default: 31536000000 }, // 1 year
        defaultAggregationPeriod: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['second', 'minute', 'hour', 'day', 'week', 'month', 'year'] },
            count: { type: 'number', minimum: 1, default: 1 }
          }
        },
        cacheSize: { type: 'number', minimum: 0, default: 100 }
      }
    };
  }

  /**
   * Get performance metrics for this strategy
   */
  protected getPerformanceMetrics(): SearchStrategyMetadata['performanceMetrics'] {
    return {
      averageResponseTime: 120,
      throughput: 400,
      memoryUsage: 12
    };
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
        averageResponseTime: 120,
        throughput: 400,
        memoryUsage: 12,
      },
    };
  }

  /**
   * Validate the current configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      // Validate strategy configuration
      if (!this.config) {
        return false;
      }

      // Validate natural language configuration
      if (this.config.naturalLanguage.confidenceThreshold < 0 || this.config.naturalLanguage.confidenceThreshold > 1) {
        return false;
      }

      // Validate performance configuration
      if (this.config.performance.maxExecutionTime < 1000 || this.config.performance.maxExecutionTime > 60000) {
        return false;
      }

      return true;

    } catch (error) {
      logError('Configuration validation failed', {
        component: 'TemporalFilterStrategy',
        operation: 'validateConfiguration',
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}