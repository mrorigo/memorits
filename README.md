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

---

## OpenAI Drop-in Replacement

**Transform your existing OpenAI code into a memory-enabled powerhouse with zero breaking changes.**

### Why Use the Drop-in Replacement?

- **Zero Code Changes**: Existing OpenAI code works unchanged
- **Automatic Memory**: Conversations are recorded transparently
- **Multiple Patterns**: From simple to advanced initialization
- **Full Compatibility**: Exact OpenAI SDK v5.x API match
- **Streaming Support**: Complete memory capture for streaming responses

### Quick Migration

**Before (standard OpenAI):**
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

**After (MemoriOpenAI drop-in):**
```typescript
import { MemoriOpenAI } from 'memorits';

const client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  autoInitialize: true
});

// Same API, now with memory!
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this...' }]
});

// Search through conversation history
const memories = await client.memory.searchMemories('conversation');
```

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

## Migration Guide

### Quick Migration (3 lines)

```typescript
// Replace this
import OpenAI from 'openai';
const client = new OpenAI({ apiKey });

// With this
import { MemoriOpenAI } from 'memorits';
const client = new MemoriOpenAI(apiKey, { enableChatMemory: true });
```

**✅ Zero breaking changes** - Your existing OpenAI code works unchanged!**

---

## Project Structure & Architecture

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
│   ├── agents/                     # 🤖 Agent Implementations
│   ├── database/                   # 💾 Database Services (Consolidation, Performance)
│   ├── memory/                     # 🧠 Memory Services (Consolidation, State)
│   ├── performance/                # ⚡ Performance Monitoring & Analytics
│   ├── providers/                  # 🔗 Provider Services (OpenAI, etc.)
│   └── utils/                      # 🛠️ Core Utilities
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
- **Provider Layer**: OpenAI SDK integration and external service providers
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

**💻 Developer Experience**
- **🗺️ Intuitive Navigation**: Logical organization makes code easy to find and understand
- **🔍 Clear Dependencies**: Explicit interfaces between domains reduce coupling
- **📚 Self-Documenting**: Domain structure clearly communicates business capabilities

**🏗️ Strategic Benefits**
- **🔮 Future-Proof Foundation**: Architecture supports complex business requirements evolution
- **🎛️ Technology Flexibility**: Infrastructure choices can change without affecting business logic
- **📊 Enterprise Alignment**: Structure mirrors business organization and processes

---


## Key Features

### 🔍 Advanced Search & Filtering

- **Importance-based filtering**: Prioritize critical, high, medium, or low importance memories
- **Category filtering**: Filter by essential, contextual, conversational, reference, personal, or conscious-info
- **Metadata inclusion**: Get rich context with timestamps, sources, and relationships
- **Full-text search**: Lightning-fast search across all memory content
- **Filter Expressions**: Advanced boolean logic with field comparisons, ranges, and operators
- **Filter Templates**: Pre-built filter templates for common search scenarios
- **Multi-Strategy Search**: Intelligent orchestration of FTS5, LIKE, semantic, and relationship search strategies
- **Relationship-based Search**: Find memories connected through relationship graphs with traversal capabilities

### 🛡️ Enterprise-Grade Type Safety

- **100% TypeScript coverage** with compile-time validation
- **15+ Clean Interfaces** replacing inline types for better maintainability
- **Self-documenting APIs** with clear method signatures
- **Zod validation** for runtime type checking
- **Prisma ORM** for type-safe database operations

### 🤖 Seamless OpenAI Integration

- **Drop-in replacement** for OpenAI client
- **Automatic memory recording** - no manual intervention needed
- **Structured memory processing** with intelligent classification
- **Dual memory modes**: conscious processing vs. automated ingestion

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

## Architecture

Memorits is built on a foundation of enterprise-grade technologies designed for production deployment:

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
- **OpenAI SDK 5.x** - Native compatibility with automatic memory enhancement
- **Provider Abstraction** - Pluggable AI provider architecture for multiple LLM services
- **Streaming Support** - Full memory capture for real-time AI interactions

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
- **[API Reference](docs/developer/api-reference/)** - Detailed interface documentation and usage examples
- **[Integration Guides](docs/developer/integrations/)** - OpenAI integration patterns and custom provider development

