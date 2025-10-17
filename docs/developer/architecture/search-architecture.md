# Search Architecture

This document explains the sophisticated search architecture of Memorits, including multi-strategy search orchestration, filtering capabilities, and performance optimization.

## Search Engine Overview

The search system is built around a modular architecture where different strategies handle specific types of search requirements:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Search        │───▶│  Strategy       │───▶│  Result         │
│   Query         │    │  Orchestrator   │    │  Processor      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Query          │    │  Strategy       │    │  Merging &      │
│  Analysis       │    │  Execution      │    │  Ranking        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Search Strategies

### Base Strategy Foundations

Every concrete search strategy extends `BaseSearchStrategy`. The base class provides:

- shared configuration validation (priority, timeout, max results, score bounds)
- structured logging for successful and failed operations
- helper methods for producing `SearchError` variants with consistent metadata
- access to the shared `DatabaseManager` (and therefore Prisma) without duplicating wiring
- optional hooks for strategy-specific configuration validation

Strategies override `executeSearch` to provide their domain logic while `BaseSearchStrategy` handles orchestration, metrics, and error translation.

### 1. SQLite FTS Strategy (Full-Text Search)

**Primary strategy for keyword search with BM25-style ranking.**

```typescript
import { sanitizeSearchQuery } from '../../infrastructure/config/SanitizationUtils';

class SQLiteFTSStrategy extends BaseSearchStrategy {
  readonly name = SearchStrategy.FTS5;
  readonly capabilities = [
    SearchCapability.KEYWORD_SEARCH,
    SearchCapability.RELEVANCE_SCORING,
    SearchCapability.FILTERING,
    SearchCapability.SORTING,
  ] as const;

  protected async executeSearch(query: SearchQuery): Promise<SearchResult[]> {
    const sanitizedText = sanitizeSearchQuery(query.text ?? '', {
      fieldName: 'searchQuery',
      allowWildcards: true,
      allowBoolean: false,
    });

    const sql = `
      SELECT
        fts.rowid AS memory_id,
        fts.content AS searchable_content,
        fts.metadata,
        bm25(memory_fts) AS search_score
      FROM memory_fts fts
      WHERE memory_fts MATCH ?
      ORDER BY search_score ASC
      LIMIT ?
    `;

    const prisma = this.databaseManager.getPrismaClient();
    const rows = await prisma.$queryRawUnsafe(sql, sanitizedText, this.config.maxResults);

    return rows.map(row => this.createSearchResult(
      row.memory_id,
      row.searchable_content,
      { searchScore: row.search_score },
      this.normalizeScore(row.search_score),
    ));
  }

  private normalizeScore(rawScore: number): number {
    // Clamp BM25 score to 0..1 range for downstream consumers
    return Math.max(0, Math.min(1, 1 / (1 + rawScore)));
  }
}
```

### 2. Recent Strategy (Time-Based)

**Optimized for temporal relevance and recent memory retrieval.**

```typescript
class RecentMemoriesStrategy extends BaseSearchStrategy {
  readonly name = SearchStrategy.RECENT;
  readonly capabilities = [
    SearchCapability.RELEVANCE_SCORING,
    SearchCapability.FILTERING,
    SearchCapability.SORTING,
  ] as const;

  protected async executeSearch(query: SearchQuery): Promise<SearchResult[]> {
    const sql = `
      SELECT
        id AS memory_id,
        searchableContent AS searchable_content,
        summary,
        processedData AS metadata,
        importanceScore,
        createdAt,
        retentionType
      FROM long_term_memory
      WHERE namespace = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `;

    const prisma = this.databaseManager.getPrismaClient();
    const rows = await prisma.$queryRawUnsafe(sql, query.namespace ?? 'default', this.config.maxResults);

    return rows.map(row => this.createSearchResult(
      row.memory_id,
      row.searchable_content,
      {
        summary: row.summary,
        createdAt: new Date(row.createdAt),
      },
      this.scoreRecentMemory(new Date(row.createdAt), row.importanceScore),
    ));
  }

  private scoreRecentMemory(createdAt: Date, importance: number): number {
    const hoursSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
    const recencyBoost = Math.exp(-hoursSinceCreation / 24); // 1 day half-life
    return Math.max(0, Math.min(1, recencyBoost * (0.5 + importance)));
  }
}
```

