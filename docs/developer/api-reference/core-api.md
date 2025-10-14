# Core API Reference

The Memorits Core API provides the primary interface for **AI-powered memory management**, search, and retrieval operations featuring sophisticated **MemoryAgent integration**. This comprehensive API enables developers to build enterprise-grade AI agents with advanced memory capabilities including classification, importance scoring, entity extraction, and relationship detection.

## Memori Class

The main class that orchestrates **AI-powered memory operations** using sophisticated **MemoryAgent integration**:

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

Creates a new Memori instance with optional configuration, leveraging **MemoryAgent architecture** for sophisticated AI-powered memory processing.

**Parameters:**
- `config` (optional): Partial configuration object

**Example:**
```typescript
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  // MemoryAgent automatically processes conversations with:
  // 🤖 AI-powered classification and importance scoring
  // 🏷️ Advanced entity extraction and relationship detection
  // 📊 Rich metadata generation and analytics
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

Records a conversation and processes it into **AI-powered memory** using sophisticated **MemoryAgent analysis**.

**MemoryAgent Processing:**
- **🤖 AI-Powered Classification**: Automatically categorizes as 'essential', 'contextual', 'conversational', etc.
- **⭐ Intelligent Importance Scoring**: AI determines 'critical', 'high', 'medium', or 'low' importance
- **🏷️ Advanced Entity Extraction**: Identifies people, places, concepts, code elements, and technical terms
- **🔗 Smart Relationship Detection**: Identifies connections to previous memories and conversations
- **📊 Rich Metadata Generation**: Captures provider, model, timestamp, and contextual information

**Parameters:**
- `userInput`: The user's message/input
- `aiOutput`: The AI's response/output
- `options` (optional): Recording options

**Returns:** The unique chat ID for the conversation

**Example:**
```typescript
const chatId = await memori.recordConversation(
  "I need help with React components and TypeScript interfaces for API integration",
  "I'll help you create well-typed React components with proper TypeScript interfaces...",
  {
    model: 'gpt-4o-mini',
    metadata: { topic: 'frontend-development' }
  }
);

// MemoryAgent automatically processes the conversation:
// 🤖 Classification: 'essential' (technical implementation discussion)
// ⭐ Importance: 'high' (complex technical topic requiring focus)
// 🏷️ Entities: ['React', 'TypeScript', 'API', 'components', 'interfaces']
// 🔗 Relationships: Connected to previous frontend development discussions
// 📊 Metadata: Provider info, model used, technical context captured
```

### searchMemories()

```typescript
async searchMemories(
  query: string,
  options?: SearchOptions
): Promise<MemorySearchResult[]>
```

Searches through **AI-enhanced memories** using advanced filtering, ranking, and **MemoryAgent-powered analysis**.

**Enhanced Search Capabilities:**
- **🔍 Semantic Understanding**: AI-powered search across memory content and metadata
- **🏷️ Entity-Based Filtering**: Search by extracted entities, concepts, and technical terms
- **🔗 Relationship Traversal**: Follow memory connections and related conversations
- **⭐ Importance-Aware Ranking**: Prioritize by AI-assessed importance levels
- **📊 Rich Metadata Access**: Comprehensive context and analytics for each memory

**Parameters:**
- `query`: Search query string
- `options` (optional): Search configuration options

**Returns:** Array of matching memory results with **AI-enhanced metadata**

**Example:**
```typescript
const results = await memori.searchMemories('React components API integration', {
  minImportance: 'high',
  categories: ['essential'],
  limit: 10,
  includeMetadata: true
});

