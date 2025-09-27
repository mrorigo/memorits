<img src="docs/memorits.jpg">

# 🎯 Memorits: Type-Safe Memory Engine for AI Conversations

**Transform AI conversations from fleeting interactions into persistent, searchable knowledge bases.**

Memorits gives your AI applications perfect recall - automatically capturing, classifying, and retrieving conversational context with enterprise-grade type safety and lightning-fast search capabilities.

<div align="center">
  <p>
    <strong>🚀 Ready to remember everything? Install now:</strong>
  </p>
  <code>npm install memorits</code>
</div>

---

## Why Memorits?

**AI conversations are ephemeral.** Every chat, every insight, every breakthrough moment vanishes into the digital ether - unless you have Memorits.

### 💪 What Memorits Does

- **🔍 Perfect Recall**: Never lose context again. Search through conversation history with surgical precision
- **🎯 Intelligent Classification**: Automatically categorize memories by importance and type - from critical business logic to casual conversation
- **⚡ Lightning Fast**: Sub-millisecond search through thousands of memories using optimized SQLite backend
- **🔒 Type Safe**: 100% TypeScript coverage with compile-time validation - catch errors before they happen
- **🤖 OpenAI Drop-in Replacement**: Zero breaking changes - existing OpenAI code works unchanged
- **🧠 Dual Memory Modes**: Choose between conscious processing or automated background ingestion

### 🎯 Perfect For

- **AI Agents** that need to maintain context across sessions
- **Chat Applications** requiring conversation history and learning
- **Research Assistants** that build knowledge bases from interactions
- **Customer Support** systems that learn from every interaction
- **Personal AI** companions that remember your preferences and history

---

## Quick Start

### 1. Install & Setup (30 seconds)

```bash
npm install memorits
```

### 2. Initialize with OpenAI

```typescript
import { Memori, ConfigManager, createMemoriOpenAI } from 'memorits';

const config = ConfigManager.loadConfig();
const memori = new Memori(config);
await memori.enable();

// Replace your OpenAI client - conversations auto-recorded!
const openaiClient = createMemoriOpenAI(memori, config.apiKey);

// Use normally - everything gets remembered
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }],
});
```

### 3. Search & Retrieve

```typescript
// Find critical information instantly
const importantMemories = await memori.searchMemories('urgent meeting notes', {
  minImportance: 'high',
  limit: 10
});

// Get technical context only
const technicalMemories = await memori.searchMemories('API documentation', {
  categories: ['essential', 'reference']
});
```

**That's it!** Your AI now has perfect memory with zero configuration.

---

## OpenAI Drop-in Replacement

**Transform your existing OpenAI code into a memory-enabled powerhouse with zero breaking changes.**

### Why Use the Drop-in Replacement?

- **Zero Code Changes**: Existing OpenAI code works unchanged
- **Automatic Memory**: Conversations are recorded transparently
- **Multiple Patterns**: From simple to advanced initialization
- **Full Compatibility**: Exact OpenAI SDK v5.x API match
- **Streaming Support**: Complete memory capture for streaming responses

### Quick Migration (30 seconds)

**Before (standard OpenAI):**
```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello world!' }]
});
```

**After (MemoriOpenAI drop-in):**
```typescript
import { MemoriOpenAI } from 'memorits';

const client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  autoInitialize: true
});

// Same API, now with memory!
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }]
});

// Search through conversation history
const memories = await client.memory.searchMemories('world');
```

### Initialization Patterns

#### Pattern 1: Simple Constructor (Most Common)

```typescript
import { MemoriOpenAI } from 'memorits';

// Simple replacement - existing code works unchanged
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  autoInitialize: true
});

// Use exactly like OpenAI client
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello, remember this!' }]
});

// Memory automatically recorded
const memories = await client.memory.searchMemories('Hello');
```

#### Pattern 2: Environment Configuration

```typescript
// Configure via environment variables
const client = await MemoriOpenAIFromEnv('your-api-key', {
  enableChatMemory: true,
  memoryProcessingMode: 'conscious'
});

// Environment variables:
// OPENAI_API_KEY=your-key
// MEMORI_DATABASE_URL=sqlite:./memories.db
// MEMORI_PROCESSING_MODE=conscious
```