### 3. Category Filter Strategy

**Classification-based filtering for organizing memories by type and importance.**

```typescript
class CategoryFilterStrategy extends BaseSearchStrategy {
  readonly name = SearchStrategy.CATEGORY_FILTER;
  readonly capabilities = [
    SearchCapability.CATEGORIZATION,
    SearchCapability.FILTERING,
    SearchCapability.RELEVANCE_SCORING,
  ] as const;

  protected async executeSearch(query: SearchQuery): Promise<SearchResult[]> {
    const categoryQuery = this.normalizeQuery(query as CategoryFilterQuery);
    const sql = this.buildCategorySQL(categoryQuery);

    const prisma = this.databaseManager.getPrismaClient();
    const rows = await prisma.$queryRawUnsafe(sql);

    return rows.map(row => this.createSearchResult(
      row.memory_id,
      row.searchable_content,
      {
        summary: row.summary ?? '',
        category: row.category_primary,
      },
      this.calculateCategoryRelevance(row, categoryQuery),
    ));
  }

  private normalizeQuery(query: CategoryFilterQuery): CategoryFilterQuery {
    // sanitize categories and text exactly as in production implementation
    return { ...query };
  }

  private buildCategorySQL(query: CategoryFilterQuery): string {
    const categoryList = query.categories?.map(cat => `'${cat.replace(/'/g, "''")}'`).join(', ') ?? '';
    const limit = Math.min(query.limit ?? this.config.maxResults, this.config.maxResults);

    return `
      SELECT
        id AS memory_id,
        searchableContent AS searchable_content,
        summary,
        processedData AS metadata,
        categoryPrimary AS category_primary,
        importanceScore
      FROM long_term_memory
      WHERE categoryPrimary IN (${categoryList})
      ORDER BY importanceScore DESC, createdAt DESC
      LIMIT ${limit}
    `;
  }
}
```

### 4. Temporal Filter Strategy

**Advanced time-based filtering with natural language processing.**

```typescript
class TemporalFilterStrategy extends BaseSearchStrategy {
  readonly name = SearchStrategy.TEMPORAL_FILTER;
  readonly capabilities = [
    SearchCapability.TEMPORAL_FILTERING,
    SearchCapability.TIME_RANGE_PROCESSING,
    SearchCapability.TEMPORAL_PATTERN_MATCHING,
    SearchCapability.TEMPORAL_AGGREGATION,
  ] as const;

  protected async executeSearch(query: SearchQuery): Promise<SearchResult[]> {
    const normalized = this.normalizeQuery(query as TemporalFilterQuery);
    const patternAnalysis = this.analyzeTemporalPatterns(normalized);
    const temporalQuery = this.buildTemporalQuery(normalized, patternAnalysis);
    const sql = this.buildTemporalSQL(normalized, temporalQuery, patternAnalysis);

    const prisma = this.databaseManager.getPrismaClient();
    const rows = await prisma.$queryRawUnsafe(sql);

    return this.processTemporalResults(rows, normalized, patternAnalysis);
  }
}
```

### 5. Metadata Filter Strategy

**Advanced metadata-based queries with complex filtering.**

```typescript
class MetadataFilterStrategy extends BaseSearchStrategy {
  readonly name = SearchStrategy.METADATA_FILTER;
  readonly capabilities = [
    SearchCapability.FILTERING,
    SearchCapability.RELEVANCE_SCORING,
  ] as const;

