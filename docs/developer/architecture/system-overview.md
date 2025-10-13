# System Overview: Memorits Architecture

This document provides a comprehensive overview of the Memorits system architecture, explaining how the TypeScript memory engine transforms AI conversations into persistent, searchable knowledge bases.

## 🎯 System Purpose

Memorits addresses the fundamental limitation of stateless AI conversations by providing **persistent memory capabilities** that transform ephemeral interactions into accumulated knowledge. The system automatically captures, classifies, and retrieves conversational context with enterprise-grade reliability and lightning-fast search capabilities.

## 🏗️ High-Level Architecture

### Core System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Memorits System                          │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  Multi-     │  │  Memory     │  │  Search     │  │  Index  │ │
│  │  Provider   │  │  Processing │  │  Engine     │  │  Mgmt   │ │
│  │  Client     │  │  Engine     │  │             │  │         │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────┐ │
│  │  Database   │  │  Memory     │  │  Advanced   │  │  Agent  │ │
│  │  Manager    │  │  Agent      │  │  Filtering  │  │  System │ │
│  │             │  │             │  │             │  │         │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────┘ │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │   SQLite    │  │  FTS5       │  │  Memory     │              │
│  │  Database   │  │  Search     │  │  States     │              │
│  │             │  │  Index      │  │  Tracking   │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

## 🔧 Core Components

### 1. Multi-Provider Client (`MemoriOpenAI` & Provider Factory)

**Universal LLM integration supporting OpenAI, Anthropic, Ollama, and custom providers with automatic memory recording.**

```typescript
// Zero breaking changes - existing OpenAI code works unchanged
const openaiClient = new MemoriOpenAI('openai-api-key', {
  enableChatMemory: true,
  autoInitialize: true
});

// Multiple provider support with unified interface
import { LLMProviderFactory, ProviderType } from '@memori/providers';

const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: 'anthropic-api-key',
  model: 'claude-3-5-sonnet-20241022'
});

// Every conversation is automatically recorded across all providers
const openaiResponse = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }]
});

// Search through conversation history across all providers
const memories = await openaiClient.memory.searchMemories('later');
```

**Key Features:**
- **100% API Compatibility**: Exact OpenAI SDK v5.x interface maintained
- **Multi-Provider Support**: OpenAI, Anthropic, Ollama, and custom providers
- **Transparent Recording**: Automatic conversation capture across all providers
- **Provider Factory Pattern**: Unified LLMProviderFactory for provider management
- **Streaming Support**: Complete memory capture for streaming responses
- **Multiple Initialization Patterns**: Constructor, environment, database URL, advanced config

### 2. Memory Processing Engine

**Sophisticated conversation analysis and memory classification.**

```typescript
class MemoryAgent {
  async processConversation(
    userInput: string,
    aiOutput: string,
    context: ProcessingContext
  ): Promise<ProcessedMemory> {
    // 1. Content analysis and summarization
    const summary = await this.summarizeContent(userInput, aiOutput);

    // 2. Importance scoring
    const importance = await this.calculateImportance(userInput, aiOutput);

    // 3. Category classification
    const category = await this.classifyCategory(userInput, aiOutput);

    // 4. Entity and keyword extraction
    const entities = await this.extractEntities(userInput, aiOutput);
    const keywords = await this.extractKeywords(userInput, aiOutput);

    return {
      summary,
      importance,
      category,
      entities,
      keywords,
      confidence: 0.9,
      processingTime: Date.now() - startTime
    };
  }
}
```

**Processing Modes:**
- **Auto-Ingestion**: Automatic processing of all conversations
- **Conscious Processing**: Background processing with human-like reflection
- **Hybrid Mode**: Combination of both approaches

### 3. Advanced Search Engine

**Multi-strategy search with sophisticated filtering and ranking.**

