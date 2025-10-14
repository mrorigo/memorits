# Memorits Developer Documentation

Welcome to the comprehensive developer documentation for **Memorits** - the Type-Safe Memory Engine for AI Conversations. This guide is designed for developers who want to build sophisticated AI agents with advanced search strategies and persistent memory capabilities.

## 🎯 What is Memorits?

Memorits transforms AI conversations from fleeting interactions into persistent, searchable knowledge bases. It provides AI applications with **perfect recall** - automatically capturing, classifying, and retrieving conversational context with enterprise-grade type safety and lightning-fast search capabilities.

### Key Features

- **🔍 Perfect Recall**: Never lose context again with surgical-precision search
- **🎯 Intelligent Classification**: Automatic categorization by importance and type
- **⚡ Lightning Fast**: Sub-millisecond search using optimized SQLite FTS5 backend
- **🔒 Type Safe**: 100% TypeScript coverage with compile-time validation
- **🧠 Dual Memory Modes**: Conscious processing vs. automated background ingestion
- **🎨 Multiple Search Strategies**: FTS5, LIKE, recent, semantic, temporal, and metadata filtering
- **🤖 Multi-Provider Integration**: Support for OpenAI, Anthropic, Ollama, and custom providers
- **⚙️ Advanced Configuration Management**: Real file system persistence, runtime updates, audit trails
- **🛡️ Enterprise Error Handling**: Circuit breaker patterns, strategy-specific recovery, enhanced error context
- **📈 Performance Monitoring**: Real-time dashboards, comprehensive analytics, system health monitoring
- **🔗 Memory Relationship Processing**: LLM-powered relationship extraction, graph analysis, and traversal
- **🔄 Intelligent Consolidation**: Multi-tier safety validation, quality scoring, and rollback capabilities
- **📊 Search Index Maintenance**: Automated optimization, health monitoring, backup, and recovery

## 🚀 Quick Start

### Installation

```bash
npm install memorits
```

### Basic Usage

```typescript
import { Memori, OpenAIWrapper } from 'memorits';

// Create Memori instance with simple configuration
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  apiKey: 'your-openai-api-key',
  autoMemory: true
});

// Create provider wrapper (direct integration)
const openai = new OpenAIWrapper(memori);

// Chat normally - memory is recorded automatically
const response = await openai.chat({
  messages: [{ role: 'user', content: 'Remember this for later...' }]
});

// Search through conversation history (same Memori instance)
const memories = await memori.searchMemories('urgent meeting notes', {
  minImportance: 'high',
  limit: 10
});
```

## 📚 Documentation Structure

This developer documentation is organized to help you build sophisticated AI agents with Memorits:

### 🚀 Quick Start
- **[Getting Started](getting-started.md)** - Installation and basic setup
- **[Basic Usage](basic-usage.md)** - Your first memory-enabled application

### 🏗️ Core Concepts
- **[Memory Management](core-concepts/memory-management.md)** - Auto-ingestion vs conscious processing modes
- **[Search Strategies](core-concepts/search-strategies.md)** - FTS5, LIKE, recent, semantic, and advanced filtering

### 🏛️ Architecture
 - **[System Overview](architecture/system-overview.md)** - High-level system design, Domain-Driven Design patterns, and data flow
 - **[Database Schema](architecture/database-schema.md)** - Database design and optimization
 - **[Search Architecture](architecture/search-architecture.md)** - Multi-strategy search implementation

### 🔧 Advanced Features
- **[Temporal Filtering](advanced-features/temporal-filtering.md)** - Time-based search and pattern matching
- **[Metadata Filtering](advanced-features/metadata-filtering.md)** - Advanced metadata-based queries
- **[Duplicate Management](advanced-features/duplicate-management.md)** - Consolidation and cleanup strategies with service-oriented architecture
- **[Conscious Processing](advanced-features/conscious-processing.md)** - Background memory processing
- **[Configuration Management](advanced-features/configuration-management.md)** - Runtime configuration with persistence and audit trails
- **[Performance Monitoring](advanced-features/performance-monitoring.md)** - Real-time dashboards and analytics
- **[Consolidation Service Architecture](advanced-features/consolidation-service-architecture.md)** - Service-oriented design for memory consolidation
- **[Service Monitoring](advanced-features/service-monitoring-metrics.md)** - Performance monitoring and metrics collection
- **[Search API Fixup](features/SEARCH_FIXUP.md)** - Recent enhancements to temporal search capabilities and API improvements

### 🔗 Integration
- **[Multi-Provider Integration](integration/openai-integration.md)** - Drop-in replacement and provider factory patterns
- **[Provider Documentation](providers/)** - Complete guides for OpenAI, Anthropic, Ollama, and custom providers

