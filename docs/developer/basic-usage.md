# Basic Usage Guide

This guide covers the essential usage patterns for Memorits, from simple memory operations to advanced search capabilities.

## Core Operations

### 1. Initialize Memori

```typescript
import { Memori } from 'memorits';

// Create Memori instance with simple configuration
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  apiKey: 'your-openai-api-key',
  autoMemory: true
});
```

### 2. Use Provider Wrappers

```typescript
import { OpenAIWrapper } from 'memorits';

const openai = new OpenAIWrapper(memori);

// Chat normally - memory is recorded automatically
const response = await openai.chat({
  messages: [
    { role: 'user', content: 'I need help with TypeScript interfaces' }
  ]
});

console.log('Conversation recorded with ID:', response.chatId);
```

### 3. Search Memories

```typescript
// Basic text search
const results = await memori.searchMemories('TypeScript interfaces', {
  limit: 5
});

// Advanced search with filtering
const filteredResults = await memori.searchMemories('programming help', {
  limit: 10,
  minImportance: 'high',
  categories: ['essential', 'contextual']
});
```

## Search Options

### SearchOptions Interface

All search operations use the comprehensive `SearchOptions` interface defined in `src/core/types/models.ts`. This interface provides:

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

  // Advanced Features
  filterExpression?: string;             // Advanced filter expression with boolean logic
  includeRelatedMemories?: boolean;      // Include related memories in results
  maxRelationshipDepth?: number;         // Maximum depth for relationship traversal
}
```

**Note**: The canonical `SearchOptions` interface is imported from `src/core/types/models.ts`. Use this interface for all search operations to ensure consistency across the system.

## Memory Classification System

### Importance Levels

```typescript
enum MemoryImportanceLevel {
  CRITICAL = 'critical',    // Must remember (score: 0.9)
  HIGH = 'high',           // Important information (score: 0.7)
  MEDIUM = 'medium',       // Useful information (score: 0.5)
  LOW = 'low'              // Background information (score: 0.3)
}
```

### Memory Categories

```typescript
enum MemoryClassification {
  ESSENTIAL = 'essential',        // Critical information
  CONTEXTUAL = 'contextual',      // Supporting context
  CONVERSATIONAL = 'conversational', // General conversation
  REFERENCE = 'reference',        // Reference material
  PERSONAL = 'personal',          // Personal information
  CONSCIOUS_INFO = 'conscious-info' // Conscious context
}
```

## Search Examples

### 1. Simple Text Search

```typescript
const results = await memori.searchMemories('TypeScript interfaces');
console.log(`Found ${results.length} memories`);

// Each result includes:
// - id: Unique memory identifier
// - content: The searchable content
// - metadata: Additional information (summary, category, importance, etc.)
// - score: Relevance score (0.0 to 1.0)
```

### 2. Importance-Based Filtering

```typescript
const importantMemories = await memori.searchMemories('programming', {
  minImportance: 'high',  // Only show high+ importance memories
  limit: 20
});
```

### 3. Category-Based Filtering

```typescript
const technicalMemories = await memori.searchMemories('code', {
  categories: ['essential', 'reference'],  // Only technical memories
  limit: 10
});
```

### 4. Combined Filtering

```typescript
const specificMemories = await memori.searchMemories('project planning', {
  minImportance: 'medium',
  categories: ['essential', 'contextual'],
  includeMetadata: true,
  limit: 15
});
```

### 5. Recent Memories Search

```typescript
// Get recent memories for context
const recentContext = await memori.searchRecentMemories(5, true);

// Get recent memories from today only
const todaysMemories = await memori.searchRecentMemories(10, false, {
  relativeExpressions: ['today']
});

// Get recent high-importance memories
const recentImportant = await memori.searchMemories('', {
  limit: 20,
  minImportance: 'high',
  temporalFilters: {
    relativeExpressions: ['last 3 days']
  }
});
```

## Memory Information

### Understanding Search Results

Each search result contains:

```typescript
interface MemorySearchResult {
  id: string;                    // Unique memory identifier
  content: string;              // Searchable content
  metadata: {
    summary: string;            // Concise summary
    category: string;           // Memory classification
    importanceScore: number;    // Importance score (0.0-1.0)
    memoryType: string;         // 'short_term' or 'long_term'
    createdAt: Date;           // When memory was created
    entities: string[];         // Extracted entities
    keywords: string[];         // Key terms
    confidenceScore: number;    // Processing confidence
  };
  score: number;                // Relevance score for this search
  strategy: string;             // Search strategy used
  timestamp: Date;              // Memory timestamp
}
```

### Working with Memory Data

```typescript
// Process search results
const results = await memori.searchMemories('important information');

for (const result of results) {
  console.log('Memory:', result.metadata.summary);
  console.log('Importance:', result.metadata.importanceScore);
  console.log('Category:', result.metadata.category);
  console.log('Created:', result.metadata.createdAt);

  // Access full content if needed
  if (result.metadata.importanceScore > 0.8) {
    console.log('High importance memory found!');
    console.log('Full content:', result.content);
  }
}
```

## Error Handling

### Basic Error Handling

```typescript
try {
  const memories = await memori.searchMemories('query');
  console.log(`Found ${memories.length} memories`);
} catch (error) {
  console.error('Search failed:', error);

  // Common errors:
  // - Database connection issues
  // - Invalid search parameters
  // - Memory processing failures
}
```

### Graceful Degradation

```typescript
// Memori errors shouldn't break your application
try {
  const memories = await memori.searchMemories('context');
  // Use memories to enhance response
  enhancedContext = memories.slice(0, 3);
} catch (error) {
  console.warn('Memory search failed, continuing without context:', error);
  // Continue with basic functionality
  enhancedContext = [];
}
```

## Consolidation Best Practices

### 1. Use Unified Consolidation Service

```typescript
// Recommended: Use DatabaseManager for unified consolidation
const dbManager = new DatabaseManager('your-database-url');
const consolidationService = dbManager.getConsolidationService();

