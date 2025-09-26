import { SearchQuery, SearchResult, ISearchStrategy, SearchStrategy } from '../types';
import { DatabaseManager } from '../../database/DatabaseManager';
import { SearchStrategyMetadata, SearchCapability } from '../SearchStrategy';

/**
 * Extended query interface for category filtering
 */
interface CategoryFilterQuery extends SearchQuery {
  categories?: string[];
  categoryHierarchy?: string[];
  categoryOperator?: 'AND' | 'OR' | 'HIERARCHY';
  enableRelevanceBoost?: boolean;
  enableAggregation?: boolean;
  minCategoryRelevance?: number;
  maxCategories?: number;
}

/**
 * Database row interface for query results
 */
export interface DatabaseRow {
  memory_id: string;
  searchable_content: string;
  summary: string;
  metadata: string;
  memory_type: string;
  category_primary: string;
  importance_score: string;
  created_at: string;
}

/**
 * Configuration for CategoryFilterStrategy
 */
export interface CategoryFilterStrategyConfig {
  hierarchy: {
    maxDepth: number;
    enableCaching: boolean;
  };
  extraction?: {
    enableMLExtraction?: boolean;
    enablePatternExtraction?: boolean;
    enableMetadataExtraction?: boolean;
    confidenceThreshold?: number;
    maxCategoriesPerMemory?: number;
  };
  relevance?: {
    hierarchyWeight?: number;
    exactMatchWeight?: number;
    partialMatchWeight?: number;
    depthWeight?: number;
    inheritanceWeight?: number;
    contextWeight?: number;
    temporalWeight?: number;
    frequencyWeight?: number;
    enableCaching?: boolean;
    maxCacheSize?: number;
  };
  aggregation?: {
    maxCategories?: number;
    minCategorySize?: number;
    enableHierarchyGrouping?: boolean;
    enableSorting?: boolean;
    sortBy?: string;
    sortDirection?: string;
    enableSubcategoryAggregation?: boolean;
    maxDepth?: number;
    enableCaching?: boolean;
    maxCacheSize?: number;
  };
  performance: {
    enableQueryOptimization: boolean;
    enableResultCaching: boolean;
    maxExecutionTime: number;
    batchSize: number;
  };
}

/**
 * Specialized strategy for category-based search operations with hierarchy support,
 * relevance scoring, and result aggregation
 */
