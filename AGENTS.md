# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Lint/Test Commands

- Run single test: `npm test -- --testPathPattern=tests/unit/core/MemoryAgent.test.ts` (uses custom Jest config with ts-jest)
- Lint with auto-fix: `npm run lint:fix` (applies different rules for tests, examples, and main code)
- Database commands: `npm run prisma:push` followed by `npm run prisma:generate` (required sequence)
- Example scripts: Use `npm run example:*` (tsx-based execution, not standard node)
- Search index management: `npm run index:health`, `npm run index:optimize`, `npm run index:backup` for advanced search features
- Memory consolidation testing: `npm run test:consolidation` for duplicate detection and merging validation

## Code Style Guidelines

- Import strategy: Use relative imports only (e.g., `../../../src/core/agents/MemoryAgent`)
- Error handling: Always use structured logging with component context (see src/core/utils/Logger.ts patterns)
- Type definitions: Use comprehensive interface system (src/core/types/models.ts) for clean APIs + Zod schemas for runtime validation
- Interface-first: All public APIs should use clean interfaces from models.ts for better IDE support
- Module system: CommonJS required (non-standard for TypeScript, affects import/export patterns)
- Memory relationships: Follow established patterns for relationship extraction, confidence scoring, and validation
- Search strategies: Implement proper error handling, timeout management, and fallback mechanisms for all search strategies
- State management: Use ProcessingStateManager for memory workflow states with proper transition validation
- Index management: Follow SearchIndexManager patterns for optimization, backup, and health monitoring

## Project-Specific Patterns

- Configuration: Environment variables must use MEMORI_*/OPENAI_* prefixes with boolean parsing for flags
- Dual ingestion: Auto vs conscious modes change memory processing behavior significantly
- Database schema: Prisma client must be regenerated after any schema changes, not just pushed
- Provider pattern: OpenAI provider requires specific mocking in tests (see test file patterns)
- Session management: All operations require sessionId tracking for proper memory association
- OpenAI drop-in: MemoriOpenAI provides zero breaking changes replacement for OpenAI SDK with automatic memory recording
- Factory patterns: Multiple initialization patterns (constructor, environment, database URL, advanced config) for different use cases
- Memory relationships: Extract relationships during MemoryAgent processing with proper confidence scoring and validation
- Search strategies: Implement ISearchStrategy interface with proper error handling, timeout management, and fallback mechanisms
- Filter expressions: Use AdvancedFilterEngine for complex boolean logic with field comparisons and operators
- State tracking: Use ProcessingStateManager for memory workflow states with transition validation and history tracking
- Index management: Follow SearchIndexManager patterns for automated optimization, backup, and health monitoring
- Consolidation logic: Implement transaction-safe duplicate detection and merging with proper rollback capabilities

## Critical Gotchas

- Ollama integration: Set OPENAI_BASE_URL and use 'ollama-local' as API key (automatic dummy key assignment)
- Memory processing: Conscious mode disables auto-ingestion - requires manual triggering
- Test isolation: Database tests create temporary SQLite instances with automatic cleanup
- Module exports: Main exports are in src/index.ts but actual implementation is in src/core/Memori.ts
- Logging: All log calls must include component metadata or will fail validation
- OpenAI drop-in: MemoriOpenAI requires specific configuration for memory recording (enableChatMemory: true, autoInitialize: true)
- Drop-in initialization: Multiple factory patterns available - choose based on use case (constructor vs environment vs database URL)
- Memory operations: Drop-in client provides direct memory access via client.memory.searchMemories() and other methods
- Streaming support: Full memory capture for streaming responses with configurable buffer settings
- Filter expressions: AdvancedFilterEngine requires proper initialization and template registration for optimal performance
- Search strategies: Strategy configuration must include proper error handling and fallback mechanisms for production stability
- Memory relationships: Relationship extraction runs during MemoryAgent processing - ensure proper database manager initialization
- State transitions: ProcessingStateManager validates all state transitions - invalid transitions will throw errors
- Index optimization: SearchIndexManager runs automated maintenance - monitor performance impact during large operations
- Consolidation safety: Duplicate consolidation uses database transactions - ensure proper transaction handling in custom implementations