# 🚀 Memori API Guide

## Overview

The **Memori API** provides a clean, intuitive interface for building applications with AI-powered memory. Simple configuration, direct provider integration, and automatic memory recording make it easy to add intelligent memory to your AI applications.

## 🚀 Quick Start

### Basic Setup

```typescript
import { Memori, OpenAIWrapper } from 'memori-ts';

const memori = new Memori({
  databaseUrl: 'postgresql://localhost:5432/memori',
  namespace: 'my-app',
  apiKey: 'sk-your-openai-key',
  autoMemory: true
});

const openai = new OpenAIWrapper(memori);

const response = await openai.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log('Response:', response.content);
console.log('Chat ID:', response.chatId);
```

### Multiple Providers

```typescript
import { Memori, OpenAIWrapper, AnthropicWrapper } from 'memori-ts';

const memori = new Memori({
  databaseUrl: 'postgresql://localhost:5432/memori',
  namespace: 'multi-provider-app',
  apiKey: 'sk-your-key',
  autoMemory: true
});

const openai = new OpenAIWrapper(memori);
const claude = new AnthropicWrapper(memori);

// Both record to the same memory pool
await openai.chat({ messages: [{ role: 'user', content: 'From OpenAI' }] });
await claude.chat({ messages: [{ role: 'user', content: 'From Claude' }] });

// Search across all conversations
const memories = await memori.searchMemories('AI');
```

### Local Development

```typescript
import { Memori, OllamaWrapper } from 'memori-ts';

const memori = new Memori({
  databaseUrl: 'sqlite:./local.db',
  namespace: 'local-dev',
  apiKey: 'ollama-local',
  baseUrl: 'http://localhost:11434',
  autoMemory: true
});

const ollama = new OllamaWrapper(memori);
const response = await ollama.chat({
  messages: [{ role: 'user', content: 'Local AI!' }]
});
```

## 📚 API Reference

### Memori Constructor

```typescript
new Memori(config: {
  databaseUrl: string;      // Database connection string
  namespace: string;        // Application namespace
  provider?: ProviderName;  // Optional: 'openai' | 'anthropic' | 'ollama'
  apiKey: string;           // Provider API key
  model?: string;           // Model name (optional)
  baseUrl?: string;         // Custom API endpoint (optional)
  autoMemory?: boolean;     // Enable automatic memory recording
  consciousMemory?: boolean; // Enable conscious memory mode
})
```

### Provider Wrappers

#### OpenAIWrapper

```typescript
const openai = new OpenAIWrapper(memori, {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
});

const response = await openai.chat({
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatResponse>;
```

#### AnthropicWrapper

```typescript
const claude = new AnthropicWrapper(memori, {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
});

const response = await claude.chat({
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
}): Promise<ChatResponse>;
```

#### OllamaWrapper

```typescript
const ollama = new OllamaWrapper(memori, {
  baseUrl?: string;
  model?: string;
  timeout?: number;
});

const response = await ollama.chat({
  messages: ChatMessage[];
  model?: string;
}): Promise<ChatResponse>;
```

## 🔧 Configuration Options

### Memory Modes

| Option | Default | Description |
|--------|---------|-------------|
| `autoMemory` | `true` | Enable automatic memory recording |
| `consciousMemory` | `false` | Enable conscious memory processing |

### Provider-Specific Options

#### OpenAI
- `model`: `'gpt-4o-mini'` (default)
- `temperature`: `0.7`
- `maxTokens`: `1000`

#### Anthropic
- `model`: `'claude-3-5-sonnet-20241022'` (default)
- `temperature`: `0.7`
- `maxTokens`: `1000`

#### Ollama
- `model`: `'llama2'` (default)
- `baseUrl`: `'http://localhost:11434'`

## 🛠️ Advanced Usage

### Custom Configuration

```typescript
const memori = new Memori({
  databaseUrl: 'postgresql://localhost:5432/memori',
  namespace: 'enterprise-app',
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
  autoMemory: true,
  consciousMemory: false
});
```

### Validation and Error Handling

```typescript
import { validateConfig, createMemoriError } from 'memori-ts';

const config = {
  databaseUrl: 'postgresql://localhost:5432/memori',
  namespace: 'my-app',
  apiKey: 'sk-your-key'
};

const validation = validateConfig(config);
if (!validation.isValid) {
  console.error('Config errors:', validation.errors);
  throw createMemoriError(
    'Invalid configuration',
    'INVALID_CONFIG',
    ['Check your database URL', 'Verify API key format']
  );
}
```

