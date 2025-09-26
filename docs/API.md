
# Memorits API Documentation

## Complete Reference Guide

This comprehensive API documentation covers all Memorits components, including the core Memori engine, OpenAI drop-in replacement, and all supporting utilities.

---

## Table of Contents

1. [Core Components](#core-components)
   - [Memori Class](#memori-class)
   - [Configuration](#configuration)
   - [Memory Operations](#memory-operations)

2. [OpenAI Drop-in Replacement](#openai-drop-in-replacement)
   - [MemoriOpenAI Client](#memoriopenai-client)
   - [Factory Functions](#factory-functions)
   - [Memory Manager](#memory-manager)

3. [Type Definitions](#type-definitions)
   - [Core Types](#core-types)
   - [Memory Types](#memory-types)
   - [Configuration Types](#configuration-types)

4. [Advanced Features](#advanced-features)
   - [Streaming Support](#streaming-support)
   - [Performance Monitoring](#performance-monitoring)
   - [Error Handling](#error-handling)

---

## Core Components

### Memori Class

The main Memori class provides memory management functionality.

#### Constructor

```typescript
constructor(config?: MemoriConfig)
```

#### Configuration

```typescript
interface MemoriConfig {
  databaseUrl?: string;           // Database connection string
  namespace?: string;             // Memory namespace
  processingMode?: 'auto' | 'conscious' | 'none';
  autoIngest?: boolean;           // Enable automatic memory ingestion
  consciousIngest?: boolean;      // Enable conscious memory processing
  minImportanceLevel?: MemoryImportanceLevel;
  maxMemoryAge?: number;          // Days to keep memories
  apiKey?: string;                // OpenAI API key for processing
  baseUrl?: string;               // OpenAI base URL
}
```

#### Core Methods

##### Memory Operations

```typescript
// Record a conversation
async recordConversation(
  userInput: string,
  assistantResponse: string,
  options?: RecordOptions
): Promise<MemoryRecord>

// Search memories
async searchMemories(
  query: string,
  options?: SearchOptions
): Promise<MemorySearchResult[]>

// Get memory statistics
async getMemoryStats(): Promise<MemoryStats>

// Clear memories
async clearAllMemories(namespace?: string): Promise<void>
async clearMemoriesByAge(days: number): Promise<void>
async clearMemoriesByImportance(level: MemoryImportanceLevel): Promise<void>
```

##### Memory Processing

```typescript
// Trigger conscious processing
async processConsciousMemories(): Promise<void>

// Get essential memories
async getEssentialMemories(limit?: number): Promise<MemoryRecord[]>

// Get memory by ID
async getMemoryById(id: string): Promise<MemoryRecord | null>
```

##### Context Management

```typescript
// Get context for a query
async getContextForQuery(query: string): Promise<ContextResult>

// Update memory importance
async updateMemoryImportance(id: string, importance: MemoryImportanceLevel): Promise<void>

// Add metadata to memory
async addMemoryMetadata(id: string, metadata: Record<string, any>): Promise<void>
```

### Configuration

#### ConfigurationManager

```typescript
class ConfigurationManager {
  // Load configuration from environment
  static loadConfig(): MemoriConfig

  // Load from file
  static loadFromFile(path: string): MemoriConfig

  // Validate configuration
  static validateConfig(config: MemoriConfig): ValidationResult

  // Get default configuration
  static getDefaults(): MemoriConfig
}
```

#### Environment Variables

```bash
# Database Configuration
MEMORI_DATABASE_URL=sqlite:./memories.db
MEMORI_NAMESPACE=default
MEMORI_MAX_AGE=30

# Processing Configuration
MEMORI_PROCESSING_MODE=auto
MEMORI_AUTO_INGEST=true
MEMORI_CONSCIOUS_INGEST=false
MEMORI_MIN_IMPORTANCE=low

# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
```

---

## OpenAI Drop-in Replacement

### MemoriOpenAI Client

The MemoriOpenAI client provides a complete drop-in replacement for the OpenAI SDK.

#### Constructor

```typescript
constructor(apiKey: string, config?: MemoriOpenAIConfig)
```

#### Configuration

```typescript
interface MemoriOpenAIConfig {
  // Core functionality
  enableChatMemory?: boolean;
  enableEmbeddingMemory?: boolean;
  memoryProcessingMode?: 'auto' | 'conscious' | 'none';

  // Initialization
  autoInitialize?: boolean;
  databaseUrl?: string;
  namespace?: string;

  // Memory filtering
  minImportanceLevel?: MemoryImportanceLevel;
  maxMemoryAge?: number;
  autoIngest?: boolean;
  consciousIngest?: boolean;

  // Performance tuning
  bufferTimeout?: number;
  maxBufferSize?: number;
  backgroundUpdateInterval?: number;

  // OpenAI client options
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
  timeout?: number;
  maxRetries?: number;

  // Advanced options
  debugMode?: boolean;
  enableMetrics?: boolean;
}
```

#### Core Methods

##### Chat Completions

```typescript
// Create chat completion
async chat.completions.create(
  params: ChatCompletionCreateParams,
  options?: RequestOptions
): Promise<ChatCompletion>

// Create streaming chat completion
async chat.completions.create(
  params: ChatCompletionCreateParams & { stream: true },
  options?: RequestOptions
): Promise<AsyncIterable<ChatCompletionChunk>>
```

##### Embeddings

```typescript
// Create embeddings
async embeddings.create(
  params: EmbeddingCreateParams,
  options?: RequestOptions
): Promise<CreateEmbeddingResponse>
```

##### Memory Operations

```typescript
// Search memories
async memory.searchMemories(
  query: string,
  options?: SearchOptions
): Promise<MemorySearchResult[]>

// Get memory statistics
async memory.getMemoryStats(): Promise<MemoryStats>

// Record chat completion
async memory.recordChatCompletion(
  params: ChatCompletionCreateParams,
  response: ChatCompletion | AsyncIterable<ChatCompletionChunk>
): Promise<MemoryRecordingResult>
```

### Factory Functions

#### MemoriOpenAIFactory

```typescript
class MemoriOpenAIFactory {
  // Create with explicit Memori instance
  async createWithMemori(
    memori: Memori,
    apiKey: string,
    options?: MemoriOpenAIConfig
  ): Promise<MemoriOpenAI>

  // Create from configuration
  async fromConfig(
    apiKey: string,
    config: MemoriOpenAIConfig
  ): Promise<MemoriOpenAI>

  // Create from environment
  async fromEnv(
    apiKey?: string,
    config?: Partial<MemoriOpenAIConfig>
  ): Promise<MemoriOpenAI>

  // Create with database URL
  async fromDatabaseUrl(
    apiKey: string,
    databaseUrl: string,
    options?: Partial<MemoriOpenAIConfig>
  ): Promise<MemoriOpenAI>
}
```

#### Convenience Functions

```typescript
// Create with explicit Memori instance
createMemoriOpenAI(
  memori: Memori,
  apiKey: string,
  options?: MemoriOpenAIConfig
): Promise<MemoriOpenAI>

// Create from configuration
MemoriOpenAIFromConfig(
  apiKey: string,
  config: MemoriOpenAIConfig
): Promise<MemoriOpenAI>

// Create from environment
MemoriOpenAIFromEnv(
  apiKey?: string,
  config?: Partial<MemoriOpenAIConfig>
): Promise<MemoriOpenAI>

// Create with database URL
MemoriOpenAIFromDatabase(
  apiKey: string,
  databaseUrl: string,
  options?: Partial<MemoriOpenAIConfig>
): Promise<MemoriOpenAI>
```

### Memory Manager

#### Core Interface

```typescript
interface MemoryManager {
  // Search operations
  searchMemories(
    query: string,
    options?: SearchOptions
  ): Promise<MemorySearchResult[]>

  // Statistics
  getMemoryStats(): Promise<MemoryStats>
  getPerformanceMetrics(): Promise<PerformanceMetrics>
  getSystemHealth(): Promise<SystemHealth>

  // Recording operations
  recordChatCompletion(
    params: ChatCompletionCreateParams,
    response: ChatCompletion | AsyncIterable<ChatCompletionChunk>
  ): Promise<MemoryRecordingResult>

  recordEmbedding(
    params: EmbeddingCreateParams,
    response: CreateEmbeddingResponse
  ): Promise<MemoryRecordingResult>

  // Memory management
  clearAllMemories(namespace?: string): Promise<void>
  clearMemoriesByAge(days: number): Promise<void>
  clearMemoriesByImportance(level: MemoryImportanceLevel): Promise<void>

  // Advanced operations
  updateMemoryImportance(id: string, importance: MemoryImportanceLevel): Promise<void>
  addMemoryMetadata(id: string, metadata: Record<string, any>): Promise<void>
  getMemoryById(id: string): Promise<MemoryRecord | null>
}
```

#### Search Options

```typescript
interface SearchOptions {
  limit?: number;                    // Maximum number of results
  minImportance?: MemoryImportanceLevel;  // Minimum importance level
  categories?: MemoryClassification[];    // Filter by categories
  namespace?: string;                 // Search specific namespace
  includeMetadata?: boolean;          // Include metadata in results
  sortBy?: 'relevance' | 'importance' | 'date';  // Sort order
  sortDirection?: 'asc' | 'desc';     // Sort direction
}
```

---

## Type Definitions

### Core Types

#### Memory Types

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

interface MemoryRecord {
  id: string;
  content: string;
  classification: MemoryClassification;
  importance: MemoryImportanceLevel;
  timestamp: Date;
  namespace: string;
  metadata?: Record<string, any>;
  userInput: string;
  assistantResponse: string;
  model?: string;
  tokensUsed?: number;
}

interface MemorySearchResult {
  memory: MemoryRecord;
  relevanceScore: number;
  matchReason: string;
}

interface MemoryStats {
  totalMemories: number;
  memoriesByClassification: Record<MemoryClassification, number>;
  memoriesByImportance: Record<MemoryImportanceLevel, number>;
  oldestMemory: Date | null;
  newestMemory: Date | null;
  totalTokensUsed: number;
  averageMemoryLength: number;
}
```

#### Database Types

```typescript
interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql' | 'mongodb';
  url: string;
  namespace?: string;
  connectionOptions?: Record<string, any>;
}

interface DatabaseConnection {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
  executeQuery(query: string, params?: any[]): Promise<any[]>;
}
```

### Configuration Types

#### Core Configuration

```typescript
interface MemoriConfig {
  // Database
  databaseUrl?: string;
  databaseType?: DatabaseType;
  namespace?: string;

  // Processing
  processingMode?: ProcessingMode;
  autoIngest?: boolean;
  consciousIngest?: boolean;

  // Memory filtering
  minImportanceLevel?: MemoryImportanceLevel;
  maxMemoryAge?: number;
  memoryRetentionPolicy?: RetentionPolicy;

  // Performance
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  enableMetrics?: boolean;
  debugMode?: boolean;

  // OpenAI integration
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
}

type ProcessingMode = 'auto' | 'conscious' | 'none';
type DatabaseType = 'sqlite' | 'postgresql' | 'mysql' | 'mongodb';
```

#### OpenAI Configuration

```typescript
interface MemoriOpenAIConfig {
  // Core functionality
  enableChatMemory?: boolean;
  enableEmbeddingMemory?: boolean;
  memoryProcessingMode?: ProcessingMode;

  // Initialization
  autoInitialize?: boolean;
  databaseUrl?: string;
  databaseType?: DatabaseType;
  namespace?: string;

  // Memory settings
  minImportanceLevel?: MemoryImportanceLevel;
  maxMemoryAge?: number;
  autoIngest?: boolean;
  consciousIngest?: boolean;

  // Performance
  bufferTimeout?: number;
  maxBufferSize?: number;
  backgroundUpdateInterval?: number;

  // OpenAI options
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
  timeout?: number;
  maxRetries?: number;

  // Advanced
  debugMode?: boolean;
  enableMetrics?: boolean;
  customHeaders?: Record<string, string>;
}
```

---

## Advanced Features

### Streaming Support

#### Streaming Buffer Configuration

```typescript
interface StreamingBufferConfig {
  bufferTimeout: number;      // Timeout in milliseconds
  maxBufferSize: number;      // Maximum buffer size in characters
  chunkTimeout: number;       // Timeout between chunks
}

class StreamingBuffer {
  constructor(config: StreamingBufferConfig);

  // Buffer streaming response
  async bufferStream(
    stream: AsyncIterable<ChatCompletionChunk>
  ): Promise<BufferedStream>

  // Process buffered content
  async processBufferedContent(
    content: string,
    metadata: StreamingMetadata
  ): Promise<void>
}
```

#### Streaming Memory Recording

```typescript
// Automatic streaming memory recording
const stream = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Tell me a long story' }],
  stream: true
});

// Memory is automatically recorded when streaming completes
let fullContent = '';
for await (const chunk of stream) {
  fullContent += chunk.choices[0]?.delta?.content || '';
  // Process chunk as needed
}

// Memory recording happens automatically
```

### Performance Monitoring

#### Performance Metrics

```typescript
interface PerformanceMetrics {
  // Request metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;

  // Memory metrics
  totalMemories: number;
  memoryOperationsPerSecond: number;
  averageMemoryProcessingTime: number;
  cacheHitRate: number;

  // Database metrics
  databaseConnections: number;
  activeConnections: number;
  queryExecutionTime: number;

  // System metrics
  uptime: number;
  memoryUsage: number;
  cpuUsage: number;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: 'connected' | 'disconnected' | 'error';
  memoryProcessing: 'active' | 'idle' | 'error';
  lastHealthCheck: Date;
  issues: string[];
}
```

#### Monitoring Methods

```typescript
// Get performance metrics
const metrics = await client.memory.getPerformanceMetrics();
console.log('Average response time:', metrics.averageResponseTime);

// Get system health
const health = await client.memory.getSystemHealth();
console.log('System status:', health.status);

// Enable detailed metrics
const client = new MemoriOpenAI('api-key', {
  enableMetrics: true,
  debugMode: process.env.NODE_ENV === 'development'
});
```

### Error Handling

#### Error Types

```typescript
enum MemoryErrorType {
  DATABASE_ERROR = 'database_error',
  PROCESSING_ERROR = 'processing_error',
  VALIDATION_ERROR = 'validation_error',
  NETWORK_ERROR = 'network_error',
  TIMEOUT_ERROR = 'timeout_error',
  QUOTA_ERROR = 'quota_error',
  PERMISSION_ERROR = 'permission_error'
}

interface MemoryError extends Error {
  type: MemoryErrorType;
  code: string;
  details?: Record<string, any>;
  timestamp: Date;
  recoverable: boolean;
}

interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  exponentialBackoff: boolean;
  retryableErrors: MemoryErrorType[];
}
```

#### Error Recovery Strategies

```typescript
enum RecoveryStrategy {
  RETRY = 'retry',
  FAILOVER = 'failover',
  GRACEFUL_DEGRADATION = 'graceful_degradation',
  IMMEDIATE_FAILURE = 'immediate_failure'
}

class ErrorRecoveryManager {
  // Configure recovery
  configureRecovery(config: ErrorRecoveryConfig): void

  // Handle error with recovery
  async handleError(
    error: MemoryError,
    context: ErrorContext
  ): Promise<RecoveryResult>

  // Get recovery statistics
  getRecoveryStats(): RecoveryStats
}
```

#### Custom Error Handling

```typescript
// Implement custom error handling
class CustomErrorHandler {
  async handleMemoryError(error: MemoryError): Promise<void> {
    switch (error.type) {
      case MemoryErrorType.DATABASE_ERROR:
        await this.handleDatabaseError(error);
        break;
      case MemoryErrorType.NETWORK_ERROR:
        await this.handleNetworkError(error);
        break;
      case MemoryErrorType.QUOTA_ERROR:
        await this.handleQuotaError(error);
        break;
      default:
        await this.handleGenericError(error);
    }
  }

  private async handleDatabaseError(error: MemoryError): Promise<void> {
    // Implement database-specific error handling
    console.error('Database error:', error.message);
    // Retry logic, failover, etc.
  }

  private async handleNetworkError(error: MemoryError): Promise<void> {
    // Implement network-specific error handling
    console.error('Network error:', error.message);
    // Retry with exponential backoff
  }

  private async handleQuotaError(error: MemoryError): Promise<void> {
    // Implement quota-specific error handling
    console.error('Quota exceeded:', error.message);
    // Graceful degradation or user notification
  }

  private async handleGenericError(error: MemoryError): Promise<void> {
    // Generic error handling
    console.error('Memory error:', error.message);
    // Log to monitoring system
  }
}
```

---

## Usage Examples

### Basic Usage

```typescript
import { Memori, MemoriOpenAI } from 'memorits';

// Initialize core memory system
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  processingMode: 'auto',
  autoIngest: true
});

await memori.enable();

// Create OpenAI client with memory
const openai = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  autoInitialize: true
});

// Use normally - conversations are automatically recorded
const response = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }]
});

// Search memories
const memories = await openai.memory.searchMemories('Remember this');
console.log('Found memories:', memories.length);
```

### Advanced Usage

```typescript
import { MemoriOpenAI, MemoryClassification, MemoryImportanceLevel } from 'memorits';

// Advanced configuration
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  enableEmbeddingMemory: true,
  memoryProcessingMode: 'conscious',
  databaseUrl: 'postgresql://localhost/memories',
  namespace: 'advanced-usage',
  minImportanceLevel: MemoryImportanceLevel.HIGH,
  autoIngest: true,
  consciousIngest: true,
  bufferTimeout: 30000,
  maxBufferSize: 50000,
  debugMode: true,
  enableMetrics: true
});

// Record conversation with metadata
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Help me with my project planning.' }
  ]
});

