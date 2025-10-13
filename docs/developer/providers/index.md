# 📚 Provider Documentation

Complete guides for all LLM providers supported by the Memori system, including OpenAI, Anthropic, Ollama, and custom provider development.

## Provider Guides

### 🤖 [Anthropic Provider Guide](./anthropic-guide.md)
Complete guide for using Anthropic's Claude models with the Memori provider system.

**Topics Covered:**
- Configuration and setup
- Supported Claude models
- Message format conversion
- Error handling and best practices
- Integration with memory system
- Migration from other providers

### 🦙 [Ollama Provider Guide](./ollama-guide.md)
Comprehensive guide for running local LLM models using Ollama.

**Topics Covered:**
- Ollama installation and setup
- Local model management
- Offline capability configuration
- Performance optimization
- Hardware requirements
- Troubleshooting local models

### 🚀 [Quick Start Guide](./quick-start.md)
Getting started with multiple LLM providers in minutes.

**Topics Covered:**
- Provider setup and configuration
- Multi-provider integration patterns
- Best practices for production use
- Performance optimization tips
- Troubleshooting common issues

## Quick Start

### Using Different Providers

```typescript
import { LLMProviderFactory, ProviderType } from 'memorits/core/infrastructure/providers';

// Register default providers
LLMProviderFactory.registerDefaultProviders();

// Create OpenAI provider
const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

// Create Anthropic provider
const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
});

// Create Ollama provider
const ollamaProvider = await LLMProviderFactory.createProvider(ProviderType.OLLAMA, {
  baseUrl: 'http://localhost:11434',
  model: 'llama2:7b',
});
```

### Testing Providers

```typescript
import { ProviderTestSuite } from 'memorits/core/infrastructure/providers';

const testSuite = new ProviderTestSuite(provider, config);
const results = await testSuite.runTestSuite();

console.log(`Tests passed: ${results.passedTests}/${results.totalTests}`);
```

### Benchmarking Performance

```typescript
import { ProviderBenchmark } from 'memorits/core/infrastructure/providers';

const benchmark = new ProviderBenchmark(provider, config);
const results = await benchmark.runBenchmark({
  iterations: 10,
  testParams: { messages: [{ role: 'user', content: 'Hello!' }] },
});

console.log(`Average latency: ${results.summary.averageDuration}ms`);
```

## Provider Selection Guide

| Requirement | Recommended Provider | Reason |
|-------------|-------------------|--------|
| **Best Quality** | Anthropic | Claude 3.5 Sonnet offers excellent quality |
| **Lowest Cost** | Anthropic | Competitive pricing, especially for input tokens |
| **Privacy/Local** | Ollama | Complete data privacy, local execution |
| **Lowest Latency** | Ollama | Local execution, no network overhead |
| **Reliability** | OpenAI | Mature infrastructure, high uptime |
| **Development** | Ollama | Free, fast iteration, no API costs |

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

## Getting Help

1. **Read the Guides**: Start with the appropriate provider guide above
2. **Check Examples**: Look at `/examples` directory for usage examples
3. **Test First**: Use the testing infrastructure to verify configurations
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