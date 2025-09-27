# Search API Reference

This document provides comprehensive documentation for Memorits' advanced search capabilities, including multi-strategy search, filtering options, and result processing.

## Advanced Search Interface

### SearchOptions Interface

```typescript
interface SearchOptions {
  // Basic options
  namespace?: string;                    // Memory namespace (default: 'default')
  limit?: number;                       // Number of results (default: 5)
  includeMetadata?: boolean;            // Include additional metadata

  // Filtering options
  minImportance?: MemoryImportanceLevel; // Filter by importance level
  categories?: MemoryClassification[];   // Filter by memory categories
  temporalFilters?: TemporalFilterOptions; // Time-based filtering
  metadataFilters?: MetadataFilterOptions; // Metadata-based filtering

  // Sorting and pagination
  sortBy?: SortOption;                   // Sort results
  offset?: number;                       // Pagination offset

  // Advanced options
  strategy?: SearchStrategy;             // Force specific strategy
  timeout?: number;                      // Search timeout (ms)
  enableCache?: boolean;                 // Enable result caching
}
```

### SearchStrategy Enum

```typescript
enum SearchStrategy {
  FTS5 = 'fts5',                    // Full-text search with BM25 ranking
  LIKE = 'like',                    // Pattern-based text matching
  RECENT = 'recent',               // Time-based recent memory retrieval
  SEMANTIC = 'semantic',           // Vector-based similarity search (planned)
  CATEGORY_FILTER = 'category_filter',    // Classification-based filtering
  TEMPORAL_FILTER = 'temporal_filter',    // Time-based filtering
  METADATA_FILTER = 'metadata_filter'     // Advanced metadata filtering
}
```

## Filtering Options

### Importance-Based Filtering

```typescript
// Filter by memory importance
const importantMemories = await memori.searchMemories('urgent information', {
  minImportance: 'high',  // Only high+ importance memories
  limit: 20
});

// Available importance levels:
// - 'critical' (0.9+ score)
// - 'high' (0.7+ score)
// - 'medium' (0.5+ score)
// - 'low' (0.3+ score)
```

### Category-Based Filtering

```typescript
// Filter by memory categories
const technicalMemories = await memori.searchMemories('programming concepts', {
  categories: ['essential', 'reference'],  // Only technical memories
  limit: 15
});

// Available categories:
// - 'essential' - Critical information
// - 'contextual' - Supporting context
// - 'conversational' - General conversation
// - 'reference' - Reference material
// - 'personal' - Personal information
// - 'conscious-info' - Conscious context
```

### Temporal Filtering

```typescript
// Time-based search filtering
const recentMemories = await memori.searchMemories('project updates', {
  temporalFilters: {
    relativeExpressions: ['last week', 'yesterday'],
    timeRanges: [{
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31')
    }]
  },
  limit: 10
});
```

### Metadata Filtering

```typescript
// Advanced metadata-based filtering
const filteredMemories = await memori.searchMemories('configuration', {
  metadataFilters: {
    fields: [
      {
        key: 'model',
        value: 'gpt-4o-mini',
        operator: 'eq'
      },
      {
        key: 'importanceScore',
        value: 0.7,
        operator: 'gte'
      }
    ]
  },
  limit: 10
});
```

## Search Result Interface

### MemorySearchResult

```typescript
interface MemorySearchResult {
  id: string;                           // Unique memory identifier
  content: string;                      // Searchable content
  metadata: {
    summary: string;                    // Concise summary
    category: string;                   // Memory classification
    importanceScore: number;            // Importance score (0.0-1.0)
    memoryType: string;                 // 'short_term' or 'long_term'
    createdAt: Date;                   // Creation timestamp
    entities: string[];                 // Extracted entities
    keywords: string[];                 // Key terms
    confidenceScore: number;            // Processing confidence
    metadata?: Record<string, unknown>; // Additional metadata
  };
  score: number;                        // Relevance score (0.0-1.0)
  strategy: string;                     // Search strategy used
  timestamp: Date;                      // Memory timestamp
}
```

## Advanced Search Methods

### Strategy-Specific Search

```typescript
// Force specific search strategy
const fts5Results = await memori.searchMemoriesWithStrategy(
  'exact phrase',
  SearchStrategy.FTS5,
  { limit: 10 }
);

// Recent memories only
const recentResults = await memori.searchMemoriesWithStrategy(
  '',
  SearchStrategy.RECENT,
  { limit: 20 }
);
```

