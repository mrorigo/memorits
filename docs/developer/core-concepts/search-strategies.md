# Search Strategies in Memorits

Memorits provides a sophisticated multi-strategy search system that allows AI agents to retrieve memories with surgical precision. The search engine orchestrates multiple specialized strategies to provide optimal results for different types of queries and use cases.

## Search Strategy Overview

The search system is built around a modular architecture where different strategies handle specific types of search requirements:

```typescript
enum SearchStrategy {
  FTS5 = 'fts5',                    // Full-text search with BM25 ranking
  LIKE = 'like',                    // Pattern-based text matching
  RECENT = 'recent',               // Time-based recent memory retrieval
  SEMANTIC = 'semantic',           // Vector-based similarity search
  CATEGORY_FILTER = 'category_filter',    // Classification-based filtering
  TEMPORAL_FILTER = 'temporal_filter',    // Time-based filtering
  METADATA_FILTER = 'metadata_filter'     // Advanced metadata filtering
}
```

## Core Search Strategies

### 1. FTS5 Strategy (Full-Text Search)

**SQLite FTS5 implementation with BM25 ranking** - the primary strategy for keyword-based search.

```typescript
// Using FTS5 strategy directly
const results = await memori.searchMemoriesWithStrategy(
  'algorithm implementation',
  SearchStrategy.FTS5,
  {
    limit: 10,
    includeMetadata: true
  }
);
```

#### FTS5 Features

- **BM25 Ranking**: Industry-standard relevance scoring algorithm
- **Phrase Search**: Quoted phrases for exact matches
- **Boolean Operators**: AND, OR, NOT operations
- **Prefix Matching**: Automatic stemming and prefix expansion
- **Metadata Filtering**: Integrated importance and category filtering

#### BM25 Configuration

```typescript
// Custom BM25 weights
const customWeights = {
  title: 2.0,      // Weight for title/summary matches
  content: 1.0,    // Weight for content matches
  category: 1.5,   // Weight for category matches
};

// Weights affect relevance scoring
// Higher weights increase importance of matches in those fields
```

#### Advanced FTS5 Queries

```typescript
// Phrase search with quotes
const phraseResults = await memori.searchMemories('"exact phrase match"');

// Boolean operations
const booleanResults = await memori.searchMemories('algorithm AND implementation NOT deprecated');

// Prefix matching
const prefixResults = await memori.searchMemories('alg*'); // Matches "algorithm", "algorithms", etc.
```

### 2. LIKE Strategy (Pattern Matching)

**Traditional SQL LIKE pattern matching** - fallback strategy for basic text search.

```typescript
const likeResults = await memori.searchMemoriesWithStrategy(
  '%pattern%',
  SearchStrategy.LIKE,
  { limit: 5 }
);
```

#### LIKE Characteristics

- **Simple Patterns**: `%` and `_` wildcards
- **Case-Insensitive**: Default case-insensitive matching
- **No Ranking**: Basic results without relevance scoring
- **Fast Fallback**: Quick results when FTS5 unavailable

### 3. RECENT Strategy (Time-Based Retrieval)

**Recent memory retrieval** - optimized for temporal relevance.

```typescript
const recentMemories = await memori.searchMemoriesWithStrategy(
  '', // Empty query for recent-only
  SearchStrategy.RECENT,
  { limit: 20 }
);
```

#### Recent Strategy Features

- **Time-Weighted Scoring**: More recent memories score higher
- **Configurable Windows**: Set time windows for relevance
- **Session Awareness**: Prioritize current session memories
- **Context Preservation**: Maintain conversation flow

```typescript
// Recent memories from specific time window
const recentWithTime = await memori.searchRecentMemories(10, false);

// Get recent memories with metadata
const recentWithMetadata = await memori.searchRecentMemories(5, true);
```

## Advanced Filtering Strategies

### 4. Category Filter Strategy

**Classification-based filtering** for organizing memories by type and importance.

```typescript
const categoryResults = await memori.searchMemoriesWithStrategy(
  'programming concepts',
  SearchStrategy.CATEGORY_FILTER,
  {
    categories: ['essential', 'reference'],
    minImportance: 'high'
  }
);
```

#### Category Filtering Options

```typescript
interface CategoryFilterOptions {
  categories?: MemoryClassification[];
  minImportance?: MemoryImportanceLevel;
  categoryHierarchy?: string[];
  categoryOperator?: 'AND' | 'OR' | 'HIERARCHY';
  enableRelevanceBoost?: boolean;
}
```

#### Category Hierarchy Support

