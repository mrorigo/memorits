# Getting Started with Memorits

This guide will get you up and running with Memorits in minutes. Follow these simple steps to add memory capabilities to your AI application.

## Prerequisites

- **Node.js 18+** - For running Memorits
- **LLM Provider** - OpenAI API key, Anthropic API key, or Ollama for local models
- **Basic TypeScript Knowledge** - To understand the examples

## Installation

Install Memorits using npm:

```bash
npm install memorits
```

## Quick Start (5 minutes)

### 1. Basic Setup

```typescript
import { MemoriAI } from 'memorits';

// Create MemoriAI instance (handles everything directly)
const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});

// Use directly - no wrapper needed
const response = await ai.chat({
  messages: [{ role: 'user', content: 'Hello! I am a software engineer who loves TypeScript.' }]
});

console.log('Response:', response.message.content);
console.log('Memorits is ready!');
```

### 2. Search Memories

```typescript
// Search for relevant memories
const memories = await ai.searchMemories('TypeScript', {
  limit: 5
});

console.log(`Found ${memories.length} relevant memories`);
```

### 3. Advanced Memory Search

```typescript
// Search for relevant memories with filtering
const relevantMemories = await ai.searchMemories('TypeScript', {
  limit: 5,
  minImportance: 'medium'
});

console.log(`Found ${relevantMemories.length} relevant memories`);
```

### 4. Multiple Providers (Optional)

Use different AI providers with the same memory pool:

```typescript
import { MemoriAI } from 'memorits';

// Create multiple MemoriAI instances with different providers
const openaiAI = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});

const ollamaAI = new MemoriAI({
  databaseUrl: 'file:./memori.db',  // Same database for shared memory
  apiKey: 'ollama-local',
  baseUrl: 'http://localhost:11434/v1',
  model: 'llama2:7b',
  provider: 'ollama',
  mode: 'automatic'
});

// Both record to the same memory pool
await openaiAI.chat({ messages: [{ role: 'user', content: 'From OpenAI' }] });
await ollamaAI.chat({ messages: [{ role: 'user', content: 'From Ollama' }] });

// Search across all conversations
const memories = await openaiAI.searchMemories('AI');
```

## Configuration Options

### Environment Variables (Recommended)

Create a `.env` file in your project root:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here

# Memory Configuration
DATABASE_URL=file:./memori.db
```

### Simple Configuration

```typescript
import { MemoriAI } from 'memorits';

const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here',
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});
```

## Memory Modes

### Automatic Mode (Default)

**Best for**: Most applications that need automatic memory recording.

```typescript
const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'  // Automatic memory recording and processing
});
```

### Manual Mode

**Best for**: Applications needing manual control over memory processing.

```typescript
const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'manual'  // Manual control over memory recording
});
```

### Conscious Mode

**Best for**: Applications needing advanced background memory processing.

```typescript
const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'conscious'  // Advanced background processing with human-like reflection
});
```

## Testing Your Setup

### 1. Use MemoriAI Directly

```typescript
// MemoriAI handles everything - no wrapper needed
const response = await ai.chat({
  messages: [
    { role: 'user', content: 'I am building an AI assistant for developers' }
  ]
});

console.log('Response:', response.message.content);
console.log('Memories recorded automatically');
```

### 2. Search for Memories

```typescript
// Search for relevant memories
const memories = await ai.searchMemories('AI assistant', {
  limit: 5
});

console.log('Found memories:', memories.length);
memories.forEach(memory => {
  console.log(`- ${memory.content?.substring(0, 100)}... (${memory.score})`);
});
```

### 3. Verify Database

Check that memories are being stored:

```bash
# View database with Prisma Studio (recommended)
npx prisma studio --schema=./prisma/schema.prisma

# Or check the SQLite database directly
sqlite3 ./memori.db "SELECT COUNT(*) FROM chat_history;"
sqlite3 ./memori.db "SELECT COUNT(*) FROM long_term_memory;"

# View recent conversations
sqlite3 ./memori.db "SELECT userInput, aiOutput, createdAt FROM chat_history ORDER BY createdAt DESC LIMIT 5;"

# View processed memories
sqlite3 ./memori.db "SELECT searchableContent, classification, importanceScore FROM long_term_memory ORDER BY createdAt DESC LIMIT 5;"
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
const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',  // Ensure directory is writable
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'
});
```

### Memory Search Returns Empty Results

**Solution**: Wait for background processing and check configuration:

```typescript
// Ensure memory processing is enabled
const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'  // Enable automatic memory processing
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