# Getting Started with Memorits

This guide will get you up and running with Memorits in minutes. Follow these simple steps to add memory capabilities to your AI application.

## Prerequisites

- **Node.js 18+** - For running Memorits
- **OpenAI API Key** - For LLM-powered memory processing (or Ollama for local models)
- **Basic TypeScript Knowledge** - To understand the examples

## Installation

Install Memorits using npm:

```bash
npm install memorits
```

## Quick Start (5 minutes)

### 1. Basic Setup

```typescript
import { Memori, OpenAIWrapper } from 'memorits';

// Create Memori instance (simple configuration)
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  apiKey: 'your-openai-api-key',
  autoMemory: true
});

// Wrap with provider (direct integration)
const openai = new OpenAIWrapper(memori);

// Use normally - memory happens automatically
const response = await openai.chat({
  messages: [{ role: 'user', content: 'Hello! I am a software engineer who loves TypeScript.' }]
});

console.log('Response:', response.content);
console.log('Memorits is ready!');
```

### 2. Search Memories

```typescript
// Search for relevant memories
const memories = await memori.searchMemories('TypeScript', {
  limit: 5
});

console.log(`Found ${memories.length} relevant memories`);
```

### 3. Basic Memory Search

```typescript
// Search for relevant memories
const relevantMemories = await memori.searchMemories('TypeScript', {
  limit: 5,
  minImportance: 'medium'
});

console.log(`Found ${relevantMemories.length} relevant memories`);
```

### 4. Multiple Providers (Optional)

Use different AI providers with the same memory pool:

```typescript
import { Memori, OpenAIWrapper, AnthropicWrapper } from 'memorits';

// Same Memori instance, different providers
const memori = new Memori({
  databaseUrl: 'postgresql://localhost:5432/memori',
  namespace: 'multi-provider-app',
  apiKey: 'your-api-key',
  autoMemory: true
});

const openai = new OpenAIWrapper(memori);
const claude = new AnthropicWrapper(memori);

// Both record to the same memory
await openai.chat({ messages: [{ role: 'user', content: 'From OpenAI' }] });
await claude.chat({ messages: [{ role: 'user', content: 'From Claude' }] });

// Search across all conversations
const memories = await memori.searchMemories('AI');
```

## Configuration Options

### Environment Variables (Recommended)

Create a `.env` file in your project root:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Memory Configuration
DATABASE_URL=sqlite:./memories.db
```

### Simple Configuration

```typescript
import { Memori } from 'memorits';

const memori = new Memori({
  databaseUrl: 'sqlite:./my-memories.db',
  namespace: 'my-app',
  apiKey: 'your-openai-api-key',
  autoMemory: true
});
```

## Memory Modes

### Auto Memory Mode (Default)

**Best for**: Most applications that need automatic memory recording.

```typescript
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  apiKey: 'your-api-key',
  autoMemory: true,        // Enable automatic memory recording
  consciousMemory: false   // Disable conscious processing
});
```

### Conscious Memory Mode

**Best for**: Applications needing background memory processing.

```typescript
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  apiKey: 'your-api-key',
  autoMemory: false,       // Disable automatic recording
  consciousMemory: true    // Enable conscious processing
});
```

### Combined Mode

**Best for**: Maximum intelligence with both memory modes.

```typescript
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  apiKey: 'your-api-key',
  autoMemory: true,        // Enable both modes
  consciousMemory: true
});
```

## Testing Your Setup

### 1. Use the Provider Wrapper

```typescript
import { OpenAIWrapper } from 'memorits';

const openai = new OpenAIWrapper(memori);

// Chat normally - memory is recorded automatically
const response = await openai.chat({
  messages: [
    { role: 'user', content: 'I am building an AI assistant for developers' }
  ]
});

console.log('Chat ID for memory:', response.chatId);
```

### 2. Search for Memories

```typescript
// Search for relevant memories
const memories = await memori.searchMemories('AI assistant', {
  limit: 5
});

console.log('Found memories:', memories.length);
memories.forEach(memory => {
  console.log(`- ${memory.metadata?.summary} (${memory.score})`);
});
```

### 3. Verify Database

Check that memories are being stored:

```bash
# View database with Prisma Studio (recommended)
npx prisma studio --schema=./prisma/schema.prisma

# Or check the SQLite database directly
sqlite3 ./memories.db "SELECT COUNT(*) FROM chat_history;"
sqlite3 ./memories.db "SELECT COUNT(*) FROM long_term_memory;"

# View recent conversations
sqlite3 ./memories.db "SELECT userInput, aiOutput, createdAt FROM chat_history ORDER BY createdAt DESC LIMIT 5;"

# View processed memories
sqlite3 ./memories.db "SELECT summary, classification, importanceScore FROM long_term_memory ORDER BY createdAt DESC LIMIT 5;"
```

## Common Issues and Solutions

### "No API key found" Error

**Solution**: Set your OpenAI API key:

```bash
export OPENAI_API_KEY="your-key-here"
# or
echo 'OPENAI_API_KEY=your-key-here' > .env
```

### "Database connection failed" Error

**Solution**: Check database permissions and path:

```typescript
const config = MemoriConfigSchema.parse({
  databaseUrl: 'sqlite:./memories.db'  // Ensure directory is writable
});
```

### Memory Search Returns Empty Results

**Solution**: Wait for background processing and check configuration:

```typescript
// Ensure memory processing is enabled
const memori = new Memori({
  databaseUrl: 'sqlite:./memories.db',
  namespace: 'my-app',
  apiKey: 'your-api-key',
  autoMemory: true  // Enable memory processing
});
```

## Next Steps

Now that you have Memorits running:

1. **Explore Search Features**: Try different search queries and filtering options
2. **Customize Configuration**: Adjust memory modes for your use case
3. **Build Your Application**: Integrate memory into your AI features
4. **Monitor Performance**: Track memory usage and search performance

## Getting Help

- **📖 [Core Concepts](core-concepts/memory-management.md)** - Understand memory modes
- **🔍 [Search Strategies](core-concepts/search-strategies.md)** - Learn advanced search
- **🏗️ [Architecture](architecture/system-overview.md)** - Deep dive into system design and data flow
- **💡 [Examples](examples/basic-usage.md)** - See practical examples
- **🐛 [Report Issues](https://github.com/mrorigo/memorits/issues)** - Get help from community

Ready to build memory-enabled AI applications? You're all set! 🚀