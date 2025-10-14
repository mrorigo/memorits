# 📚 Provider Documentation

Complete guides for all LLM providers supported by the Memori system, featuring **AI-powered memory processing** with sophisticated MemoryAgent integration across OpenAI, Anthropic, Ollama, and custom provider development.

## Provider Guides

### 🤖 [Anthropic Provider Guide](./anthropic-guide.md)
Complete guide for using Anthropic's Claude models with the sophisticated Memori provider system.

**Topics Covered:**
- Configuration and setup with MemoryAgent integration
- Supported Claude models with AI-powered memory processing
- Message format conversion with enhanced metadata
- Error handling and best practices for memory-enabled applications
- Integration with sophisticated memory system featuring classification, entity extraction, and relationship detection
- Integration with unified MemoryAgent architecture

### 🦙 [Ollama Provider Guide](./ollama-guide.md)
Comprehensive guide for running local LLM models using Ollama with advanced memory capabilities.

**Topics Covered:**
- Ollama installation and setup with MemoryAgent integration
- Local model management with AI-powered memory processing
- Offline capability configuration with sophisticated memory features
- Performance optimization for memory-intensive applications
- Hardware requirements for advanced memory processing
- Troubleshooting local models with enhanced memory capabilities

### 🚀 [Quick Start Guide](./quick-start.md)
Getting started with multiple LLM providers in minutes using the MemoryAgent architecture.

**Topics Covered:**
- Provider setup and configuration with AI-powered memory processing
- Multi-provider integration patterns leveraging unified MemoryAgent
- Best practices for production use with sophisticated memory capabilities
- Performance optimization tips for memory-enhanced applications
- Troubleshooting common issues with advanced memory features

## Quick Start with AI-Powered Memory Processing

### Using Different Providers with MemoryAgent Integration

```typescript
import { LLMProviderFactory, ProviderType } from 'memorits/core/infrastructure/providers';

// Register default providers with MemoryAgent integration
LLMProviderFactory.registerDefaultProviders();

// Create OpenAI provider with sophisticated AI-powered memory processing
const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto', // Leverages MemoryAgent for AI-powered processing
    sessionId: 'my-app'
  }
});

// Create Anthropic provider with unified MemoryAgent architecture
const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto', // Same MemoryAgent processing across all providers
    sessionId: 'my-app' // Same session for shared AI-enhanced memory
  }
});

// Create Ollama provider with local MemoryAgent processing
const ollamaProvider = await LLMProviderFactory.createProvider(ProviderType.OLLAMA, {
  baseUrl: 'http://localhost:11434',
  model: 'llama2:7b',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto', // MemoryAgent works locally too!
    sessionId: 'my-app'
  }
});

// All providers now share the same sophisticated MemoryAgent capabilities:
// 🤖 AI-powered classification and importance scoring
// 🏷️ Advanced entity extraction and relationship detection
// 📊 Rich memory analytics and metadata generation
```

### Testing Providers with Memory Capabilities

```typescript
import { ProviderTestSuite } from 'memorits/core/infrastructure/providers';

const testSuite = new ProviderTestSuite(provider, config);
const results = await testSuite.runTestSuite();

// Tests now include memory processing capabilities
console.log(`Tests passed: ${results.passedTests}/${results.totalTests}`);
console.log(`Memory processing: ${results.memoryProcessingTests.passed}/${results.memoryProcessingTests.total}`);
```

### Benchmarking Performance with Memory Processing

```typescript
import { ProviderBenchmark } from 'memorits/core/infrastructure/providers';

const benchmark = new ProviderBenchmark(provider, config);
const results = await benchmark.runBenchmark({
  iterations: 10,
  testParams: { messages: [{ role: 'user', content: 'Hello!' }] },
});

// Benchmarking now includes memory processing metrics
console.log(`Average latency: ${results.summary.averageDuration}ms`);
console.log(`Memory processing time: ${results.memoryProcessing.averageTime}ms`);
console.log(`Entity extraction: ${results.memoryProcessing.entityExtractionTime}ms`);
```

## Provider Selection Guide with MemoryAgent Integration