#### Pattern 3: Database URL

```typescript
// Direct database specification
const client = await MemoriOpenAIFromDatabase(
  'your-api-key',
  'postgresql://localhost/memories',
  {
    enableChatMemory: true,
    enableEmbeddingMemory: false
  }
);
```

#### Pattern 4: Advanced Configuration

```typescript
const client = await MemoriOpenAIFromConfig('your-api-key', {
  enableChatMemory: true,
  enableEmbeddingMemory: true,
  memoryProcessingMode: 'conscious',
  databaseUrl: 'sqlite:./advanced.db',
  namespace: 'my-session',
  minImportanceLevel: 'medium',
  autoIngest: false,
  consciousIngest: true,
  bufferTimeout: 30000,
  maxBufferSize: 50000
});
```

### Advanced Usage Examples

#### Streaming with Memory

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Tell me a long story...' }],
  stream: true
});

let fullContent = '';
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  fullContent += content;
  process.stdout.write(content); // Your streaming logic here
}

// Memory is automatically recorded when streaming completes
console.log(`\n\nMemory recorded: ${fullContent.length} characters`);
```

#### Memory Search and Retrieval

```typescript
// Search with filters
const importantMemories = await client.memory.searchMemories('urgent', {
  limit: 10,
  minImportance: 'high',
  categories: ['essential', 'contextual']
});

// Get memory statistics
const stats = await client.memory.getMemoryStats();
console.log(`Total memories: ${stats.totalMemories}`);
console.log(`Conscious memories: ${stats.consciousMemories}`);
```

#### Memory Operations

```typescript
// Record specific conversations
const result = await client.memory.recordChatCompletion(
  chatParams,
  response,
  { category: 'essential', importance: 'high' }
);

if (result.success) {
  console.log(`Memory recorded with ID: ${result.chatId}`);
} else {
  console.error(`Recording failed: ${result.error}`);
}
```

### Configuration Options

```typescript
interface MemoriOpenAIConfig {
  // Core functionality
  enableChatMemory?: boolean;           // Enable chat memory recording
  enableEmbeddingMemory?: boolean;      // Enable embedding memory recording
  memoryProcessingMode?: 'auto' | 'conscious' | 'none';

  // Initialization
  autoInitialize?: boolean;             // Auto-create Memori instance
  databaseConfig?: DatabaseConfig;      // Database configuration
  namespace?: string;                   // Memory namespace

  // Memory filtering
  minImportanceLevel?: MemoryImportanceFilter;
  maxMemoryAge?: number;                // Days to keep memories
  autoIngest?: boolean;                 // Auto vs conscious ingestion

  // Performance tuning
  bufferTimeout?: number;               // Streaming buffer timeout (ms)
  maxBufferSize?: number;               // Max streaming buffer size (chars)

  // OpenAI client options
  apiKey?: string;                      // Override API key
  baseUrl?: string;                     // Override base URL
  organization?: string;                // Organization ID
  project?: string;                     // Project ID
  timeout?: number;                     // Request timeout
  maxRetries?: number;                  // Maximum retries
}
```

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_ORGANIZATION=your-org-id
OPENAI_PROJECT=your-project-id

# Memory Configuration
MEMORI_DATABASE_URL=sqlite:./memories.db
MEMORI_NAMESPACE=default
MEMORI_PROCESSING_MODE=auto
MEMORI_AUTO_INGEST=true
MEMORI_CONSCIOUS_INGEST=false
MEMORI_MIN_IMPORTANCE=low
MEMORI_MAX_AGE=30

# Performance Configuration
MEMORI_BUFFER_TIMEOUT=30000
MEMORI_MAX_BUFFER_SIZE=50000
MEMORI_BACKGROUND_INTERVAL=30000
```

### Error Handling

Memory errors are handled gracefully and don't break OpenAI functionality:

```typescript
try {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello!' }],
  });
} catch (error) {
  // OpenAI errors are preserved exactly as they would be
  // Memory recording errors are logged but don't affect the response
  console.error('OpenAI error:', error);
  }
  ```
  