// Automatic DuplicateManager integration for sophisticated similarity analysis
const duplicates = await consolidationService.detectDuplicateMemories(content, 0.7);
```

### 2. Enable Automated Consolidation

```typescript
// Start automated consolidation scheduling
dbManager.startConsolidationScheduling({
  intervalMinutes: 60,        // Run every hour
  maxConsolidationsPerRun: 50, // Process max 50 per run
  similarityThreshold: 0.7,    // 70% similarity threshold
  dryRun: false               // Perform actual consolidation
});

// Monitor consolidation performance
const metrics = await dbManager.getConsolidationPerformanceMetrics();
console.log(`Success rate: ${metrics.consolidationSuccessRate}%`);
```

## Performance Tips

### 1. Use Appropriate Limits

```typescript
// For real-time applications
const quickResults = await memori.searchMemories('urgent', { limit: 3 });

// For analysis and reporting
const comprehensiveResults = await memori.searchMemories('analysis', { limit: 50 });
```

### 2. Filter Before Searching

```typescript
// Use importance and category filters to reduce search space
const filteredSearch = await memori.searchMemories('specific topic', {
  minImportance: 'medium',
  categories: ['essential', 'reference'],
  limit: 10
});
```

### 3. Cache Search Results

```typescript
// Cache frequently used searches
const cache = new Map();

function getCachedSearch(key: string, searchFn: () => Promise<any[]>) {
  if (cache.has(key)) {
    return Promise.resolve(cache.get(key));
  }

  return searchFn().then(results => {
    cache.set(key, results);
    return results;
  });
}
```

### 4. Monitor Consolidation Performance

```typescript
// Check consolidation health regularly
const consolidationMetrics = await dbManager.getConsolidationPerformanceMetrics();
if (consolidationMetrics.consolidationSuccessRate < 90) {
  console.warn('Consolidation success rate below threshold');
  // Adjust similarity thresholds or review consolidation strategy
}

// Get optimization recommendations
const recommendations = await consolidationService.getOptimizationRecommendations();
if (recommendations.overallHealth === 'poor') {
  console.warn('Consolidation system health is poor');
  recommendations.recommendations.forEach(rec => {
    console.log(`${rec.priority}: ${rec.description}`);
  });
}
```

## Integration Patterns

### With Chat Applications

```typescript
class MemoryEnabledChat {
  private memori: Memori;

  async processMessage(userMessage: string, sessionId: string) {
    // Search for relevant context
    const context = await this.memori.searchMemories(userMessage, {
      limit: 5,
      minImportance: 'medium'
    });

    // Include context in AI prompt
    const messages = [
      ...context.map(c => ({ role: 'system' as const, content: c.content })),
      { role: 'user' as const, content: userMessage }
    ];

    // Get AI response
    const response = await this.aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages
    });

    // Record the conversation
    await this.memori.recordConversation(
      userMessage,
      response.choices[0].message.content,
      'gpt-4o-mini',
      { sessionId }
    );

    return response;
  }
}
```

### With Knowledge Bases

```typescript
class KnowledgeBaseAssistant {
  async answerQuestion(question: string) {
    // Search for relevant knowledge
    const knowledge = await this.memori.searchMemories(question, {
      categories: ['reference', 'essential'],
      minImportance: 'high',
      limit: 10
    });

    // Use knowledge to answer question
    const context = knowledge.map(k => k.content).join('\n');
    const prompt = `Context: ${context}\n\nQuestion: ${question}`;

    return this.aiClient.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    });
  }
}
```

## Best Practices

### 1. Start Simple

```typescript
// Begin with basic search and filtering
const results = await memori.searchMemories('your topic', {
  limit: 5
});

// Gradually add complexity as needed
const advancedResults = await memori.searchMemories('your topic', {
  minImportance: 'high',
  categories: ['essential'],
  includeMetadata: true
});
```

### 2. Handle Empty Results

```typescript
const results = await memori.searchMemories('specific topic');

if (results.length === 0) {
  console.log('No memories found for this topic');
  // Provide fallback behavior
} else {
  console.log(`Found ${results.length} relevant memories`);
}
```

### 3. Monitor Performance

```typescript
const startTime = Date.now();
const results = await memori.searchMemories('performance test', { limit: 10 });
const duration = Date.now() - startTime;

console.log(`Search took ${duration}ms and returned ${results.length} results`);
```

## Troubleshooting

### Common Issues

**"No memories found"**
- Wait for background processing (may take a few seconds)
- Check if auto-ingestion is enabled
- Verify database connection

**"Search is slow"**
- Add importance/category filters to reduce search space
- Use appropriate limits
- Check database indexes

**"Memory not being recorded"**
- Ensure `memori.enable()` was called
- Check database permissions
- Verify configuration is valid

### Debug Information

```typescript
// Enable debug logging
process.env.DEBUG = 'memori:*';

// Check system status
const isEnabled = memori.isEnabled();
const sessionId = memori.getSessionId();
console.log('Memori status:', { isEnabled, sessionId });
```

## Next Steps

Now that you understand basic usage:

1. **🔍 [Search Strategies](core-concepts/search-strategies.md)** - Learn advanced search techniques
2. **🏗️ [Architecture](architecture/system-overview.md)** - Understand system design and data flow
3. **🔧 [Advanced Features](advanced-features/temporal-filtering.md)** - Explore sophisticated filtering
4. **💡 [Examples](examples/basic-usage.md)** - See practical implementations

Happy coding with Memorits! 🎯