### Memory Management

```typescript
// Search memories
const memories = await memori.searchMemories('cats');

// Advanced search with options
const recentMemories = await memori.searchMemories('AI', {
  limit: 10,
  includeMetadata: true
});

// Get memory statistics
const stats = await memori.getMemoryStatistics();
console.log(`Total memories: ${stats.totalMemories}`);
```

## 🎯 Design Principles

### 1. **Single Creation Pattern**
```typescript
// ✅ One obvious way to create Memori
new Memori({
  databaseUrl: 'postgresql://...',
  namespace: 'my-app',
  apiKey: 'sk-...',
  autoMemory: true
});

// ❌ No complex factory patterns or auto-detection
```

### 2. **Direct Integration**
```typescript
// ✅ Provider wrappers use Memori instances directly
const openai = new OpenAIWrapper(memori);
const claude = new AnthropicWrapper(memori);

// ❌ No separate configuration structs
```

### 3. **Automatic Memory Recording**
```typescript
// ✅ Memory happens automatically
const response = await openai.chat({ messages });

// ✅ Search works across all providers
const memories = await memori.searchMemories('topic');

// ❌ No manual memory management needed
```

### 4. **Simple Boolean Flags**
```typescript
// ✅ Obvious configuration options
{
  autoMemory: true,        // Simple boolean
  consciousMemory: false   // Simple boolean
}

// ❌ No nested configuration objects
```

## 🚨 Error Handling

### Common Errors and Solutions

```typescript
try {
  const memori = new Memori(config);
  await memori.enable();
} catch (error) {
  if (error.message.includes('databaseUrl')) {
    console.error('Check your database connection string');
  }

  if (error.message.includes('apiKey')) {
    console.error('Verify your API key format');
  }

  if (error.message.includes('namespace')) {
    console.error('Choose a unique namespace for your app');
  }
}
```

### Validation Errors

```typescript
import { validateConfig } from 'memori-ts';

const validation = validateConfig(config);
if (!validation.isValid) {
  console.error('Configuration errors:');
  validation.errors.forEach(error => console.error(`- ${error}`));

  if (validation.warnings.length > 0) {
    console.warn('Warnings:');
    validation.warnings.forEach(warning => console.warn(`- ${warning}`));
  }
}
```

## 📊 Performance Tips

### 1. **Connection Reuse**
```typescript
// ✅ Reuse Memori instances
const memori = new Memori(config);

// ❌ Don't create new instances for each operation
```

### 2. **Batch Operations**
```typescript
// ✅ Enable once, use multiple times
await memori.enable();

// Use for multiple operations
await openai.chat({ messages: [...] });
await memori.searchMemories('query');
```

### 3. **Proper Cleanup**
```typescript
// ✅ Always close when done
await memori.close();
```

## 🔧 Troubleshooting

### Common Issues

**"Database connection failed"**
- Check your `databaseUrl` format
- Ensure database server is running
- Verify network connectivity

**"Invalid API key"**
- Verify API key format for your provider
- Check if key has required permissions
- Ensure key hasn't expired

**"Memory recording failed"**
- Ensure Memori is enabled with `await memori.enable()`
- Check namespace uniqueness
- Verify database write permissions

### Debug Mode

```typescript
const memori = new Memori({
  // ... other config
  debugMode: true  // Enable detailed logging
});
```

## 📝 Next Steps

1. **Read the Examples**: Check `examples/unified-usage.ts` for copy-paste code
2. **Run the Tests**: Execute `npm test` to see the API in action
3. **Explore Advanced Features**: Check `src/core/Memori.ts` for additional methods
4. **Customize Configuration**: Adjust memory modes and provider settings as needed

## 💡 Key Benefits

- **🎯 Simplicity**: One obvious way to do everything
- **🔗 Integration**: Direct connection between providers and memory
- **🚀 Performance**: Optimized for speed and reliability
- **🛡️ Reliability**: Comprehensive error handling and validation
- **📚 Clarity**: Self-documenting API design

---

**Ready to build amazing AI applications with memory? Start with the basic example above and explore the possibilities!**