---

## Migration Guide

### Quick Migration (3 lines)

```typescript
// Replace this
import OpenAI from 'openai';
const client = new OpenAI({ apiKey });

// With this
import { MemoriOpenAI } from 'memorits';
const client = new MemoriOpenAI(apiKey, { enableChatMemory: true });
```

**✅ Zero breaking changes** - Your existing OpenAI code works unchanged!**

---


## Key Features

### 🔍 Advanced Search & Filtering

- **Importance-based filtering**: Prioritize critical, high, medium, or low importance memories
- **Category filtering**: Filter by essential, contextual, conversational, reference, personal, or conscious-info
- **Metadata inclusion**: Get rich context with timestamps, sources, and relationships
- **Full-text search**: Lightning-fast search across all memory content

### 🛡️ Enterprise-Grade Type Safety

- **100% TypeScript coverage** with compile-time validation
- **15+ Clean Interfaces** replacing inline types for better maintainability
- **Self-documenting APIs** with clear method signatures
- **Zod validation** for runtime type checking
- **Prisma ORM** for type-safe database operations

### 🤖 Seamless OpenAI Integration

- **Drop-in replacement** for OpenAI client
- **Automatic memory recording** - no manual intervention needed
- **Structured memory processing** with intelligent classification
- **Dual memory modes**: conscious processing vs. automated ingestion

### ⚡ Performance Optimized

- **SQLite backend** for fast local development and testing
- **Optimized queries** with proper indexing and relationships
- **Memory-efficient processing** for large conversation histories
- **Background processing** for non-blocking memory ingestion

---

## Real-World Example

Imagine building an AI coding assistant that remembers your entire codebase context:

```typescript
// Your AI assistant now remembers every discussion about your codebase
const architectureDecisions = await memori.searchMemories('database schema decisions', {
  categories: ['essential'],
  minImportance: 'high'
});

// It knows your preferences and patterns
const stylePreferences = await memori.searchMemories('coding style preferences', {
  categories: ['personal']
});

// It maintains context across sessions
const previousDiscussions = await memori.searchMemories('authentication system', {
  limit: 20
});
```

**Result**: Your AI assistant becomes exponentially more valuable as it accumulates knowledge about your projects, preferences, and working patterns.

---

## Architecture

Memorits is built on proven, enterprise-ready technologies:

- **TypeScript 5.9+** for type safety and modern JavaScript features
- **Prisma ORM** for type-safe database operations
- **SQLite** for fast, reliable local storage
- **Zod** for runtime type validation
- **OpenAI SDK** for seamless AI integration
- **Winston** for comprehensive logging

---

## Dual Attribution

**This project represents a dual attribution collaboration:**

