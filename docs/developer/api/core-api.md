# Core API Reference

This document provides comprehensive documentation for the core Memorits API, including the main MemoriAI class and its primary interfaces.

## MemoriAI Class

The `MemoriAI` class is the main entry point for memory-enabled AI operations, combining LLM provider integration with memory management capabilities.

### Constructor

```typescript
constructor(config: MemoriAIConfig)
```

**Parameters:**
- `config`: Complete configuration object

**Example:**
```typescript
import { MemoriAI } from 'memorits';

// Using custom configuration
const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});
```

### Core Methods

#### `chat()`

Send a chat completion request with automatic memory recording.

```typescript
async chat(options: ChatOptions): Promise<ChatResponse>
```

**Parameters:**
- `options`: Chat completion options including messages and model settings

**Returns:** Chat response with content and metadata

**Example:**
```typescript
const response = await ai.chat({
  messages: [
    { role: 'user', content: 'What is TypeScript?' }
  ],
  model: 'gpt-4',
  temperature: 0.7
});

console.log('Response:', response.message.content);
console.log('Chat ID:', response.chatId);
```

#### `searchMemories()`

Search for relevant memories using advanced filtering.

```typescript
async searchMemories(
  query: string,
  options?: SearchOptions
): Promise<MemorySearchResult[]>
```

**Parameters:**
- `query`: Search query text
- `options` (optional): Search configuration options

**Returns:** Array of matching memory results

**Example:**
```typescript
// Basic search
const results = await ai.searchMemories('TypeScript interfaces');

// Advanced search with filtering
const filteredResults = await ai.searchMemories('programming concepts', {
  minImportance: 'high',
  categories: ['essential', 'reference'],
  limit: 10,
  includeMetadata: true
});
```

#### `searchMemories()`

Search for relevant memories using advanced filtering.

```typescript
async searchMemories(
  query: string,
  options?: SearchOptions
): Promise<MemorySearchResult[]>
```

**Parameters:**
- `query`: Search query text
- `options` (optional): Search configuration options

**Returns:** Array of matching memory results

**Example:**
```typescript
// Basic search
const results = await memori.searchMemories('TypeScript interfaces');

// Advanced search with filtering
const filteredResults = await memori.searchMemories('programming concepts', {
  minImportance: 'high' as any,
  categories: ['essential' as any, 'reference' as any],
  limit: 10,
  includeMetadata: true
});

// Advanced filter expressions
const advancedResults = await memori.searchMemories('', {
  filterExpression: 'importance_score >= 0.7 AND created_at > "2024-01-01"',
  limit: 10
});

// Memory consolidation
const consolidationResult = await memori.consolidateDuplicateMemories(
  'memory-id-1',
  ['memory-id-2', 'memory-id-3']
);

if (consolidationResult.consolidated > 0) {
  console.log(`Consolidated ${consolidationResult.consolidated} duplicate memories`);
}

// Search with relationships using advanced strategies
const relationshipSearch = await memori.searchMemoriesWithStrategy(
  'related to project setup',
  SearchStrategy.RELATIONSHIP,
  {
    limit: 10,
    includeMetadata: true
  }
);

// Get index health report
const healthReport = await memori.getIndexHealthReport();
console.log(`Index health: ${healthReport.health}`);
console.log(`Issues found: ${healthReport.issues.length}`);

// Optimize search index
const optimizationResult = await memori.optimizeIndex('merge');
console.log(`Optimization saved ${optimizationResult.spaceSaved} bytes`);
```

### Status Methods

#### `getConfig()`

Get the current configuration.

```typescript
getConfig(): MemoriAIConfig
```

**Returns:** Current configuration object

**Example:**
```typescript
const config = ai.getConfig();
console.log('Current config:', config);
```

#### `getSessionId()` (if available)

Get the current session identifier.

```typescript
getSessionId(): string
```

**Returns:** Unique session ID string

**Example:**
```typescript
const sessionId = ai.getSessionId?.();
console.log('Current session:', sessionId);
```

### Memory Mode Configuration

MemoriAI supports three memory processing modes configured at initialization:

#### Mode Options

- **`automatic`** (default): Auto-record conversations and process memories
- **`manual`**: Manual control over memory recording and processing
- **`conscious`**: Advanced background processing with human-like reflection

**Example:**
```typescript
// Check current mode
const config = ai.getConfig();
console.log('Current mode:', config.mode);

// Mode is set at initialization and cannot be changed
const ai = new MemoriAI({
  // ... other config,
  mode: 'automatic'  // Choose appropriate mode
});
```