```typescript
// Hierarchical category filtering
const hierarchicalResults = await memori.searchMemories('design patterns', {
  categoryHierarchy: ['programming', 'design', 'patterns'],
  categoryOperator: 'HIERARCHY'
});
```

### 5. Temporal Filter Strategy

**Time-based filtering and pattern matching** for temporal queries.

```typescript
const temporalResults = await memori.searchMemoriesWithStrategy(
  'recent changes',
  SearchStrategy.TEMPORAL_FILTER,
  {
    createdAfter: '2024-01-01',
    createdBefore: '2024-12-31'
  }
);
```

#### Temporal Features

- **Natural Language Parsing**: "yesterday", "last week", "this month"
- **Date Range Queries**: Specific start/end dates
- **Pattern Matching**: "every Monday", "weekends", "business hours"
- **Time Zone Awareness**: Automatic timezone handling

#### Temporal Query Examples

```typescript
// Natural language temporal queries
const yesterdayResults = await memori.searchMemories('meetings', {
  createdAfter: 'yesterday'
});

const lastWeekResults = await memori.searchMemories('project updates', {
  createdAfter: '1 week ago'
});

// Specific date ranges
const dateRangeResults = await memori.searchMemories('decisions', {
  createdAfter: '2024-01-01T00:00:00Z',
  createdBefore: '2024-03-31T23:59:59Z'
});
```

### 6. Metadata Filter Strategy

**Advanced metadata-based queries** for sophisticated filtering.

```typescript
const metadataResults = await memori.searchMemoriesWithStrategy(
  'configuration',
  SearchStrategy.METADATA_FILTER,
  {
    metadataFilters: {
      modelUsed: 'gpt-4o-mini',
      importanceScore: { gte: 0.7 },
      hasEntities: ['user', 'system']
    }
  }
);
```

#### Metadata Filtering Capabilities

```typescript
interface MetadataFilterOptions {
  enableNestedAccess?: boolean;
  maxDepth?: number;
  enableTypeValidation?: boolean;
  enableFieldDiscovery?: boolean;
  strictValidation?: boolean;
}
```

## Search Strategy Orchestration

### Automatic Strategy Selection

Memorits automatically selects the best strategies based on query characteristics:

```typescript
// Automatic strategy orchestration
const results = await memori.searchMemories('urgent algorithm from yesterday');

// Strategy selection logic:
// 1. FTS5 for keyword search
// 2. TEMPORAL_FILTER for "yesterday"
// 3. CATEGORY_FILTER if category keywords detected
// 4. METADATA_FILTER for complex metadata queries
```

### Strategy Priority System

Strategies have configurable priorities that affect execution order:

```typescript
// Strategy priority configuration
const strategyPriority = {
  [SearchStrategy.FTS5]: 10,           // Highest priority
  [SearchStrategy.CATEGORY_FILTER]: 8,
  [SearchStrategy.TEMPORAL_FILTER]: 7,
  [SearchStrategy.METADATA_FILTER]: 6,
  [SearchStrategy.SEMANTIC]: 5,        // Future implementation
  [SearchStrategy.RECENT]: 3,          // Lower priority
  [SearchStrategy.LIKE]: 1,            // Fallback
};
```

### Strategy Execution Flow

```typescript
// Typical strategy execution order for complex queries
const executionOrder = [
  SearchStrategy.FTS5,              // Primary search
  SearchStrategy.CATEGORY_FILTER,   // Category filtering
  SearchStrategy.TEMPORAL_FILTER,   // Time filtering
  SearchStrategy.METADATA_FILTER,   // Metadata filtering
  SearchStrategy.RECENT,            // Recent memories
];
```

## Advanced Search Features

### Composite Search Queries

Combine multiple strategies for sophisticated queries:

```typescript
// Multi-strategy search
const advancedResults = await memori.searchMemories('urgent meeting notes', {
  minImportance: 'high',
  categories: ['essential', 'contextual'],
  includeMetadata: true
});

// Automatically uses:
// - FTS5 for text search
// - CATEGORY_FILTER for classification
// - METADATA_FILTER for importance
```

### Search Result Ranking

Results are ranked using composite scoring:

```typescript
interface CompositeScore {
  baseScore: number;           // From search strategy
  strategyPriority: number;    // Strategy importance
  recencyBoost: number;        // Time-based relevance
  importanceBoost: number;     // Memory importance
  contextBoost: number;        // Context relevance
}
```

#### Ranking Algorithm

```typescript
// Composite scoring calculation
const compositeScore = (
  baseScore * strategyWeight +
  recencyScore * timeWeight +
  importanceScore * importanceWeight +
  contextScore * contextWeight
) / totalWeight;
```