  protected async executeSearch(query: SearchQuery): Promise<SearchResult[]> {
    const metadataQuery = this.parseMetadataQuery(query as MetadataFilterQuery);
    const sql = this.buildMetadataSQL(query, metadataQuery);
    const rows = await this.databaseManager.getPrismaClient().$queryRawUnsafe(sql);

    return rows.map(row => this.createSearchResult(
      row.memory_id,
      row.searchable_content,
      this.extractMetadata(row.metadata),
      this.calculateMetadataRelevance(metadataQuery.fields, metadataQuery, query),
    ));
  }

  // Additional helper methods handle sanitisation, validation, aggregation, and caching.
}
```

### 6. Relationship Search Strategy

**Memory relationship-based search with graph traversal capabilities.**

```typescript
class RelationshipSearchStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.RELATIONSHIP;
  readonly priority = 6;
  readonly capabilities = [SearchCapability.RELATIONSHIP_SEARCH, SearchCapability.GRAPH_TRAVERSAL];
  readonly maxDepth = 3;
  readonly minRelationshipStrength = 0.3;

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const relationshipQuery = query as RelationshipSearchQuery;

    // Build relationship graph traversal query
    const sql = `
      WITH RECURSIVE related_memories AS (
        -- Start with source memories matching the query
        SELECT DISTINCT m.*,
               0 as depth,
               1.0 as relationship_strength,
               mr.relationshipType,
               mr.confidence as relationship_confidence
        FROM long_term_memory m
        WHERE m.namespace = ?
        AND json_extract(m.processedData, '$.relatedMemoriesJson') IS NOT NULL
          AND MATCH(memory_fts, ?)
          AND mr.strength >= ?

        UNION ALL

        -- Recursively find related memories
        SELECT m.*,
               rm.depth + 1,
               rm.relationship_strength * mr.strength,
               mr.relationshipType,
               mr.confidence
        FROM long_term_memory m
        WHERE json_extract(m.processedData, '$.relatedMemoriesJson') LIKE ?
        WHERE rm.depth < ?
          AND (rm.relationship_strength * mr.strength) >= ?
      )
      SELECT DISTINCT *,
             MAX(relationship_strength) as max_strength,
             GROUP_CONCAT(DISTINCT relationshipType) as relationship_types
      FROM related_memories
      GROUP BY id
      ORDER BY max_strength DESC, createdAt DESC
      LIMIT ?
    `;

    return this.executeQuery(sql, [
      query.namespace,
      query.text || '',
      this.minRelationshipStrength,
      this.maxDepth,
      this.minRelationshipStrength * 0.5,
      query.limit || 20
    ]);
  }
}
```

### 7. Advanced Filter Engine

**Sophisticated filter expression processing with boolean logic and template system.**

```typescript
class AdvancedFilterEngine {
  private templateManager: FilterTemplateManager;
  private expressionParser: ExpressionParser;
  private executionEngine: FilterExecutionEngine;

  async parseFilter(filterExpression: string): Promise<FilterNode> {
    // Parse complex boolean expressions
    // Support: field comparisons, ranges, operators, nested conditions
    return this.expressionParser.parse(filterExpression);
  }

  async executeFilter(
    filterNode: FilterNode,
    searchResults: SearchResult[]
  ): Promise<FilterResult> {
    // Execute filter against result set
    // Support early termination for performance
    return this.executionEngine.execute(filterNode, searchResults);
  }

  registerTemplate(template: FilterTemplate): void {
    // Register reusable filter templates
    // Example: 'recent_important: {days_ago: "7"}'
    this.templateManager.register(template);
  }
}
```

## Strategy Orchestration

### SearchService Coordinator

The SearchService orchestrates multiple strategies with sophisticated error handling and performance monitoring:

```typescript
class SearchService {
  private strategies: Map<SearchStrategy, ISearchStrategy> = new Map();
  private performanceMonitor: SearchPerformanceMonitor;
  private errorHandler: SearchErrorHandler;

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // 1. Validate and sanitize input
      const validation = this.validateSearchInput(query);
      if (!validation.isValid) {
        throw new SearchValidationError(`Invalid search query: ${validation.errors.join(', ')}`);
      }

