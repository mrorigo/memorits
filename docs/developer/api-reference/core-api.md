# Core API Reference

The Memorits Core API provides the primary interface for memory management, search, and retrieval operations. This comprehensive API enables developers to build sophisticated AI agents with advanced memory capabilities.

## Memori Class

The main class that orchestrates all memory operations:

```typescript
import { Memori } from 'memorits';

class Memori {
  constructor(config?: Partial<MemoriConfig>);
  async enable(): Promise<void>;
  async recordConversation(
    userInput: string,
    aiOutput: string,
    options?: RecordConversationOptions
  ): Promise<string>;
  async searchMemories(
    query: string,
    options?: SearchOptions
  ): Promise<MemorySearchResult[]>;
  async close(): Promise<void>;
}
```

### Constructor

```typescript
constructor(config?: Partial<MemoriConfig>)
```

Creates a new Memori instance with optional configuration.

**Parameters:**
- `config` (optional): Partial configuration object

**Example:**
```typescript
const memori = new Memori({
  autoIngest: true,
  consciousIngest: false,
  namespace: 'my-app',
  databaseUrl: 'sqlite:./memories.db'
});
```

### enable()

```typescript
async enable(): Promise<void>
```

Initializes the memory system and enables all functionality.

**Throws:**
- `Error`: If already enabled or initialization fails

**Example:**
```typescript
await memori.enable();
console.log('Memory system ready!');
```

### recordConversation()

```typescript
async recordConversation(
  userInput: string,
  aiOutput: string,
  options?: RecordConversationOptions
): Promise<string>
```

Records a conversation and processes it into memory based on the configured mode.

**Parameters:**
- `userInput`: The user's message/input
- `aiOutput`: The AI's response/output
- `options` (optional): Recording options

**Returns:** The unique chat ID for the conversation

**Example:**
```typescript
const chatId = await memori.recordConversation(
  "What's the best sorting algorithm?",
  "For most applications, I'd recommend quicksort...",
  {
    model: 'gpt-4o-mini',
    metadata: { topic: 'algorithms' }
  }
);
```

### searchMemories()

```typescript
async searchMemories(
  query: string,
  options?: SearchOptions
): Promise<MemorySearchResult[]>
```

Searches through stored memories using advanced filtering and ranking.

**Parameters:**
- `query`: Search query string
- `options` (optional): Search configuration options

**Returns:** Array of matching memory results

**Example:**
```typescript
const results = await memori.searchMemories('urgent meeting notes', {
  minImportance: 'high',
  categories: ['essential'],
  limit: 10,
  includeMetadata: true
});
```

### close()

```typescript
async close(): Promise<void>
```

Closes the memory system and releases resources.

**Example:**
```typescript
await memori.close();
```

## Configuration API

### MemoriConfig Interface

```typescript
interface MemoriConfig {
  // Core functionality
  autoIngest?: boolean;
  consciousIngest?: boolean;
  namespace?: string;

  // Database configuration
  databaseUrl?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;

  // Memory processing
  minImportanceLevel?: MemoryImportanceFilter;
  maxMemoryAge?: number;
  backgroundInterval?: number;

  // User context
  userContext?: {
    userPreferences?: string[];
    currentProjects?: string[];
    relevantSkills?: string[];
  };
}
```

### Configuration Options

#### Core Functionality
- `autoIngest` (boolean, default: true): Enable automatic memory processing
- `consciousIngest` (boolean, default: false): Enable conscious/background processing
- `namespace` (string, default: 'default'): Memory namespace for multi-tenancy

#### Database Configuration
- `databaseUrl` (string): Database connection URL (SQLite, PostgreSQL, etc.)
- `apiKey` (string): OpenAI API key for memory processing
- `model` (string, default: 'gpt-4o-mini'): Model for memory processing
- `baseUrl` (string): Custom API base URL

#### Memory Processing
- `minImportanceLevel`: Minimum importance level for processing
- `maxMemoryAge` (number): Maximum age of memories in days
- `backgroundInterval` (number): Background processing interval in milliseconds

