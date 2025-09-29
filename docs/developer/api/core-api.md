# Core API Reference

This document provides comprehensive documentation for the core Memorits API, including the main Memori class and its primary interfaces.

## Memori Class

The `Memori` class is the main entry point for memory management operations.

### Constructor

```typescript
constructor(config?: Partial<MemoriConfig>)
```

**Parameters:**
- `config` (optional): Partial configuration object

**Example:**
```typescript
import { Memori, ConfigManager } from 'memorits';

// Using configuration manager
const config = ConfigManager.loadConfig();
const memori = new Memori(config);

// Using custom configuration
const memori = new Memori({
  databaseUrl: 'sqlite:./my-memories.db',
  namespace: 'my-app',
  autoIngest: true
});
```

### Core Methods

#### `enable()`

Initialize the memory system and enable processing.

```typescript
async enable(): Promise<void>
```

**Returns:** Promise that resolves when system is ready

**Throws:**
- `ConfigurationError`: Invalid configuration
- `DatabaseError`: Database connection failure

**Example:**
```typescript
try {
  await memori.enable();
  console.log('Memorits is ready!');
} catch (error) {
  console.error('Failed to enable Memorits:', error);
}
```

#### `recordConversation()`

Record a conversation for memory processing.

```typescript
async recordConversation(
  userInput: string,
  aiOutput: string,
  options?: RecordConversationOptions
): Promise<string>
```

**Parameters:**
- `userInput`: The user's message content
- `aiOutput`: The AI's response content
- `options` (optional): Recording options including model and metadata

**Returns:** The chat ID of the recorded conversation

**Example:**
```typescript
const chatId = await memori.recordConversation(
  'What is TypeScript?',
  'TypeScript is a programming language that builds on JavaScript...',
  {
    model: 'gpt-4o-mini',
    metadata: {
      sessionId: 'user-session-123',
      topic: 'programming',
      difficulty: 'beginner'
    }
  }
);
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

// Advanced filter expressions (GAPS1)
const advancedResults = await memori.searchMemories('', {
  filterExpression: 'importance_score >= 0.7 AND created_at > "2024-01-01"',
  limit: 10
});

// Memory consolidation (GAPS1)
const consolidationResult = await memori.consolidateDuplicateMemories(
  'memory-id-1',
  ['memory-id-2', 'memory-id-3']
);

if (consolidationResult.consolidated > 0) {
  console.log(`Consolidated ${consolidationResult.consolidated} duplicate memories`);
}

// Search with relationships (GAPS1)
const relationshipSearch = await memori.searchMemories('related to project setup', {
  includeRelatedMemories: true,
  maxRelationshipDepth: 2
});

// Get index health report (GAPS1)
const healthReport = await memori.getIndexHealthReport();
console.log(`Index health: ${healthReport.health}`);
console.log(`Issues found: ${healthReport.issues.length}`);

// Optimize search index (GAPS1)
const optimizationResult = await memori.optimizeIndex('merge');
console.log(`Optimization saved ${optimizationResult.spaceSaved} bytes`);
```

#### `close()`

Clean up resources and close database connections.

```typescript
async close(): Promise<void>
```

**Example:**
```typescript
await memori.close();
console.log('Memorits shut down successfully');
```

### Status Methods

#### `isEnabled()`

Check if the memory system is enabled.

```typescript
isEnabled(): boolean
```

**Returns:** `true` if system is enabled and ready

**Example:**
```typescript
if (memori.isEnabled()) {
  // System is ready for use
  const memories = await memori.searchMemories('test');
}
```

#### `getSessionId()`

Get the current session identifier.

```typescript
getSessionId(): string
```

**Returns:** Unique session ID string

**Example:**
```typescript
const sessionId = memori.getSessionId();
console.log('Current session:', sessionId);
```

### Memory Processing Control

#### `isConsciousModeEnabled()`

Check if conscious processing mode is active.

```typescript
isConsciousModeEnabled(): boolean
```

**Returns:** `true` if conscious mode is enabled

#### `isAutoModeEnabled()`

Check if auto-ingestion mode is active.

```typescript
isAutoModeEnabled(): boolean
```

**Returns:** `true` if auto mode is enabled

#### `checkForConsciousContextUpdates()`

Check for and process new conscious memories.

```typescript
async checkForConsciousContextUpdates(): Promise<void>
```

**Example:**
```typescript
// Manually trigger conscious context update
await memori.checkForConsciousContextUpdates();
```

#### `getBackgroundUpdateInterval()`

Get the current background update interval.