---

## API Reference

📚 **[Complete API Documentation](docs/developer/api/core-api.md)** - Comprehensive API reference with detailed examples.

---

## Development

```bash
# Run tests
npm test

# Watch tests during development
npm run test:watch

# Lint code
npm run lint

# Database management
npm run prisma:studio

# Run examples
npm run example:openai
npm run example:ollama
npm run example:search
npm run example:advanced-search
npm run example:search-strategy
npm run example:performance-dashboard
npm run example:consolidation

- **npm run example:advanced-search**: Comprehensive demonstration of all search strategies, advanced filtering, performance monitoring, and error handling
```

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

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

3. Initialize database:
   ```bash
   npm run prisma:push
   ```

4. Build and run:
   ```bash
   npm run build
   npm start
   ```

## Usage

```typescript
import { Memori, ConfigManager, createMemoriOpenAI } from 'memorits';

const config = ConfigManager.loadConfig();
const memori = new Memori(config);

await memori.enable();

// Create OpenAI client with automatic memory recording
const openaiClient = createMemoriOpenAI(memori, config.apiKey);

// Use normally - conversations are automatically recorded
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello world!' }],
});

// Search memories with advanced options
const memories = await memori.searchMemories('world', {
  limit: 5,
  minImportance: 'high',
  categories: ['essential', 'contextual']
});

// Search with basic options
const basicSearch = await memori.searchMemories('world', { limit: 10 });

// Advanced search with filtering
const filteredMemories = await memori.searchMemories('programming', {
  limit: 20,
  minImportance: 'high', // Only show high+ importance memories
  categories: ['essential', 'contextual'], // Filter by memory categories
  includeMetadata: true // Include additional metadata
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

// Search with relationships
const relationshipSearch = await memori.searchMemories('related to project setup', {
  includeRelatedMemories: true,
  maxRelationshipDepth: 2
});

// Get index health report
const healthReport = await memori.getIndexHealthReport();
console.log(`Index health: ${healthReport.health}`);
console.log(`Issues found: ${healthReport.issues.length}`);

// Optimize search index
const optimizationResult = await memori.optimizeIndex('merge');
console.log(`Optimization saved ${optimizationResult.spaceSaved} bytes`);
```

## Advanced Features

### ⚙️ Advanced Configuration Management

Memorits now features enterprise-grade configuration management with:

#### **FileConfigurationPersistenceManager**
- **Real File System Operations**: Persistent configuration storage with automatic directory management
- **Enhanced Backup System**: Metadata-rich backups with integrity verification using SHA-256 checksums
- **Automatic Directory Management**: Creates and manages configuration directories with proper permissions
- **Backup Rotation**: Configurable retention policies with automatic cleanup of old backups

```typescript
import { SearchStrategyConfigManager, FileConfigurationPersistenceManager } from 'memorits';

// Create persistence manager with custom config directory
const persistenceManager = new FileConfigurationPersistenceManager('./config/search');

// Create configuration manager
const configManager = new SearchStrategyConfigManager(persistenceManager);

// Save configuration with automatic backup
await configManager.saveConfiguration('FTS5', {
  strategyName: 'FTS5',
  enabled: true,
  priority: 10,
  performance: {
    enableCaching: true,
    cacheSize: 1000,
    enableParallelExecution: false,
  },
  strategySpecific: {
    bm25Weights: { title: 2.0, content: 1.0, category: 1.5 }
  }
});

// Create backup with metadata
const backup = await persistenceManager.backup('FTS5');
console.log(`Backup created: ${backup.id}, Size: ${backup.fileSize}, Checksum: ${backup.checksum}`);

// Restore from backup with integrity validation
const restoredConfig = await persistenceManager.restoreWithValidation('FTS5', backup.id);
```

#### **Runtime Configuration Management**
- **Dynamic Updates**: Modify search strategies without service restart
- **Configuration Notifications**: Real-time change notifications for strategy updates
- **Comprehensive Audit Trails**: Complete history tracking of all configuration changes
- **Strategy Reconfiguration**: Hot-swapping of search strategy parameters