export class CategoryFilterStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.CATEGORY_FILTER;
  readonly priority = 10;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;

  readonly description = 'Category-based filtering with hierarchy support';
  readonly capabilities = [
    SearchCapability.CATEGORIZATION,
    SearchCapability.FILTERING,
    SearchCapability.RELEVANCE_SCORING,
  ] as const;

  private readonly databaseManager: DatabaseManager;
  private readonly logger: typeof console;
  private readonly config: CategoryFilterStrategyConfig;

  constructor(
    config: CategoryFilterStrategyConfig,
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
    // Can handle queries with category filters or when category relevance is beneficial
    return this.hasCategoryFilters(query) || query.text.length > 0;
  }

  /**
   * Main search method implementing category-based search
   */
  async execute(query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Build category query and SQL
      const categoryQuery = this.buildCategoryQuery(query as CategoryFilterQuery);
      const sql = this.buildCategorySQL(query as CategoryFilterQuery, categoryQuery);

      // Execute query and process results
      const results = await this.executeCategoryQuery(sql, this.getQueryParameters(query as CategoryFilterQuery));
      const processedResults = this.processCategoryResults(results, query);

      // Log performance metrics
      const duration = Date.now() - startTime;
      this.logger.info(`Category search completed in ${duration}ms, found ${processedResults.length} results`);

      return processedResults;

    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`Category search failed after ${duration}ms:`, error);

      throw new Error(`Category strategy failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private hasCategoryFilters(query: SearchQuery): boolean {
    const categoryQuery = query as CategoryFilterQuery;
    return !!(categoryQuery.categories && categoryQuery.categories.length > 0) ||
      !!(categoryQuery.categoryHierarchy && categoryQuery.categoryHierarchy.length > 0);
  }

  private buildCategoryQuery(query: CategoryFilterQuery): string {
    if (!query.categories || query.categories.length === 0) {
      return query.text || '';
    }

    // Combine text search with category filters
    const textPart = query.text || '';
    const categoryPart = query.categories.join(' ');

    return `${textPart} ${categoryPart}`.trim();
  }

  private getQueryParameters(query: CategoryFilterQuery): unknown[] {
    const parameters: unknown[] = [];

    // Add category filters as parameters
    if (query.categories) {
      query.categories.forEach((category: string) => {
        parameters.push(`%${category}%`);
      });
    }

    return parameters;
  }

  private buildCategorySQL(query: CategoryFilterQuery, categoryQuery: string): string {
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Build WHERE clause with category filtering and FTS
    const whereClause = this.buildCategoryWhereClause(query, categoryQuery);

    // Build ORDER BY clause with category relevance
    const orderByClause = this.buildCategoryOrderByClause(query);

    // Construct the main category query with FTS support
    const sql = `
      SELECT
        memory_id,
        searchable_content,
        summary,
        metadata,
        memory_type,
        category_primary,
        importance_score,
        created_at,
        '${this.name}' as search_strategy
      FROM (
        SELECT
          memory_id,
          searchable_content,
          summary,
          metadata,
          memory_type,
          category_primary,
          importance_score,
          created_at
        FROM short_term_memory
        WHERE ${whereClause}

        UNION ALL

        SELECT
          memory_id,
          searchable_content,
          summary,
          metadata,
          memory_type,
          category_primary,
          importance_score,
          created_at
        FROM long_term_memory
        WHERE ${whereClause}
      ) AS combined_memories
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    return sql;
  }

  private buildCategoryWhereClause(query: CategoryFilterQuery, categoryQuery: string): string {
    const conditions: string[] = [];

    // Add FTS search condition using the categoryQuery
    if (categoryQuery && categoryQuery.trim()) {
      const ftsQuery = this.buildFTSQuery(categoryQuery);
      conditions.push(`(searchable_content MATCH '${ftsQuery}' OR summary MATCH '${ftsQuery}')`);
    }

    // Add category-specific conditions
    if (query.categories && query.categories.length > 0) {
      const categoryList = query.categories.map((cat: string) => `'${cat.replace(/'/g, "''")}'`).join(', ');
      conditions.push(`category_primary IN (${categoryList})`);
    }

    // Add hierarchy-based conditions
    if (query.categoryHierarchy && query.categoryHierarchy.length > 0) {
      const hierarchyConditions = query.categoryHierarchy.map((hierarchyCat: string) => {
        return `json_extract(metadata, '$.category_primary') LIKE '${hierarchyCat.replace(/'/g, "''")}%'`;
      });
      conditions.push(`(${hierarchyConditions.join(' OR ')})`);
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  }

  private buildCategoryOrderByClause(query: CategoryFilterQuery): string {
    let orderBy = 'ORDER BY ';

    // Primary sort by category relevance
    orderBy += 'category_relevance DESC, ';

    // Add category-specific scoring
    orderBy += `
      CASE
        WHEN category_primary IN (${query.categories ? query.categories.map((cat: string) => `'${cat.replace(/'/g, "''")}'`).join(', ') : "''"})
        THEN 1.5
        ELSE 1.0
      END * importance_score DESC, `;

    // Add recency boost for recent category matches
    orderBy += 'created_at DESC';

    return orderBy;
  }

  private async executeCategoryQuery(sql: string, parameters: unknown[]): Promise<unknown[]> {
    const db = this.databaseManager.getPrismaClient();
    return await db.$queryRawUnsafe(sql, ...parameters);
  }

  private processCategoryResults(results: unknown[], query: SearchQuery): SearchResult[] {
    const searchResults: SearchResult[] = [];

    for (const row of results as DatabaseRow[]) {
      try {
        const metadata = JSON.parse(row.metadata || '{}');

        // Calculate category-based relevance score
        const categoryRelevance = this.calculateCategoryRelevance(row, query as CategoryFilterQuery);

        searchResults.push({
          id: row.memory_id,
          content: row.searchable_content,
          metadata: {
            summary: row.summary || '',
            category: row.category_primary,
            importanceScore: parseFloat(row.importance_score) || 0.5,
            memoryType: row.memory_type,
            createdAt: new Date(row.created_at),
            ...metadata,
          },
          score: categoryRelevance,
          strategy: this.name,
          timestamp: new Date(row.created_at),
        });

      } catch (error) {
        this.logger.warn('Error processing category result:', error);
        continue;
      }
    }

    return searchResults;
  }

  private calculateCategoryRelevance(row: DatabaseRow, query: CategoryFilterQuery): number {
    let relevance = 0.3; // Base relevance

    // Category match boost
    if (query.categories && query.categories.includes(row.category_primary)) {
      relevance += 0.4;
    }

    // Hierarchy match boost
    if (query.categoryHierarchy && query.categoryHierarchy.length > 0) {
      const hierarchyMatch = query.categoryHierarchy.some((hierarchyCat: string) =>
        row.category_primary && row.category_primary.startsWith(hierarchyCat),
      );
      if (hierarchyMatch) {
        relevance += 0.3;
      }
    }

    // Text match boost
    if (query.text) {
      const content = (row.searchable_content || '').toLowerCase();
      const summary = (row.summary || '').toLowerCase();
      const searchText = query.text.toLowerCase();

      if (content.includes(searchText) || summary.includes(searchText)) {
        relevance += 0.2;
      }
    }

    // Importance score contribution
    const importance = parseFloat(row.importance_score) || 0.5;
    relevance *= (0.5 + importance);

    return Math.max(0, Math.min(1, relevance));
  }

  /**
   * Build FTS query from text for MATCH operations
   */
  private buildFTSQuery(text: string): string {
    if (!text || text.trim() === '') {
      return '*'; // Match everything if no query
    }

    const cleanQuery = text.replace(/"/g, '""').replace(/\*/g, '').trim();
    const terms = cleanQuery.split(/\s+/);

    if (terms.length === 1) {
      return `"${cleanQuery}"`;
    } else {
      return terms.map(term => `"${term}"`).join(' OR ');
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
        averageResponseTime: 150,
        throughput: 300,
        memoryUsage: 8,
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

      // Validate hierarchy configuration
      if (this.config.hierarchy.maxDepth < 1 || this.config.hierarchy.maxDepth > 10) {
        return false;
      }

      // Validate performance configuration
      if (this.config.performance.maxExecutionTime < 1000 || this.config.performance.maxExecutionTime > 60000) {
        return false;
      }

      return true;

    } catch (error) {
      this.logger.error('Configuration validation failed:', error);
      return false;
    }
  }
}