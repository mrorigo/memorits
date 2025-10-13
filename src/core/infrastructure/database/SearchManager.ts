import { MemoryClassification, MemoryImportanceLevel } from '../../types/schemas';
import { MemorySearchResult, SearchOptions } from '../../types/models';
import { logInfo, logError } from '../config/Logger';
import { FTSManager } from './FTSManager';
import { SearchService } from '../../domain/search/SearchService';
import { SearchQuery, SearchResult } from '../../domain/search/types';
import { ValidationError } from '../config/SanitizationUtils';
import { PrismaClient } from '@prisma/client';

/**
 * Search statistics interface for tracking search performance
 */
export interface SearchStatistics {
  totalSearches: number;
  averageLatency: number;
  strategyUsage: Record<string, number>;
  errorCount: number;
  lastSearchTime?: Date;
}

/**
 * SearchManager class for high-level search operations
 * Coordinates between FTS5 and basic search strategies using FTSManager
 */
export class SearchManager {
  private ftsManager: FTSManager;
  private searchService?: SearchService;
  private prisma: PrismaClient;
  private searchStatistics: SearchStatistics = {
    totalSearches: 0,
    averageLatency: 0,
    strategyUsage: {},
    errorCount: 0,
  };

  constructor(ftsManager: FTSManager, searchService?: SearchService, prismaClient?: PrismaClient) {
    this.ftsManager = ftsManager;
    this.searchService = searchService;
    // If no PrismaClient provided, we'll need to get it from FTSManager or require it
    this.prisma = prismaClient || (ftsManager as any).prisma;
  }

  /**
   * Main search method that orchestrates search strategies
   */
  async searchMemories(query: string, options: SearchOptions = {}): Promise<MemorySearchResult[]> {
    const startTime = Date.now();
    const operationType = query.trim() ? 'search_with_query' : 'search_empty';

    try {
      logInfo('Starting memory search operation', {
        component: 'SearchManager',
        operation: operationType,
        queryLength: query.length,
        options: {
          namespace: options.namespace,
          limit: options.limit,
          includeMetadata: options.includeMetadata,
          minImportance: options.minImportance,
          categoriesCount: options.categories?.length || 0,
        },
      });

      // Validate search options
      const validation = this.validateSearchOptions(options);
      if (!validation.isValid) {
        throw new ValidationError(
          `Invalid search options: ${validation.errors.join(', ')}`,
          'searchOptions',
          JSON.stringify(options),
          'search_validation',
        );
      }

      // Use SearchService if available for enhanced search capabilities
      if (this.searchService) {
        return await this.searchWithSearchService(query, options, startTime);
      }

      // Fallback to direct FTSManager coordination
      return await this.searchWithFTSCoordination(query, options, startTime);

    } catch (error) {
      const latency = Date.now() - startTime;

      // Update error statistics
      this.searchStatistics.errorCount++;
      this.searchStatistics.totalSearches++;

      logError('Memory search operation failed', {
        component: 'SearchManager',
        operation: operationType,
        error: error instanceof Error ? error.message : String(error),
        latency,
        queryLength: query.length,
        options: {
          namespace: options.namespace,
          limit: options.limit,
        },
      });

      // Update average latency even for failed searches
      this.updateAverageLatency(latency);

      throw error;
    }
  }

