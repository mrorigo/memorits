# Memorits AI Agent Integration Guide

## Core Architecture
- **Memori Class**: Main memory management system with **MemoryAgent integration**
- **Manager Pattern**: Specialized managers for different operations
- **Search Strategies**: Multiple search algorithms with filtering support
- **Configuration**: Environment-based configuration with runtime updates
- **MemoryAgent Processing**: **LLM-powered conversation analysis and memory extraction**

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

### Store Conversations with MemoryAgent Processing
```typescript
// Record conversation for LLM-powered memory processing
const chatId = await memori.recordConversation(
  'User question or statement',
  'AI response or action taken',
  {
    model: 'gpt-4o-mini',
    sessionId: 'current-session-id',
    metadata: { topic: 'category', importance: 'high' }
  }
);

// MemoryAgent processes conversations with:
// 🤖 LLM-Powered Classification: 'essential', 'contextual', 'conversational'
// ⭐ Importance Scoring: 'critical', 'high', 'medium', 'low'
// 🏷️ Entity Extraction: People, places, concepts, code elements
// 🔗 Relationship Detection: Memory connections and dependencies
// 📊 Metadata Generation: Provider, model, context, analytics
```

### Search Memories with LLM-Enhanced Results
```typescript
// Basic search with processed memory results
const memories = await memori.searchMemories('query text', {
  limit: 5,
  minImportance: 'medium',
  categories: ['essential', 'contextual']
});

// Each result includes processed enhancements:
// 🤖 Classification: Categorized as 'essential', 'contextual', etc.
// ⭐ Importance: Scored as 'critical', 'high', 'medium', 'low'
// 🏷️ Entities: Extracted people, places, concepts, code elements
// 🔗 Relationships: Detected connections to other memories
// 📊 Metadata: Context and analytics

// Advanced filtering with metadata
const filtered = await memori.searchMemories('specific topic', {
  filterExpression: 'importance_score >= 0.7 AND created_at > "2024-01-01"',
  includeMetadata: true
});

// Access processed insights
filtered.forEach(memory => {
  console.log(`Category: ${memory.classification.category} (${memory.classification.confidence})`);
  console.log(`Entities: ${memory.entities.map(e => e.value).join(', ')}`);
  console.log(`Relationships: ${memory.relationships.length} connections`);
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

## MemoryAgent LLM-Powered Features

### 🤖 **Memory Processing Capabilities**

The MemoryAgent integration provides LLM-powered memory processing:

#### **LLM-Powered Classification**
- **Automatic Categorization**: Memories classified as 'essential', 'contextual', 'conversational', 'reference', 'personal', or 'conscious-info'
- **Confidence Scoring**: Processing provides confidence levels for each classification decision
- **Context Adaptation**: Classification based on conversation context and content

#### **Importance Scoring**
- **Multi-Level Importance**: 'critical', 'high', 'medium', 'low' importance levels
- **Content-Based Assessment**: Importance determined by content significance and relevance
- **Context Consideration**: Importance scoring considers conversation context

#### **Entity Extraction**
- **Named Entity Recognition**: Automatic extraction of people, organizations, locations, dates
- **Technical Entity Detection**: Identification of code elements, APIs, frameworks, technologies
- **Concept Recognition**: Extraction of abstract concepts and domain knowledge
- **Confidence Scoring**: Each extracted entity includes confidence scores for reliability

#### **Relationship Detection**
- **Continuation Relationships**: Identifies follow-up discussions and related topics
- **Reference Relationships**: Links to previously mentioned concepts or decisions
- **Contradiction Detection**: Flags conflicting information across conversations
- **Superseding Relationships**: Tracks when new information replaces previous knowledge

#### **Memory Metadata**
```typescript
// Example of MemoryAgent-enhanced memory structure
const enhancedMemory = {
  id: 'mem_123',
  content: 'User discussed React components for API integration',
  classification: {
    category: 'essential',
    importance: 'high',
    confidence: 0.92,
    reason: 'Technical implementation discussion with business impact'
  },
  entities: [
    { value: 'React', type: 'technology', confidence: 0.95 },
    { value: 'API', type: 'concept', confidence: 0.88 },
    { value: 'components', type: 'code_element', confidence: 0.91 }
  ],
  relationships: [
    { type: 'continuation', targetMemoryId: 'mem_89', confidence: 0.85 },
    { type: 'reference', targetMemoryId: 'mem_45', confidence: 0.72 }
  ],
  metadata: {
    provider: 'openai',
    model: 'gpt-4o-mini',
    processingTimestamp: '2024-01-15T10:30:00Z',
    sessionId: 'my-app'
  }
};
```

## Memory Modes

### Auto-Ingestion (Default) with MemoryAgent Processing
```typescript
// Automatic memory processing during conversations with AI-powered analysis
// Note: Memory processing modes are now configured via IProviderConfig.memory
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app'
});