```typescript
// Get current configuration
const currentConfig = await configManager.loadConfiguration('FTS5');

// Update configuration dynamically
const updatedConfig = configManager.mergeConfigurations(currentConfig!, {
  priority: 15,
  performance: {
    cacheSize: 2000,
    enableCaching: true
  }
});

// Save with audit trail
await configManager.saveConfiguration('FTS5', updatedConfig);

// Get audit history
const history = await configManager.getAuditHistory('FTS5', 10);
console.log('Configuration changes:', history);

// Get performance analytics
const analytics = configManager.getPerformanceAnalytics();
console.log(`Cache hit rate: ${analytics.cacheEfficiency * 100}%`);
console.log(`Average operation latency: ${analytics.averageLatency}ms`);
```

#### **Configuration Performance Monitoring**
- **Real-time Metrics**: Operation latency, throughput, and error rate tracking
- **Performance Analytics**: Detailed performance reports with recommendations
- **Trend Analysis**: Historical performance analysis with predictions
- **Alert Integration**: Performance threshold monitoring and alerting

```typescript
// Get performance metrics
const metrics = configManager.getPerformanceMetrics();
console.log(`Total operations: ${metrics.totalOperations}`);
console.log(`Average latency: ${metrics.averageOperationTime}ms`);
console.log(`Cache hit rate: ${metrics.cacheHitRate}`);

// Get detailed performance report
const report = configManager.getConfigurationPerformanceReport();
console.log('Performance summary:', report.summary);
console.log('Recommendations:', report.recommendations);

// Get recent operation metrics
const recentOps = configManager.getRecentOperationMetrics(50);
console.log(`Recent operations: ${recentOps.length}`);
```

### 🛡️ Enterprise Error Handling

#### **Circuit Breaker Pattern**
- **Fault Tolerance**: Automatic failure detection and recovery
- **Strategy-specific Recovery**: Individual error handling per search strategy
- **Enhanced Error Context**: Detailed error information with stack traces and context
- **Graceful Degradation**: Fallback mechanisms when strategies fail

```typescript
// Circuit breaker automatically handles strategy failures
const searchService = new SearchService(dbManager, configManager);

// Search continues even if one strategy fails
const results = await searchService.searchWithStrategy(query, SearchStrategy.FTS5);

// Get error context for debugging
const errorContext = searchService.getLastError();
if (errorContext) {
  console.log(`Strategy: ${errorContext.strategy}`);
  console.log(`Error: ${errorContext.message}`);
  console.log(`Recovery action: ${errorContext.recoveryAction}`);
}
```

#### **Error Recovery Mechanisms**
- **Automatic Retry**: Configurable retry policies with exponential backoff
- **Fallback Strategies**: Alternative search approaches when primary fails
- **Error Classification**: Categorization of errors by severity and type
- **Recovery Tracking**: Monitoring and reporting of recovery success rates

### 📊 Performance Monitoring & Analytics

#### **Real-time Performance Dashboard**
- **Live Metrics**: Real-time collection of performance data
- **Visual Widgets**: Configurable dashboard with charts and indicators
- **Alert System**: Proactive monitoring with customizable thresholds
- **Trend Analysis**: Historical analysis with predictive capabilities

```typescript
import { PerformanceDashboardService } from 'memorits';

const dashboard = new PerformanceDashboardService();
dashboard.initializeDashboard();

// Get system status overview
const status = dashboard.getSystemStatusOverview();
console.log(`Overall health: ${status.overallHealth}`);
console.log(`Active alerts: ${status.activeAlerts}`);

// Get real-time metrics
const metrics = dashboard.getRealTimeMetrics('search', 'latency', 100);
console.log(`Recent search latency: ${metrics.map(m => m.value).join(', ')}`);

// Set up alert callbacks
dashboard.addAlertCallback((alert) => {
  console.log(`Alert: ${alert.title} - ${alert.description}`);
  if (alert.severity === 'critical') {
    // Trigger incident response
    notifyOnCall(alert);
  }
});
```

