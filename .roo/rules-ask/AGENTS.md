# Ask Mode Rules (Non-Obvious Only)

- Configuration context: Environment variables use MEMORI_*/OPENAI_* prefixes - check ConfigManager.ts for parsing logic
- Dual ingestion modes: Auto vs conscious ingestion have different memory processing flows - see Memori.ts implementation
- Schema relationships: ChatHistory, ShortTermMemory, and LongTermMemory have complex relationships defined in Prisma schema
- Provider abstraction: OpenAI provider is abstracted - actual implementation details in src/core/providers/OpenAIProvider.ts
- Memory lifecycle: Memories transition from chat -> short-term -> long-term based on importance and access patterns
- Conscious processing: Special mode that requires background monitoring and periodic context updates
- OpenAI drop-in: MemoriOpenAI provides zero breaking changes replacement - see src/integrations/openai-dropin/ for implementation
- Drop-in factory patterns: Four initialization patterns available - constructor, environment, database URL, and advanced config
- Memory integration: Drop-in client includes direct memory access via client.memory.searchMemories() and other methods