// Search with advanced filtering
const importantMemories = await client.memory.searchMemories('project planning', {
  limit: 10,
  minImportance: MemoryImportanceLevel.HIGH,
  categories: [MemoryClassification.ESSENTIAL, MemoryClassification.CONTEXTUAL],
  includeMetadata: true,
  sortBy: 'relevance',
  sortDirection: 'desc'
});

// Get performance metrics
const metrics = await client.memory.getPerformanceMetrics();
console.log('Performance metrics:', metrics);

// Get system health
const health = await client.memory.getSystemHealth();
console.log('System health:', health.status);
```

### Error Handling Example

```typescript
import { MemoriOpenAI, MemoryError, MemoryErrorType } from 'memorits';

const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  autoInitialize: true
});

try {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello world!' }]
  });

  console.log('Success:', response.choices[0]?.message?.content);
} catch (error) {
  if (error instanceof Error) {
    // Handle OpenAI API errors
    if (error.message.includes('rate limit')) {
      console.log('Rate limited - implement retry logic');
      // Implement exponential backoff
    } else if (error.message.includes('invalid model')) {
      console.log('Invalid model - check model name');
    } else if (error.message.includes('quota')) {
      console.log('Quota exceeded - implement graceful degradation');
    } else {
      console.log('OpenAI error:', error.message);
    }
  } else {
    // Handle memory-specific errors
    const memoryError = error as MemoryError;
    console.log('Memory error:', memoryError.message);

    if (memoryError.type === MemoryErrorType.DATABASE_ERROR) {
      console.log('Database error - check connection');
    } else if (memoryError.type === MemoryErrorType.PROCESSING_ERROR) {
      console.log('Processing error - memory recording failed');
    }
  }
}
```

---

## Best Practices

### 1. Configuration

```typescript
// Use environment variables for configuration
const config = {
  apiKey: process.env.OPENAI_API_KEY,
  databaseUrl: process.env.MEMORI_DATABASE_URL,
  namespace: process.env.MEMORI_NAMESPACE || 'default',
  processingMode: (process.env.MEMORI_PROCESSING_MODE as ProcessingMode) || 'auto',
  enableChatMemory: true,
  autoInitialize: true
};