// Each result includes AI-powered enhancements:
results.forEach(result => {
  console.log(`Category: ${result.classification.category} (${result.classification.confidence})`);
  console.log(`Importance: ${result.classification.importance}`);
  console.log(`Entities: ${result.entities.map(e => e.value).join(', ')}`);
  console.log(`Relationships: ${result.relationships.length} connections`);
  console.log(`Search relevance: ${result.metadata?.searchScore}`);
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
  namespace?: string;
  enableRelationshipExtraction?: boolean;

  // Database configuration
  databaseUrl?: string;

  // User context (for enhanced memory processing)
  userContext?: {
    userPreferences?: string[];
    currentProjects?: string[];
    relevantSkills?: string[];
  };
}
```

### Configuration Options

#### Core Functionality
- `namespace` (string, default: 'default'): Memory namespace for multi-tenancy

#### Database Configuration
- `databaseUrl` (string): Database connection URL (SQLite, PostgreSQL, etc.)

#### Relationship Extraction
- `enableRelationshipExtraction` (boolean, default: true): Enable relationship extraction during memory processing

#### LLM Provider Configuration
LLM provider configuration (OpenAI, Anthropic, Ollama) now uses the `IProviderConfig` interface. See [Provider Documentation](../providers/) for configuration details.

## Search API

### SearchOptions Interface

The `SearchOptions` interface provides comprehensive search configuration options for memory retrieval. This interface is defined in `src/core/types/models.ts` and supports advanced filtering and search capabilities:

```typescript
interface SearchOptions {
  // Basic options
  namespace?: string;
  limit?: number;
  includeMetadata?: boolean;

  // Filtering options
  minImportance?: MemoryImportanceLevel;
  categories?: MemoryClassification[];
  temporalFilters?: TemporalFilterOptions;
  metadataFilters?: MetadataFilterOptions;

  // Sorting and pagination
  sortBy?: SortOption;
  offset?: number;

  // Advanced options
  strategy?: SearchStrategy;
  timeout?: number;
  enableCache?: boolean;

  // Advanced Features
  filterExpression?: string;
  includeRelatedMemories?: boolean;
  maxRelationshipDepth?: number;
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
async getAvailableSearchStrategies(): Promise<SearchStrategy[]>
```

Returns all available search strategies.

**Example:**
```typescript
const strategies = await memori.getAvailableSearchStrategies();
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
  classification: MemoryClassification;  // 🤖 AI-powered categorization
  importance: MemoryImportanceLevel;     // ⭐ AI-assessed importance level
  topic?: string;
  entities: string[];                    // 🏷️ Extracted entities and concepts
  keywords: string[];
  confidenceScore: number;               // 📊 AI confidence in classification
  classificationReason: string;          // 🤖 Explanation of AI classification
  metadata?: {
    searchScore?: number;                // 🔍 Relevance score from search
    searchStrategy?: string;             // 🔍 Strategy used for this result
    memoryType?: string;                 // 📋 Type of memory (chat, processed, etc.)
    category?: string;                   // 📂 Memory category
    importanceScore?: number;            // ⭐ Numeric importance score
    // AI-enhanced metadata fields:
    extractedEntities?: Array<{         // 🏷️ Detailed entity information
      value: string;
      type: 'person' | 'organization' | 'location' | 'technology' | 'concept' | 'code_element';
      confidence: number;
    }>;
    relationships?: Array<{             // 🔗 Detected memory relationships
      type: 'continuation' | 'reference' | 'related' | 'superseding' | 'contradiction';
      targetMemoryId: string;
      confidence: number;
    }>;
    processingTimestamp?: string;       // ⏰ When MemoryAgent processed this memory
    provider?: string;                  // 🤖 LLM provider used
    model?: string;                     // 🤖 Model that generated the content
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

### OpenAI Integration with MemoryAgent

```typescript
import { MemoriOpenAI } from 'memorits/integrations/openai-dropin';

// Create OpenAI client with AI-powered MemoryAgent processing using new IProviderConfig
const openaiClient = new MemoriOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto', // Leverages sophisticated MemoryAgent for AI analysis
    sessionId: 'my-app'
  }
});

// Use exactly like regular OpenAI client - now with sophisticated memory processing!
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }]
});

// MemoryAgent automatically processes every conversation with:
// 🤖 AI-Powered Classification: 'essential', 'contextual', etc.
// ⭐ Intelligent Importance Scoring: 'critical', 'high', 'medium', 'low'
// 🏷️ Advanced Entity Extraction: People, places, concepts, code elements
// 🔗 Smart Relationship Detection: Connections to previous memories
// 📊 Rich Metadata Generation: Provider, model, timestamp, context

// Access enhanced memory with AI-powered search
const memories = await openaiClient.memory.searchMemories('important information');
console.log(`Found ${memories.length} AI-enhanced memories`);
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

## MemoryAgent Architecture Benefits

### 🏗️ **Sophisticated MemoryAgent Architecture**

The **MemoryAgent integration** delivers sophisticated AI-powered memory processing:

#### **🚀 Unified Architecture**
- **Single Implementation**: MemoryAgent implementation across all providers
- **Unified Processing Pipeline**: Consistent behavior across OpenAI, Anthropic, Ollama

#### **🧠 AI-Powered Memory Processing**
- **LLM-Powered Classification**: Automatic categorization using AI analysis
- **Intelligent Importance Scoring**: Dynamic importance assessment based on content
- **Advanced Entity Extraction**: Automated extraction of key entities and concepts
- **Smart Relationship Detection**: Identification of memory connections and dependencies
- **Rich Metadata Generation**: Comprehensive context and analytics for every memory

#### **🔧 Developer Experience**
- **Sophisticated Memory Capabilities**: Enterprise-grade features in unified architecture
- **Consistent Provider Behavior**: Identical memory processing across all LLM providers
- **Rich Memory Analytics**: Deep insights into conversation patterns and knowledge extraction
- **Extensible Architecture**: Design supports advanced memory features

### 📊 **Memory Analytics & Insights**

```typescript
// Access comprehensive memory analytics
const analytics = await memori.getMemoryAnalytics({
  timeRange: { start: '2024-01-01', end: '2024-12-31' },
  sessionId: 'my-app'
});

console.log(`Total memories processed: ${analytics.totalMemories}`);
console.log(`By importance:`, analytics.byImportance);
// {
//   critical: 12,    // 🔥 Mission-critical information
//   high: 45,        // 📈 Important technical decisions
//   medium: 123,     // 📝 Educational content and examples
//   low: 234         // 💬 Casual conversation and greetings
// }

console.log(`Top entities:`, analytics.topEntities);
// [
//   { value: 'React', count: 45, type: 'technology' },
//   { value: 'TypeScript', count: 38, type: 'technology' },
//   { value: 'API', count: 29, type: 'concept' }
// ]

console.log(`Memory relationships: ${analytics.relationshipStats.totalConnections}`);
```

### 🏷️ **Entity Extraction & Relationship Mapping**

```typescript
// Search results now include rich entity and relationship data
const results = await memori.searchMemories('React components', {
  includeMetadata: true,
  includeRelatedMemories: true
});

results.forEach(result => {
  // Access extracted entities with confidence scores
  result.metadata?.extractedEntities?.forEach(entity => {
    console.log(`${entity.value} (${entity.type}): ${entity.confidence}`);
  });

  // Explore memory relationships
  result.metadata?.relationships?.forEach(rel => {
    console.log(`${rel.type} → ${rel.targetMemoryId} (${rel.confidence})`);
  });
});
```

## Best Practices

### 1. Configuration Setup

```typescript
// Recommended configuration for production
const productionConfig = {
  databaseUrl: process.env.DATABASE_URL || 'sqlite:./memories.db',
  namespace: process.env.MEMORI_NAMESPACE || 'default',
  enableRelationshipExtraction: true
};

// Note: LLM provider configuration now uses IProviderConfig format
// See provider documentation for OpenAI, Anthropic, or Ollama setup
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