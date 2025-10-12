# Memorits AI Agent Integration Guide

## Core Architecture
- **Memori Class**: Main memory management system
- **Manager Pattern**: Specialized managers for different operations
- **Search Strategies**: Multiple search algorithms with automatic selection
- **Configuration**: Environment-based configuration with runtime updates

## Essential Setup

### Installation & Initialization
```bash
npm install memorits
```

```typescript
import { Memori, ConfigManager } from 'memorits';

// Load configuration from environment
const config = ConfigManager.loadConfig();
const memori = new Memori(config);
await memori.enable();
```

### Environment Variables
```bash
OPENAI_API_KEY=your-key
DATABASE_URL=sqlite:./memories.db
MEMORI_NAMESPACE=default
MEMORI_AUTO_INGEST=true
MEMORI_CONSCIOUS_INGEST=false
```

## Memory Operations

### Store Conversations
```typescript
// Record conversation for memory processing
const chatId = await memori.recordConversation(
  'User question or statement',
  'AI response or action taken',
  {
    model: 'gpt-4o-mini',
    sessionId: 'current-session-id',
    metadata: { topic: 'category', importance: 'high' }
  }
);
```

### Search Memories
```typescript
// Basic search
const memories = await memori.searchMemories('query text', {
  limit: 5,
  minImportance: 'medium',
  categories: ['essential', 'contextual']
});

// Advanced filtering
const filtered = await memori.searchMemories('specific topic', {
  filterExpression: 'importance_score >= 0.7 AND created_at > "2024-01-01"',
  includeMetadata: true
});
```

### Strategy-Specific Search
```typescript
// Use specific search strategies
import { SearchStrategy } from 'memorits/core/domain/search/types';

const fts5Results = await memori.searchMemoriesWithStrategy(
  'exact phrase',
  SearchStrategy.FTS5,
  { limit: 10 }
);

const recentResults = await memori.searchRecentMemories(5, true);
```

## Memory Modes

### Auto-Ingestion (Default)
```typescript
// Automatic memory processing during conversations
const config = ConfigManager.loadConfig();
Object.assign(config, {
  autoIngest: true,
  consciousIngest: false
});
const memori = new Memori(config);
```

### Conscious Processing
```typescript
// Background processing with reflection
const config = ConfigManager.loadConfig();
Object.assign(config, {
  autoIngest: false,
  consciousIngest: true
});
const memori = new Memori(config);

// Manual processing trigger
await memori.checkForConsciousContextUpdates();
```

## Search Strategies

### Automatic Strategy Selection
```typescript
// Memorits chooses optimal strategy based on query
const results = await memori.searchMemories('urgent meeting notes');

// Uses: FTS5 → Category Filter → Temporal Filter → Recent
```

### Strategy-Specific Usage
```typescript
import { SearchStrategy } from 'memorits/core/domain/search/types';

// Force specific strategy
const fts5Results = await memori.searchMemoriesWithStrategy(
  'exact phrase',
  SearchStrategy.FTS5
);

const recentResults = await memori.searchRecentMemories(5);

// Get available strategies
const strategies = await memori.getAvailableSearchStrategies();
```

### Advanced Filtering
```typescript
// Multi-dimensional search
const results = await memori.searchMemories('project requirements', {
  minImportance: 'high',
  categories: ['essential', 'contextual'],
  filterExpression: 'importance_score >= 0.7',
  includeMetadata: true,
  limit: 10
});
```

## Memory Consolidation

### Automatic Consolidation
```typescript
// Enable automated consolidation via environment
process.env.MEMORI_ENABLE_CONSOLIDATION = 'true';
process.env.MEMORI_CONSOLIDATION_INTERVAL_MINUTES = '60';

// Or configure programmatically
const config = ConfigManager.loadConfig();
Object.assign(config, {
  enableConsolidation: true,
  consolidationIntervalMinutes: 60
});
```

### Manual Consolidation
```typescript
// Consolidate specific duplicate memories
const result = await memori.consolidateDuplicateMemories(
  'primary-memory-id',
  ['duplicate-id-1', 'duplicate-id-2']
);

console.log(`Consolidated: ${result.consolidated}`);
```

## Index Management

### Health Monitoring
```typescript
// Get index health report
const health = await memori.getIndexHealthReport();
console.log(`Health: ${health.health}`);
console.log(`Issues: ${health.issues.length}`);
```

### Performance Optimization
```typescript
// Optimize search index
const optimization = await memori.optimizeIndex('merge');
console.log(`Space saved: ${optimization.spaceSaved} bytes`);

// Create backup
const backup = await memori.createIndexBackup();
console.log(`Backup size: ${backup.indexSize}`);

// Restore from backup
const restored = await memori.restoreIndexFromBackup(backup.id);
```

## OpenAI Integration

### Drop-in Replacement
```typescript
import { MemoriOpenAI } from 'memorits/integrations/openai-dropin/client';

// Replace OpenAI with zero code changes
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  autoInitialize: true
});

// Conversations automatically recorded
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this...' }]
});

// Access memory directly
const memories = await client.memory.searchMemories('important');
```

### Factory Pattern
```typescript
import { MemoriOpenAIFromEnv } from 'memorits/integrations/openai-dropin/factory';

// Initialize from environment
const client = MemoriOpenAIFromEnv();

// Or from database URL
const client = MemoriOpenAIFromDatabase('postgresql://localhost/memories');

// Or from configuration object
const client = MemoriOpenAIFromConfig({
  apiKey: 'your-key',
  enableChatMemory: true,
  autoIngest: true
});
```

