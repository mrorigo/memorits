# 🚀 Memori API Guide

## Overview

The **Memori API** provides a clean, intuitive interface for building applications with AI-powered memory. Simple configuration, direct provider integration, and automatic memory recording make it easy to add intelligent memory to your AI applications.

## 🚀 Quick Start

### Basic Setup

```typescript
import { MemoriAI } from 'memorits';

const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY || 'sk-your-openai-key',
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});

const response = await ai.chat({
  messages: [{ role: 'user', content: 'Hello!' }]
});

console.log('Response:', response.message.content);
console.log('Chat ID:', response.chatId);
```

### Multiple Providers

```typescript
import { MemoriAI } from 'memorits';

// OpenAI provider
const openaiAI = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});

// Anthropic provider (same database for shared memory)
const anthropicAI = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  provider: 'anthropic',
  mode: 'automatic'
});

// Both record to the same memory pool
await openaiAI.chat({ messages: [{ role: 'user', content: 'From OpenAI' }] });
await anthropicAI.chat({ messages: [{ role: 'user', content: 'From Claude' }] });

// Search across all conversations
const memories = await openaiAI.searchMemories('AI');
```

### Local Development

```typescript
import { MemoriAI } from 'memorits';

const ai = new MemoriAI({
  databaseUrl: 'file:./local.db',
  apiKey: 'ollama-local',
  baseUrl: 'http://localhost:11434',
  model: 'llama2',
  provider: 'ollama',
  mode: 'automatic'
});

const response = await ai.chat({
  messages: [{ role: 'user', content: 'Local AI!' }]
});
```

## 📚 API Reference

### MemoriAI Constructor

```typescript
new MemoriAI(config: {
  databaseUrl: string;      // Database connection string
  apiKey: string;           // Provider API key
  model?: string;           // Model name (default: provider-specific)
  provider: 'openai' | 'anthropic' | 'ollama'; // Required provider
  baseUrl?: string;         // Custom API endpoint (optional)
  mode?: 'automatic' | 'manual' | 'conscious'; // Memory processing mode
  namespace?: string;       // Application namespace (optional)
  sessionId?: string;       // Session identifier (optional)
  memory?: {               // Memory configuration (optional)
    enableChatMemory?: boolean;
    memoryProcessingMode?: 'auto' | 'manual' | 'conscious';
  };
})
```

### Core Methods

#### chat()

```typescript
const response = await ai.chat({
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeout?: number;
}): Promise<ChatResponse>;
```

#### searchMemories()

```typescript
const memories = await ai.searchMemories(
  query: string,
  options?: {
    limit?: number;
    minImportance?: 'low' | 'medium' | 'high' | 'critical';
    categories?: string[];
    temporalFilters?: any;
    includeMetadata?: boolean;
  }
): Promise<MemorySearchResult[]>;
```

#### searchRecentMemories()

```typescript
const recentMemories = await ai.searchRecentMemories(
  limit?: number,
  includeCurrentSession?: boolean,
  temporalFilters?: any
): Promise<MemorySearchResult[]>;
```

## 🔧 Configuration Options

### Memory Modes

| Option | Default | Description |
|--------|---------|-------------|
| `mode` | `'automatic'` | Memory processing mode |
| `automatic` | Auto-record conversations and process memories |
| `manual` | Manual control over memory recording and processing |
| `conscious` | Advanced background processing with human-like reflection |

### Provider-Specific Options

#### OpenAI
- `model`: `'gpt-4'` (default)
- `temperature`: `0.7`
- `maxTokens`: `1000`
- `baseUrl`: OpenAI API endpoint

#### Anthropic
- `model`: `'claude-3-5-sonnet-20241022'` (default)
- `temperature`: `0.7`
- `maxTokens`: `1000`
- `baseUrl`: Anthropic API endpoint

#### Ollama
- `model`: `'llama2'` (default)
- `baseUrl`: `'http://localhost:11434'` (default)
- `timeout`: Connection timeout in milliseconds

## 🛠️ Advanced Usage

### Custom Configuration

```typescript
const ai = new MemoriAI({
  databaseUrl: 'file:./enterprise.db',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic',
  namespace: 'enterprise-app'
});
```

### Validation and Error Handling

```typescript
import { MemoriAIConfig } from 'memorits';

const config: MemoriAIConfig = {
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
};

// MemoriAI validates configuration automatically on creation
try {
  const ai = new MemoriAI(config);
} catch (error) {
  console.error('Configuration error:', error);
  // Handle validation errors
}
```

### Memory Management

