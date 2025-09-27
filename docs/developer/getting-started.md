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
import { Memori, ConfigManager, createMemoriOpenAI } from 'memorits';

// Initialize with default configuration
const config = ConfigManager.loadConfig();
const memori = new Memori(config);

// Enable memory processing
await memori.enable();
console.log('Memorits is ready!');
```

### 2. OpenAI Integration

```typescript
// Replace your OpenAI client with MemoriOpenAI
const openaiClient = createMemoriOpenAI(memori, config.apiKey);

// Use normally - conversations are automatically recorded!
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'Remember: I am a software engineer who loves TypeScript.' }
  ],
});

// Search for memories
const memories = await memori.searchMemories('software engineer', {
  minImportance: 'high'
});
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

## Configuration Options

### Environment Variables (Recommended)

Create a `.env` file in your project root:

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-openai-api-key-here
OPENAI_BASE_URL=https://api.openai.com/v1

# Memory Configuration
MEMORI_DATABASE_URL=sqlite:./memories.db
MEMORI_NAMESPACE=default
MEMORI_MODEL=gpt-4o-mini

# Memory Modes
MEMORI_AUTO_INGEST=true
MEMORI_CONSCIOUS_INGEST=false
```

### Programmatic Configuration

```typescript
import { MemoriConfigSchema } from 'memorits';

const config = MemoriConfigSchema.parse({
  databaseUrl: 'sqlite:./my-memories.db',
  namespace: 'my-app',
  model: 'gpt-4o-mini',
  autoIngest: true,
  consciousIngest: false
});

const memori = new Memori(config);
```

## Memory Modes Explained

### Auto-Ingestion Mode (Default)

**Best for**: Most applications that need dynamic memory retrieval.

- **How it works**: Every conversation is processed and stored
- **Search behavior**: Dynamic search triggered by each query
- **Performance**: Optimized for real-time applications
- **Use case**: Chat applications, assistants, general AI apps

```typescript
const config = MemoriConfigSchema.parse({
  autoIngest: true,
  consciousIngest: false
});
```

### Conscious Processing Mode

**Best for**: Applications needing persistent context and background learning.

- **How it works**: Background processing with human-like reflection
- **Search behavior**: One-shot context injection at startup
- **Performance**: Background processing, minimal runtime overhead
- **Use case**: Personal assistants, long-term memory applications

```typescript
const config = MemoriConfigSchema.parse({
  autoIngest: false,
  consciousIngest: true
});
```

### Combined Mode

**Best for**: Maximum intelligence with both dynamic and persistent memory.

```typescript
const config = MemoriConfigSchema.parse({
  autoIngest: true,
  consciousIngest: true
});
```

## Testing Your Setup

### 1. Record Some Conversations

```typescript
// Record a conversation
const chatId = await memori.recordConversation(
  'I am building an AI assistant for developers',
  'Great! I\'ll help you build an AI assistant. What kind of features do you need?',
  'gpt-4o-mini'
);

console.log('Recorded conversation:', chatId);
```

### 2. Search for Memories

```typescript
// Wait a moment for processing, then search
setTimeout(async () => {
  const memories = await memori.searchMemories('AI assistant', {
    limit: 5
  });

  console.log('Found memories:', memories.length);
  memories.forEach(memory => {
    console.log(`- ${memory.metadata.summary} (${memory.score})`);
  });
}, 2000);
```

### 3. Verify Database

Check that memories are being stored:

```bash
# View database with Prisma Studio (if installed globally)
npx prisma studio --schema=./node_modules/memorits/prisma/schema.prisma

# Or check the SQLite database directly
sqlite3 ./memories.db "SELECT COUNT(*) FROM long_term_memory;"
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
const config = MemoriConfigSchema.parse({
  autoIngest: true,  // Enable memory processing
  model: 'gpt-4o-mini'  // Ensure model is available
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
- **🏗️ [Architecture](architecture/system-overview.md)** - Deep dive into system design
- **💡 [Examples](examples/basic-usage.md)** - See practical examples
- **🐛 [Report Issues](https://github.com/mrorigo/memorits/issues)** - Get help from community

Ready to build memory-enabled AI applications? You're all set! 🚀