## Search API

### SearchOptions Interface

```typescript
interface SearchOptions {
  limit?: number;
  minImportance?: MemoryImportanceFilter;
  categories?: MemoryClassification[];
  includeMetadata?: boolean;
  namespace?: string;
}
```

### Advanced Search with Strategies

```typescript
async searchMemoriesWithStrategy(
  query: string,
  strategy: SearchStrategy,
  options?: SearchOptions
): Promise<MemorySearchResult[]>
```

Searches using a specific search strategy.

**Parameters:**
- `query`: Search query
- `strategy`: Specific search strategy to use
- `options`: Search configuration

**Example:**
```typescript
const ftsResults = await memori.searchMemoriesWithStrategy(
  'algorithm implementation',
  SearchStrategy.FTS5,
  { limit: 5 }
);
```

### Strategy Management

```typescript
getAvailableSearchStrategies(): SearchStrategy[]
```

Returns all available search strategies.

**Example:**
```typescript
const strategies = memori.getAvailableSearchStrategies();
console.log('Available strategies:', strategies);
```

## Memory Processing API

### Memory Recording Options

```typescript
interface RecordConversationOptions {
  model?: string;
  metadata?: Record<string, unknown>;
}
```

### Memory Search Results

```typescript
interface MemorySearchResult {
  id: string;
  content: string;
  summary: string;
  classification: MemoryClassification;
  importance: MemoryImportanceLevel;
  topic?: string;
  entities: string[];
  keywords: string[];
  confidenceScore: number;
  classificationReason: string;
  metadata?: {
    searchScore?: number;
    searchStrategy?: string;
    memoryType?: string;
    category?: string;
    importanceScore?: number;
  };
}
```

## Agent System API

### Conscious Agent Management

```typescript
getConsciousAgent(): ConsciousAgent | undefined
isConsciousModeEnabled(): boolean
checkForConsciousContextUpdates(): Promise<void>
initializeConsciousContext(): Promise<void>
```

### Background Monitoring

```typescript
setBackgroundUpdateInterval(intervalMs: number): void
getBackgroundUpdateInterval(): number
isBackgroundMonitoringActive(): boolean
```

**Example:**
```typescript
// Configure background monitoring
memori.setBackgroundUpdateInterval(60000); // 1 minute

// Check if monitoring is active
if (memori.isBackgroundMonitoringActive()) {
  console.log('Conscious processing is running');
}
```

## Database Management API

### Direct Database Operations

```typescript
interface DatabaseManager {
  storeChatHistory(data: ChatHistoryData): Promise<string>;
  storeLongTermMemory(
    memoryData: ProcessedLongTermMemory,
    chatId: string,
    namespace: string
  ): Promise<string>;
  getDatabaseStats(namespace?: string): Promise<DatabaseStats>;
  close(): Promise<void>;
}
```

### Memory Statistics

```typescript
interface DatabaseStats {
  totalConversations: number;
  totalMemories: number;
  shortTermMemories: number;
  longTermMemories: number;
  consciousMemories: number;
  lastActivity?: Date;
}
```

## Type Definitions

### Memory Classification

```typescript
enum MemoryClassification {
  ESSENTIAL = 'essential',
  CONTEXTUAL = 'contextual',
  CONVERSATIONAL = 'conversational',
  REFERENCE = 'reference',
  PERSONAL = 'personal',
  CONSCIOUS_INFO = 'conscious-info'
}

enum MemoryImportanceLevel {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}
```

### Search Strategy Types

```typescript
enum SearchStrategy {
  FTS5 = 'fts5',
  LIKE = 'like',
  RECENT = 'recent',
  SEMANTIC = 'semantic',
  CATEGORY_FILTER = 'category_filter',
  TEMPORAL_FILTER = 'temporal_filter',
  METADATA_FILTER = 'metadata_filter'
}
```

## Error Handling

### Error Types