### Advanced Methods

#### `consolidateDuplicateMemories()`

Consolidate duplicate memories with transaction safety and intelligent data merging.

```typescript
async consolidateDuplicateMemories(
  primaryMemoryId: string,
  duplicateIds: string[],
  namespace?: string
): Promise<ConsolidationResult>
```

**Parameters:**
- `primaryMemoryId`: ID of the primary memory to keep
- `duplicateIds`: Array of duplicate memory IDs to merge
- `namespace` (optional): Memory namespace (default: 'default')

**Returns:** Consolidation result with count and any errors

**Example:**
```typescript
const result = await memori.consolidateDuplicateMemories(
  'primary-memory-id',
  ['duplicate-1', 'duplicate-2'],
  'my-namespace'
);

console.log(`Consolidated ${result.consolidated} memories`);
if (result.errors.length > 0) {
  console.error('Consolidation errors:', result.errors);
}
```

#### `getIndexHealthReport()`

Get comprehensive health report for the search index.

```typescript
async getIndexHealthReport(): Promise<IndexHealthReport>
```

**Returns:** Detailed health report including statistics, issues, and recommendations

**Example:**
```typescript
const report = await memori.getIndexHealthReport();
console.log(`Index health: ${report.health}`);
console.log(`Total documents: ${report.statistics.totalDocuments}`);
console.log(`Issues: ${report.issues.join(', ')}`);
```

#### `optimizeIndex()`

Perform index optimization with specified strategy.

```typescript
async optimizeIndex(type?: OptimizationType): Promise<OptimizationResult>
```

**Parameters:**
- `type` (optional): Optimization type (default: 'merge')

**Returns:** Optimization result with performance metrics

**Example:**
```typescript
const result = await memori.optimizeIndex('rebuild');
console.log(`Optimization completed in ${result.duration}ms`);
console.log(`Space saved: ${result.spaceSaved} bytes`);
```

#### `createIndexBackup()`

Create a backup of the current search index.

```typescript
async createIndexBackup(): Promise<BackupMetadata>
```

**Returns:** Backup metadata including timestamp, size, and checksum

**Example:**
```typescript
const backup = await memori.createIndexBackup();
console.log(`Backup created: ${backup.timestamp}`);
console.log(`Document count: ${backup.documentCount}`);
```

#### `restoreIndexFromBackup()`

Restore search index from a backup.

```typescript
async restoreIndexFromBackup(backupId: string): Promise<boolean>
```

**Parameters:**
- `backupId`: ID of the backup to restore from

**Returns:** `true` if restoration was successful

**Example:**
```typescript
const success = await memori.restoreIndexFromBackup('backup-2024-01-01');
if (success) {
  console.log('Index restored successfully');
}
```

#### `findDuplicateMemories()`

Find potential duplicate memories for consolidation.

```typescript
async findDuplicateMemories(
  content: string,
  options?: {
    similarityThreshold?: number;
    namespace?: string;
    limit?: number;
  }
): Promise<MemorySearchResult[]>
```

**Parameters:**
- `content`: Content to find duplicates for
- `options` (optional): Search configuration
  - `similarityThreshold` (optional): Similarity threshold (default: 0.7)
  - `namespace` (optional): Memory namespace
  - `limit` (optional): Maximum results (default: 20)

**Returns:** Array of potential duplicate memories

**Example:**
```typescript
const duplicates = await memori.findDuplicateMemories(
  'This is a test memory about TypeScript',
  {
    similarityThreshold: 0.8,
    limit: 10
  }
);

console.log(`Found ${duplicates.length} potential duplicates`);
```

#### `getMemoryStatistics()`

Get comprehensive memory statistics for a namespace.

```typescript
async getMemoryStatistics(namespace?: string): Promise<DatabaseStats>
```

**Parameters:**
- `namespace` (optional): Memory namespace (default: configured namespace)

**Returns:** Database statistics including conversation and memory counts

**Example:**
```typescript
const stats = await memori.getMemoryStatistics();
console.log(`Total conversations: ${stats.totalConversations}`);
console.log(`Total memories: ${stats.totalMemories}`);
console.log(`Long-term memories: ${stats.longTermMemories}`);
```

#### `getDetailedMemoryStatistics()`

Get detailed memory statistics with breakdowns by type, importance, and category.

