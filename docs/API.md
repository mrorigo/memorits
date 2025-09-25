# Memorits API Reference

This document provides comprehensive API documentation for Memorits, including all interfaces, classes, and methods.

## Table of Contents

- [Core Interfaces](#core-interfaces)
- [Search & Filtering](#search--filtering)
- [Memory Processing](#memory-processing)
- [Configuration](#configuration)
- [Database Operations](#database-operations)
- [Provider Interfaces](#provider-interfaces)
- [Utility Interfaces](#utility-interfaces)
- [Type Definitions](#type-definitions)
- [Usage Examples](#usage-examples)

## Core Interfaces

### MemorySearchResult

Represents the result of a memory search operation with full type safety.

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
  metadata?: Record<string, unknown>;
}
```

### ConversationMetadata

Structured metadata for conversation recording.

```typescript
interface ConversationMetadata {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tokensUsed?: number;
  modelType?: 'openai' | 'ollama';
  conversationIndex?: number;
  category?: string;
  [key: string]: unknown;
}
```

### RecordConversationOptions

Options for recording conversations with enhanced metadata support.

```typescript
interface RecordConversationOptions {
  model?: string;
  metadata?: ConversationMetadata;
}
```

## Search & Filtering

### SearchOptions

Advanced search options with filtering capabilities.

```typescript
interface SearchOptions {
  namespace?: string;                    // Memory namespace (default: 'default')
  limit?: number;                       // Number of results (default: 5)
  minImportance?: MemoryImportanceLevel; // Filter by importance level
  categories?: MemoryClassification[];   // Filter by memory categories
  includeMetadata?: boolean;            // Include additional metadata
}
```

**Usage Examples:**

```typescript
// Basic search
const memories = await memori.searchMemories('TypeScript', { limit: 10 });

// Search with importance filtering
const importantMemories = await memori.searchMemories('critical', {
  minImportance: 'high' // Only show high importance and above
});

// Search specific categories
const technicalMemories = await memori.searchMemories('code', {
  categories: ['essential', 'reference'] // Only technical memories
});

// Include metadata in results
const detailedResults = await memori.searchMemories('analysis', {
  includeMetadata: true,
  limit: 20
});
```

### DatabaseStats

Database statistics and metrics interface.

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

## Memory Processing

### MemoryProcessingParams

Structured parameters for memory processing operations.

```typescript
interface MemoryProcessingParams {
  chatId: string;
  userInput: string;
  aiOutput: string;
  context: ConversationContext;
}
```

### MemoryProcessingResult

Result of memory processing operations with status information.

```typescript
interface MemoryProcessingResult {
  success: boolean;
  memory?: ProcessedLongTermMemory;
  error?: string;
  processingTime: number;
  fallbackUsed?: boolean;
}
```

### ConversationContext

Rich context information for conversation processing.

```typescript
interface ConversationContext {
  conversationId: string;
  sessionId: string;
  modelUsed: string;
  userPreferences: string[];
  currentProjects: string[];
  relevantSkills: string[];
  userId?: string;
}
```

## Configuration

### UserContext

User-specific context data for personalized memory processing.

```typescript
interface UserContext {
  userPreferences?: string[];
  currentProjects?: string[];
  relevantSkills?: string[];
}
```

### MemoriConfig

Main configuration interface for Memorits.

```typescript
interface MemoriConfig {
  databaseUrl: string;
  namespace: string;
  consciousIngest: boolean;
  autoIngest: boolean;
  model: string;
  apiKey: string;
  baseUrl?: string;
  userContext?: UserContext;
  backgroundUpdateInterval?: number;
}
```

**Configuration Example:**

```typescript
const config: MemoriConfig = {
  databaseUrl: 'file:./memori.db',
  namespace: 'default',
  consciousIngest: false,
  autoIngest: true,
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
  baseUrl: process.env.OPENAI_BASE_URL,
  userContext: {
    userPreferences: ['detailed explanations', 'code examples'],
    currentProjects: ['web application', 'API development'],
    relevantSkills: ['TypeScript', 'React', 'Node.js']
  },
  backgroundUpdateInterval: 30000
};
```

## Database Operations

### DatabaseManager Interface

The DatabaseManager provides comprehensive database operations with type safety.

```typescript
class DatabaseManager {
  // Store conversation data
  async storeChatHistory(data: ChatHistoryData): Promise<string>

  // Store processed memory
  async storeLongTermMemory(memoryData: any, chatId: string, namespace: string): Promise<string>

  // Advanced search with filtering
  async searchMemories(query: string, options: SearchOptions): Promise<MemorySearchResult[]>

  // Close database connection
  async close(): Promise<void>
}
```

### Advanced Search Features

The search system supports multiple filtering options:

```typescript
// Search with importance filtering
const highPriorityMemories = await dbManager.searchMemories('urgent', {
  minImportance: 'high'
});

// Search by specific categories
const technicalMemories = await dbManager.searchMemories('implementation', {
  categories: ['essential', 'contextual']
});

// Include metadata for detailed analysis
const detailedSearch = await dbManager.searchMemories('architecture', {
  includeMetadata: true,
  limit: 50
});
```

## Provider Interfaces

### LLMProviderConfig

Configuration for Language Model providers.

```typescript
interface LLMProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### EmbeddingResult

Results from embedding operations.

```typescript
interface EmbeddingResult {
  vector: number[];
  tokensUsed: number;
  model: string;
}
```

**Provider Configuration Examples:**

```typescript
// OpenAI Configuration
const openaiConfig: LLMProviderConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'text-embedding-ada-002',
  temperature: 0.1,
  maxTokens: 1000
};

// Ollama Configuration
const ollamaConfig: LLMProviderConfig = {
  apiKey: 'ollama-local', // Dummy key for Ollama
  model: 'llama2:7b',
  baseUrl: 'http://localhost:11434/v1'
};
```

## Utility Interfaces

### LogContext

Structured logging context for consistent log formatting.

```typescript
interface LogContext {
  component?: string;
  userId?: string;
  sessionId?: string;
  chatId?: string;
  namespace?: string;
  [key: string]: any;
}
```

### LoggerConfig

Configuration for the logging system.

```typescript
interface LoggerConfig {
  level: LogLevel;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logDir?: string;
  environment: 'development' | 'production' | 'test';
}

type LogLevel = 'error' | 'warn' | 'info' | 'debug';
```

## Type Definitions

### Memory Classification Enums

#### MemoryClassification

Categorizes memories by their type and purpose.

```typescript
enum MemoryClassification {
  ESSENTIAL = "essential",        // Critical information that must be remembered
  CONTEXTUAL = "contextual",      // Supporting context for other memories
  CONVERSATIONAL = "conversational", // General conversation and chit-chat
  REFERENCE = "reference",        // Reference material and documentation
  PERSONAL = "personal",          // Personal information and preferences
  CONSCIOUS_INFO = "conscious-info" // Information promoted to conscious awareness
}
```

#### MemoryImportanceLevel

Defines the importance hierarchy for memory retention.

```typescript
enum MemoryImportanceLevel {
  CRITICAL = "critical",  // 0.9 score - Must remember (essential information)
  HIGH = "high",          // 0.7 score - Important information
  MEDIUM = "medium",      // 0.5 score - Useful information
  LOW = "low"             // 0.3 score - Background information
}
```

### Utility Types

```typescript
// Optional properties utility
type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Memory with metadata
type MemoryWithMetadata = ProcessedLongTermMemory & {
  metadata: ConversationMetadata;
};

// Deep partial for nested objects
type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};
```

## Usage Examples

### Basic Memory Operations

```typescript
import { Memori, ConfigManager } from 'memorits';

// Initialize with configuration
const config = ConfigManager.loadConfig();
const memori = new Memori(config);
await memori.enable();

// Record a conversation
const chatId = await memori.recordConversation(
  'What is TypeScript?',
  'TypeScript is a superset of JavaScript that adds static typing.',
  {
    model: 'gpt-4o-mini',
    metadata: { category: 'programming' }
  }
);

// Search for memories
const memories = await memori.searchMemories('TypeScript', {
  limit: 10,
  minImportance: 'medium'
});
```

### Advanced Search with Filtering

```typescript
// Search with multiple filters
const filteredMemories = await memori.searchMemories('database', {
  limit: 20,
  minImportance: 'high',
  categories: ['essential', 'reference'],
  includeMetadata: true
});

// Process results
filteredMemories.forEach(memory => {
  console.log(`Memory: ${memory.summary}`);
  console.log(`Importance: ${memory.importance}`);
  console.log(`Classification: ${memory.classification}`);
  if (memory.metadata) {
    console.log(`Model: ${memory.metadata.modelUsed}`);
  }
});
```

### Memory Processing with Custom Context

```typescript
// Record conversation with rich context
const contextChatId = await memori.recordConversation(
  'How do I implement error handling?',
  'Use try-catch blocks and proper error types.',
  {
    model: 'gpt-4o-mini',
    metadata: {
      category: 'error-handling',
      context: 'production application'
    }
  }
);

// The memory will be processed with enhanced context
// including user preferences and project information
```

### Configuration with User Context

```typescript
const config: MemoriConfig = {
  databaseUrl: 'file:./memori.db',
  namespace: 'user123',
  consciousIngest: false,
  autoIngest: true,
  model: 'gpt-4o-mini',
  apiKey: process.env.OPENAI_API_KEY,
  userContext: {
    userPreferences: [
      'detailed technical explanations',
      'code examples in TypeScript',
      'practical implementation advice'
    ],
    currentProjects: [
      'E-commerce platform',
      'API development',
      'Database optimization'
    ],
    relevantSkills: [
      'TypeScript', 'React', 'Node.js',
      'PostgreSQL', 'Redis', 'Docker'
    ]
  }
};

const personalizedMemori = new Memori(config);
```

## Best Practices

### Interface Usage

1. **Always use interfaces** for public APIs instead of inline types
2. **Leverage SearchOptions** for advanced filtering capabilities
3. **Include metadata** in conversation recording for rich context
4. **Use MemoryClassification** to categorize different types of information

### Error Handling

1. **Check return types** - Many methods return structured result objects
2. **Handle optional fields** - Use optional chaining for metadata
3. **Validate configurations** - Use MemoriConfig interface for type safety

### Performance Optimization

1. **Use appropriate limits** - Set reasonable result limits to avoid large datasets
2. **Filter at search time** - Use importance and category filters to reduce processing
3. **Include only needed metadata** - Set includeMetadata: false when not needed

### Type Safety

1. **Prefer interfaces over any** - Use the provided interfaces for better type safety
2. **Leverage enums** - Use MemoryClassification and MemoryImportanceLevel for consistency
3. **Validate at runtime** - Combine interfaces with Zod schemas for runtime validation

This API reference provides comprehensive documentation for all Memorits interfaces and their usage patterns. For implementation details, see the developer documentation in `docs/DEVELOPER.md`.