## Error Handling

### Circuit Breaker Protection
```typescript
// Automatic error recovery
try {
  const results = await memori.searchMemories('query');
} catch (error) {
  // Graceful fallback - errors don't break functionality
  console.warn('Search failed, continuing without memory context');
}

// Memory operations are non-blocking
// Failed memory operations don't affect AI responses
```

### Graceful Degradation
```typescript
// Always handle errors gracefully
const context = await memori.searchMemories('context').catch(() => []);
// Continue with empty context if search fails

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    ...(context.length > 0 ? [{ role: 'system', content: context[0].content }] : []),
    { role: 'user', content: userMessage }
  ]
});
```

## Configuration

### Environment Variables
```bash
# Core configuration
OPENAI_API_KEY=your-key
DATABASE_URL=sqlite:./memories.db
MEMORI_NAMESPACE=default

# Memory modes
MEMORI_AUTO_INGEST=true
MEMORI_CONSCIOUS_INGEST=false
MEMORI_ENABLE_RELATIONSHIP_EXTRACTION=true

# Performance
MEMORI_MODEL=gpt-4o-mini
MEMORI_ENABLE_CONSOLIDATION=true
MEMORI_CONSOLIDATION_INTERVAL_MINUTES=60
```

### Runtime Configuration
```typescript
// Override configuration at runtime
const config = ConfigManager.loadConfig();
Object.assign(config, {
  namespace: 'production-app',
  autoIngest: true,
  enableRelationshipExtraction: true
});

const memori = new Memori(config);
```

## Testing

### Test Setup
```typescript
// Use in-memory database for tests
const config = ConfigManager.loadConfig();
Object.assign(config, {
  databaseUrl: ':memory:',  // SQLite in-memory database
  autoIngest: false  // Disable for predictable tests
});

const memori = new Memori(config);
await memori.enable();
```

### Test Patterns
```typescript
// Test memory storage and retrieval
const chatId = await memori.recordConversation(
  'Test input',
  'Test output',
  { model: 'test-model', sessionId: 'test-session' }
);

// Wait for processing (if auto-ingest enabled)
await new Promise(resolve => setTimeout(resolve, 100));

const memories = await memori.searchMemories('test');
assert(memories.length > 0);
```

## Troubleshooting

### Common Issues

**Empty Search Results**
```typescript
// Wait for processing
await new Promise(resolve => setTimeout(resolve, 1000));

// Check if auto-ingestion is enabled
console.log('Auto mode:', memori.isAutoModeEnabled());
console.log('Conscious mode:', memori.isConsciousModeEnabled());

// Try manual processing if conscious mode
if (memori.isConsciousModeEnabled()) {
  await memori.checkForConsciousContextUpdates();
}
```

**Memory Not Recording**
```typescript
// Verify system is enabled
console.log('Enabled:', memori.isEnabled());

// Check configuration
const config = ConfigManager.loadConfig();
console.log('Auto ingest:', config.autoIngest);

// Enable if needed
await memori.enable();
```

**Performance Issues**
```typescript
// Monitor search performance
const start = Date.now();
const results = await memori.searchMemories('query', { limit: 5 });
const duration = Date.now() - start;

console.log(`Search took ${duration}ms for ${results.length} results`);

// Use appropriate limits and filters
const optimized = await memori.searchMemories('query', {
  limit: 3,
  minImportance: 'medium'
});
```

## Best Practices

### Error Handling
```typescript
// Always handle errors gracefully
try {
  const memories = await memori.searchMemories('context');
  // Use memories if available
  const context = memories.slice(0, 3);
} catch (error) {
  // Continue without memory context
  console.warn('Memory search failed:', error);
  const context = [];
}
```

### Resource Management
```typescript
// Clean up on shutdown
process.on('SIGINT', async () => {
  await memori.close();
  process.exit(0);
});
```

### Performance Optimization
```typescript
// Use filters to reduce search space
const results = await memori.searchMemories('topic', {
  minImportance: 'medium',
  categories: ['essential'],
  limit: 5
});

// Cache frequently used searches
const cache = new Map();
const cacheKey = 'frequent-search';

if (cache.has(cacheKey)) {
  results = cache.get(cacheKey);
} else {
  results = await memori.searchMemories('query');
  cache.set(cacheKey, results);
}
```

## Quick Reference

### Core Operations
- `memori.recordConversation(userInput, aiOutput, options?)` - Store conversation
- `memori.searchMemories(query, options?)` - Search memories
- `memori.searchRecentMemories(limit, includeMetadata?)` - Get recent memories
- `memori.getAvailableSearchStrategies()` - List available strategies

### Memory Modes
- **Auto-Ingestion**: `autoIngest: true` - Process conversations immediately
- **Conscious Processing**: `consciousIngest: true` - Background processing

### Search Options
- `limit?: number` - Result count limit
- `minImportance?: 'low'|'medium'|'high'|'critical'` - Filter by importance
- `categories?: string[]` - Filter by categories
- `includeMetadata?: boolean` - Include detailed metadata
- `filterExpression?: string` - Advanced SQL-like filtering

### Status Checks
- `memori.isEnabled()` - Check if system is ready
- `memori.getSessionId()` - Get current session ID
- `memori.isAutoModeEnabled()` - Check auto-ingestion status
- `memori.isConsciousModeEnabled()` - Check conscious processing status