| Requirement | Recommended Provider | Reason |
|-------------|-------------------|--------|
| **Best Quality** | Anthropic | Claude 3.5 Sonnet offers excellent quality with sophisticated MemoryAgent processing |
| **Lowest Cost** | Anthropic | Competitive pricing with full AI-powered memory capabilities |
| **Privacy/Local** | Ollama | Complete data privacy, local execution with MemoryAgent processing |
| **Lowest Latency** | Ollama | Local execution, no network overhead, instant MemoryAgent processing |
| **Reliability** | OpenAI | Mature infrastructure, high uptime, proven MemoryAgent integration |
| **Development** | Ollama | Free, fast iteration, no API costs, full MemoryAgent capabilities |
| **Memory Features** | **All Providers** | **Unified MemoryAgent architecture across all providers** |

## Support Matrix with MemoryAgent Integration

| Feature | OpenAI | Anthropic | Ollama |
|---------|--------|-----------|--------|
| Chat Completion | ✅ | ✅ | ✅ |
| Embeddings | ✅ | ❌ | ✅ |
| Streaming | ✅ | ❌ | ❌ |
| Function Calling | ✅ | ❌ | ❌ |
| Local Execution | ❌ | ❌ | ✅ |
| API Costs | ✅ | ✅ | ❌ |
| Offline Support | ❌ | ❌ | ✅ |
| **🧠 MemoryAgent Processing** | **✅** | **✅** | **✅** |
| **🤖 AI-Powered Classification** | **✅** | **✅** | **✅** |
| **⭐ Importance Scoring** | **✅** | **✅** | **✅** |
| **🏷️ Entity Extraction** | **✅** | **✅** | **✅** |
| **🔗 Relationship Detection** | **✅** | **✅** | **✅** |

## MemoryAgent Architecture Benefits

### 🚀 **Unified Memory Processing Across All Providers**

The MemoryAgent integration provides unified memory processing across multi-provider LLM applications:

#### **🎯 Consistent Experience**
- **Identical Memory Processing**: Same sophisticated AI-powered memory capabilities across OpenAI, Anthropic, and Ollama
- **Unified API**: Single memory interface regardless of underlying LLM provider
- **Shared Memory Pool**: All providers contribute to and access the same enhanced memory system

#### **🧠 Advanced Memory Capabilities**
- **AI-Powered Classification**: Every provider leverages the same intelligent categorization system
- **Intelligent Importance Scoring**: Consistent importance assessment across all LLM interactions
- **Advanced Entity Extraction**: Unified entity recognition and relationship detection
- **Rich Metadata Generation**: Comprehensive analytics and context tracking

#### **🔧 Unified Architecture**
- **Zero Code Duplication**: Single MemoryAgent implementation serves all providers
- **Streamlined Integration**: Clean architecture with unified memory processing
- **Enhanced Maintainability**: Single codebase for memory functionality across providers

#### **📈 Performance & Scalability**
- **Optimized Processing**: MemoryAgent efficiently handles memory processing for all providers
- **Resource Efficiency**: Shared processing pipeline reduces overhead
- **Scalable Architecture**: MemoryAgent design scales with multiple provider usage
- **Enhanced Analytics**: Unified insights across all provider interactions

## Getting Help

1. **Read the Guides**: Start with the appropriate provider guide above
2. **Check Examples**: Look at `/examples` directory for usage examples showcasing AI-powered memory
3. **Test First**: Use the testing infrastructure to verify configurations with memory processing
4. **Community**: Join relevant communities for provider-specific questions

## Contributing

When adding new providers or updating documentation:

1. Follow the existing documentation structure
2. Include practical examples and code snippets
3. Document migration paths from existing providers
4. Add testing examples for the new provider
5. Update this index with links to new documentation

## Related Documentation

- **[Integration Guide](../integration/openai-integration.md)** - Multi-provider integration patterns and drop-in replacements
- **[Core API Reference](../api/core-api.md)** - Main Memori class and memory management APIs
- **[Architecture Overview](../architecture/system-overview.md)** - System design and multi-provider architecture
- **[Examples](../../../examples/)** - Real-world usage examples and demos