### Multi-Strategy Search

```typescript
// Search across multiple strategies
const multiStrategyResults = await memori.searchMemories('comprehensive search', {
  strategies: ['fts5', 'category_filter', 'temporal_filter'],
  combineResults: true,
  deduplication: true
});
```

### Contextual Search

```typescript
// Search with conversation context
const contextualResults = await memori.searchMemories('previous discussion', {
  contextWindow: 5,                    // Include 5 recent conversations
  sessionId: 'current-session',        // Limit to current session
  includeRelated: true                 // Include related memories
});
```

## Search Result Processing

### Result Sorting

```typescript
// Sort search results
const sortedResults = await memori.searchMemories('query', {
  sortBy: {
    field: 'importanceScore',
    direction: 'desc'
  },
  limit: 20
});

// Multiple sort criteria
const multiSortedResults = await memori.searchMemories('query', {
  sortBy: [
    { field: 'importanceScore', direction: 'desc' },
    { field: 'createdAt', direction: 'desc' }
  ]
});
```

### Result Filtering

```typescript
// Post-search filtering
const results = await memori.searchMemories('broad query', { limit: 50 });

// Filter results by criteria
const filteredResults = results.filter(result =>
  result.metadata.importanceScore > 0.7 &&
  result.metadata.category === 'essential'
);
```

### Result Enrichment

```typescript
// Enrich results with additional data
const enrichedResults = await memori.searchMemories('query', {
  includeMetadata: true,
  enrichWith: ['related_memories', 'access_patterns']
});

// Access enriched data
enrichedResults.forEach(result => {
  console.log('Related memories:', result.metadata.relatedMemories);
  console.log('Access count:', result.metadata.accessCount);
});
```

## Performance Optimization

### Caching Configuration

```typescript
// Configure search result caching
const cachedSearch = await memori.searchMemories('frequently accessed', {
  enableCache: true,
  cacheTTL: 300000,  // 5 minutes
  cacheKey: 'custom-key'
});
```

### Batch Search Operations

```typescript
// Batch multiple search operations
const batchResults = await memori.batchSearch([
  { query: 'urgent', options: { limit: 5 } },
  { query: 'reference', options: { categories: ['reference'] } },
  { query: 'recent', options: { temporalFilters: { relativeExpressions: ['today'] } } }
]);
```

### Search Analytics

```typescript
// Get search performance metrics
const analytics = await memori.getSearchAnalytics({
  timeRange: 'last_24_hours',
  includeStrategyBreakdown: true
});

console.log('Search Analytics:', {
  totalQueries: analytics.totalQueries,
  averageResponseTime: analytics.averageResponseTime,
  mostUsedStrategies: analytics.strategyUsage,
  cacheHitRate: analytics.cacheHitRate
});
```

## Error Handling

### Search-Specific Errors

```typescript
try {
  const results = await memori.searchMemories('query', {
    temporalFilters: { relativeExpressions: ['invalid date'] }
  });
} catch (error) {
  if (error instanceof SearchTimeoutError) {
    console.error('Search timed out:', error.timeout);
  } else if (error instanceof SearchStrategyError) {
    console.error('Search strategy failed:', error.strategy);
  } else if (error instanceof FilterValidationError) {
    console.error('Invalid filter:', error.filter);
  }
}
```

### Graceful Degradation

```typescript
// Continue operation even if search fails
async function safeSearch(query: string, fallback: any[] = []) {
  try {
    return await memori.searchMemories(query, { limit: 10 });
  } catch (error) {
    console.warn('Search failed, using fallback:', error);
    return fallback;
  }
}
```

## Integration Examples

### With Chat Applications

```typescript
class SearchEnabledChat {
  async findRelevantContext(userMessage: string) {
    // Multi-dimensional search for context
    const context = await memori.searchMemories(userMessage, {
      limit: 5,
      minImportance: 'medium',
      categories: ['essential', 'contextual'],
      temporalFilters: {
        relativeExpressions: ['last week']
      }
    });

    return context.map(c => c.content);
  }

  async searchSimilarTopics(topic: string) {
    // Find related topics and discussions
    const relatedTopics = await memori.searchMemories(topic, {
      categories: ['essential', 'reference'],
      includeMetadata: true,
      limit: 15
    });

    return relatedTopics.map(result => ({
      content: result.content,
      importance: result.metadata.importanceScore,
      relatedEntities: result.metadata.entities
    }));
  }
}
```

