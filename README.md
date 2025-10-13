<img src="docs/memorits.jpg">

# 🎯 Memorits: Production-Ready Memory Engine for AI Applications

**Enterprise-grade conversational memory with advanced search, intelligent consolidation, and comprehensive monitoring.**

Memorits delivers enterprise-grade memory management for AI applications - featuring comprehensive observability, advanced memory processing capabilities, and architecture designed to scale from development to enterprise deployment.

<div align="center">
  <p>
    <strong>🚀 Ready to remember everything? Install now:</strong>
  </p>
  <code>npm install memorits</code>
</div>

---

## Table of Contents

- [Why Memorits?](#why-memorits)
- [Quick Start](#quick-start)
  - [Installation](#installation)
  - [Basic Usage](#basic-usage)
  - [OpenAI Drop-in Replacement](#openai-drop-in-replacement)
- [Core API](#core-api)
  - [Memory Management](#memory-management)
  - [Memory Consolidation](#memory-consolidation)
  - [Index Management](#index-management)
- [OpenAI Drop-in Replacement](#openai-drop-in-replacement-1)
  - [Quick Migration](#quick-migration)
  - [Initialization Patterns](#initialization-patterns)
  - [Advanced Usage](#advanced-usage)
  - [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
- [Architecture Overview](#architecture-overview)
- [Key Features](#key-features)
- [Enterprise Features](#enterprise-features)
- [Real-World Example](#real-world-example)
- [Architecture Deep Dive](#architecture-deep-dive)
- [Development](#development)
- [Dual Attribution](#dual-attribution)

---

## Why Memorits?

**In enterprise AI applications, conversational context is mission-critical.** Every interaction represents institutional knowledge, compliance requirements, and business value that must be captured, preserved, and made instantly accessible across your entire organization.

### 🚀 Enterprise-Grade Capabilities

- **🏢 Enterprise-Ready Architecture**: Robust memory management with enterprise-scale reliability and performance
- **📊 Comprehensive Observability**: Real-time monitoring, alerting, and analytics for complete operational visibility
- **🔒 Enterprise Security**: Type-safe operations with comprehensive audit trails and data governance
- **⚡ High-Performance Search**: Sub-millisecond query response across millions of memories with advanced indexing
- **🔄 Intelligent Memory Lifecycle**: Automated consolidation, deduplication, and archival with rollback capabilities
- **🛡️ Fault-Tolerant Operations**: Circuit breaker patterns, graceful degradation, and automatic recovery mechanisms
- **📈 Advanced Analytics**: Performance dashboards, trend analysis, and predictive monitoring
- **⚙️ Enterprise Configuration Management**: Dynamic configuration updates, version control, and policy enforcement

### 🎯 Enterprise Use Cases

- **Enterprise AI Assistants** requiring institutional memory and compliance tracking
- **Customer Experience Platforms** that learn from every interaction across channels
- **Knowledge Management Systems** that capture and organize organizational expertise
- **Compliance & Audit Systems** that maintain complete conversation histories
- **Research & Development Platforms** that build searchable knowledge bases from collaborations
- **Customer Support Automation** that learns from every case and provides consistent responses

---

## Quick Start

### Installation

```bash
npm install memorits
```

### Basic Usage

```typescript
import { Memori, ConfigManager } from 'memorits';

// Initialize with configuration
const config = ConfigManager.loadConfig();
const memori = new Memori(config);
await memori.enable();

// Record conversations
const chatId = await memori.recordConversation(
  'What is TypeScript?',
  'TypeScript is a superset of JavaScript that adds static typing.'
);

// Search memories
const memories = await memori.searchMemories('TypeScript', {
  limit: 10,
  minImportance: 'medium'
});

console.log(`Found ${memories.length} relevant memories`);
```

### OpenAI Drop-in Replacement

**Transform your existing OpenAI code with zero breaking changes:**

```typescript
import { MemoriOpenAI } from 'memorits';

// Replace your OpenAI client - conversations auto-recorded!
const client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  autoInitialize: true
});

// Use exactly like OpenAI SDK
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }]
});

// Search through conversation history
const memories = await client.memory.searchMemories('later');
```

**That's it!** Your AI now has perfect memory with zero configuration.

---

## Core API

### Memory Management

```typescript
import { Memori } from 'memorits';

const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  autoIngest: true,
  consciousIngest: false
});

await memori.enable();

// Record conversations
const chatId = await memori.recordConversation(
  userInput,
  aiOutput,
  { model: 'gpt-4o-mini' }
);

// Search with advanced options
const memories = await memori.searchMemories('query', {
  limit: 20,
  minImportance: 'high',
  categories: ['essential', 'contextual'],
  includeMetadata: true
});

// Advanced search strategies
const results = await memori.searchMemoriesWithStrategy(
  'query',
  'FTS5', // or 'LIKE', 'SEMANTIC', 'RELATIONSHIP'
  { limit: 10 }
);

// Enhanced temporal search with time windows
const recentMemories = await memori.searchRecentMemories(10, true, {
  relativeExpressions: ['last week', 'yesterday'],
  patterns: ['daily standup', 'weekly review']
});

// Complex temporal queries with multiple criteria
const projectUpdates = await memori.searchMemories('urgent project updates', {
  temporalFilters: {
    timeRanges: [{
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31')
    }]
  },
  categories: ['essential'],
  minImportance: 'high'
});
```

### Memory Consolidation

```typescript
// Find and consolidate duplicate memories
const duplicates = await memori.findDuplicateMemories(memories, {
  similarityThreshold: 0.8
});

for (const duplicateGroup of duplicates) {
  const result = await memori.consolidateDuplicateMemories(
    duplicateGroup.primaryId,
    duplicateGroup.duplicateIds
  );

  console.log(`Consolidated ${result.consolidated} memories`);
}
```

### Index Management

```typescript
// Get health report
const health = await memori.getIndexHealthReport();
console.log(`Index health: ${health.health}`);

// Optimize index
const optimization = await memori.optimizeIndex('merge');
console.log(`Saved ${optimization.spaceSaved} bytes`);

  // Create backup
  const backup = await memori.createIndexBackup();
  console.log(`Backup created: ${backup.id}`);
  ```

  ### Memory Statistics & Analytics

  ```typescript
  // Get comprehensive memory statistics
  const stats = await memori.getMemoryStatistics();
  console.log(`Total conversations: ${stats.totalConversations}`);
  console.log(`Total memories: ${stats.totalMemories}`);

  // Get detailed breakdown by type, importance, and category
  const detailedStats = await memori.getDetailedMemoryStatistics();
  console.log(`Long-term memories: ${detailedStats.byType.longTerm}`);
  console.log(`High importance: ${detailedStats.byImportance.high}`);
  console.log(`Recent activity (24h): ${detailedStats.recentActivity.last24Hours}`);
  ```

  ### Memory Relationships & Analysis

  ```typescript
  // Extract relationships from content
  const relationships = await memori.extractMemoryRelationships(
    'This is a follow-up to our previous discussion about the authentication system',
    { minConfidence: 0.7 }
  );

  for (const rel of relationships) {
    console.log(`${rel.type}: ${rel.targetMemoryId} (confidence: ${rel.confidence})`);
  }

  // Build comprehensive relationship graph for a namespace
  const graph = await memori.buildRelationshipGraph('my-app', {
    maxDepth: 3,
    includeWeakRelationships: false
  });

  console.log(`Found ${graph.nodes.length} connected memories`);
  console.log(`Found ${graph.edges.length} relationships`);
  console.log(`Identified ${graph.clusters.length} memory clusters`);
  ```

  ### Advanced Search Operations

  ```typescript
  // Get available search strategies
  const strategies = await memori.getAvailableSearchStrategies();
  console.log('Available strategies:', strategies);

  // Use specific search strategy with temporal filtering
  const semanticResults = await memori.searchMemoriesWithStrategy(
    'project architecture decisions',
    SearchStrategy.SEMANTIC,
    {
      limit: 10,
      temporalFilters: {
        relativeExpressions: ['last month', 'this week']
      }
    }
  );

  // Complex metadata filtering
  const filteredMemories = await memori.searchMemories('urgent issues', {
    limit: 20,
    categories: ['essential', 'contextual'],
    minImportance: 'high',
    includeMetadata: true,
    metadataFilters: {
      field: 'createdAt',
      operator: 'gte',
      value: new Date('2024-01-01')
    }
  });
  ```

  ### Backup & Recovery

  ```typescript
  // Restore from backup
  const success = await memori.restoreIndexFromBackup(backup.id);
  if (success) {
    console.log('Index restored successfully');
  }
  ```

---

## OpenAI Drop-in Replacement

**Transform your existing OpenAI code into a memory-enabled powerhouse with zero breaking changes.**

### Why Use the Drop-in Replacement?

- **Zero Code Changes**: Existing OpenAI code works unchanged
- **Automatic Memory**: Conversations are recorded transparently
- **Multiple Patterns**: From simple to advanced initialization
- **Full Compatibility**: Exact OpenAI SDK v5.x API match
- **Streaming Support**: Complete memory capture for streaming responses


### Initialization Patterns

#### Simple Constructor

```typescript
import { MemoriOpenAI } from 'memorits';

const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  autoInitialize: true,
  databaseConfig: {
    type: 'sqlite',
    url: 'sqlite:./memories.db'
  }
});
```

#### Factory Functions

```typescript
import { memoriOpenAIFactory } from 'memorits';

// From configuration
const client1 = await memoriOpenAIFactory.fromConfig('api-key', {
  enableChatMemory: true,
  memoryProcessingMode: 'auto'
});

// From environment
const client2 = await memoriOpenAIFactory.fromEnv('api-key');

// From database URL
const client3 = await memoriOpenAIFactory.fromDatabaseUrl(
  'api-key',
  'sqlite:./memories.db'
);
```

### Advanced Usage

#### Streaming with Memory

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Tell me a story...' }],
  stream: true
});

let fullContent = '';
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  fullContent += content;
  process.stdout.write(content);
}

// Memory automatically recorded when streaming completes
const memories = await client.memory.searchMemories('story');
```

#### Memory Operations

```typescript
// Search with filters
const memories = await client.memory.searchMemories('urgent', {
  limit: 10,
  minImportance: 'high',
  categories: ['essential']
});

// Get statistics
const stats = await client.memory.getMemoryStats();
console.log(`Total: ${stats.totalMemories}`);
```

### Configuration

```typescript
interface MemoriOpenAIConfig {
  // Core functionality
  enableChatMemory?: boolean;
  enableEmbeddingMemory?: boolean;
  memoryProcessingMode?: 'auto' | 'conscious' | 'none';

  // Initialization
  autoInitialize?: boolean;
  databaseConfig?: {
    type: 'sqlite' | 'postgresql';
    url: string;
    namespace?: string;
  };
  namespace?: string;

  // Memory settings
  autoIngest?: boolean;
  consciousIngest?: boolean;
  minImportanceLevel?: 'low' | 'medium' | 'high' | 'critical';

  // OpenAI options
  apiKey?: string;
  baseUrl?: string;
  organization?: string;
  project?: string;
  timeout?: number;
  maxRetries?: number;
}
```

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1

# Memory Configuration
MEMORI_DATABASE_URL=sqlite:./memories.db
MEMORI_NAMESPACE=default
MEMORI_PROCESSING_MODE=auto
MEMORI_AUTO_INGEST=true
```

---

---

## Architecture Overview

Memorits follows **Domain-Driven Design (DDD)** principles with a clear separation of concerns:

### 🏗️ **Architecture Overview**

```
src/
├── core/                           # 🏢 Core Business Logic
│   ├── domain/                     # 🎯 Business Logic Layer (DDD Bounded Contexts)
│   │   ├── conversation/           # Conversation Management Domain
│   │   ├── memory/                 # Memory Processing & State Management Domain
│   │   └── search/                 # Search Strategies & Filtering Domain
│   ├── infrastructure/             # 🔧 External Concerns Layer
│   │   ├── config/                 # Configuration & Logging Infrastructure
│   │   ├── database/               # Database Access & Repository Infrastructure
│   │   └── providers/              # External Service Provider Infrastructure
│   ├── types/                      # 📋 Shared Type Definitions
│   └── performance/                # ⚡ Performance Monitoring & Analytics
├── integrations/                   # 🔗 External Integrations
│   └── openai-dropin/              # OpenAI Drop-in Replacement
└── index.ts                        # 🚪 Main Entry Point
```

### 🏢 **Domain Layer** (`src/core/domain/`)
- **Memory Domain**: Memory processing, classification, consolidation, and state management
- **Search Domain**: Search strategies, filtering, relationship processing, and indexing
- **Conversation Domain**: Chat history and conversation management

### 🔧 **Infrastructure Layer** (`src/core/infrastructure/`)
- **Database Layer**: Prisma ORM, SQLite backend, repositories, and data access objects
- **Provider Layer**: Multi-provider LLM integration supporting OpenAI, Anthropic, Ollama, and extensible architecture
- **Configuration Layer**: Winston logging, configuration management, and utilities

### 🔗 **Integration Layer** (`src/integrations/`)
- External system integrations (OpenAI drop-in replacement, etc.)

### 🎯 **Domain-Driven Design Benefits**

**🏢 Clear Business Focus**
- **🎯 Domain-Centric Organization**: Business logic organized by bounded contexts (Memory, Search, Conversation)
- **🔒 Ubiquitous Language**: Consistent terminology between business logic and implementation
- **📋 Explicit Business Rules**: Domain models enforce business invariants and validation

**🔧 Technical Excellence**
- **⚡ Enhanced Testability**: Pure domain logic testable without infrastructure dependencies
- **🔄 Infrastructure Independence**: Business rules isolated from technical implementation details
- **🧪 Focused Testing**: Each bounded context can be tested in isolation with mocked dependencies

**🚀 Operational Advantages**
- **🔧 Easier Maintenance**: Changes in one domain don't cascade to unrelated areas
- **👥 Better Team Organization**: Teams can own specific domains without conflicts
- **📈 Scalable Architecture**: Each domain can evolve independently as business needs grow

---

## Key Features

### 🔍 Advanced Search & Filtering

- **Importance-based filtering**: Prioritize critical, high, medium, or low importance memories
- **Category filtering**: Filter by essential, contextual, conversational, reference, personal, or conscious-info
- **Temporal filtering**: Time-based search with natural language expressions ("yesterday", "last week", "2 hours ago")
- **Time range queries**: Specify exact date ranges or relative time windows for precise temporal filtering
- **Pattern matching**: Find recurring events and temporal patterns ("daily standup", "weekly review")
- **Metadata inclusion**: Get rich context with timestamps, sources, and relationships
- **Full-text search**: Lightning-fast search across all memory content
- **Filter Expressions**: Advanced boolean logic with field comparisons, ranges, and operators
- **Multi-Strategy Search**: Intelligent orchestration of FTS5, LIKE, semantic, and relationship search strategies
- **Relationship-based Search**: Find memories connected through relationship graphs with traversal capabilities

### 🛡️ Enterprise-Grade Type Safety

- **100% TypeScript coverage** with compile-time validation
- **15+ Clean Interfaces** replacing inline types for better maintainability
- **Self-documenting APIs** with clear method signatures
- **Zod validation** for runtime type checking
- **Prisma ORM** for type-safe database operations

### 🤖 Multi-Provider LLM Integration

- **Universal drop-in replacement** supporting OpenAI, Anthropic, Ollama, and custom providers
- **Automatic memory recording** - no manual intervention needed
- **Structured memory processing** with intelligent classification
- **Dual memory modes**: conscious processing vs. automated ingestion
- **Provider abstraction** - switch between LLM providers with minimal configuration changes

### ⚡ Performance Optimized

- **SQLite backend** for fast local development and testing
- **Optimized queries** with proper indexing and relationships
- **Memory-efficient processing** for large conversation histories
- **Background processing** for non-blocking memory ingestion

### 🔗 Memory Relationships & Consolidation

- **Relationship Extraction**: Automatically identify continuation, reference, related, superseding, and contradictory relationships between memories
- **Relationship Confidence Scoring**: Calculate relationship strength and confidence using semantic similarity, temporal proximity, and entity overlap
- **Intelligent Consolidation**: Detect and merge duplicate memories with transaction-safe operations
- **Data Merging**: Intelligently combine entities, keywords, and metadata from duplicate memories
- **Consolidation Tracking**: Maintain detailed history of consolidation operations with rollback capabilities
- **Memory Processing States**: Comprehensive state tracking for memory processing workflows with validation and history

### 📊 Search Index Management

- **Automated Health Monitoring**: Continuous monitoring of search index health with corruption detection
- **Index Optimization**: Automated optimization with merge, compact, rebuild, and vacuum operations
- **Performance Analytics**: Detailed performance metrics including query time, throughput, and memory usage
- **Backup & Recovery**: Automated index backups with integrity verification and corruption recovery
- **Maintenance Scheduling**: Configurable automated maintenance with health checks, optimization, and backup schedules

---

## Enterprise Features

### 🏢 Production-Ready Architecture

**Built for Enterprise Scale and Reliability**

- **High Availability**: Fault-tolerant design with automatic failover and recovery mechanisms
- **Horizontal Scalability**: Database-level scaling with read replicas and connection pooling
- **Resource Optimization**: Memory-efficient processing with configurable buffer management
- **Background Processing**: Non-blocking operations with intelligent queue management

### 📊 Enterprise Observability

**Comprehensive Monitoring and Alerting**

- **Real-time Dashboards**: Live performance metrics and system health visualization
- **Custom Alerting**: Configurable thresholds with multiple notification channels
- **Performance Analytics**: Historical trend analysis with predictive insights
- **Audit Trails**: Complete operation history with compliance reporting
- **System Health Checks**: Automated diagnostics with actionable recommendations

### 🔒 Enterprise Security & Compliance

**Production-Grade Security and Governance**

- **Data Sanitization**: Comprehensive input validation and XSS/SQL injection prevention
- **Access Control**: Namespace-based isolation with granular permission management
- **Encryption Ready**: Secure data handling with encryption hooks for sensitive environments
- **Compliance Logging**: Detailed audit trails for regulatory compliance (GDPR, HIPAA, SOX)
- **Data Retention**: Configurable retention policies with automated archival

### ⚙️ Enterprise Configuration Management

**Advanced Configuration for Production Environments**

- **Environment-Based Config**: Separate configurations for dev/staging/production
- **Configuration Templates**: Reusable configuration patterns for different deployment scenarios
- **Runtime Configuration**: Hot-swapping of settings without service restart
- **Configuration Validation**: Schema-based validation with detailed error reporting
- **Backup & Recovery**: Automated configuration backups with rollback capabilities

### 🛡️ Enterprise Error Handling

**Robust Error Management for Critical Applications**

- **Circuit Breaker Pattern**: Automatic failure detection and graceful degradation
- **Strategy-Specific Recovery**: Individual error handling per search strategy
- **Error Classification**: Intelligent categorization of errors by severity and type
- **Recovery Automation**: Self-healing capabilities with configurable retry policies
- **Error Context**: Enhanced debugging information for rapid issue resolution

### 📈 Performance & Monitoring

**Enterprise-Grade Performance Optimization**

- **Performance Baselines**: Automated performance benchmarking and regression detection
- **Load Testing Support**: Built-in load testing utilities for capacity planning
- **Memory Profiling**: Detailed memory usage analysis and leak detection
- **Query Optimization**: Automatic query plan analysis and optimization suggestions
- **Caching Strategies**: Multi-level caching with intelligent cache invalidation

---

## Real-World Example

Imagine building an AI coding assistant that remembers your entire codebase context:

```typescript
// Your AI assistant now remembers every discussion about your codebase
const architectureDecisions = await memori.searchMemories('database schema decisions', {
  categories: ['essential'],
  minImportance: 'high'
});

// It knows your preferences and patterns
const stylePreferences = await memori.searchMemories('coding style preferences', {
  categories: ['personal']
});

// It maintains context across sessions
const previousDiscussions = await memori.searchMemories('authentication system', {
  limit: 20
});
```

**Result**: Your AI assistant becomes exponentially more valuable as it accumulates knowledge about your projects, preferences, and working patterns.

---

## Architecture Deep Dive

### 🏗️ **Domain-Driven Design Architecture**
- **Domain Layer** (`src/core/domain/`) - Pure business logic organized by bounded contexts:
  - **Memory Domain** - Memory processing, classification, and state management
  - **Search Domain** - Search strategies, filtering, and relationship processing
  - **Conversation Domain** - Chat history and conversation management
- **Infrastructure Layer** (`src/core/infrastructure/`) - Technical implementations:
  - **Database Layer** - Prisma ORM, SQLite backend, and repository implementations
  - **Provider Layer** - OpenAI SDK integration and external service providers
  - **Configuration Layer** - Winston logging, configuration management, and utilities
- **Integration Layer** (`src/integrations/`) - External system integrations
- **TypeScript 5.9+** - Full type safety with compile-time validation and modern JavaScript features
- **Zod** - Runtime type validation with detailed error reporting and schema evolution

### 🔌 **AI Integration Layer**
- **Multi-Provider SDK** - Native compatibility with OpenAI, Anthropic, Ollama, and custom providers
- **Provider Factory Pattern** - Unified LLMProviderFactory for creating and managing provider instances
- **Memory-Enabled Providers** - Automatic memory enhancement across all supported LLM services
- **Streaming Support** - Full memory capture for real-time AI interactions across all providers

### 📊 **Enterprise Services**
- **Performance Monitoring** - Real-time metrics collection and alerting
- **Health Checks** - Comprehensive system diagnostics and status reporting
- **Configuration Management** - Dynamic configuration with validation and audit trails

### 🛡️ **Production Features**
- **Error Handling** - Circuit breaker patterns with graceful degradation
- **Connection Pooling** - Database connection management for high-throughput applications
- **Background Processing** - Asynchronous operations with queue management
- **Resource Management** - Memory-efficient processing with configurable limits

---

## Development

### Build & Test

```bash
# Install dependencies
npm install

# Run tests
npm test

# Watch tests during development
npm run test:watch

# Lint code
npm run lint

# Database management
npm run prisma:studio
```

### Examples

Run example scripts to see Memorits in action:

```bash
# Basic usage
npm run example:basic

# OpenAI integration
npm run example:openai

# Advanced search features
npm run example:advanced-search

# Memory consolidation
npm run example:consolidation

# Performance dashboard
npm run example:performance-dashboard

# Index management
npm run index:health
npm run index:optimize
npm run index:backup
```

### Project Structure

The codebase follows Domain-Driven Design principles:

- **`src/core/domain/`** - Business logic organized by bounded contexts
- **`src/core/infrastructure/`** - Technical implementations and external concerns
- **`src/integrations/`** - External system integrations
- **`examples/`** - Usage examples and demonstrations
- **`tests/`** - Comprehensive test coverage

---

## Dual Attribution

**This project represents a dual attribution collaboration:**

### Original Library Attribution
**This project is a TypeScript port of the original [Memori Python project](https://github.com/GibsonAI/memori) created by GibsonAI.**

- **Original Authors**: Harshal More, harshalmore2468@gmail.com
- **Organization**: GibsonAI Team, noc@gibsonai.com
- **Original Repository**: [https://github.com/GibsonAI/memori](https://github.com/GibsonAI/memori)
- **License**: [Apache License 2.0](LICENSE)
- **Documentation**: [https://memori.gibsonai.com/docs](https://memori.gibsonai.com/docs)

### Port Attribution
**This specific TypeScript port was created by @mrorigo with AI assistance from Roo Code using the code-supernova model.**

- **Port Author**: mrorigo
- **AI Assistant**: Roo Code (code-supernova model)
- **Repository**: [https://github.com/mrorigo/memorits](https://github.com/mrorigo/memorits)
- **NPM Package**: [https://npmjs.com/package/memorits](https://npmjs.com/package/memorits)

This TypeScript port maintains compatibility with the original Apache License 2.0 and preserves the core functionality and architecture of the original implementation while leveraging TypeScript's type safety and modern JavaScript ecosystem.

---

## Developer Documentation

📚 **[Comprehensive Developer Guide](docs/developer/index.md)** - Complete architecture overview, implementation details, and advanced usage patterns.

### Key Developer Resources:
- **[Core Concepts](docs/developer/core-concepts/)** - Memory management, search strategies, and classification systems
- **[Architecture Deep Dive](docs/developer/architecture/)** - System design, database layer, and search engine implementation
- **[Advanced Features](docs/developer/advanced-features/)** - Temporal filtering, metadata processing, conscious memory, memory relationships, and consolidation
- **[API Reference](docs/developer/api/)** - Detailed interface documentation and usage examples
- **[Integration Guides](docs/developer/integration/)** - Multi-provider integration patterns and custom provider development
- **[Provider Documentation](docs/developer/providers/)** - Complete guides for OpenAI, Anthropic, Ollama, and custom providers
- **[Provider Documentation](docs/developer/providers/)** - Comprehensive guides for OpenAI, Anthropic, Ollama, and custom providers

---

## API Reference

📚 **[Complete API Documentation](docs/developer/api/)** - Comprehensive API reference with detailed examples.

---

<div align="center">
  <p>
    <strong>🚀 Ready to give your AI enterprise-grade memory?</strong>
  </p>
  <p>
    <a href="#quick-start">Get Started</a> •
    <a href="https://github.com/mrorigo/memorits">View on GitHub</a> •
    <a href="https://npmjs.com/package/memorits">Install from NPM</a>
  </p>
  <p>
    <strong>🏢 Enterprise-grade • Production-designed • Mission-capable</strong>
  </p>
</div>