### Search Result Deduplication

Automatic deduplication across strategies:

```typescript
// Results from multiple strategies are deduplicated
const deduplicatedResults = await memori.searchMemories('query');

// Removes duplicate memories while preserving highest-scoring version
// Maintains strategy diversity in results
```

## Search Strategy Configuration

### Strategy-Specific Configuration

```typescript
interface StrategyConfiguration {
  enabled: boolean;
  priority: number;
  timeout: number;
  maxResults: number;
  minScore: number;
  options?: Record<string, unknown>;
}
```

#### FTS5 Configuration

```typescript
const fts5Config: StrategyConfiguration = {
  enabled: true,
  priority: 10,
  timeout: 10000,        // 10 second timeout
  maxResults: 1000,      // Maximum results to process
  minScore: 0.1,         // Minimum relevance score
  options: {
    bm25Weights: {
      title: 2.0,
      content: 1.0,
      category: 1.5
    }
  }
};
```

#### Temporal Filter Configuration

```typescript
const temporalConfig: StrategyConfiguration = {
  enabled: true,
  priority: 7,
  timeout: 10000,
  maxResults: 100,
  minScore: 0.3,
  options: {
    naturalLanguage: {
      enableParsing: true,
      enablePatternMatching: true,
      confidenceThreshold: 0.3
    }
  }
};
```

## Performance Optimization

### Query Optimization

Strategies are optimized based on query characteristics:

```typescript
// Query analysis for optimization
const query = 'urgent meeting from yesterday';

const optimizations = {
  isTemporal: true,        // Contains temporal indicators
  isCategorical: false,    // No category keywords
  isComplex: false,        // Simple query
  estimatedComplexity: 'low'
};
```

### Caching and Indexing

```typescript
// Strategy-specific caching
const cacheConfig = {
  enableResultCaching: true,
  cacheSize: 100,
  cacheTTL: 300000,      // 5 minutes
  enableQueryOptimization: true
};
```

### Performance Monitoring

```typescript
// Strategy performance metrics
interface StrategyMetrics {
  averageResponseTime: number;
  throughput: number;
  memoryUsage: number;
  successRate: number;
  errorRate: number;
}
```

## Error Handling and Resilience

### Strategy Error Handling

```typescript
try {
  const results = await memori.searchMemoriesWithStrategy(
    query,
    SearchStrategy.FTS5
  );
} catch (error) {
  if (error instanceof SearchStrategyError) {
    // Strategy-specific error
    console.error(`FTS5 strategy failed: ${error.message}`);
  } else if (error instanceof SearchTimeoutError) {
    // Timeout handling
    console.warn('Search timed out, using fallback strategy');
  }
}
```

### Fallback Mechanisms

```typescript
// Automatic fallback on strategy failure
const fallbackChain = [
  SearchStrategy.FTS5,
  SearchStrategy.LIKE,      // Fallback for FTS5
  SearchStrategy.RECENT     // Ultimate fallback
];
```

## Best Practices

### 1. Choose the Right Strategy

- **Use FTS5 for**: Keyword searches, phrase matching, relevance ranking
- **Use RECENT for**: Time-sensitive queries, conversation flow
- **Use CATEGORY_FILTER for**: Organizing by type, importance filtering
- **Use TEMPORAL_FILTER for**: Date ranges, natural language time queries
- **Use METADATA_FILTER for**: Complex filtering, custom metadata

### 2. Optimize Query Performance

```typescript
// Use specific strategies for better performance
const fastResults = await memori.searchMemoriesWithStrategy(
  query,
  SearchStrategy.RECENT,  // Fastest for recent queries
  { limit: 5 }
);
```

### 3. Combine Strategies Effectively

```typescript
// Multi-strategy approach for comprehensive results
const comprehensiveResults = await memori.searchMemories(query, {
  minImportance: 'medium',
  categories: ['essential'],
  includeMetadata: true
});
```

### 4. Monitor Strategy Performance

```typescript
// Track strategy effectiveness
const availableStrategies = memori.getAvailableSearchStrategies();
availableStrategies.forEach(strategy => {
  const strategyInstance = searchService.getStrategy(strategy);
  const metadata = strategyInstance.getMetadata();
  console.log(`${strategy}: ${metadata.performanceMetrics.averageResponseTime}ms avg`);
});
```

This sophisticated search strategy system enables AI agents to retrieve memories with incredible precision, supporting everything from simple keyword searches to complex multi-dimensional queries that combine text, time, categorization, and metadata filtering.