### With Knowledge Bases

```typescript
class KnowledgeBaseSearch {
  async semanticSearch(query: string) {
    // Search for semantically related content
    const results = await memori.searchMemories(query, {
      strategy: SearchStrategy.FTS5,  // Use full-text search
      categories: ['reference', 'essential'],
      minImportance: 'high',
      limit: 20
    });

    return results.map(result => ({
      content: result.content,
      relevance: result.score,
      category: result.metadata.category
    }));
  }

  async findByImportance(importance: MemoryImportanceLevel) {
    // Find all memories of specific importance
    const importantMemories = await memori.searchMemories('', {
      minImportance: importance,
      limit: 100,
      includeMetadata: true
    });

    return importantMemories;
  }
}
```

## Best Practices

### 1. Use Appropriate Search Strategies

```typescript
// Choose strategy based on use case
const searchStrategies = {
  // For keyword searches
  keywordSearch: SearchStrategy.FTS5,

  // For recent context
  recentContext: SearchStrategy.RECENT,

  // For time-based queries
  temporalSearch: SearchStrategy.TEMPORAL_FILTER,

  // For metadata queries
  metadataSearch: SearchStrategy.METADATA_FILTER,

  // For category-based filtering
  categorySearch: SearchStrategy.CATEGORY_FILTER
};
```

### 2. Optimize Performance

```typescript
// Performance-optimized search
const optimizedSearch = await memori.searchMemories('query', {
  limit: 10,                          // Reasonable result limit
  minImportance: 'medium',            // Filter out low-quality results
  categories: ['essential'],          // Focus on important categories
  enableCache: true,                  // Enable caching
  timeout: 5000                       // Set reasonable timeout
});
```

### 3. Handle Large Result Sets

```typescript
// Handle pagination for large datasets
async function getAllResults(query: string, pageSize: number = 50) {
  const allResults: MemorySearchResult[] = [];
  let offset = 0;

  while (true) {
    const page = await memori.searchMemories(query, {
      limit: pageSize,
      offset: offset,
      minImportance: 'low'
    });

    if (page.length === 0) break;

    allResults.push(...page);
    offset += pageSize;

    // Prevent infinite loops
    if (offset > 1000) break;
  }

  return allResults;
}
```

### 4. Monitor Search Quality

```typescript
// Monitor and improve search quality
function analyzeSearchQuality(results: MemorySearchResult[], query: string) {
  const analysis = {
    totalResults: results.length,
    averageScore: results.reduce((sum, r) => sum + r.score, 0) / results.length,
    topCategories: results.reduce((acc, r) => {
      acc[r.metadata.category] = (acc[r.metadata.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    relevance: results.filter(r => r.score > 0.7).length / results.length
  };

  console.log('Search quality analysis:', analysis);
  return analysis;
}
```

## Troubleshooting

### Common Issues

**"No results found"**
```typescript
// Debug empty results
const debugResults = await memori.searchMemories('test query', {
  limit: 100,  // Increase limit
  minImportance: 'low',  // Lower importance threshold
  includeMetadata: true  // Get detailed information
});

console.log('Debug info:', {
  totalResults: debugResults.length,
  hasMemories: await memori.hasAnyMemories(),
  systemEnabled: memori.isEnabled()
});
```

**"Search is slow"**
```typescript
// Optimize slow searches
const fastSearch = await memori.searchMemories('query', {
  limit: 5,  // Reduce result count
  minImportance: 'high',  // Filter by importance
  categories: ['essential'],  // Limit categories
  timeout: 3000  // Set timeout
});
```

**"Inconsistent results"**
```typescript
// Ensure consistent search behavior
const consistentSearch = await memori.searchMemories('query', {
  strategy: SearchStrategy.FTS5,  // Force specific strategy
  enableCache: false,  // Disable caching for testing
  sortBy: { field: 'createdAt', direction: 'desc' }  // Consistent sorting
});
```

This comprehensive search API enables sophisticated memory retrieval with advanced filtering, multi-strategy search, and performance optimization for production applications.