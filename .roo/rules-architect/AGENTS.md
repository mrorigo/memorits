# Architect Mode Rules (Non-Obvious Only)

- Module coupling: Provider pattern creates tight coupling between MemoryAgent and OpenAIProvider - changes require coordination
- Memory architecture: Three-tier memory system (chat -> short-term -> long-term) with automatic promotion based on scores
- Background processing: Conscious mode requires interval-based monitoring that can impact system performance
- Configuration management: Environment-based config with fallback defaults creates complex initialization paths
- Database design: Prisma schema with JSON fields requires careful migration planning to avoid data loss
- Session isolation: Each Memori instance uses sessionId for data isolation - affects multi-user scenarios
- Testing architecture: Integration tests require temporary databases - affects CI/CD pipeline design