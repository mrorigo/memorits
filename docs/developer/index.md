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
- **🤖 OpenAI Drop-in Replacement**: Zero breaking changes for existing code

## 🚀 Quick Start

### Installation

```bash
npm install memorits
```

### Basic Usage

```typescript
import { Memori, ConfigManager, createMemoriOpenAI } from 'memorits';

// Initialize with configuration
const config = ConfigManager.loadConfig();
const memori = new Memori(config);
await memori.enable();

// Create OpenAI client with automatic memory recording
const openaiClient = createMemoriOpenAI(memori, config.apiKey);

// Use normally - conversations are automatically recorded
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }],
});

// Search through conversation history
const memories = await memori.searchMemories('urgent meeting notes', {
  minImportance: 'high',
  limit: 10
});
```

## 📚 Documentation Structure

This developer documentation is organized to help you build sophisticated AI agents with Memorits:

### Core Concepts
- **[Memory Management](core-concepts/memory-management.md)** - Understanding auto-ingestion vs conscious processing modes
- **[Search Strategies](core-concepts/search-strategies.md)** - FTS5, LIKE, recent, semantic, and advanced filtering
- **[Memory Classification](core-concepts/classification.md)** - Importance levels and categorization systems

### Architecture Deep Dive
- **[System Architecture](architecture/system-overview.md)** - High-level system design and data flow
- **[Database Layer](architecture/database-layer.md)** - SQLite with FTS5, schema design, and optimization
- **[Search Engine](architecture/search-engine.md)** - Multi-strategy search implementation
- **[Agent System](architecture/agent-system.md)** - Memory and conscious agents explained

### Advanced Features
- **[Temporal Filtering](advanced-features/temporal-filtering.md)** - Time-based search and pattern matching
- **[Metadata Filtering](advanced-features/metadata-filtering.md)** - Advanced metadata-based queries
- **[Duplicate Management](advanced-features/duplicate-management.md)** - Consolidation and cleanup strategies
- **[Conscious Processing](advanced-features/conscious-processing.md)** - Background memory processing

### Integration Guides
- **[OpenAI Integration](integrations/openai-integration.md)** - Drop-in replacement patterns
- **[Custom Integrations](integrations/custom-integrations.md)** - Building custom providers
- **[Multi-Agent Systems](integrations/multi-agent-systems.md)** - Shared memory architectures

### API Reference
- **[Core API](api-reference/core-api.md)** - Memori class and primary interfaces
- **[Search API](api-reference/search-api.md)** - Advanced search capabilities
- **[Database API](api-reference/database-api.md)** - Direct database operations
- **[Configuration API](api-reference/configuration-api.md)** - Configuration management

### Examples & Tutorials
- **[Basic Examples](examples/basic-usage.md)** - Getting started examples
- **[Advanced Examples](examples/advanced-usage.md)** - Complex use cases
- **[Agent Building](examples/agent-building.md)** - Building memory-enabled agents
- **[Search Strategies](examples/search-strategies.md)** - Advanced search techniques

### Deployment & Operations
- **[Production Deployment](deployment/production.md)** - Production-ready deployment
- **[Monitoring](deployment/monitoring.md)** - Health checks and observability
- **[Performance Tuning](deployment/performance.md)** - Optimization strategies
- **[Backup & Recovery](deployment/backup-recovery.md)** - Data management

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
- **FTS5**: Full-text search with BM25 ranking
- **LIKE**: Pattern-based text matching
- **Recent**: Time-based recent memory retrieval
- **Semantic**: Vector-based similarity search (planned)
- **Category Filter**: Classification-based filtering
- **Temporal Filter**: Time-based filtering and pattern matching
- **Metadata Filter**: Advanced metadata-based queries

### Memory Classification
- **Importance Levels**: Critical, High, Medium, Low
- **Categories**: Essential, Contextual, Conversational, Reference, Personal, Conscious-Info
- **Metadata**: Rich context with timestamps, sources, and relationships

## 🚀 Next Steps

1. **Start with [Core Concepts](core-concepts/memory-management.md)** to understand the fundamental ideas
2. **Explore [Architecture](architecture/system-overview.md)** to see how components fit together
3. **Try the [Examples](examples/basic-usage.md)** to get hands-on experience
4. **Dive into [Advanced Features](advanced-features/temporal-filtering.md)** for sophisticated use cases
5. **Check the [API Reference](api-reference/core-api.md)** for detailed interface documentation

## 📖 Additional Resources

- **[GitHub Repository](https://github.com/mrorigo/memorits)** - Source code and issues
- **[NPM Package](https://npmjs.com/package/memorits)** - Package installation and versions
- **[Migration Guide](../MIGRATION.md)** - Migrating from OpenAI to MemoriOpenAI
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