// Validate configuration
const client = new MemoriOpenAI(config.apiKey!, config);
```

### 2. Error Handling

```typescript
// Implement comprehensive error handling
class RobustMemoriClient {
  private client: MemoriOpenAI;

  constructor(apiKey: string, config: MemoriOpenAIConfig) {
    this.client = new MemoriOpenAI(apiKey, {
      ...config,
      enableMetrics: true
    });
  }

  async safeChatCompletion(params: ChatCompletionCreateParams) {
    try {
      return await this.client.chat.completions.create(params);
    } catch (error) {
      await this.handleError(error);
      throw error; // Re-throw after handling
    }
  }

  private async handleError(error: unknown): Promise<void> {
    // Log to monitoring system
    console.error('Memori error:', error);

    // Implement recovery logic
    if (this.isRetryableError(error)) {
      await this.implementRetryLogic(error);
    }
  }
}
```

### 3. Performance Optimization

```typescript
// Optimize for your use case
const client = new MemoriOpenAI('api-key', {
  // For high-throughput applications
  bufferTimeout: 5000,
  maxBufferSize: 10000,
  memoryProcessingMode: 'auto',
  minImportanceLevel: 'medium',

  // For memory quality
  memoryProcessingMode: 'conscious',
  minImportanceLevel: 'high',
  maxMemoryAge: 30,

  // For development
  debugMode: true,
  enableMetrics: true
});
```

### 4. Memory Management

```typescript
// Implement memory lifecycle management
class MemoryManager {
  private client: MemoriOpenAI;

  constructor(client: MemoriOpenAI) {
    this.client = client;
  }

  // Regular cleanup
  async cleanupOldMemories(): Promise<void> {
    await this.client.memory.clearMemoriesByAge(30); // Keep only 30 days
  }

  // Optimize memory importance
  async optimizeMemoryImportance(): Promise<void> {
    const memories = await this.client.memory.searchMemories('', {
      limit: 1000,
      includeMetadata: true
    });

    for (const memory of memories) {
      const newImportance = this.calculateImportance(memory);
      if (newImportance !== memory.memory.importance) {
        await this.client.memory.updateMemoryImportance(
          memory.memory.id,
          newImportance
        );
      }
    }
  }

  private calculateImportance(memory: MemorySearchResult): MemoryImportanceLevel {
    // Implement your importance calculation logic
    return MemoryImportanceLevel.MEDIUM;
  }
}
```

---

## Migration Guide

For complete migration instructions, see [Migration Guide](MIGRATION.md).