#### **Comprehensive Analytics**
- **Performance Reports**: Automated report generation with insights
- **Cross-component Analysis**: Correlation analysis across system components
- **Resource Utilization**: Memory, CPU, and I/O efficiency tracking
- **Predictive Analytics**: Trend-based performance predictions

### Enhanced Search API

The search API now supports advanced filtering options including filter expressions and relationship search:

```typescript
interface SearchOptions {
  limit?: number;                    // Number of results (default: 5)
  minImportance?: MemoryImportanceLevel; // Filter by importance level
  categories?: MemoryClassification[];   // Filter by memory categories
  includeMetadata?: boolean;         // Include additional metadata
  filterExpression?: string;         // Advanced filter expression with boolean logic
  includeRelatedMemories?: boolean;  // Include related memories in results
  maxRelationshipDepth?: number;     // Maximum depth for relationship traversal
  searchStrategy?: SearchStrategy;   // Force specific search strategy
}

// Search with importance filtering
const importantMemories = await memori.searchMemories('critical', {
  minImportance: 'high' // Only show high importance and above
});

// Search specific categories
const technicalMemories = await memori.searchMemories('code', {
  categories: ['essential', 'reference'] // Only technical memories
});

// Advanced filter expressions
const recentImportantMemories = await memori.searchMemories('', {
  filterExpression: 'importance_score >= 0.7 AND created_at > "2024-01-01"',
  limit: 20
});

// Complex boolean filter expressions
const complexSearch = await memori.searchMemories('', {
  filterExpression: '(category = "essential" OR category = "contextual") AND importance_score >= 0.6 AND created_at BETWEEN "2024-01-01" AND "2024-12-31"',
  limit: 50
});

// Filter templates (pre-registered)
const templateSearch = await memori.searchMemories('', {
  filterExpression: 'recent_important: { days_ago: "7" }', // Template with parameters
  limit: 10
});

### 🔗 Advanced Memory Relationship Processing

#### **LLM-Powered Relationship Extraction**
- **OpenAI Integration**: Advanced relationship analysis using GPT models
- **Relationship Type Detection**: Automatic identification of continuation, reference, related, superseding, and contradictory relationships
- **Confidence Scoring**: Semantic similarity and temporal proximity analysis
- **Graph Traversal**: Multi-hop relationship navigation with depth control

```typescript
// Configure OpenAI for relationship processing
const config = ConfigManager.loadConfig();
config.openaiApiKey = process.env.OPENAI_API_KEY;
config.relationshipProcessing = {
  enabled: true,
  model: 'gpt-4o-mini',
  confidenceThreshold: 0.7,
  enableSemanticAnalysis: true
};

const memori = new Memori(config);
await memori.enable();

// Memories are automatically analyzed for relationships during processing
const chatId = await memori.recordConversation(
  "I'm working on a React authentication system",
  "I'll help you implement JWT-based authentication with refresh tokens"
);

// Search with relationship context
const relatedMemories = await memori.searchMemories('authentication patterns', {
  includeRelatedMemories: true,
  maxRelationshipDepth: 2,
  minRelationshipConfidence: 0.6
});

// Get relationship graph for memory
const relationships = await memori.getMemoryRelationships(chatId);
console.log(`Found ${relationships.length} related memories`);
```

#### **Memory Relationship Types**
- **Continuation**: Sequential conversation flow
- **Reference**: Related topics or concepts
- **Related**: Associated ideas or projects
- **Superseding**: Updated or improved information
- **Contradictory**: Conflicting information requiring resolution

#### **Relationship Graph Analysis**
- **Traversal Algorithms**: Breadth-first and depth-first relationship exploration
- **Strength Weighting**: Relationship confidence and recency scoring
- **Path Discovery**: Finding connection paths between distant memories
- **Cluster Detection**: Grouping related memories into knowledge clusters

### 🔄 Intelligent Duplicate Consolidation

#### **Multi-tier Safety Validation**
- **Quality Scoring**: Content similarity and importance analysis
- **Entity Merging**: Intelligent combination of extracted entities and metadata
- **History Preservation**: Complete audit trail of consolidation operations
- **Rollback Capabilities**: Transaction-safe consolidation with undo support

```typescript
// Find duplicate memories using advanced similarity detection
const candidateMemories = await memori.searchMemories('authentication implementation', {
  limit: 200,
  includeMetadata: true
});

