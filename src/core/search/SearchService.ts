import { SearchStrategy, SearchQuery, SearchResult, ISearchStrategy, ISearchService, SearchError, StrategyNotFoundError } from './types';
import { SearchCapability, SearchStrategyMetadata, SearchStrategyConfig, BaseSearchStrategy, SearchResultBuilder } from './SearchStrategy';
import { DatabaseManager } from '../database/DatabaseManager';

/**
 * Main SearchService implementation that orchestrates multiple search strategies
 * following the specification in PARITY_1.md section 2.2
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
    this.strategies.set(SearchStrategy.FTS5, new SQLiteFTSStrategy());
    this.strategies.set(SearchStrategy.LIKE, new LikeSearchStrategy());
    this.strategies.set(SearchStrategy.RECENT, new RecentMemoriesStrategy());
    this.strategies.set(SearchStrategy.SEMANTIC, new SemanticSearchStrategy());
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
}

/**
 * SQLite FTS5 search strategy implementation
 */
class SQLiteFTSStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.FTS5;
  readonly priority = 10;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;
  readonly description = 'Full-text search using SQLite FTS5 engine';
  readonly capabilities = [SearchCapability.KEYWORD_SEARCH, SearchCapability.RELEVANCE_SCORING] as const;

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
        averageResponseTime: 50,
        throughput: 1000,
        memoryUsage: 10
      }
    };
  }

  async validateConfiguration(): Promise<boolean> {
    return true;
  }

  async execute(query: SearchQuery, dbManager: DatabaseManager): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];

      // Build FTS query
      const ftsQuery = this.buildFTSQuery(query.text);

      // Execute raw SQL query
      const sql = `
        SELECT
          fts.memory_id,
          fts.memory_type,
          fts.summary,
          fts.searchable_content,
          fts.category_primary,
          fts.importance_score,
          fts.created_at,
          bm25(memory_search_fts) as search_score,
          'fts5' as search_strategy
        FROM memory_search_fts fts
        WHERE memory_search_fts MATCH ?
        ORDER BY bm25(memory_search_fts) DESC, fts.importance_score DESC
        LIMIT ?
      `;

      const db = (dbManager as any).prisma || dbManager;
      const queryResults = await db.$queryRawUnsafe(sql, ftsQuery, query.limit || 10);

      for (const row of queryResults as any[]) {
        results.push({
          id: row.memory_id,
          content: row.searchable_content,
          metadata: {
            summary: row.summary,
            category: row.category_primary,
            importanceScore: row.importance_score,
            memoryType: row.memory_type
          },
          score: row.search_score || 0.5,
          strategy: this.name,
          timestamp: new Date(row.created_at)
        });
      }

      return results;

    } catch (error) {
      throw new SearchError(
        `FTS5 strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        query,
        error instanceof Error ? error : undefined
      );
    }
  }

  private buildFTSQuery(query: string): string {
    const cleanQuery = query.replace(/"/g, '""').replace(/\*/g, '').trim();
    const terms = cleanQuery.split(/\s+/);

    if (terms.length === 1) {
      return `"${cleanQuery}"`;
    } else {
      return terms.map(term => `"${term}"`).join(' OR ');
    }
  }
}

/**
 * LIKE-based fallback search strategy
 */
class LikeSearchStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.LIKE;
  readonly priority = 5;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;
  readonly description = 'LIKE-based fallback search for partial matches';
  readonly capabilities = [SearchCapability.KEYWORD_SEARCH] as const;

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
        averageResponseTime: 100,
        throughput: 500,
        memoryUsage: 5
      }
    };
  }

  async validateConfiguration(): Promise<boolean> {
    return true;
  }

  async execute(query: SearchQuery, dbManager: DatabaseManager): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];
      const searchPatterns = this.buildSearchPatterns(query.text);

      for (const memoryType of this.supportedMemoryTypes) {
        const tableName = memoryType === 'short_term' ? 'short_term_memory' : 'long_term_memory';

        const orConditions = searchPatterns.map((pattern, index) =>
          `(summary LIKE $${index + 1} OR searchable_content LIKE $${index + 1})`
        ).join(' OR ');

        const sql = `
          SELECT
            memory_id,
            '${memoryType}' as memory_type,
            searchable_content,
            summary,
            category_primary,
            importance_score,
            created_at
          FROM ${tableName}
          WHERE ${orConditions}
          ORDER BY importance_score DESC, created_at DESC
          LIMIT ${query.limit || 10}
        `;

        const db = (dbManager as any).prisma || dbManager;
        const queryResults = await db.$queryRawUnsafe(sql, ...searchPatterns);

        for (const row of queryResults as any[]) {
          results.push({
            id: row.memory_id,
            content: row.searchable_content,
            metadata: {
              summary: row.summary,
              category: row.category_primary,
              importanceScore: row.importance_score,
              memoryType: row.memory_type
            },
            score: 0.4, // Lower score than FTS5
            strategy: this.name,
            timestamp: new Date(row.created_at)
          });
        }
      }

      return results;

    } catch (error) {
      throw new SearchError(
        `LIKE strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        query,
        error instanceof Error ? error : undefined
      );
    }
  }

  private buildSearchPatterns(query: string): string[] {
    const patterns: string[] = [];
    const cleanQuery = query.trim();

    if (!cleanQuery) return patterns;

    patterns.push(`%${cleanQuery}%`);

    const words = cleanQuery.split(/\s+/);
    for (const word of words) {
      if (word.length > 2) {
        patterns.push(`%${word}%`);
      }
    }

    return patterns;
  }
}