### 📖 API Reference
- **[Core API](api/core-api.md)** - Memori class and primary interfaces
- **[Search API](api/search-api.md)** - Advanced search capabilities

### 💡 Examples
- **[Basic Usage Examples](examples/basic-usage.md)** - Getting started examples and practical patterns
- **[Advanced Examples](../../../examples/)** - Real-world usage examples and demos

## 🎯 Target Audience

This documentation is specifically designed for:

### AI Agent Developers
- Building conversational agents that maintain context
- Implementing long-term memory for chat applications
- Creating research assistants with knowledge accumulation
- Developing customer support systems with learning capabilities

### Search Strategy Experts
- Implementing advanced search and filtering
- Building custom search strategies
- Optimizing search performance
- Understanding multi-strategy search orchestration

### System Architects
- Designing memory-enabled AI systems
- Planning multi-agent architectures
- Integrating with existing AI infrastructure
- Scaling memory systems for production

### Backend Engineers
- Understanding database schema and operations
- Implementing custom integrations
- Performance tuning and optimization
- Production deployment and monitoring

## 🔧 Key Concepts You Should Understand

### Memory Modes
- **Auto-Ingestion**: Automatic processing of conversations in real-time
- **Conscious Processing**: Background processing with human-like reflection

### Search Strategies
- **FTS5**: Full-text search with BM25 ranking and configurable weights
- **LIKE**: Pattern-based text matching with relevance boosting
- **Recent**: Time-based recent memory retrieval with time windows
- **Semantic**: Vector-based similarity search (planned)
- **Category Filter**: Classification-based filtering with hierarchy support
- **Temporal Filter**: Time-based filtering with natural language parsing
- **Metadata Filter**: Advanced metadata-based queries with nested access
- **Relationship**: Graph-based relationship traversal with confidence scoring

### Memory Classification
- **Importance Levels**: Critical, High, Medium, Low
- **Categories**: Essential, Contextual, Conversational, Reference, Personal, Conscious-Info
- **Metadata**: Rich context with timestamps, sources, and relationships

## 🚀 Next Steps

1. **Start with [Getting Started](getting-started.md)** for installation and basic setup
2. **Learn [Basic Usage](basic-usage.md)** to understand core patterns
3. **Explore [Core Concepts](core-concepts/memory-management.md)** to understand the fundamental ideas
4. **Study [Architecture](architecture/system-overview.md)** to understand system design and data flow
5. **Dive into [Advanced Features](advanced-features/temporal-filtering.md)** for sophisticated use cases
6. **Check the [API Reference](api/core-api.md)** for detailed interface documentation
## 🏗️ Project Architecture & Structure

Memorits follows **Domain-Driven Design (DDD)** principles with a clear separation of concerns:

### **Domain Layer** (`src/core/domain/`)
- **Memory Domain**: Memory processing, classification, consolidation, and state management
- **Search Domain**: Search strategies, filtering, relationship processing, and indexing
- **Conversation Domain**: Chat history and conversation management

### **Infrastructure Layer** (`src/core/infrastructure/`)
- **Database Layer**: Prisma ORM, SQLite backend, repositories, and data access objects
- **Provider Layer**: Multi-provider LLM integration supporting OpenAI, Anthropic, Ollama, and extensible architecture
- **Configuration Layer**: Winston logging, configuration management, and utilities

### **Integration Layer** (`src/integrations/`)
- External system integrations (Multi-provider drop-in replacements, etc.)

**Benefits of This Structure:**
- **Clear Separation of Concerns**: Business logic separate from technical implementation
- **Better Testability**: Domain logic can be tested independently of infrastructure
- **Easier Maintenance**: Changes in one domain don't affect others
- **Improved Developer Experience**: Logical organization makes code easier to find and understand


## 📖 Additional Resources

 - **[GitHub Repository](https://github.com/mrorigo/memorits)** - Source code and issues
 - **[NPM Package](https://npmjs.com/package/memorits)** - Package installation and versions
 - **[Python Version](../../../memori/)** - Original Python implementation

## 🤝 Contributing

We welcome contributions! See our [Contributing Guide](../../../memori/CONTRIBUTING.md) for details on:
- Reporting bugs and requesting features
- Submitting pull requests
- Development setup and testing
- Documentation improvements

## 📄 License

This project is licensed under the Apache License 2.0. See the [LICENSE](../../../memori/LICENSE) file for details.

---

**Ready to give your AI perfect memory?** Start building with Memorits today! 🎯