      // 2. Analyze query characteristics
      const analysis = this.analyzeQuery(query);

      // 3. Select applicable strategies
      const applicableStrategies = this.selectStrategies(queryAnalysis);

      // 4. Execute strategies with circuit breaker protection
      const strategyResults = await this.executeStrategiesWithErrorHandling(strategies, query);

      // 5. Merge, deduplicate, and rank results
      const mergedResults = this.mergeResults(strategyResults, query);

      // 6. Track performance metrics
      const queryTime = Date.now() - startTime;
      this.performanceMonitor.updatePerformanceMetrics(queryTime);

      return mergedResults;

    } catch (error) {
      // Track performance metrics even for failed queries
      const queryTime = Date.now() - startTime;
      this.performanceMonitor.updatePerformanceMetrics(queryTime);
      throw error;
    }
  }

  private analyzeQuery(query: SearchQuery): QueryAnalysis {
    return {
      hasTextSearch: !!query.text && query.text.length > 0,
      hasTemporalFilters: this.hasTemporalFilters(query),
      hasMetadataFilters: !!(query.filters?.metadataFilters),
      hasCategoryFilters: !!(query.filters?.categories),
      estimatedComplexity: this.calculateComplexity(query)
    };
  }
}
```

### Strategy Selection Algorithm

```typescript
private selectStrategies(analysis: QueryAnalysis): ISearchStrategy[] {
  const strategies: ISearchStrategy[] = [];

  // Primary strategy for text search
  if (analysis.hasTextSearch) {
    strategies.push(this.strategies.get(SearchStrategy.FTS5));
  }

  // Secondary strategies based on query characteristics
  if (analysis.hasTemporalFilters) {
    strategies.push(this.strategies.get(SearchStrategy.TEMPORAL_FILTER));
  }

  if (analysis.hasMetadataFilters) {
    strategies.push(this.strategies.get(SearchStrategy.METADATA_FILTER));
  }

  if (analysis.hasCategoryFilters) {
    strategies.push(this.strategies.get(SearchStrategy.CATEGORY_FILTER));
  }

  // Always include recent strategy for context (fallback)
  if (!strategies.includes(SearchStrategy.RECENT)) {
    strategies.push(this.strategies.get(SearchStrategy.RECENT));
  }

  // Add relationship search for complex queries
  if (analysis.estimatedComplexity === 'high') {
    strategies.push(this.strategies.get(SearchStrategy.RELATIONSHIP));
  }

  return strategies.filter(Boolean); // Remove any undefined strategies
}
```

## Result Processing

### Merging and Ranking

```typescript
private mergeResults(
  strategyResults: SearchResult[][],
  originalQuery: SearchQuery
): SearchResult[] {
  // 1. Flatten all results
  const allResults = strategyResults.flat();

  // 2. Remove duplicates
  const uniqueResults = this.deduplicateResults(allResults);

  // 3. Recalculate scores based on strategy priority
  const scoredResults = this.recalculateScores(uniqueResults, strategyResults);

  // 4. Sort by final score
  return scoredResults.sort((a, b) => b.score - a.score);
}

private deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(result => {
    if (seen.has(result.id)) {
      return false;
    }
    seen.add(result.id);
    return true;
  });
}
```

### Composite Scoring

```typescript
private recalculateScores(
  results: SearchResult[],
  strategyResults: SearchResult[][]
): SearchResult[] {
  return results.map(result => {
    // Calculate composite score based on:
    // - Base relevance from search strategy
    // - Strategy priority weight
    // - Recency boost
    // - Importance boost

    const compositeScore = (
      result.score * 0.4 +                    // Base score weight
      this.getStrategyPriority(result.strategy) * 0.3 +  // Strategy priority
      this.getRecencyScore(result) * 0.2 +     // Recency boost
      result.metadata.importanceScore * 0.1    // Importance boost
    );

    return {
      ...result,
      score: Math.max(0, Math.min(1, compositeScore))
    };
  });
}
```

## Query Processing Pipeline

### 1. Query Parsing

```typescript
interface QueryProcessor {
  parseTextQuery(text: string): ParsedQuery;
  extractTemporalExpressions(text: string): TemporalExpression[];
  extractMetadataPatterns(text: string): MetadataPattern[];
  identifySearchIntent(text: string): SearchIntent;
}
```

### 2. Strategy Execution

```typescript
interface StrategyExecutor {
  executeStrategy(strategy: ISearchStrategy, query: SearchQuery): Promise<SearchResult[]>;
  handleStrategyTimeout(strategy: ISearchStrategy, timeout: number): Promise<SearchResult[]>;
  aggregateStrategyResults(results: SearchResult[][]): SearchResult[];
}
```

### 3. Result Post-Processing

```typescript
interface ResultProcessor {
  deduplicate(results: SearchResult[]): SearchResult[];
  rerank(results: SearchResult[], query: SearchQuery): SearchResult[];
  applyLimits(results: SearchResult[], limit: number): SearchResult[];
  enrichMetadata(results: SearchResult[]): Promise<SearchResult[]>;
}
```

## Performance Optimization

### Query Optimization

```typescript
class QueryOptimizer {
  optimizeSearchQuery(query: SearchQuery): OptimizedQuery {
    // Analyze query complexity
    const complexity = this.analyzeComplexity(query);

    // Select optimal execution plan
    const executionPlan = this.createExecutionPlan(query, complexity);

    // Apply performance optimizations
    return this.applyOptimizations(query, executionPlan);
  }

  private analyzeComplexity(query: SearchQuery): QueryComplexity {
    let complexity = 'low';

    if (query.text && query.text.length > 100) complexity = 'medium';
    if ((query as any).temporalFilters) complexity = 'medium';
    if ((query as any).metadataFilters?.fields?.length > 3) complexity = 'high';

    return complexity;
  }
}
```

### Caching Strategy

```typescript
class SearchCache {
  private cache = new Map<string, CachedResult>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async get(query: SearchQuery): Promise<SearchResult[] | null> {
    const key = this.generateCacheKey(query);
    const cached = this.cache.get(key);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.results;
    }

    return null;
  }

  async set(query: SearchQuery, results: SearchResult[]): Promise<void> {
    const key = this.generateCacheKey(query);
    this.cache.set(key, {
      results,
      timestamp: Date.now()
    });

    // Cleanup old entries
    this.cleanup();
  }
}
```

## Advanced Features

### Parallel Strategy Execution

```typescript
async executeStrategiesInParallel(
  strategies: ISearchStrategy[],
  query: SearchQuery
): Promise<SearchResult[]> {
  // Execute all strategies concurrently
  const promises = strategies.map(strategy =>
    this.executeStrategy(strategy, query)
      .then(results => ({ strategy: strategy.name, results }))
      .catch(error => ({ strategy: strategy.name, results: [], error }))
  );

  const results = await Promise.allSettled(promises);

  // Handle both successful and failed executions
  return this.processParallelResults(results);
}
```

### Strategy Fallback Chain

```typescript
private async executeWithFallback(
  primaryStrategy: ISearchStrategy,
  fallbackStrategies: ISearchStrategy[],
  query: SearchQuery
): Promise<SearchResult[]> {
  try {
    // Try primary strategy first
    return await this.executeStrategy(primaryStrategy, query);
  } catch (error) {
    console.warn(`Primary strategy ${primaryStrategy.name} failed:`, error);

    // Try fallback strategies
    for (const fallback of fallbackStrategies) {
      try {
        return await this.executeStrategy(fallback, query);
      } catch (fallbackError) {
        console.warn(`Fallback strategy ${fallback.name} also failed:`, fallbackError);
      }
    }

    // All strategies failed
    throw new SearchError('All search strategies failed');
  }
}
```

## Error Handling

### Strategy-Level Error Handling with Circuit Breakers

```typescript
class SearchErrorHandler {
  private circuitBreakers: Map<SearchStrategy, CircuitBreaker> = new Map();
  private errorCounts: Map<SearchStrategy, number> = new Map();