// Configure via LLM provider with IProviderConfig format
const client = new MemoriOpenAI({
  apiKey: 'your-api-key',
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto' // 🤖 MemoryAgent AI processing enabled
  }
});

// Every conversation receives comprehensive AI analysis
```

### Conscious Processing
```typescript
// Background processing with reflection
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app'
});

// Configure via LLM provider with conscious processing mode
const client = new MemoriOpenAI({
  apiKey: 'your-api-key',
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'conscious'
  }
});

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

## OpenAI Integration with MemoryAgent

### Drop-in Replacement with Memory Processing
```typescript
import { MemoriOpenAI } from 'memorits/integrations/openai-dropin/client';

// Replace OpenAI with zero code changes and memory processing
const client = new MemoriOpenAI({
  apiKey: 'your-api-key',
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app'
  }
});

// Conversations automatically recorded and processed
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this...' }]
});

// Every conversation receives processing:
// 🤖 Classification: Categorized as 'essential', 'contextual', etc.
// ⭐ Importance Scoring: 'critical', 'high', 'medium', 'low'
// 🏷️ Entity Extraction: Automatic identification of key concepts
// 🔗 Relationship Detection: Connection mapping
// 📊 Rich Metadata: Context and analytics

// Access processed memory directly
const memories = await client.memory.searchMemories('important');
console.log(`Found ${memories.length} processed memories`);
```

### Factory Pattern
```typescript
import { MemoriOpenAIFromEnv } from 'memorits/integrations/openai-dropin/factory';

// Initialize from environment
const client = MemoriOpenAIFromEnv();

// Or from database URL
const client = MemoriOpenAIFromDatabase('postgresql://localhost/memories');

// Or from configuration object using new IProviderConfig
const client = MemoriOpenAIFromConfig({
  apiKey: 'your-key',
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app'
  }
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
MEMORI_SESSION_ID=my-app-session
MEMORI_PROCESSING_MODE=auto
MEMORI_MIN_IMPORTANCE_LEVEL=medium
MEMORI_ENABLE_CHAT_MEMORY=true
MEMORI_ENABLE_EMBEDDING_MEMORY=false

# Performance
MEMORI_ENABLE_CONSOLIDATION=true
MEMORI_CONSOLIDATION_INTERVAL_MINUTES=60
```

### Runtime Configuration
```typescript
// Override configuration at runtime
const config = ConfigManager.loadConfig();
Object.assign(config, {
  namespace: 'production-app',
  enableRelationshipExtraction: true
});

Note: LLM provider configuration uses IProviderConfig format
// See provider documentation for OpenAI, Anthropic, or Ollama setup

const memori = new Memori(config);
```

## Testing

### Test Setup
```typescript
// Use in-memory database for tests
const config = ConfigManager.loadConfig();
Object.assign(config, {
  databaseUrl: ':memory:',  // SQLite in-memory database
  namespace: 'test-namespace'  // Use test namespace for isolation
});

const memori = new Memori(config);
await memori.enable();

// Note: For OpenAI integration testing, use IProviderConfig format
const testClient = new MemoriOpenAI({
  apiKey: 'test-key',
  model: 'gpt-3.5-turbo',  // Faster model for testing
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'test-session'
  }
});
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

// Check memory processing configuration
// Note: Memory modes are configured via IProviderConfig.memory
console.log('Memori enabled:', memori.isEnabled());

// Check LLM provider configuration for memory settings
const client = new MemoriOpenAI({
  apiKey: 'your-api-key',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto'
  }
});

// Try manual processing if using conscious mode
await memori.checkForConsciousContextUpdates();
```

**Memory Not Recording**
```typescript
// Verify system is enabled
console.log('Enabled:', memori.isEnabled());

// Check LLM provider configuration for memory settings
const client = new MemoriOpenAI({
  apiKey: 'your-api-key',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto'
  }
});

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
- **Auto-Ingestion**: Configure via `IProviderConfig.memory.memoryProcessingMode: 'auto'`
- **Conscious Processing**: Configure via `IProviderConfig.memory.memoryProcessingMode: 'conscious'`

### Search Options
- `limit?: number` - Result count limit
- `minImportance?: 'low'|'medium'|'high'|'critical'` - Filter by importance
- `categories?: string[]` - Filter by categories
- `includeMetadata?: boolean` - Include detailed metadata
- `filterExpression?: string` - Advanced SQL-like filtering

### Status Checks
- `memori.isEnabled()` - Check if system is ready
- `memori.getSessionId()` - Get current session ID

### IProviderConfig Memory Options
- `memory.enableChatMemory?: boolean` - Enable chat memory recording
- `memory.enableEmbeddingMemory?: boolean` - Enable embedding memory recording
- `memory.memoryProcessingMode?: 'auto' | 'conscious' | 'none'` - Memory processing mode
- `memory.minImportanceLevel?: 'low' | 'medium' | 'high' | 'critical' | 'all'` - Minimum importance level
- `memory.sessionId?: string` - Session ID for tracking memory operations