  /**
   * Search using SearchService for enhanced capabilities
   */
  private async searchWithSearchService(
    query: string,
    options: SearchOptions,
    startTime: number,
  ): Promise<MemorySearchResult[]> {
    if (!this.searchService) {
      throw new Error('SearchService not available');
    }

    // Convert SearchOptions to SearchQuery
    const searchQuery: SearchQuery = {
      text: query,
      limit: options.limit,
      offset: 0, // Not directly supported in SearchOptions, default to 0
      includeMetadata: options.includeMetadata,
      filters: options.minImportance || options.categories || options.temporalFilters ? {
        minImportance: options.minImportance,
        categories: options.categories,
        ...(options.temporalFilters && { temporalFilters: options.temporalFilters }),
      } : undefined,
      filterExpression: options.filterExpression,
    };

    // Execute search using SearchService
    const searchResults = await this.searchService.search(searchQuery);

    // Transform SearchResult[] to MemorySearchResult[]
    const results = searchResults.map((result: SearchResult) => ({
      id: result.id,
      content: result.content,
      summary: result.metadata?.summary as string || '',
      classification: (result.metadata?.category as string || 'unknown') as MemoryClassification,
      importance: (result.metadata?.importance as string || 'medium') as MemoryImportanceLevel,
      topic: result.metadata?.category as string || undefined,
      entities: [],
      keywords: [],
      confidenceScore: result.score,
      classificationReason: result.strategy,
      metadata: options.includeMetadata ? {
        searchScore: result.score,
        searchStrategy: result.strategy,
        memoryType: result.metadata?.memoryType as string || 'long_term',
        category: result.metadata?.category as string,
        importanceScore: result.metadata?.importanceScore as number || 0.5,
      } : undefined,
    }));

    const latency = Date.now() - startTime;

    // Update statistics
    this.updateSearchStatistics('search_service', latency, true);

    logInfo('Search completed using SearchService', {
      component: 'SearchManager',
      strategy: 'search_service',
      resultCount: results.length,
      latency,
      queryLength: query.length,
    });

    return results;
  }

  /**
   * Search using direct FTSManager coordination with fallback
   */
  private async searchWithFTSCoordination(
    query: string,
    options: SearchOptions,
    startTime: number,
  ): Promise<MemorySearchResult[]> {
    // Determine search strategy based on query and FTS availability
    const strategy = this.determineSearchStrategy(query, options);

    try {
      let results: MemorySearchResult[];

      switch (strategy) {
      case 'fts5':
        results = await this.searchWithFTS5(query, options);
        break;
      case 'basic':
        results = await this.searchWithBasic(query, options);
        break;
      default:
        throw new Error(`Unknown search strategy: ${strategy}`);
      }

      const latency = Date.now() - startTime;

      // Update statistics
      this.updateSearchStatistics(strategy, latency, true);

      logInfo('Search completed successfully', {
        component: 'SearchManager',
        strategy,
        resultCount: results.length,
        latency,
        queryLength: query.length,
        namespace: options.namespace,
      });

      return results;

    } catch (error) {
      const latency = Date.now() - startTime;

      logError('Primary search strategy failed, attempting fallback', {
        component: 'SearchManager',
        strategy,
        error: error instanceof Error ? error.message : String(error),
        latency,
      });

      // Attempt fallback strategy
      return await this.executeFallbackSearch(query, options, strategy, startTime);
    }
  }

  /**
   * Search using FTS5 strategy via FTSManager
   */
  private async searchWithFTS5(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
    if (!this.ftsManager.isFTSEnabled()) {
      throw new Error('FTS5 is not enabled');
    }

    return await this.ftsManager.searchMemoriesFTS(query, options);
  }