### Original Library Attribution
**This project is a TypeScript port of the original [Memori Python project](https://github.com/GibsonAI/memori) created by GibsonAI.**

- **Original Authors**: Harshal More, harshalmore2468@gmail.com
- **Organization**: GibsonAI Team, noc@gibsonai.com
- **Original Repository**: [https://github.com/GibsonAI/memori](https://github.com/GibsonAI/memori)
- **License**: [Apache License 2.0](LICENSE)
- **Documentation**: [https://memori.gibsonai.com/docs](https://memori.gibsonai.com/docs)

### Port Attribution
**This specific TypeScript port was created by @mrorigo with AI assistance from Roo Code using the code-supernova model.**

- **Port Author**: mrorigo
- **AI Assistant**: Roo Code (code-supernova model)
- **Repository**: [https://github.com/mrorigo/memorits](https://github.com/mrorigo/memorits)
- **NPM Package**: [https://npmjs.com/package/memorits](https://npmjs.com/package/memorits)

This TypeScript port maintains compatibility with the original Apache License 2.0 and preserves the core functionality and architecture of the original implementation while leveraging TypeScript's type safety and modern JavaScript ecosystem.

---

## Developer Documentation

📚 **[Comprehensive Developer Guide](docs/developer/index.md)** - Complete architecture overview, implementation details, and advanced usage patterns.

### Key Developer Resources:
- **[Core Concepts](docs/developer/core-concepts/)** - Memory management, search strategies, and classification systems
- **[Architecture Deep Dive](docs/developer/architecture/)** - System design, database layer, and search engine implementation
- **[Advanced Features](docs/developer/advanced-features/)** - Temporal filtering, metadata processing, and conscious memory
- **[API Reference](docs/developer/api-reference/)** - Detailed interface documentation and usage examples
- **[Integration Guides](docs/developer/integrations/)** - OpenAI integration patterns and custom provider development

---

## API Reference

📚 **[Complete API Documentation](docs/developer/api/core-api.md)** - Comprehensive API reference with detailed examples.

---

## Development

```bash
# Run tests
npm test

# Watch tests during development
npm run test:watch

# Lint code
npm run lint

# Database management
npm run prisma:studio

# Run examples
npm run example:openai
npm run example:ollama
npm run example:search
```

---

<div align="center">
  <p>
    <strong>Ready to give your AI perfect memory?</strong>
  </p>
  <p>
    <a href="#quick-start">Get Started</a> •
    <a href="https://github.com/mrorigo/memorits">View on GitHub</a> •
    <a href="https://npmjs.com/package/memorits">Install from NPM</a>
  </p>
</div>

## Quick Start

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment:
   ```bash
   cp .env.example .env
   # Edit .env with your OpenAI API key
   ```

3. Initialize database:
   ```bash
   npm run prisma:push
   ```

4. Build and run:
   ```bash
   npm run build
   npm start
   ```

## Usage

```typescript
import { Memori, ConfigManager, createMemoriOpenAI } from 'memorits';

const config = ConfigManager.loadConfig();
const memori = new Memori(config);

await memori.enable();

// Create OpenAI client with automatic memory recording
const openaiClient = createMemoriOpenAI(memori, config.apiKey);

// Use normally - conversations are automatically recorded
const response = await openaiClient.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello world!' }],
});

// Search memories with advanced options
const memories = await memori.searchMemories('world', {
  limit: 5,
  minImportance: 'high',
  categories: ['essential', 'contextual']
});

// Search with basic options
const basicSearch = await memori.searchMemories('world', { limit: 10 });

// Advanced search with filtering
const filteredMemories = await memori.searchMemories('programming', {
  limit: 20,
  minImportance: 'high', // Only show high+ importance memories
  categories: ['essential', 'contextual'], // Filter by memory categories
  includeMetadata: true // Include additional metadata
});
```

## Advanced Features

### Enhanced Search API

The search API now supports advanced filtering options:

```typescript
interface SearchOptions {
  limit?: number;                    // Number of results (default: 5)
  minImportance?: MemoryImportanceLevel; // Filter by importance level
  categories?: MemoryClassification[];   // Filter by memory categories
  includeMetadata?: boolean;         // Include additional metadata
}

// Search with importance filtering
const importantMemories = await memori.searchMemories('critical', {
  minImportance: 'high' // Only show high importance and above
});

// Search specific categories
const technicalMemories = await memori.searchMemories('code', {
  categories: ['essential', 'reference'] // Only technical memories
});
```

### Clean Interface System

Memorits now features a comprehensive interface system with:
- **15+ Clean Interfaces** replacing inline types
- **Self-documenting APIs** with clear method signatures
- **Enhanced Type Safety** with compile-time error detection
- **Better IDE Support** with rich autocomplete and IntelliSense

### Memory Classification System

```typescript
enum MemoryClassification {
  ESSENTIAL = 'essential',        // Critical information
  CONTEXTUAL = 'contextual',      // Supporting context
  CONVERSATIONAL = 'conversational', // General conversation
  REFERENCE = 'reference',        // Reference material
  PERSONAL = 'personal',          // Personal information
  CONSCIOUS_INFO = 'conscious-info' // Conscious context
}

enum MemoryImportanceLevel {
  CRITICAL = 'critical',  // Must remember
  HIGH = 'high',          // Important information
  MEDIUM = 'medium',      // Useful information
  LOW = 'low'             // Background information
}
```

## Development

- Run tests: `npm test`
- Watch tests: `npm run test:watch`
- Lint code: `npm run lint`
- Database studio: `npm run prisma:studio`