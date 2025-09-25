# Memorits

A type-safe memory engine for AI conversations with OpenAI integration. **Published as 'memorits' on NPM.**

## Dual Attribution

**This project represents a dual attribution collaboration:**

### Original Library Attribution
**This project is a TypeScript port of the original [Memori Python project](https://github.com/GibsonAI/memori) created by GibsonAI.**

- **Original Authors**: Harshal More, harshalmore2468@gmail.com
- **Organization**: GibsonAI Team, noc@gibsonai.com
- **Original Repository**: [https://github.com/GibsonAI/memori](https://github.com/GibsonAI/memori)
- **License**: [Apache License 2.0](LICENSE)
- **Documentation**: [https://memori.gibsonai.com/docs](https://memori.gibsonai.com/docs)

The original Memori project is "an open-source SQL-Native memory engine for AI that uses structured entity extraction, relationship mapping, and SQL-based retrieval to create transparent, portable, and queryable AI memory with multiple agents working together for intelligent memory management."

### Port Attribution
**This specific TypeScript port was created by 'mrorigo' with AI assistance from Roo Code using the code-supernova model.**

- **Port Author**: mrorigo
- **AI Assistant**: Roo Code (code-supernova model)
- **Repository**: [https://github.com/mrorigo/memorits](https://github.com/mrorigo/memorits)
- **NPM Package**: [https://npmjs.com/package/memorits](https://npmjs.com/package/memorits)

This TypeScript port maintains compatibility with the original Apache License 2.0 and preserves the core functionality and architecture of the original implementation while leveraging TypeScript's type safety and modern JavaScript ecosystem.

## Features

- **100% type safety** with TypeScript + Zod + Prisma + Clean Interfaces
- **Advanced API interfaces** with self-documenting method signatures
- **Enhanced search capabilities** with filtering by importance and categories
- OpenAI integration with automatic memory recording
- SQLite database for easy testing and development
- Structured memory processing with classification
- Dual memory modes (conscious and auto ingestion)

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

## API Reference

See detailed API documentation in `docs/API.md` or visit the [project repository](https://github.com/mrorigo/memorits).

## Development

- Run tests: `npm test`
- Watch tests: `npm run test:watch`
- Lint code: `npm run lint`
- Database studio: `npm run prisma:studio`