# Memori TypeScript AI Assistant Guide

This document provides essential context for AI agents working with the Memori TypeScript codebase.

## Project Overview

Memori is a conversational memory management system that captures, processes, and retrieves conversational context using Large Language Models (LLMs). This is a TypeScript port of the original Python project by GibsonAI.

### Key Components

- `Memori` (`src/core/Memori.ts`): Main class orchestrating memory management
- `MemoryAgent` (`src/core/agents/MemoryAgent.ts`): Handles memory processing and classification
- `ConsciousAgent` (`src/core/agents/ConsciousAgent.ts`): Optional component for conscious memory ingestion
- `DatabaseManager` (`src/core/database/DatabaseManager.ts`): Manages Prisma-based data persistence
- `OpenAIProvider` (`src/core/providers/OpenAIProvider.ts`): LLM integration layer

### Architecture Patterns

- **Dual Ingestion Modes**: Supports both direct and conscious memory ingestion
- **Provider Pattern**: Abstracts LLM interactions through provider interfaces
- **Event-based Logging**: Structured logging with component and context metadata
- **Type-Safe Architecture**: Uses Zod schemas for runtime type validation

## Development Workflow

### Environment Setup
```bash
npm install        # Install dependencies
npm run build     # Build TypeScript
npm run dev       # Watch mode development
```

### Database Operations
```bash
npm run prisma:generate  # Generate Prisma client
npm run prisma:push     # Update database schema
npm run prisma:studio   # Open Prisma data browser
```

### Testing
```bash
npm test          # Run all tests
npm run test:watch  # Watch mode for tests
```

## Project Conventions

### Code Organization
- Core logic in `src/core/`
- Integration tests in `tests/integration/`
- Unit tests in `tests/unit/`
- Usage examples in `examples/`

### Testing Patterns
- Integration tests use temporary SQLite databases
- Test files follow `*.test.ts` naming
- Database cleanup in afterEach blocks

### Logging Standards
- Use structured logging with component context
- Log levels: info, error (from `core/utils/Logger.ts`)
- Include relevant metadata in log context

## Integration Points

### OpenAI Integration
- Configure via environment variables or config object
- Supports custom base URLs for API proxies
- See `examples/openai-integration.ts` for usage

### Database Integration
- SQLite for development/testing
- Prisma ORM for database operations
- Schema defined in `prisma/schema.prisma`

## Common Workflows

1. **Adding a New Feature**:
   - Add types to `src/core/types/`
   - Implement feature in relevant component
   - Add tests following existing patterns
   - Update examples if needed

2. **Running Tests**:
   - Ensure database schema is up-to-date
   - Tests automatically create/cleanup temp databases
   - Check `tests/integration/database/DatabaseManager.test.ts` for example

3. **Debugging**:
   - Check logs in `logs/` directory
   - Use Prisma Studio for database inspection
   - See examples directory for working implementations