```typescript
class SearchService {
  private strategies: Map<SearchStrategy, ISearchStrategy> = new Map();

  async searchMemories(query: SearchQuery): Promise<SearchResult[]> {
    // 1. Query analysis and strategy selection
    const analysis = this.analyzeQuery(query);
    const strategies = this.selectOptimalStrategies(analysis);

    // 2. Parallel strategy execution with error handling
    const results = await this.executeStrategies(strategies, query);

    // 3. Result merging, deduplication, and ranking
    return this.mergeAndRankResults(results, query);
  }
}
```

**Search Strategies:**
- **FTS5**: Full-text search with BM25 ranking (SQLite)
- **LIKE**: Pattern-based fallback search
- **Recent**: Time-based recent memory retrieval
- **Category Filter**: Classification-based filtering
- **Temporal Filter**: Time-based filtering with natural language
- **Metadata Filter**: Advanced metadata-based queries
- **Relationship Search**: Memory relationship graph traversal

**Advanced Features:**
- **Circuit Breaker Protection**: Failed strategies don't break the system
- **Strategy Configuration Management**: Runtime configuration and tuning
- **Performance Monitoring**: Comprehensive search metrics and analytics
- **Error Recovery**: Automatic fallback and recovery mechanisms

### 4. Manager Pattern (Database Layer)

**Sophisticated manager-based architecture for database operations.**

```typescript
// DatabaseManager - Main facade coordinating all database operations
class DatabaseManager {
  private memoryManager: MemoryManager;
  private searchManager: SearchManager;
  private relationshipManager: RelationshipManager;
  private stateManager: StateManager;

  async storeLongTermMemory(memory: ProcessedLongTermMemory, chatId: string, namespace: string): Promise<string> {
    return this.memoryManager.storeLongTermMemory(memory, chatId, namespace);
  }

  async searchMemories(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
    return this.searchManager.searchMemories(query, options);
  }
}

// MemoryManager - Specialized memory operations with state tracking
class MemoryManager {
  async storeLongTermMemory(memoryData: ProcessedLongTermMemory, chatId: string, namespace: string): Promise<string> {
    // Comprehensive validation and sanitization
    const sanitizedData = await this.validateAndSanitizeMemoryInput(memoryData, chatId, namespace);

    // Store with state tracking integration
    const result = await this.databaseContext.getPrismaClient().longTermMemory.create({...});

    // Initialize state tracking for workflow management
    await this.stateManager.initializeExistingMemoryState(result.id, MemoryProcessingState.PROCESSED);

    return result.id;
  }
}
```

**Manager Architecture Benefits:**
- **Separation of Concerns**: Each manager handles specific domain responsibilities
- **State Tracking Integration**: Built-in workflow state management across all operations
- **Performance Monitoring**: Comprehensive metrics and analytics
- **Error Recovery**: Sophisticated error handling with circuit breakers
- **Namespace Isolation**: Multi-tenant support with logical separation

### 5. Memory State Management

**Comprehensive workflow state tracking for memory processing.**

```typescript
class MemoryProcessingStateManager {
  async trackStateTransition(
    memoryId: string,
    fromState: ProcessingState,
    toState: ProcessingState,
    metadata: StateTransitionMetadata
  ): Promise<void> {
    // Validate state transition
    this.validateTransition(fromState, toState);

    // Record transition with full audit trail
    await this.recordTransition({
      memoryId,
      fromState,
      toState,
      timestamp: new Date(),
      metadata,
      performedBy: metadata.agent || 'system'
    });

    // Update current state
    await this.updateCurrentState(memoryId, toState);
  }
}
```

## 🔄 Data Flow Architecture

### Conversation Processing Flow

```
1. User Input → 2. LLM Provider → 3. Memory Recording → 4. Processing → 5. Storage
     ↓               ↓                    ↓              ↓            ↓
  - Context      - Response         - Conversation   - LLM         - SQLite
  - Session       - Streaming         - Metadata       - Analysis    - FTS5
  - Metadata      - Complete          - Classification - Importance  - Indexes
                  - Response
```