/**
 * Recent memories search strategy
 */
class RecentMemoriesStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.RECENT;
  readonly priority = 3;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;
  readonly description = 'Search for most recent memories when no query is provided';
  readonly capabilities = [] as const;

  canHandle(query: SearchQuery): boolean {
    return !query.text || query.text.trim().length === 0;
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
        averageResponseTime: 30,
        throughput: 2000,
        memoryUsage: 2
      }
    };
  }

  async validateConfiguration(): Promise<boolean> {
    return true;
  }

  async execute(query: SearchQuery, dbManager: DatabaseManager): Promise<SearchResult[]> {
    try {
      const results: SearchResult[] = [];

      // Only execute if query is empty (recent memories)
      if (query.text && query.text.trim()) {
        return results;
      }

      const limit = query.limit || 10;
      const limitPerType = Math.ceil(limit / this.supportedMemoryTypes.length);

      for (const memoryType of this.supportedMemoryTypes) {
        const tableName = memoryType === 'short_term' ? 'short_term_memory' : 'long_term_memory';

        const sql = `
          SELECT
            memory_id,
            '${memoryType}' as memory_type,
            searchable_content,
            summary,
            category_primary,
            importance_score,
            created_at
          FROM ${tableName}
          ORDER BY created_at DESC, importance_score DESC
          LIMIT ${limitPerType}
        `;

        const db = (dbManager as any).prisma || dbManager;
        const queryResults = await db.$queryRawUnsafe(sql);

        for (const row of queryResults as any[]) {
          results.push({
            id: row.memory_id,
            content: row.searchable_content,
            metadata: {
              summary: row.summary,
              category: row.category_primary,
              importanceScore: row.importance_score,
              memoryType: row.memory_type
            },
            score: 1.0, // Highest score for recent memories
            strategy: this.name,
            timestamp: new Date(row.created_at)
          });
        }
      }

      return results;

    } catch (error) {
      throw new SearchError(
        `Recent memories strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        query,
        error instanceof Error ? error : undefined
      );
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

  async execute(_query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    // Placeholder implementation - would use embeddings for semantic search
    console.log('Semantic search not yet implemented, skipping...');
    return [];
  }
}