  async executeWithCircuitBreaker(
    strategy: SearchStrategy,
    operation: () => Promise<SearchResult[]>
  ): Promise<SearchResult[]> {
    const circuitBreaker = this.getCircuitBreaker(strategy);

    if (circuitBreaker.isOpen()) {
      throw new SearchError(`Circuit breaker is OPEN for strategy: ${strategy}`);
    }

    try {
      const result = await operation();
      this.onSuccess(strategy);
      return result;
    } catch (error) {
      this.onError(strategy, error);
      throw error;
    }
  }

  private onError(strategy: SearchStrategy, error: unknown): void {
    const currentCount = this.errorCounts.get(strategy) || 0;
    this.errorCounts.set(strategy, currentCount + 1);

    // Open circuit breaker if too many errors
    if (currentCount >= this.maxErrors) {
      this.getCircuitBreaker(strategy).open();
    }
  }
}
```

### Graceful Degradation and Fallback

```typescript
async searchWithDegradation(query: SearchQuery): Promise<SearchResult[]> {
  const strategies = this.getAvailableStrategies();

  for (const strategy of strategies) {
    try {
      // Try each strategy in priority order
      const results = await this.executeStrategy(strategy, query);

      if (results.length > 0) {
        return results;
      }
    } catch (error) {
      // Log error and try next strategy
      console.warn(`Strategy ${strategy.name} failed, trying next...`);
      continue;
    }
  }

  // Return empty results rather than throwing
  return [];
}
```

### Graceful Degradation

```typescript
async searchWithDegradation(query: SearchQuery): Promise<SearchResult[]> {
  const strategies = this.getAvailableStrategies();

  for (const strategy of strategies) {
    try {
      const results = await this.executeStrategy(strategy, query);

      if (results.length > 0) {
        console.log(`Search succeeded with strategy: ${strategy.name}`);
        return results;
      }
    } catch (error) {
      console.warn(`Strategy ${strategy.name} failed, trying next...`);
      continue;
    }
  }

  // Return empty results rather than throwing
  console.warn('All search strategies failed, returning empty results');
  return [];
}
```

## Advanced Features

### Search Strategy Configuration Management

Runtime configuration management for all search strategies with persistence and validation:

```typescript
class SearchStrategyConfigManager {
  private configStore: ConfigurationStore;
  private validators: Map<SearchStrategy, ConfigurationValidator>;

  async loadConfiguration(strategyName: string): Promise<SearchStrategyConfiguration> {
    // Load from persistent storage with fallback to defaults
    const stored = await this.configStore.get(strategyName);
    if (stored) {
      return this.validateConfiguration(strategyName, stored);
    }
    return this.getDefaultConfiguration(strategyName);
  }

  async saveConfiguration(
    strategyName: string,
    config: SearchStrategyConfiguration
  ): Promise<boolean> {
    // Validate before saving
    const validation = await this.validateConfiguration(strategyName, config);
    if (!validation.isValid) {
      throw new ConfigurationError(validation.errors);
    }

    return this.configStore.set(strategyName, config);
  }

