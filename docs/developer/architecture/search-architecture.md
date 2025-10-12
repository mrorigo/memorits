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

### 1. FTS5 Strategy (Full-Text Search)

**Primary strategy for keyword-based search with BM25 ranking.**

```typescript
class FTS5SearchStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.FTS5;
  readonly priority = 10;  // Highest priority
  readonly capabilities = [SearchCapability.FULL_TEXT_SEARCH, SearchCapability.RANKING];

  async search(query: SearchQuery): Promise<SearchResult[]> {
    // Use SQLite FTS5 for fast text search
    const sql = `
      SELECT *, bm25(memory_fts) as rank
      FROM memory_fts
      WHERE memory_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `;

    return this.executeFTSQuery(sql, [query.text, query.limit || 10]);
  }
}
```

### 2. Recent Strategy (Time-Based)

**Optimized for temporal relevance and recent memory retrieval.**

```typescript
class RecentSearchStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.RECENT;
  readonly priority = 3;
  readonly capabilities = [SearchCapability.TEMPORAL_SEARCH];

  async search(query: SearchQuery): Promise<SearchResult[]> {
    // Time-weighted scoring for recent memories
    const sql = `
      SELECT *,
        CASE
          WHEN createdAt > datetime('now', '-1 hour') THEN 1.0
          WHEN createdAt > datetime('now', '-1 day') THEN 0.8
          WHEN createdAt > datetime('now', '-1 week') THEN 0.6
          ELSE 0.4
        END as recency_score
      FROM long_term_memory
      WHERE namespace = ?
      ORDER BY recency_score DESC, importanceScore DESC
      LIMIT ?
    `;

    return this.executeQuery(sql, [query.namespace, query.limit || 20]);
  }
}
```

### 3. Category Filter Strategy

**Classification-based filtering for organizing memories by type and importance.**

```typescript
class CategoryFilterStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.CATEGORY_FILTER;
  readonly priority = 8;
  readonly capabilities = [SearchCapability.FILTERING, SearchCapability.CATEGORIZATION];

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const categoryQuery = query as CategoryFilterQuery;

    // Multi-dimensional category filtering
    const sql = `
      SELECT *,
        CASE categoryPrimary
          WHEN 'essential' THEN importanceScore * 1.2
          WHEN 'contextual' THEN importanceScore * 1.1
          WHEN 'reference' THEN importanceScore * 1.0
          ELSE importanceScore * 0.8
        END as category_boost
      FROM long_term_memory
      WHERE namespace = ?
        AND categoryPrimary IN (${categoryQuery.categories.map(() => '?').join(',')})
        AND importanceScore >= ?
      ORDER BY category_boost DESC, createdAt DESC
      LIMIT ?
    `;

    return this.executeQuery(sql, [
      query.namespace,
      ...categoryQuery.categories,
      categoryQuery.minImportance || 0.3,
      query.limit || 20
    ]);
  }
}
```

### 4. Temporal Filter Strategy

**Advanced time-based filtering with natural language processing.**

```typescript
class TemporalFilterStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.TEMPORAL_FILTER;
  readonly priority = 7;
  readonly capabilities = [SearchCapability.TEMPORAL_SEARCH, SearchCapability.NATURAL_LANGUAGE];

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const temporalQuery = query as TemporalFilterQuery;

    // Parse natural language time expressions
    const timeRanges = this.parseTimeExpressions(temporalQuery.temporalFilters);

    // Build temporal query with multiple ranges
    const rangeConditions = timeRanges.map((range, index) =>
      `createdAt BETWEEN ? AND ?`
    ).join(' OR ');

    const sql = `
      SELECT *,
        CASE
          WHEN createdAt BETWEEN ? AND ? THEN 1.0  -- Primary range
          WHEN createdAt BETWEEN ? AND ? THEN 0.8  -- Secondary range
          ELSE 0.5
        END as temporal_relevance
      FROM long_term_memory
      WHERE namespace = ?
        AND (${rangeConditions})
      ORDER BY temporal_relevance DESC, importanceScore DESC
      LIMIT ?
    `;

    return this.executeQuery(sql, [
      ...timeRanges.flat(),
      query.namespace,
      query.limit || 20
    ]);
  }
}
```

### 5. Metadata Filter Strategy

**Advanced metadata-based queries with complex filtering.**

```typescript
class MetadataFilterStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.METADATA_FILTER;
  readonly priority = 9;
  readonly capabilities = [SearchCapability.FILTERING, SearchCapability.METADATA_SEARCH];

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const metadataQuery = query as MetadataFilterQuery;

    // Build complex metadata conditions
    const metadataConditions = metadataQuery.metadataFilters.fields.map(field =>
      this.buildMetadataCondition(field)
    );

    const sql = `
      SELECT *,
        ${this.buildMetadataRelevanceCalculation(metadataQuery)} as metadata_relevance
      FROM long_term_memory
      WHERE namespace = ?
        AND (${metadataConditions.join(' AND ')})
      ORDER BY metadata_relevance DESC, importanceScore DESC
      LIMIT ?
    `;

    return this.executeQuery(sql, [
      query.namespace,
      query.limit || 20
    ]);
  }
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

This search architecture provides a robust, scalable, and intelligent search system capable of handling complex queries across multiple dimensions while maintaining high performance and reliability.