```typescript
async getDetailedMemoryStatistics(namespace?: string): Promise<{
  totalMemories: number;
  byType: {
    longTerm: number;
    shortTerm: number;
    conscious: number;
  };
  byImportance: Record<string, number>;
  byCategory: Record<string, number>;
  recentActivity: {
    last24Hours: number;
    last7Days: number;
    last30Days: number;
  };
  averageConfidence: number;
}>
```

**Parameters:**
- `namespace` (optional): Memory namespace (default: configured namespace)

**Returns:** Detailed statistics with multiple breakdowns

**Example:**
```typescript
const detailedStats = await memori.getDetailedMemoryStatistics();
console.log(`Long-term memories: ${detailedStats.byType.longTerm}`);
console.log(`High importance: ${detailedStats.byImportance.high}`);
console.log(`Recent activity (24h): ${detailedStats.recentActivity.last24Hours}`);
```

#### `extractMemoryRelationships()`

Extract memory relationships using the sophisticated RelationshipProcessor.

```typescript
async extractMemoryRelationships(
  content: string,
  options?: {
    namespace?: string;
    minConfidence?: number;
    maxRelationships?: number;
  }
): Promise<MemoryRelationship[]>
```

**Parameters:**
- `content`: Content to extract relationships from
- `options` (optional): Extraction configuration
  - `namespace` (optional): Memory namespace
  - `minConfidence` (optional): Minimum confidence threshold (default: 0.5)
  - `maxRelationships` (optional): Maximum relationships to extract (default: 10)

**Returns:** Array of extracted memory relationships

**Example:**
```typescript
const relationships = await memori.extractMemoryRelationships(
  'This is a follow-up to our previous discussion about the authentication system',
  {
    minConfidence: 0.7,
    maxRelationships: 5
  }
);

for (const rel of relationships) {
  console.log(`${rel.type}: ${rel.targetMemoryId} (confidence: ${rel.confidence})`);
}
```

#### `buildRelationshipGraph()`

Build relationship graph for a namespace.

```typescript
async buildRelationshipGraph(
  namespace?: string,
  options?: {
    maxDepth?: number;
    includeWeakRelationships?: boolean;
  }
): Promise<{
  nodes: Array<{ id: string; type: string; content: string }>;
  edges: Array<{ source: string; target: string; type: string; strength: number }>;
  clusters: Array<{ id: string; nodes: string[]; strength: number }>;
}>
```

**Parameters:**
- `namespace` (optional): Memory namespace (default: configured namespace)
- `options` (optional): Graph building configuration
  - `maxDepth` (optional): Maximum traversal depth (default: 3)
  - `includeWeakRelationships` (optional): Include weak relationships (default: false)

**Returns:** Relationship graph with nodes, edges, and clusters

**Example:**
```typescript
const graph = await memori.buildRelationshipGraph('my-app', {
  maxDepth: 3,
  includeWeakRelationships: false
});

console.log(`Found ${graph.nodes.length} connected memories`);
console.log(`Found ${graph.edges.length} relationships`);
console.log(`Identified ${graph.clusters.length} memory clusters`);
```

#### `getAvailableSearchStrategies()`

Get available search strategies.

```typescript
async getAvailableSearchStrategies(): Promise<SearchStrategy[]>
```

**Returns:** Array of available search strategy types

**Example:**
```typescript
const strategies = await memori.getAvailableSearchStrategies();
console.log('Available strategies:', strategies);

// Use specific strategy
if (strategies.includes(SearchStrategy.SEMANTIC)) {
  const results = await memori.searchMemoriesWithStrategy(
    'query',
    SearchStrategy.SEMANTIC,
    { limit: 10 }
  );
}
```

## Configuration Management

### MemoriAIConfig Interface

```typescript
interface MemoriAIConfig {
  databaseUrl: string;                    // Database connection URL
  apiKey: string;                         // LLM provider API key
  model?: string;                         // Default LLM model (provider-specific)
  provider: 'openai' | 'anthropic' | 'ollama'; // Required provider
  baseUrl?: string;                       // Custom API base URL
  mode?: 'automatic' | 'manual' | 'conscious'; // Memory processing mode
  namespace?: string;                     // Memory namespace
  sessionId?: string;                     // Session identifier
  memory?: {                              // Memory configuration (optional)
    enableChatMemory?: boolean;
    memoryProcessingMode?: 'auto' | 'manual' | 'conscious';
  };
}
```

### ChatOptions Interface

```typescript
interface ChatOptions {
  messages: ChatMessage[];                // Chat messages
  model?: string;                         // Model override
  temperature?: number;                   // Temperature setting
  maxTokens?: number;                     // Max tokens
  timeout?: number;                       // Request timeout
  sessionId?: string;                     // Session identifier
}
```