  getDefaultConfiguration(strategyName: string): SearchStrategyConfiguration {
    // Strategy-specific defaults with performance optimization
    const defaults: Record<string, SearchStrategyConfiguration> = {
      [SearchStrategy.FTS5]: {
        enabled: true,
        priority: 10,
        timeout: 5000,
        maxResults: 100,
        strategySpecific: {
          bm25Weights: { title: 2.0, content: 1.0, category: 1.5 },
          queryTimeout: 10000,
          resultBatchSize: 100
        }
      },
      [SearchStrategy.RELATIONSHIP]: {
        enabled: true,
        priority: 6,
        timeout: 3000,
        maxResults: 50,
        strategySpecific: {
          maxDepth: 3,
          minRelationshipStrength: 0.3,
          includeRelationshipPaths: true,
          traversalStrategy: 'breadth_first'
        }
      }
    };

    return defaults[strategyName] || { enabled: true, priority: 5, timeout: 5000, maxResults: 20 };
  }
}
```

### Advanced Filter Expression System

Sophisticated filter expression processing with template support:

```typescript
class AdvancedFilterEngine {
  private parser: FilterExpressionParser;
  private templateManager: FilterTemplateManager;

  async processFilterExpression(
    expression: string,
    context: FilterContext
  ): Promise<ProcessedFilter> {
    // 1. Template substitution
    const resolvedExpression = await this.templateManager.resolve(expression, context);

    // 2. Expression parsing
    const parsedFilter = this.parser.parse(resolvedExpression);

    // 3. Optimization
    const optimizedFilter = this.optimizeFilter(parsedFilter);

    return {
      originalExpression: expression,
      resolvedExpression,
      parsedFilter: optimizedFilter,
      estimatedComplexity: this.estimateComplexity(optimizedFilter)
    };
  }

  // Template registration for common filter patterns
  registerTemplate(name: string, template: FilterTemplate): void {
    this.templateManager.register(name, template);
  }
}
```

### Search Index Management System

Comprehensive index maintenance, optimization, and monitoring:

```typescript
class SearchIndexManager {
  private healthMonitor: IndexHealthMonitor;
  private optimizationEngine: IndexOptimizationEngine;
  private backupManager: IndexBackupManager;

  async getHealthReport(): Promise<IndexHealthReport> {
    const statistics = await this.getIndexStatistics();
    const issues = await this.detectIssues(statistics);
    const recommendations = await this.generateRecommendations(issues);

    return {
      health: this.calculateHealthScore(statistics, issues),
      statistics,
      issues,
      recommendations,
      timestamp: new Date(),
      estimatedOptimizationTime: await this.estimateOptimizationTime(statistics)
    };
  }

  async optimizeIndex(type: OptimizationType = OptimizationType.MERGE): Promise<OptimizationResult> {
    // Perform index optimization with progress tracking
    const startTime = Date.now();
    const statsBefore = await this.getIndexStatistics();

    // Execute optimization based on type
    switch (type) {
      case OptimizationType.REBUILD:
        await this.rebuildIndex();
        break;
      case OptimizationType.MERGE:
        await this.mergeIndex();
        break;
      case OptimizationType.COMPACT:
        await this.compactIndex();
        break;
    }

    const statsAfter = await this.getIndexStatistics();
    const duration = Date.now() - startTime;

    return {
      success: true,
      optimizationType: type,
      startTime: new Date(startTime),
      endTime: new Date(),
      duration,
      documentsProcessed: statsAfter.totalDocuments,
      sizeBefore: statsBefore.totalSize,
      sizeAfter: statsAfter.totalSize,
      spaceSaved: statsBefore.totalSize - statsAfter.totalSize,
      performanceImprovement: this.calculatePerformanceImprovement(statsBefore, statsAfter)
    };
  }

  async createBackup(): Promise<BackupMetadata> {
    // Create integrity-checked backup with compression
    const indexData = await this.exportIndexData();
    const compressedData = await this.compressData(indexData);
    const checksum = await this.generateChecksum(compressedData);

    const metadata: BackupMetadata = {
      timestamp: new Date(),
      version: '1.0.0',
      indexSize: compressedData.length,
      documentCount: indexData.length,
      optimizationLevel: 'standard',
      checksum
    };

    await this.backupManager.storeBackup(metadata, compressedData);
    return metadata;
  }
}
```
```

