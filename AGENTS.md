# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Lint/Test Commands

- Run tests: `npm test` (uses Jest with TypeScript support)
- Lint with auto-fix: `npm run lint:fix` (applies ESLint rules)
- Database setup: `npm run prisma:push` followed by `npm run prisma:generate` (required sequence)
- Example scripts: Use `npm run example:*` (tsx-based execution)
- Type checking: `npx tsc --noEmit` (validate types without building)

## Code Style Guidelines

- **Import strategy**: Use domain-driven imports (e.g., `../../infrastructure/config/Logger`, `../types/models`)
- **Error handling**: Use structured logging with component context (see Logger.ts patterns)
- **Type definitions**: Use interface system from types/models.ts with Zod validation
- **Interface-first**: Public APIs should use clean interfaces for IDE support
- **Module system**: CommonJS required for compatibility
- **Architecture**: Follow domain/infrastructure separation (business logic in domain/, technical concerns in infrastructure/)
- **MemoryAgent**: Use for conversation processing and memory extraction
- **Search strategies**: Implement with proper error handling and timeout management
- **State management**: Use ProcessingStateManager for memory workflow states
- **Provider integration**: Support for OpenAI, Anthropic, and Ollama providers

## Project-Specific Patterns

- **Configuration**: Environment variables must use MEMORI_*/OPENAI_* prefixes with boolean parsing for flags
- **DDD Architecture**: Follow domain/infrastructure separation - business logic in domain/, technical concerns in infrastructure/
- **Dual ingestion**: Auto vs conscious modes change memory processing behavior significantly
- **Database schema**: Prisma client must be regenerated after any schema changes, not just pushed
- **Provider pattern**: OpenAI provider requires specific mocking in tests (see test file patterns)
- **Session management**: All operations require sessionId tracking for proper memory association
- **OpenAI drop-in**: MemoriOpenAI provides zero breaking changes replacement for OpenAI SDK with automatic memory recording
- **Factory patterns**: Multiple initialization patterns (constructor, environment, database URL, advanced config) for different use cases
- **MemoryAgent Integration**: Leverage MemoryAgent for AI-powered memory processing across all LLM providers
- **AI-Powered Classification**: Use MemoryAgent for automatic categorization and importance scoring
- **Entity Extraction**: Implement entity extraction patterns for people, places, concepts, and code elements
- **Relationship Detection**: Follow MemoryAgent patterns for smart relationship identification and mapping
- **Memory relationships**: Extract relationships during MemoryAgent processing with proper confidence scoring and validation
- **Search strategies**: Implement ISearchStrategy interface with proper error handling, timeout management, and fallback mechanisms
- **Temporal search**: Enhanced searchRecentMemories API supports time windows, relative expressions, and temporal filtering
- **Filter expressions**: Use AdvancedFilterEngine for complex boolean logic with field comparisons and operators
- **State tracking**: Use ProcessingStateManager for memory workflow states with transition validation and history tracking
- **Index management**: Follow SearchIndexManager patterns for automated optimization, backup, and health monitoring
- **Consolidation logic**: Implement transaction-safe duplicate detection and merging with proper rollback capabilities

## Critical Gotchas

- **Ollama integration**: Set OPENAI_BASE_URL and use 'ollama-local' as API key (automatic dummy key assignment)
- **MemoryAgent processing**: All LLM providers now use MemoryAgent for AI-powered memory processing with classification, importance scoring, entity extraction, and relationship detection
- **Memory processing**: Conscious mode disables auto-ingestion - requires manual triggering
- **Test isolation**: Database tests create temporary SQLite instances with automatic cleanup
- **Module exports**: Main exports are in src/index.ts but actual implementation is in src/core/Memori.ts
- **Logging**: All log calls must include component metadata or will fail validation
- **OpenAI drop-in**: MemoriOpenAI requires new IProviderConfig format with memory.enableChatMemory: true and memory.memoryProcessingMode: 'auto'
- **Drop-in initialization**: Multiple factory patterns available - choose based on use case (constructor vs environment vs database URL)
- **Memory operations**: Drop-in client provides direct memory access via client.memory.searchMemories() and other methods
- **Streaming support**: Full memory capture for streaming responses with configurable buffer settings
- **Filter expressions**: AdvancedFilterEngine requires proper initialization and template registration for optimal performance
- **Search strategies**: Strategy configuration must include proper error handling and fallback mechanisms for production stability
- **Memory relationships**: Relationship extraction runs during MemoryAgent processing - ensure proper database manager initialization
- **State transitions**: ProcessingStateManager validates all state transitions - invalid transitions will throw errors
- **Index optimization**: SearchIndexManager runs automated maintenance - monitor performance impact during large operations
- **Consolidation safety**: Duplicate consolidation uses database transactions - ensure proper transaction handling in custom implementations
- **Import paths**: Use domain-driven imports (e.g., `../../infrastructure/config/Logger`, `../types/models`) following DDD separation
- **Provider configuration**: Use new IProviderConfig interface with nested memory options (memory.enableChatMemory, memory.memoryProcessingMode, memory.sessionId)
- **Session management**: All providers now use sessionId in memory configuration for proper multi-user memory isolation
- **Unified configuration**: Single IProviderConfig interface for all LLM providers (OpenAI, Anthropic, Ollama) with consistent memory options
- **MemoryAgent capabilities**: All providers share identical MemoryAgent processing for AI-powered classification, entity extraction, importance scoring, and relationship detection
- **Import restrictions**: Use static imports only - dynamic imports (import()) are prohibited and will cause module resolution issues