```typescript
getBackgroundUpdateInterval(): number
```

**Returns:** Update interval in milliseconds

### GAPS1 Advanced Methods

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

## Configuration Management

### MemoriConfig Interface

```typescript
interface MemoriConfig {
  databaseUrl: string;                    // Database connection URL
  namespace: string;                      // Memory namespace
  consciousIngest: boolean;               // Enable conscious processing
  autoIngest: boolean;                    // Enable auto ingestion
  model: string;                          // Default LLM model
  apiKey: string;                         // OpenAI API key
  baseUrl?: string;                       // Custom API base URL
  userContext?: UserContext;              // User-specific context
}
```

### RecordConversationOptions Interface

```typescript
interface RecordConversationOptions {
  sessionId?: string;                     // Session identifier
  metadata?: Record<string, unknown>;     // Additional metadata
  skipProcessing?: boolean;               // Skip memory processing
  immediate?: boolean;                    // Process immediately
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

class SearchError extends Error {
  constructor(message: string, strategy?: string) {}
}

class ValidationError extends Error {
  constructor(message: string, field?: string) {}
}
```

## Usage Examples

### Complete Application Example

```typescript
import { Memori, ConfigManager, createMemoriOpenAI } from 'memorits';

class MemoryEnabledApplication {
  private memori: Memori;
  private openaiClient: any;

  constructor() {
    // Initialize Memorits
    const config = ConfigManager.loadConfig();
    this.memori = new Memori(config);
  }

  async initialize() {
    try {
      // Enable memory processing
      await this.memori.enable();

      // Create OpenAI client with memory
      this.openaiClient = createMemoriOpenAI(this.memori, process.env.OPENAI_API_KEY);

      console.log('Application initialized with memory capabilities');
    } catch (error) {
      console.error('Initialization failed:', error);
      throw error;
    }
  }

  async processUserQuery(userMessage: string, sessionId: string) {
    try {
      // Search for relevant context
      const context = await this.memori.searchMemories(userMessage, {
        limit: 5,
        minImportance: 'medium' as any
      });

      // Include context in AI prompt
      const messages = [
        ...context.map(c => ({
          role: 'system' as const,
          content: `Context: ${c.content}`
        })),
        { role: 'user' as const, content: userMessage }
      ];

      // Get AI response
      const response = await this.openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages
      });

      // Record the conversation for future use
      await this.memori.recordConversation(
        userMessage,
        response.choices[0].message.content,
        {
          model: 'gpt-4o-mini',
          metadata: { sessionId }
        }
      );

      return response.choices[0].message.content;
    } catch (error) {
      console.error('Error processing query:', error);
      throw error;
    }
  }

  async shutdown() {
    await this.memori.close();
    console.log('Application shut down successfully');
  }
}
```

### Configuration Example

```typescript
import { MemoriConfigSchema } from 'memorits';

// Load configuration with validation
const config = MemoriConfigSchema.parse({
  databaseUrl: process.env.DATABASE_URL || 'sqlite:./memories.db',
  namespace: process.env.MEMORI_NAMESPACE || 'default',
  autoIngest: process.env.MEMORI_AUTO_INGEST === 'true',
  consciousIngest: process.env.MEMORI_CONSCIOUS_INGEST === 'true',
  model: process.env.MEMORI_MODEL || 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY || '',
  baseUrl: process.env.OPENAI_BASE_URL,
  userContext: {
    userPreferences: ['dark_mode', 'concise_responses'],
    currentProjects: ['memorits_development'],
    relevantSkills: ['typescript', 'node.js', 'ai_development']
  }
});

const memori = new Memori(config);
```

## Best Practices

### 1. Error Handling

```typescript
// Always handle errors gracefully
try {
  const results = await memori.searchMemories('query');
} catch (error) {
  if (error instanceof DatabaseError) {
    // Handle database issues
    console.error('Database error:', error);
  } else if (error instanceof SearchError) {
    // Handle search issues
    console.error('Search error:', error);
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

### 2. Resource Management

```typescript
// Always clean up resources
process.on('SIGINT', async () => {
  console.log('Shutting down...');
  await memori.close();
  process.exit(0);
});
```

### 3. Performance Monitoring

```typescript
// Monitor performance
const startTime = Date.now();
const results = await memori.searchMemories('query', { limit: 10 });
const duration = Date.now() - startTime;

console.log(`Search took ${duration}ms and returned ${results.length} results`);
```

This core API provides a solid foundation for building sophisticated memory-enabled applications with comprehensive search and filtering capabilities.