## Manager Responsibility Clarification

Following the code review remediation, the search architecture now has clearly defined responsibilities between the manager classes:

### SearchManager (Low-Level Search Coordination)
**Primary Responsibility**: FTS operations and direct search coordination

```typescript
class SearchManager {
  // FTS5 operations and low-level search coordination
  async searchMemories(query: string, options: SearchOptions): Promise<MemorySearchResult[]>

  // Strategy selection and fallback logic for direct searches
  private determineSearchStrategy(query: string, options: SearchOptions): string

  // Fallback search when primary strategy fails
  private async executeFallbackSearch(query: string, options: SearchOptions): Promise<MemorySearchResult[]>
}
```

**Key Functions**:
- ✅ Direct FTS5 search operations
- ✅ Search strategy selection and coordination
- ✅ Fallback mechanism for failed searches
- ✅ Input validation and sanitization
- ✅ Search statistics tracking

### SearchService (High-Level Search API)
**Primary Responsibility**: Strategy orchestration and advanced search capabilities

```typescript
class SearchService {
  // High-level search API with strategy orchestration
  async search(query: SearchQuery): Promise<SearchResult[]>

  // Strategy-specific search execution
  async searchWithStrategy(query: SearchQuery, strategy: SearchStrategy): Promise<SearchResult[]>

  // Advanced filtering and expression processing
  async processFilterExpression(expression: string): Promise<ProcessedFilter>
}
```

**Key Functions**:
- ✅ Multi-strategy orchestration and execution
- ✅ Advanced filter expression processing
- ✅ Performance monitoring and error handling
- ✅ Circuit breaker pattern for strategy protection
- ✅ Result merging, deduplication, and ranking
- ✅ Index health monitoring and optimization

### DatabaseManager (Pure Database Facade)
**Primary Responsibility**: Database operations without search logic

```typescript
class DatabaseManager {
  // Pure database operations only
  async storeLongTermMemory(memory: ProcessedLongTermMemory): Promise<string>
  async getDatabaseStats(): Promise<DatabaseStats>
  async getConsolidationService(): Promise<ConsolidationService>

  // ❌ No search methods - removed in remediation
}
```

**Key Functions**:
- ✅ Memory storage and retrieval
- ✅ Database statistics and monitoring
- ✅ Consolidation service access
- ✅ State management operations
- ✅ Performance monitoring

## Responsibility Separation Benefits

### Before Remediation:
- **SearchManager**: Mixed low-level and high-level logic
- **SearchService**: Strategy management with some overlap
- **DatabaseManager**: Had search methods (should be facade only)

### After Remediation:
- **SearchManager**: Pure low-level search coordination and FTS operations
- **SearchService**: Pure high-level search API and strategy orchestration
- **DatabaseManager**: Pure database facade with no search logic

This separation provides:
- **Clear boundaries**: Each class has a single, well-defined responsibility
- **Reduced coupling**: Managers interact through well-defined interfaces
- **Easier testing**: Each component can be tested in isolation
- **Better maintainability**: Changes to one layer don't affect others
- **Improved performance**: Specialized classes can optimize for their specific use cases

## Integration Pattern

The managers work together through a clean integration pattern:

```typescript
// High-level API usage (Memori.ts)
const searchResults = await memori.searchMemories(query, options);

// Internally routes to:
const searchManager = dbManager.searchManager; // Get SearchManager instance
return searchManager.searchMemories(query, options); // Execute search

// Advanced usage:
const searchService = await dbManager.getSearchService(); // Get SearchService
return searchService.searchWithStrategy(searchQuery, strategy); // Strategy-specific search
```

This search architecture provides a robust, scalable, and intelligent search system capable of handling complex queries across multiple dimensions while maintaining high performance and reliability.
