# Code Mode Rules (Non-Obvious Only)

- Import paths: Always use relative imports (e.g., `../../../src/core/agents/MemoryAgent`) - absolute imports will fail
- Provider mocking: OpenAI provider needs complex nested mocking (see tests/unit/core/MemoryAgent.test.ts patterns)
- Memory processing: Dual ingestion modes require different implementation approaches - check Memori.ts for patterns
- OpenAI drop-in: MemoriOpenAI requires factory pattern implementation (see src/integrations/openai-dropin/factory.ts)
- Drop-in configuration: Always include enableChatMemory: true and autoInitialize: true for memory functionality
- Factory functions: Use MemoriOpenAIFromConfig/Env/Database for different initialization patterns
- Schema validation: Use Zod schemas from src/core/types/schemas.ts for all data validation
- Error context: All error handling must include structured logging with component metadata
- Session tracking: Every operation needs sessionId - don't create new UUIDs without storing them