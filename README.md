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

- 100% type safety with TypeScript + Zod + Prisma
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

// Search memories
const memories = await memori.searchMemories('world', 5);
```

## API Reference

See detailed API documentation in `docs/API.md` or visit the [project repository](https://github.com/mrorigo/memorits).

## Development

- Run tests: `npm test`
- Watch tests: `npm run test:watch`
- Lint code: `npm run lint`
- Database studio: `npm run prisma:studio`