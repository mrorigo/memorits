# 🚀 Provider Quick Start Guide

Get started with multiple LLM providers in minutes using Memorits' unified provider system.

## Quick Setup (2 minutes)

### 1. Install Dependencies

```bash
npm install memorits
```

### 2. Choose Your Integration Pattern

#### Option A: Drop-in Replacement (OpenAI Compatible)

```typescript
import { MemoriOpenAI } from 'memorits';

const client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  autoInitialize: true
});

// Use exactly like OpenAI SDK
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello!' }]
});

// Access memory features
const memories = await client.memory.searchMemories('hello');
```

#### Option B: Provider Factory (Multi-Provider Support)

```typescript
import { LLMProviderFactory, ProviderType } from '@memori/providers';

// Create OpenAI provider
const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  enableMemory: true,
  memoryConfig: {
    databaseUrl: 'sqlite:./memories.db',
    namespace: 'my-app'
  }
});

// Create Anthropic provider (shared memory)
const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  enableMemory: true,
  memoryConfig: {
    databaseUrl: 'sqlite:./memories.db', // Same database for shared memory
    namespace: 'my-app'
  }
});

// Use different providers
const openaiResponse = await openaiProvider.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello from OpenAI!' }]
});

const anthropicResponse = await anthropicProvider.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello from Anthropic!' }]
});

// Search across all conversations
const memories = await openaiProvider.memory.searchMemories('hello');
```

#### Option C: Ollama (Local LLM)

```typescript
const ollamaProvider = await LLMProviderFactory.createProvider(ProviderType.OLLAMA, {
  baseUrl: 'http://localhost:11434',
  model: 'llama2:7b',
  enableMemory: true,
  memoryConfig: {
    databaseUrl: 'sqlite:./memories.db',
    namespace: 'my-app'
  }
});

const response = await ollamaProvider.chat.completions.create({
  model: 'llama2:7b',
  messages: [{ role: 'user', content: 'Hello locally!' }]
});
```

## Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-openai-key
OPENAI_BASE_URL=https://api.openai.com/v1

# Anthropic Configuration
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-key
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1

# Ollama Configuration (local)
OLLAMA_BASE_URL=http://localhost:11434

# Memory Configuration
MEMORI_DATABASE_URL=sqlite:./memories.db
MEMORI_NAMESPACE=my-app
MEMORI_AUTO_INGEST=true
```

## Basic Usage Patterns

### Pattern 1: Single Provider with Memory

```typescript
import { MemoriOpenAI } from 'memorits';

class MemoryEnabledApp {
  private client: MemoriOpenAI;

  constructor() {
    this.client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
      enableChatMemory: true,
      autoInitialize: true,
      databaseConfig: {
        type: 'sqlite',
        url: 'sqlite:./memories.db'
      }
    });
  }

  async chat(message: string) {
    // AI response with automatic memory recording
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: message }]
    });

    return response.choices[0].message.content;
  }

  async searchHistory(query: string) {
    // Search conversation history
    return this.client.memory.searchMemories(query, {
      limit: 10,
      minImportance: 'medium'
    });
  }
}
```

### Pattern 2: Multiple Providers with Shared Memory

```typescript
import { LLMProviderFactory, ProviderType } from 'memorits/core/infrastructure/providers';

class MultiProviderApp {
  private providers: Map<ProviderType, any> = new Map();
  private sharedMemory: any;

  async initialize() {
    // Create providers with shared memory configuration
    const memoryConfig = {
      databaseUrl: 'sqlite:./memories.db',
      namespace: 'multi-provider-app'
    };

    this.providers.set(ProviderType.OPENAI,
      await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
        apiKey: process.env.OPENAI_API_KEY,
        model: 'gpt-4o-mini',
        enableMemory: true,
        memoryConfig
      })
    );

    this.providers.set(ProviderType.ANTHROPIC,
      await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
        apiKey: process.env.ANTHROPIC_API_KEY,
        model: 'claude-3-5-sonnet-20241022',
        enableMemory: true,
        memoryConfig
      })
    );

    // Use first provider's memory for shared access
    this.sharedMemory = this.providers.get(ProviderType.OPENAI)!.memory;
  }

  async askProvider(providerType: ProviderType, message: string) {
    const provider = this.providers.get(providerType);
    if (!provider) {
      throw new Error(`Provider ${providerType} not available`);
    }

    const response = await provider.chat.completions.create({
      model: providerType === ProviderType.OPENAI ? 'gpt-4o-mini' : 'claude-3-5-sonnet-20241022',
      messages: [{ role: 'user', content: message }]
    });

    return response.choices[0].message.content;
  }

  async searchAllMemories(query: string) {
    return this.sharedMemory.searchMemories(query, { limit: 20 });
  }
}
```

## Provider Selection Guide

| Requirement | Recommended Provider | Reason |
|-------------|-------------------|--------|
| **Best Quality** | Anthropic | Claude 3.5 Sonnet offers excellent response quality |
| **Lowest Cost** | Anthropic | Competitive pricing, especially for input tokens |
| **Privacy/Local** | Ollama | Complete data privacy, local execution |
| **Lowest Latency** | Ollama | Local execution, no network overhead |
| **Reliability** | OpenAI | Mature infrastructure, high uptime |
| **Development** | Ollama | Free, fast iteration, no API costs |

## Next Steps

1. **Read Provider Guides**: Choose the appropriate provider guide for detailed setup
2. **Configure Memory**: Set up database and namespace configuration
3. **Test Integration**: Use the testing tools to verify your setup
4. **Performance Tuning**: Optimize configuration for your use case
5. **Production Setup**: Configure monitoring and error handling

## Getting Help

- **Provider Guides**: See specific guides for each provider
- **API Reference**: Check the core API documentation
- **Examples**: Look at `/examples` directory for complete examples
- **Testing Tools**: Use `ProviderTestSuite` and `ProviderBenchmark` for validation

This quick start guide gets you up and running with multiple LLM providers in minutes while providing a solid foundation for building sophisticated memory-enabled applications.