```typescript
class MemoryError extends Error {
  constructor(message: string, public code: string);
}

class SearchError extends MemoryError {
  constructor(message: string, public strategy: string);
}

class DatabaseError extends MemoryError {
  constructor(message: string, public operation: string);
}
```

### Error Handling Example

```typescript
try {
  const results = await memori.searchMemories('query');
} catch (error) {
  if (error instanceof SearchError) {
    console.error(`Search failed with strategy ${error.strategy}: ${error.message}`);
  } else if (error instanceof DatabaseError) {
    console.error(`Database operation ${error.operation} failed: ${error.message}`);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Session Management

### Session Information

```typescript
getSessionId(): string
isEnabled(): boolean
```

**Example:**
```typescript
const sessionId = memori.getSessionId();
const enabled = memori.isEnabled();

console.log(`Session: ${sessionId}, Enabled: ${enabled}`);
```

## Advanced Memory Operations

### Processed Memory Storage

```typescript
async storeProcessedMemory(
  processedMemory: ProcessedLongTermMemory,
  chatId: string,
  namespace?: string
): Promise<string>
```

Stores pre-processed memory directly.

**Parameters:**
- `processedMemory`: Already processed memory object
- `chatId`: Associated chat/conversation ID
- `namespace` (optional): Target namespace

**Example:**
```typescript
const memoryId = await memori.storeProcessedMemory(
  processedMemory,
  chatId,
  'custom-namespace'
);
```

### Memory Retrieval with Metadata

```typescript
// Search with full metadata
const detailedResults = await memori.searchMemories('query', {
  includeMetadata: true,
  limit: 20
});

// Access metadata
detailedResults.forEach(result => {
  console.log('Search strategy:', result.metadata?.searchStrategy);
  console.log('Memory type:', result.metadata?.memoryType);
  console.log('Search score:', result.metadata?.searchScore);
});
```

## Integration Helper Functions

### OpenAI Integration

```typescript
import { createMemoriOpenAI } from 'memorits';

// Create OpenAI client with automatic memory recording
const openaiClient = createMemoriOpenAI(memori, apiKey);

// Use exactly like regular OpenAI client
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this...' }]
});
```

### Configuration Management

```typescript
import { ConfigManager } from 'memorits';

// Load configuration from environment
const config = ConfigManager.loadConfig();

// Merge with custom config
const customConfig = ConfigManager.mergeConfig(config, {
  namespace: 'my-app',
  autoIngest: true
});
```

## Best Practices

### 1. Configuration Setup

```typescript
// Recommended configuration for production
const productionConfig = {
  autoIngest: true,
  consciousIngest: false,
  namespace: process.env.MEMORI_NAMESPACE || 'default',
  databaseUrl: process.env.DATABASE_URL || 'sqlite:./memories.db',
  minImportanceLevel: 'medium',
  maxMemoryAge: 90, // Keep memories for 90 days
  backgroundInterval: 30000 // Check every 30 seconds
};
```

### 2. Error Handling

```typescript
// Comprehensive error handling
class MemoryManager {
  async safeSearch(query: string): Promise<MemorySearchResult[]> {
    try {
      return await memori.searchMemories(query);
    } catch (error) {
      console.error('Search failed:', error);
      // Return empty array or fallback results
      return [];
    }
  }

  async safeRecord(userInput: string, aiOutput: string): Promise<string | null> {
    try {
      return await memori.recordConversation(userInput, aiOutput);
    } catch (error) {
      console.error('Recording failed:', error);
      return null;
    }
  }
}
```

### 3. Resource Management

```typescript
// Proper resource cleanup
class Application {
  private memori: Memori;

  async initialize() {
    this.memori = new Memori(config);
    await this.memori.enable();

    // Setup cleanup on process exit
    process.on('SIGINT', async () => {
      await this.cleanup();
      process.exit(0);
    });
  }

  async cleanup() {
    if (this.memori.isEnabled()) {
      await this.memori.close();
    }
  }
}
```

This comprehensive API provides everything needed to build sophisticated AI agents with advanced memory capabilities, from basic conversation recording to complex multi-strategy search operations.