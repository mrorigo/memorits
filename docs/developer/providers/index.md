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

## Quick Start with Memory Processing

### Using Different Providers

```typescript
import { MemoriAI } from 'memorits';

// Create MemoriAI instances for different providers (shared database)
const openaiAI = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});

const anthropicAI = new MemoriAI({
  databaseUrl: 'file:./memori.db',  // Same database for shared memory
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  provider: 'anthropic',
  mode: 'automatic'
});

const ollamaAI = new MemoriAI({
  databaseUrl: 'file:./memori.db',  // Same database for shared memory
  apiKey: 'ollama-local',
  baseUrl: 'http://localhost:11434',
  model: 'llama2',
  provider: 'ollama',
  mode: 'automatic'
});

// Use any provider - they all share the same memory pool
const openaiResponse = await openaiAI.chat({
  messages: [{ role: 'user', content: 'Remember: I love TypeScript' }]
});

const claudeResponse = await anthropicAI.chat({
  messages: [{ role: 'user', content: 'What does the user love?' }]
});

// Search works across all providers
const memories = await openaiAI.searchMemories('TypeScript');
```

### Testing Providers

```typescript
import { MemoriAI } from 'memorits';

// Create MemoriAI instance
const ai = new MemoriAI({
  databaseUrl: 'file:./test.db',
  apiKey: process.env.OPENAI_API_KEY || 'test-key',
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});

// Test chat functionality
const response = await ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log('Chat test passed:', response.message.content.length > 0);
console.log('Memory recorded:', response.chatId);

// Test memory search
const memories = await ai.searchMemories('Hello');
console.log('Memory search test passed:', memories.length > 0);
```

### Simple Performance Check

```typescript
import { MemoriAI } from 'memorits';

const ai = new MemoriAI({
  databaseUrl: 'file:./benchmark.db',
  apiKey: process.env.OPENAI_API_KEY || 'test-key',
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});

// Simple performance test
const startTime = Date.now();

const response = await ai.chat({
  messages: [{ role: 'user', content: 'Performance test' }]
});

const duration = Date.now() - startTime;
console.log(`Response time: ${duration}ms`);
console.log(`Chat ID: ${response.chatId}`);
```

## Provider Selection Guide

| Requirement | Recommended Provider | Reason |
|-------------|-------------------|--------|
| **Best Quality** | Anthropic | Claude 3.5 Sonnet offers excellent quality with memory processing |
| **Lowest Cost** | Anthropic | Competitive pricing with full memory capabilities |
| **Privacy/Local** | Ollama | Complete data privacy, local execution with memory processing |
| **Lowest Latency** | Ollama | Local execution, no network overhead, instant memory processing |
| **Reliability** | OpenAI | Mature infrastructure, high uptime, proven memory integration |
| **Development** | Ollama | Free, fast iteration, no API costs, full memory capabilities |
| **Memory Features** | **All Providers** | **Unified memory architecture across all providers** |

## Support Matrix

| Feature | OpenAI | Anthropic | Ollama |
|---------|--------|-----------|--------|
| Chat Completion | ✅ | ✅ | ✅ |
| Embeddings | ✅ | ❌ | ✅ |
| Streaming | ✅ | ❌ | ❌ |
| Function Calling | ✅ | ❌ | ❌ |
| Local Execution | ❌ | ❌ | ✅ |
| API Costs | ✅ | ✅ | ❌ |
| Offline Support | ❌ | ❌ | ✅ |
| **🧠 Memory Processing** | **✅** | **✅** | **✅** |
| **🤖 Classification** | **✅** | **✅** | **✅** |
| **⭐ Importance Scoring** | **✅** | **✅** | **✅** |
| **🏷️ Entity Extraction** | **✅** | **✅** | **✅** |
| **🔗 Relationship Detection** | **✅** | **✅** | **✅** |

## Memory Architecture Benefits

### 🚀 **Unified Memory Processing Across All Providers**

The memory system provides unified processing across multi-provider applications:

#### **🎯 Consistent Experience**
- **Identical Memory Processing**: Same memory capabilities across OpenAI, Anthropic, and Ollama
- **Unified API**: Single memory interface regardless of underlying LLM provider
- **Shared Memory Pool**: All providers contribute to and access the same memory system

#### **🧠 Memory Capabilities**
- **Classification**: Intelligent categorization of conversations
- **Importance Scoring**: Consistent importance assessment across all interactions
- **Entity Extraction**: Unified entity recognition and relationship detection
- **Rich Metadata**: Comprehensive analytics and context tracking

#### **🔧 Simple Architecture**
- **Direct Integration**: MemoriAI works directly with providers (no wrappers needed)
- **Clean Design**: Simple, maintainable memory functionality
- **Easy to Use**: Obvious patterns for memory operations

#### **📈 Performance & Scalability**
- **Efficient Processing**: Optimized memory handling for all providers
- **Resource Efficient**: Shared processing reduces overhead
- **Scalable Design**: Works with multiple provider usage
- **Unified Insights**: Single source of memory analytics

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