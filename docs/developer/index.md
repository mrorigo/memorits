# Memorits Developer Documentation

Welcome to the Memorits developer hub. Memorits is a TypeScript-first memory engine that pairs any LLM provider with durable conversational memory, rich search tooling, and strict runtime validation. This documentation keeps you grounded in the actual codebase, so every example and reference maps directly to the implementation you will find under `src/`.

## Why Memorits?

- **Agent-Friendly Memory** – `MemoriAI` captures conversations, scores importance, and stores summaries automatically.
- **Prisma + SQLite Core** – A fully typed persistence layer with migrations managed through Prisma.
- **Provider Abstraction** – Shared MemoryAgent pipelines for OpenAI, Anthropic, and Ollama via a unified provider factory.
- **Search Engine** – FTS5, recency, metadata, temporal, and relationship strategies with configurable fallbacks.
- **Structured Logging** – All components log with component metadata, ready for production observability.
- **Type-Safe APIs** – Zod-backed schemas drive runtime validation, and all public types are exported for IDE support.

## Quick Start

Install the package:

```bash
npm install memorits
```

Create your first memory-enabled client:

```typescript
import { MemoriAI } from 'memorits';

const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY ?? 'sk-your-api-key',
  provider: 'openai',
  model: 'gpt-4o-mini',
  mode: 'automatic',            // automatic | manual | conscious
  namespace: 'support-bot'      // optional logical partition
});

const reply = await ai.chat({
  messages: [{ role: 'user', content: 'Memorits should remember that I love TypeScript.' }]
});

const memories = await ai.searchMemories('TypeScript', { limit: 5 });
```

For Ollama or custom endpoints, supply `baseUrl` and the synthetic API key (`ollama-local`) that the providers expect. The `ConfigManager` also recognises environment settings such as `DATABASE_URL`, `MEMORI_NAMESPACE`, `MEMORI_AUTO_INGEST`, and `OPENAI_BASE_URL`.

## Documentation Map

- **Foundations**
  - `getting-started.md` – installation, environment setup, and first request.
  - `basic-usage.md` – day-to-day patterns with `MemoriAI` plus pointers to advanced workflows.
  - `core-concepts/memory-management.md` – automatic vs conscious ingestion aligned with `Memori`.
  - `core-concepts/search-strategies.md` – how strategies in `src/core/domain/search` are orchestrated.

- **Architecture**
  - `architecture/system-overview.md` – code-level overview of domain and infrastructure layers.
  - `architecture/database-schema.md` – Prisma models, migration workflow, and state tracking tables.
  - `architecture/search-architecture.md` – SearchService orchestration, fallbacks, and index maintenance.

- **API Reference**
  - `api/core-api.md` – `MemoriAI`, `Memori`, configuration types, and exported helpers.
  - `api/search-api.md` – search shapes, `SearchOptions`, `searchMemoriesWithStrategy`, and recent-memory APIs.
  - `api-reference/` – supplementary deep dives (consolidation, dashboards, etc.).

- **Advanced Features**
  - `advanced-features/temporal-filtering.md` – how `TemporalFilterOptions` are applied.
  - `advanced-features/metadata-filtering.md` – AdvancedFilterEngine usage and samples.
  - `advanced-features/conscious-processing.md` – `ConsciousAgent` lifecycle driven by `Memori`.
  - `advanced-features/performance-monitoring.md` – dashboard and analytics services in `src/core/performance`.
  - `advanced-features/duplicate-management.md` – duplicate detection and consolidation helpers.

- **Integrations & Providers**
  - `integration/openai-integration.md` – OpenAI drop-in client (`MemoriOpenAI`) and provider factory patterns.
  - `providers/` – provider-specific setup notes for OpenAI, Anthropic, and Ollama.

- **Examples**
  - `examples/basic-usage.md` – walkthrough sourced from `examples/` in the repository.
  - Explore the sibling `examples/` directory for runnable TypeScript scripts (`npm run example:*`).

## Architecture Snapshot

- **Domain (`src/core/domain/`)** – MemoryAgent, ConsciousAgent, search strategies, and state managers.
- **Infrastructure (`src/core/infrastructure/`)** – Prisma-backed database managers, provider integrations, config sanitisation, and logging.
- **Performance (`src/core/performance/`)** – Dashboard and analytics services used for runtime insight.
- **Integrations (`src/integrations/`)** – Drop-in OpenAI client compatible with the official SDK.

The project embraces DDD boundaries: domain logic is decoupled from persistence; provider details live in infrastructure; integrations expose polished wrappers.

## Additional Resources

- GitHub: <https://github.com/mrorigo/memorits>
- npm: <https://www.npmjs.com/package/memorits>
- License: Apache 2.0 (`LICENSE`)

---

Memorits is designed to be the canonical, production-ready memory layer for TypeScript agents. Dive in, wire it to your provider of choice, and start building assistants that remember. 🚀