## Search Options

### Basic Search Options

```typescript
interface BasicSearchOptions {
  namespace?: string;                     // Memory namespace (default: 'default')
  limit?: number;                        // Number of results (default: 5)
  includeMetadata?: boolean;             // Include additional metadata
}
```

### Advanced Search Options

```typescript
interface AdvancedSearchOptions extends BasicSearchOptions {
  minImportance?: MemoryImportanceLevel;  // Filter by importance level
  categories?: MemoryClassification[];    // Filter by memory categories
  temporalFilters?: TemporalFilterOptions; // Time-based filtering
  metadataFilters?: MetadataFilterOptions; // Metadata-based filtering
  sortBy?: SortOption;                    // Sort results
  offset?: number;                        // Pagination offset
}
```

## Memory Classification

### MemoryImportanceLevel Enum

```typescript
enum MemoryImportanceLevel {
  CRITICAL = 'critical',    // 0.9 score - Must remember
  HIGH = 'high',           // 0.7 score - Important information
  MEDIUM = 'medium',       // 0.5 score - Useful information
  LOW = 'low'              // 0.3 score - Background information
}
```

### MemoryClassification Enum

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

## Search Results

### MemorySearchResult Interface

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

## Error Types

### Common Error Classes

```typescript
class ConfigurationError extends Error {
  constructor(message: string, configField?: string) {}
}

class DatabaseError extends Error {
  constructor(message: string, operation?: string) {}
}

class ProviderError extends Error {
  constructor(message: string, provider?: string) {}
}

class SearchError extends Error {
  constructor(message: string, strategy?: string) {}
}
```

## Usage Examples

### Complete Application Example

```typescript
import { MemoriAI } from 'memorits';

class MemoryEnabledApplication {
  private ai: MemoriAI;

  constructor() {
    // Initialize MemoriAI with all capabilities
    this.ai = new MemoriAI({
      databaseUrl: 'file:./memori.db',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4',
      provider: 'openai',
      mode: 'automatic'
    });
  }

  async processUserQuery(userMessage: string, sessionId?: string) {
    try {
      // Search for relevant context
      const context = await this.ai.searchMemories(userMessage, {
        limit: 5,
        minImportance: 'medium'
      });

      // Include context in AI prompt
      const messages = [
        ...context.map(c => ({
          role: 'system' as const,
          content: `Context: ${c.content}`
        })),
        { role: 'user' as const, content: userMessage }
      ];

      // Get AI response with automatic memory recording
      const response = await this.ai.chat({
        messages,
        sessionId
      });

      return response.message.content;
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }

  async searchMemories(query: string) {
    const memories = await this.ai.searchMemories(query, {
      limit: 10,
      includeMetadata: true
    });

    return memories;
  }

  async getConfig() {
    return this.ai.getConfig();
  }
}
```

### Configuration Example

```typescript
import { MemoriAI } from 'memorits';

// Simple configuration
const ai = new MemoriAI({
  databaseUrl: process.env.DATABASE_URL || 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
  model: process.env.MEMORI_MODEL || 'gpt-4',
  provider: 'openai',
  mode: process.env.MEMORI_MODE || 'automatic',
  namespace: process.env.MEMORI_NAMESPACE || 'default'
});

// Environment-based configuration is straightforward
// No complex schema validation needed - MemoriAI handles validation
```

## Best Practices

### 1. Error Handling

```typescript
// Always handle errors gracefully
try {
  const results = await ai.searchMemories('query');
} catch (error) {
  if (error instanceof DatabaseError) {
    // Handle database issues
    console.error('Database error:', error);
  } else if (error instanceof ProviderError) {
    // Handle provider issues
    console.error('Provider error:', error);
  } else if (error instanceof SearchError) {
    // Handle search issues
    console.error('Search error:', error);
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

### 2. Configuration Management

```typescript
// Use environment variables for configuration
const ai = new MemoriAI({
  databaseUrl: process.env.DATABASE_URL || 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
  provider: 'openai',
  mode: 'automatic'
});

// MemoriAI validates configuration automatically
```

### 3. Performance Monitoring

```typescript
// Monitor performance
const startTime = Date.now();
const results = await ai.searchMemories('query', { limit: 10 });
const duration = Date.now() - startTime;

console.log(`Search took ${duration}ms and returned ${results.length} results`);
```

This core API provides a solid foundation for building sophisticated memory-enabled applications with comprehensive search and filtering capabilities.