### Memory Retrieval Flow

```
1. Search Query → 2. Strategy Selection → 3. Parallel Execution → 4. Result Processing
       ↓                 ↓                       ↓                    ↓
    - Text Analysis   - Query Intent        - FTS5, LIKE,         - Deduplication
    - Intent          - Optimal Strategies   - Category,           - Composite Scoring
    - Extraction                             - Temporal Filters    - Ranking
```

### Background Processing Flow

```
Conscious Processing Agent
       ↓
1. Memory Discovery → 2. Duplicate Detection → 3. Consolidation → 4. Relationship Extraction
         ↓                    ↓                       ↓                    ↓
      - Eligible         - Similarity           - Data Merge        - Graph Analysis
      - Memories          - Analysis             - State Update      - Link Creation
      - Prioritization    - Confidence Scoring   - Audit Trail       - Metadata Storage
```

## 🎨 Key Architectural Patterns

### 1. Strategy Pattern (Search)

**Pluggable search strategies with unified interface.**

```typescript
interface ISearchStrategy {
  readonly name: SearchStrategy;
  readonly priority: number;
  readonly capabilities: SearchCapability[];

  search(query: SearchQuery): Promise<SearchResult[]>;
  getMetadata(): SearchStrategyMetadata;
}
```

**Benefits:**
- **Extensibility**: Easy to add new search strategies
- **Testability**: Each strategy can be tested independently
- **Performance**: Strategies can be optimized individually
- **Reliability**: Failed strategies don't break the system

### 2. Manager Pattern (Database)

**Specialized managers for different operational domains.**

```typescript
// MemoryManager - Dedicated memory operations with state tracking
class MemoryManager {
  async storeLongTermMemory(memory: ProcessedLongTermMemory, chatId: string, namespace: string): Promise<string>;
  async getMemoryById(id: string, namespace?: string): Promise<ProcessedLongTermMemory | null>;
  async updateMemory(id: string, updates: Partial<ProcessedLongTermMemory>, namespace?: string): Promise<boolean>;
  async getMemoriesByImportance(minImportance: MemoryImportanceLevel, namespace?: string): Promise<ProcessedLongTermMemory[]>;
}

// SearchManager - Dedicated search operations
class SearchManager {
  async searchMemories(query: string, options: SearchOptions): Promise<MemorySearchResult[]>;
  async searchWithStrategy(query: string, strategy: SearchStrategy): Promise<MemorySearchResult[]>;
}

// RelationshipManager - Memory relationship operations
class RelationshipManager {
  async storeMemoryRelationships(memoryId: string, relationships: MemoryRelationship[]): Promise<void>;
  async getRelatedMemories(memoryId: string, options: RelationshipQueryOptions): Promise<RelatedMemory[]>;
}
```

**Benefits:**
- **Domain Expertise**: Each manager encapsulates specific business logic
- **State Integration**: Built-in workflow state tracking across operations
- **Performance Monitoring**: Comprehensive metrics and error handling
- **Separation of Concerns**: Clear boundaries between different operational domains
- **Testing**: Easy mocking and unit testing of specific functionality

### 3. Observer Pattern (Memory Processing)

**Event-driven memory processing with loose coupling.**

```typescript
interface MemoryProcessingObserver {
  onMemoryCreated(memory: Memory): Promise<void>;
  onMemoryUpdated(memory: Memory): Promise<void>;
  onMemoryDeleted(memoryId: string): Promise<void>;
}
```

**Benefits:**
- **Decoupling**: Processing agents can be added/removed independently
- **Scalability**: Multiple processing agents can work in parallel
- **Reliability**: Failed observers don't affect others
- **Monitoring**: Easy to track processing pipeline health

## 📊 System Capabilities