```typescript
// Search memories
const memories = await ai.searchMemories('cats');

// Advanced search with options
const recentMemories = await ai.searchMemories('AI', {
  limit: 10,
  includeMetadata: true
});

// Search recent memories
const recent = await ai.searchRecentMemories(5);

// No need for manual statistics - search results provide all needed info
console.log(`Found ${memories.length} memories`);
```

## 🎯 Design Principles

### 1. **Unified API**
```typescript
// ✅ One class handles everything
new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: 'sk-...',
  provider: 'openai',
  mode: 'automatic'
});

// ❌ No wrapper classes needed
```

### 2. **Direct Provider Integration**
```typescript
// ✅ MemoriAI handles provider communication directly
const ai = new MemoriAI({
  provider: 'openai',
  model: 'gpt-4'
});

// ❌ No separate provider wrapper instances
```

### 3. **Mode-Based Operation**
```typescript
// ✅ Choose your memory processing strategy
{
  mode: 'automatic',    // Auto-record everything
  mode: 'manual',       // Manual control
  mode: 'conscious'     // Advanced reflection
}

// ❌ No complex configuration objects
```

### 4. **Simple Configuration**
```typescript
// ✅ Everything in one place
{
  databaseUrl: 'file:./memori.db',
  apiKey: 'sk-...',
  provider: 'openai',
  mode: 'automatic'
}

// ❌ No nested provider configurations
```

## 🚨 Error Handling

### Common Errors and Solutions

```typescript
try {
  const ai = new MemoriAI({
    databaseUrl: 'file:./memori.db',
    apiKey: process.env.OPENAI_API_KEY,
    provider: 'openai',
    mode: 'automatic'
  });
} catch (error) {
  if (error.message.includes('databaseUrl')) {
    console.error('Check your database connection string format');
  }

  if (error.message.includes('apiKey')) {
    console.error('Verify your API key format');
  }

  if (error.message.includes('provider')) {
    console.error('Choose a valid provider: openai, anthropic, or ollama');
  }
}
```

### Configuration Validation

```typescript
// MemoriAI validates configuration automatically
try {
  const ai = new MemoriAI({
    databaseUrl: 'file:./memori.db',
    apiKey: 'sk-...',
    provider: 'openai'
  });
} catch (error) {
  console.error('Configuration error:', error.message);
  // Handle missing required fields, invalid formats, etc.
}
```

## 📊 Performance Tips

### 1. **Instance Reuse**
```typescript
// ✅ Reuse MemoriAI instances
const ai = new MemoriAI(config);

// ❌ Don't create new instances for each operation
```

### 2. **Efficient Searching**
```typescript
// ✅ Use specific search terms and filters
const memories = await ai.searchMemories('specific topic', {
  limit: 10,
  minImportance: 'medium'
});

// ✅ Use recent memories for current context
const recent = await ai.searchRecentMemories(5);
```

### 3. **Mode Selection**
```typescript
// ✅ Choose appropriate mode for your use case
const ai = new MemoriAI({
  // ... config,
  mode: 'automatic'  // For most applications
  // mode: 'manual'     // For fine-grained control
  // mode: 'conscious'  // For advanced reflection
});
```

## 🔧 Troubleshooting

### Common Issues

**"Database connection failed"**
- Check your `databaseUrl` format (use `file:./memori.db` for SQLite)
- Ensure database file path is writable
- Verify PostgreSQL server is running (if using PostgreSQL)

**"Invalid API key"**
- Verify API key format for your provider
- Check if key has required permissions
- Ensure key hasn't expired

**"Memory recording failed"**
- Verify database connection and permissions
- Check provider configuration (model, baseUrl)
- Ensure sufficient disk space for database

### Debug Information

```typescript
// Enable debug logging in your environment
process.env.DEBUG = 'memori:*';

// Check MemoriAI configuration
const config = ai.getConfig?.();
console.log('Current configuration:', config);
```

## 📝 Next Steps

1. **Read the Examples**: Check `examples/basic-usage.ts` for copy-paste code
2. **Run the Tests**: Execute `npm test` to see the API in action
3. **Explore Advanced Features**: Check `src/core/MemoriAI.ts` for additional methods
4. **Customize Configuration**: Adjust memory modes and provider settings as needed

## 💡 Key Benefits

- **🎯 Simplicity**: One unified class for everything
- **🔗 Direct Integration**: No wrapper classes needed
- **🚀 Performance**: Optimized for speed and reliability
- **🛡️ Reliability**: Comprehensive error handling and validation
- **📚 Clarity**: Self-documenting API design

---

**Ready to build amazing AI applications with memory? Start with the basic example above and explore the possibilities!**