  /**
   * Search using basic strategy (fallback)
   */
  private async searchWithBasic(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
    // Implement basic search using Prisma queries when FTS is not available
    try {
      logInfo('Executing basic search strategy', {
        component: 'SearchManager',
        queryLength: query.length,
        namespace: options.namespace,
      });

      const limit = Math.min(options.limit || 10, 1000);

      // Build where clause for basic search using raw SQL for flexibility
      let whereClause = '1=1'; // Default condition
      const params: any[] = [];

      // Add text search in searchableContent and summary
      if (query && query.trim()) {
        const searchTerm = `%${query.trim()}%`;
        whereClause += ' AND (searchableContent LIKE ? OR summary LIKE ?)';
        params.push(searchTerm, searchTerm);
      }

      // Add namespace filter
      if (options.namespace) {
        whereClause += ' AND namespace = ?';
        params.push(options.namespace);
      }

      // Add importance filter
      if (options.minImportance) {
        const minScore = this.calculateImportanceScore(options.minImportance);
        whereClause += ' AND importanceScore >= ?';
        params.push(minScore);
      }

      // Add category filter
      if (options.categories && options.categories.length > 0) {
        const placeholders = options.categories.map(() => '?').join(',');
        whereClause += ` AND categoryPrimary IN (${placeholders})`;
        params.push(...options.categories);
      }

      // Execute search using raw SQL for better compatibility
      const longTermQuery = `
        SELECT id, searchableContent, summary, categoryPrimary, retentionType, importanceScore, extractionTimestamp, namespace
        FROM long_term_memory
        WHERE ${whereClause}
        ORDER BY importanceScore DESC
        LIMIT ?
      `;

      const shortTermQuery = `
        SELECT id, searchableContent, summary, categoryPrimary, retentionType, importanceScore, createdAt, namespace
        FROM short_term_memory
        WHERE ${whereClause}
        ORDER BY importanceScore DESC
        LIMIT ?
      `;

      const [longTermResults, shortTermResults] = await Promise.all([
        this.prisma.$queryRawUnsafe(longTermQuery, ...params, Math.floor(limit / 2)),
        this.prisma.$queryRawUnsafe(shortTermQuery, ...params, Math.floor(limit / 2)),
      ]);

      // Transform results to MemorySearchResult format
      const results: MemorySearchResult[] = [];

      // Process long-term memory results
      for (const memory of longTermResults as any[]) {
        results.push({
          id: memory.id,
          content: memory.searchableContent || '',
          summary: memory.summary || '',
          classification: 'unknown' as MemoryClassification,
          importance: 'medium' as MemoryImportanceLevel,
          topic: undefined,
          entities: [],
          keywords: [],
          confidenceScore: 0.5,
          classificationReason: '',
          metadata: options.includeMetadata ? {
            searchScore: 0.5,
            searchStrategy: 'basic',
            memoryType: 'long_term',
            category: memory.categoryPrimary,
            importanceScore: memory.importanceScore,
          } : undefined,
        });
      }

      // Process short-term memory results
      for (const memory of shortTermResults as any[]) {
        results.push({
          id: memory.id,
          content: memory.searchableContent || '',
          summary: memory.summary || '',
          classification: 'unknown' as MemoryClassification,
          importance: 'medium' as MemoryImportanceLevel,
          topic: undefined,
          entities: [],
          keywords: [],
          confidenceScore: 0.5,
          classificationReason: '',
          metadata: options.includeMetadata ? {
            searchScore: 0.5,
            searchStrategy: 'basic',
            memoryType: 'short_term',
            category: memory.categoryPrimary,
            importanceScore: memory.importanceScore,
          } : undefined,
        });
      }

      logInfo('Basic search completed successfully', {
        component: 'SearchManager',
        resultCount: results.length,
        longTermCount: (longTermResults as any[]).length,
        shortTermCount: (shortTermResults as any[]).length,
      });

      return results;

    } catch (error) {
      logError('Basic search failed', {
        component: 'SearchManager',
        query,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate importance score from importance level (same as FTSManager)
   */
  private calculateImportanceScore(level: string): number {
    const scores = {
      [MemoryImportanceLevel.CRITICAL]: 0.9,
      [MemoryImportanceLevel.HIGH]: 0.7,
      [MemoryImportanceLevel.MEDIUM]: 0.5,
      [MemoryImportanceLevel.LOW]: 0.3,
    };
    return scores[level as MemoryImportanceLevel] || 0.5;
  }

  /**
   * Execute fallback search when primary strategy fails
   */
  private async executeFallbackSearch(
    query: string,
    options: SearchOptions,
    failedStrategy: string,
    startTime: number,
  ): Promise<MemorySearchResult[]> {
    let fallbackStrategy: string;

    // Determine appropriate fallback strategy
    switch (failedStrategy) {
    case 'fts5':
      fallbackStrategy = 'basic';
      break;
    case 'basic':
      fallbackStrategy = 'fts5'; // Try FTS5 if basic fails
      break;
    default:
      fallbackStrategy = 'basic';
      break;
    }

    try {
      logInfo('Attempting fallback search strategy', {
        component: 'SearchManager',
        failedStrategy,
        fallbackStrategy,
      });

      let results: MemorySearchResult[];

      switch (fallbackStrategy) {
      case 'fts5':
        results = await this.searchWithFTS5(query, options);
        break;
      case 'basic':
        results = await this.searchWithBasic(query, options);
        break;
      default:
        throw new Error('No valid fallback strategy available');
      }

      const latency = Date.now() - startTime;

      // Update statistics for fallback
      this.updateSearchStatistics(`${failedStrategy}_fallback_${fallbackStrategy}`, latency, true);

      logInfo('Fallback search completed successfully', {
        component: 'SearchManager',
        originalStrategy: failedStrategy,
        fallbackStrategy,
        resultCount: results.length,
        latency,
      });

      return results;

    } catch (fallbackError) {
      const latency = Date.now() - startTime;

      logError('Fallback search also failed', {
        component: 'SearchManager',
        failedStrategy,
        fallbackStrategy,
        error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
        latency,
      });

      // Update statistics for failed fallback
      this.updateSearchStatistics(failedStrategy, latency, false);

      throw new Error(`Both primary (${failedStrategy}) and fallback (${fallbackStrategy}) search strategies failed`);
    }
  }

  /**
   * Determine the best search strategy based on query and options
   */
  private determineSearchStrategy(query: string, _options: SearchOptions): string {
    // Use FTS5 if available and query is meaningful
    if (this.ftsManager.isFTSEnabled() && query && query.trim()) {
      return 'fts5';
    }

    // Fall back to basic search
    return 'basic';
  }

  /**
   * Validate search options
   */
  validateSearchOptions(options: SearchOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate limit
    if (options.limit !== undefined) {
      if (typeof options.limit !== 'number' || options.limit < 1) {
        errors.push('Limit must be a positive number');
      }
      if (options.limit > 1000) {
        errors.push('Limit cannot exceed 1000');
      }
    }

    // Validate namespace
    if (options.namespace !== undefined) {
      if (typeof options.namespace !== 'string') {
        errors.push('Namespace must be a string');
      }
      if (options.namespace.length > 100) {
        errors.push('Namespace is too long (max 100 characters)');
      }
    }

    // Validate categories
    if (options.categories !== undefined) {
      if (!Array.isArray(options.categories)) {
        errors.push('Categories must be an array');
      } else {
        const invalidCategories = options.categories.filter(cat =>
          !cat || typeof cat !== 'string' || cat.length > 50,
        );
        if (invalidCategories.length > 0) {
          errors.push('Invalid categories found');
        }
      }
    }

    // Validate min importance
    if (options.minImportance !== undefined) {
      const validImportanceLevels = Object.values(MemoryImportanceLevel);
      if (!validImportanceLevels.includes(options.minImportance)) {
        errors.push('Invalid minimum importance level');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get available search strategies
   */
  getSearchStrategies(): string[] {
    const strategies: string[] = [];

    if (this.ftsManager.isFTSEnabled()) {
      strategies.push('fts5');
    }

    strategies.push('basic');

    if (this.searchService) {
      strategies.push('search_service');
    }

    return strategies;
  }

  /**
   * Get search statistics
   */
  getSearchStats(): SearchStatistics {
    return { ...this.searchStatistics };
  }

  /**
   * Update search statistics
   */
  private updateSearchStatistics(strategy: string, latency: number, success: boolean): void {
    this.searchStatistics.totalSearches++;
    this.searchStatistics.lastSearchTime = new Date();

    // Update strategy usage
    this.searchStatistics.strategyUsage[strategy] =
      (this.searchStatistics.strategyUsage[strategy] || 0) + 1;

    // Update average latency
    this.updateAverageLatency(latency);

    // Update error count if failed
    if (!success) {
      this.searchStatistics.errorCount++;
    }
  }

  /**
   * Update average latency calculation
   */
  private updateAverageLatency(latency: number): void {
    const total = this.searchStatistics.totalSearches;
    const currentAvg = this.searchStatistics.averageLatency;

    // Calculate new average using rolling average formula
    this.searchStatistics.averageLatency = (currentAvg * (total - 1) + latency) / total;
  }

  /**
   * Reset search statistics
   */
  resetSearchStats(): void {
    this.searchStatistics = {
      totalSearches: 0,
      averageLatency: 0,
      strategyUsage: {},
      errorCount: 0,
    };

    logInfo('Search statistics reset', {
      component: 'SearchManager',
    });
  }

  /**
   * Get FTS status through FTSManager
   */
  async getFTSStatus(): Promise<{
    enabled: boolean;
    isValid: boolean;
    issues: string[];
    stats: { tables: number; triggers: number; indexes: number };
  }> {
    return await this.ftsManager.getFTSStatus();
  }

  /**
   * Initialize FTS support through FTSManager
   */
  async initializeFTSSupport(): Promise<void> {
    await this.ftsManager.initializeFTSSupport();
  }
}