const duplicates = await memori.findDuplicateMemories(candidateMemories, {
  similarityThreshold: 0.8,
  includeSemanticSimilarity: true,
  minConfidenceScore: 0.7
});

console.log(`Found ${duplicates.length} potential duplicate groups`);

// Consolidate with safety validation
for (const duplicateGroup of duplicates) {
  const consolidationResult = await memori.consolidateDuplicateMemories(
    duplicateGroup.primaryId,
    duplicateGroup.duplicateIds,
    {
      enableQualityScoring: true,
      preserveMetadata: true,
      createBackup: true,
      notifyOnConflicts: true
    }
  );

  console.log(`Consolidated ${consolidationResult.consolidated} memories`);
  console.log(`Quality score: ${consolidationResult.qualityScore}`);
}

// Get consolidation history
const history = await memori.getConsolidationHistory({
  limit: 50,
  includeRollbackInfo: true
});
```

#### **Consolidation State Management**
- **Processing Workflows**: Comprehensive state tracking through consolidation pipeline
- **Validation Gates**: Multi-stage validation with rollback on failure
- **Progress Monitoring**: Real-time tracking of consolidation operations
- **Error Recovery**: Automatic retry with exponential backoff

### 📊 Search Index Maintenance

#### **Automated Index Optimization**
- **Health Monitoring**: Continuous monitoring of index corruption and performance
- **Automatic Optimization**: Scheduled merge, compact, and rebuild operations
- **Performance Metrics**: Query time, throughput, and resource usage tracking
- **Backup & Recovery**: Automated index backups with integrity verification

```typescript
// Get index health report
const healthReport = await memori.getIndexHealthReport();
console.log(`Index health: ${healthReport.health}`);
console.log(`Issues found: ${healthReport.issues.length}`);
console.log(`Fragmentation: ${healthReport.fragmentation * 100}%`);

// Optimize index with specific strategy
const optimizationResult = await memori.optimizeIndex('merge');
console.log(`Space saved: ${optimizationResult.spaceSaved} bytes`);
console.log(`Operations performed: ${optimizationResult.operationsPerformed}`);

// Schedule automatic maintenance
await memori.scheduleIndexMaintenance({
  optimizationInterval: 24 * 60 * 60 * 1000, // 24 hours
  backupInterval: 7 * 24 * 60 * 60 * 1000,   // 7 days
  healthCheckInterval: 60 * 60 * 1000,       // 1 hour
  enableAutoRecovery: true
});
```

#### **Index Performance Analytics**
- **Query Performance**: Response time distribution and slow query analysis
- **Resource Utilization**: Memory usage, disk I/O, and CPU consumption
- **Maintenance Impact**: Performance before and after optimization
- **Predictive Monitoring**: Trend analysis and capacity planning

### Clean Interface System

Memorits now features a comprehensive interface system with:
- **15+ Clean Interfaces** replacing inline types
- **Self-documenting APIs** with clear method signatures
- **Enhanced Type Safety** with compile-time error detection
- **Better IDE Support** with rich autocomplete and IntelliSense

### Memory Classification System

```typescript
enum MemoryClassification {
  ESSENTIAL = 'essential',        // Critical information
  CONTEXTUAL = 'contextual',      // Supporting context
  CONVERSATIONAL = 'conversational', // General conversation
  REFERENCE = 'reference',        // Reference material
  PERSONAL = 'personal',          // Personal information
  CONSCIOUS_INFO = 'conscious-info' // Conscious context
}

enum MemoryImportanceLevel {
  CRITICAL = 'critical',  // Must remember
  HIGH = 'high',          // Important information
  MEDIUM = 'medium',      // Useful information
  LOW = 'low'             // Background information
}
```

## Development

- Run tests: `npm test`
- Watch tests: `npm run test:watch`
- Lint code: `npm run lint`
- Database studio: `npm run prisma:studio`