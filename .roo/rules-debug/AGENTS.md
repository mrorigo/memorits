# Debug Mode Rules (Non-Obvious Only)

- Database inspection: Use `npm run prisma:studio` to inspect database state during debugging
- Test databases: Integration tests create temporary SQLite databases automatically - no manual setup needed
- Memory ingestion: Set MEMORI_AUTO_INGEST=false and MEMORI_CONSCIOUS_INGEST=true for step debugging
- Background monitoring: Default 30-second interval can be changed with setBackgroundUpdateInterval()
- Log inspection: Check logs/ directory for structured logs with component metadata
- Provider debugging: Mock OpenAI responses must match exact expected format or tests fail silently