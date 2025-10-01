# Basic Usage Guide

This guide covers the essential usage patterns for Memorits, from simple memory operations to advanced search capabilities.

## Core Operations

### 1. Initialize Memorits

```typescript
import { Memori } from 'memorits';

// Create Memori instance with configuration
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  apiKey: 'your-openai-api-key',
  model: 'gpt-4o-mini',
  autoIngest: true,
  consciousIngest: false
});

// Enable memory processing
await memori.enable();
```

### 2. Record Conversations

```typescript
// Record a conversation
const chatId = await memori.recordConversation(
  'I need help with TypeScript interfaces',
  'I can help you with TypeScript interfaces. What specific aspect do you need assistance with?',
  'gpt-4o-mini',
  {
    sessionId: 'user-session-123',
    metadata: {
      topic: 'programming',
      difficulty: 'intermediate'
    }
  }
);

console.log('Conversation recorded with ID:', chatId);
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

### Basic Search Options

```typescript
interface BasicSearchOptions {
  limit?: number;                    // Number of results (default: 5)
  namespace?: string;                // Memory namespace (default: 'default')
  includeMetadata?: boolean;         // Include additional metadata
}
```

### Advanced Search Options

```typescript
interface AdvancedSearchOptions extends BasicSearchOptions {
  minImportance?: MemoryImportanceLevel;  // Filter by importance level
  categories?: MemoryClassification[];    // Filter by memory categories
  temporalFilters?: TemporalFilterOptions; // Time-based filtering
  metadataFilters?: MetadataFilterOptions; // Metadata-based filtering
}
```

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