### Memory Management
- **Dual Processing Modes**: Auto-ingestion and conscious processing
- **Intelligent Classification**: Automatic categorization and importance scoring
- **Duplicate Detection**: Advanced consolidation with transaction safety
- **Relationship Extraction**: Memory graph construction and traversal
- **State Tracking**: Complete workflow state management

### Search & Retrieval
- **Multi-Strategy Search**: Orchestrated search across multiple dimensions
- **Advanced Filtering**: 25+ filter operators with boolean logic
- **Natural Language Processing**: Temporal and intent understanding
- **Relationship-Based Search**: Graph traversal for connected memories
- **Performance Optimization**: Sub-millisecond search with intelligent caching

### Data Integrity
- **Transaction Safety**: All operations are ACID compliant
- **Audit Trails**: Complete history of all changes and processing
- **Backup & Recovery**: Automated index backup with corruption recovery
- **Health Monitoring**: Continuous monitoring of system health

## 🔒 Enterprise Features

### Type Safety
- **100% TypeScript Coverage**: Compile-time validation prevents runtime errors
- **Clean Interfaces**: 15+ well-defined interfaces replace inline types
- **Runtime Validation**: Zod schemas for additional safety
- **IDE Support**: Rich autocomplete and IntelliSense

### Performance
- **Optimized SQLite Backend**: Fast local development and testing
- **Efficient Indexing**: Strategic indexes for query performance
- **Memory Management**: Optimized memory usage for large conversation histories
- **Background Processing**: Non-blocking memory ingestion

### Reliability
- **Graceful Error Handling**: Memory failures don't break AI functionality
- **Automatic Recovery**: Intelligent retry and fallback mechanisms
- **Comprehensive Logging**: Detailed error tracking and debugging
- **Health Monitoring**: Proactive system health monitoring

## 🚀 Usage Patterns

### Simple Integration
```typescript
// Replace OpenAI client with zero changes
const openaiClient = new MemoriOpenAI('openai-api-key', { enableChatMemory: true });
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello world!' }]
});

// Multi-provider support
import { LLMProviderFactory, ProviderType } from '@memori/providers';
const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: 'anthropic-api-key',
  model: 'claude-3-5-sonnet-20241022'
});
```

### Advanced Configuration
```typescript
// Sophisticated memory-enabled application
const memori = new Memori({
  databaseUrl: 'postgresql://localhost/memories',
  processingMode: 'conscious',
  namespace: 'production-app'
});

const memories = await memori.searchMemories('urgent project requirements', {
  minImportance: 'high',
  categories: ['essential', 'contextual'],
  includeRelatedMemories: true
});
```

## 📈 Scalability Considerations

### Database Scaling
- **Read Replicas**: Support for read-heavy workloads
- **Partitioning**: Namespace-based logical partitioning
- **Connection Pooling**: Efficient database connection management
- **Query Optimization**: Intelligent query planning and execution

### Memory Scaling
- **Streaming Processing**: Handle large conversation volumes
- **Batch Operations**: Efficient bulk memory operations
- **Caching Strategy**: Intelligent result caching
- **Resource Limits**: Configurable memory and processing limits

### Search Scaling
- **Index Optimization**: Automated index maintenance
- **Query Parallelization**: Concurrent search execution
- **Result Caching**: Intelligent caching of frequent queries
- **Load Distribution**: Strategy-based load balancing

This architecture provides a robust, scalable foundation for building sophisticated AI agents with persistent memory capabilities while maintaining the simplicity and reliability required for production applications.

## Related Documentation

- **[Multi-Provider Integration Guide](../integration/openai-integration.md)** - Integration patterns for different LLM providers
- **[Provider Documentation](../providers/)** - Complete guides for OpenAI, Anthropic, Ollama, and custom providers
- **[Database Schema Deep Dive](database-schema.md)** - Detailed database design and optimization strategies
- **[Search Architecture](search-architecture.md)** - Multi-strategy search implementation details