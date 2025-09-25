# Ask Mode Rules (Non-Obvious Only)

- Configuration context: Environment variables use MEMORI_*/OPENAI_* prefixes - check ConfigManager.ts for parsing logic
- Dual ingestion modes: Auto vs conscious ingestion have different memory processing flows - see Memori.ts implementation
- Schema relationships: ChatHistory, ShortTermMemory, and LongTermMemory have complex relationships defined in Prisma schema
- Provider abstraction: OpenAI provider is abstracted - actual implementation details in src/core/providers/OpenAIProvider.ts
- Memory lifecycle: Memories transition from chat -> short-term -> long-term based on importance and access patterns
- Conscious processing: Special mode that requires background monitoring and periodic context updates