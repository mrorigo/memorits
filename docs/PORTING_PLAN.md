# Memori Python to TypeScript Porting Plan

## Overview

This document outlines the migration of the Memori project from Python (using SQLAlchemy + Pydantic) to TypeScript (using Prisma + Zod) while maintaining 100% type safety.

**Focus:** OpenAI integration only (no universal LLM integration)
**Testing Database:** SQLite initially
**Type Safety:** 100% with TypeScript + Zod + Prisma

## Original Python Implementation References

- **Main Class:** `memori/memori/core/memory.py` - Memori class with dual ingestion modes
- **Database Models:** `memori/memori/database/models.py` - SQLAlchemy models
- **Pydantic Models:** `memori/memori/utils/pydantic_models.py` - Type definitions
- **OpenAI Integration:** `memori/memori/integrations/openai_integration.py` - OpenAI client wrapper
- **Configuration:** `memori/memori/config/settings.py` - Configuration management
- **Memory Agents:** `memori/memori/agents/memory_agent.py` - Memory processing

---

## Phase 1: Project Setup and Foundation

### 1.1 Dependencies Installation

```bash
cd memori-ts
npm init -y
npm install @prisma/client zod openai uuid date-fns
npm install -D @types/node @types/uuid typescript tsx prisma @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint jest ts-jest @types/jest
```

**Reference:** Original Python requirements in `memori/requirements.txt`

### 1.2 TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.3 Project Structure

```
memori-ts/
├── src/
│   ├── core/
│   │   ├── Memori.ts                    # Main class (ref: memori/core/memory.py)
│   │   ├── database/
│   │   │   ├── DatabaseManager.ts        # Prisma wrapper (ref: memori/database/sqlalchemy_manager.py)
│   │   │   └── schema.prisma            # Database schema
│   │   ├── agents/
│   │   │   └── MemoryAgent.ts           # Memory processing (ref: memori/agents/memory_agent.py)
│   │   ├── providers/
│   │   │   └── OpenAIProvider.ts        # OpenAI integration (ref: memori/integrations/openai_integration.py)
│   │   ├── types/
│   │   │   ├── models.ts                # Core types (ref: memori/utils/pydantic_models.py)
│   │   │   └── schemas.ts               # Zod schemas
│   │   └── utils/
│   │       ├── Logger.ts                # Logging utility
│   │       └── ConfigManager.ts         # Configuration (ref: memori/config/settings.py)
│   ├── integrations/
│   │   └── openai.ts                    # OpenAI client wrapper
│   └── index.ts                         # Main exports
├── prisma/
│   └── schema.prisma                     # Database schema
├── tests/
│   ├── unit/
│   │   └── core/
│   │       └── Memori.test.ts           # Main class tests
│   └── integration/
│       └── database/
│           └── DatabaseManager.test.ts  # Database tests
├── package.json
├── tsconfig.json
└── README.md
```

---

## Phase 2: Database Schema Design

### 2.1 Prisma Schema

```prisma
// prisma/schema.prisma
datasource db {
  provider = "sqlite"  // Start with SQLite for testing
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model ChatHistory {
  id          String   @id @default(cuid())
  userInput   String
  aiOutput    String
  model       String
  timestamp   DateTime @default(now())
  sessionId   String
  namespace   String   @default("default")
  tokensUsed  Int      @default(0)
  metadata    Json?

  shortTermMemories ShortTermMemory[]
  longTermMemories  LongTermMemory[]

  @@map("chat_history")
}

model ShortTermMemory {
  id               String   @id @default(cuid())
  chatId           String?
  processedData    Json
  importanceScore  Float    @default(0.5)
  categoryPrimary  String
  retentionType    String   @default("short_term")
  namespace        String   @default("default")
  createdAt        DateTime @default(now())
  expiresAt        DateTime?
  accessCount      Int      @default(0)
  lastAccessed     DateTime?
  searchableContent String
  summary          String
  isPermanentContext Boolean @default(false)

  chat ChatHistory? @relation(fields: [chatId], references: [id], onDelete: SetNull)

  @@map("short_term_memory")
}

model LongTermMemory {
  id                    String   @id @default(cuid())
  originalChatId        String?
  processedData         Json
  importanceScore       Float    @default(0.5)
  categoryPrimary       String
  retentionType         String   @default("long_term")
  namespace             String   @default("default")
  createdAt             DateTime @default(now())
  accessCount           Int      @default(0)
  lastAccessed          DateTime?
  searchableContent     String
  summary               String
  noveltyScore          Float    @default(0.5)
  relevanceScore        Float    @default(0.5)
  actionabilityScore    Float    @default(0.5)

  // Classification Fields
  classification        String   @default("conversational")
  memoryImportance      String   @default("medium")
  topic                 String?
  entitiesJson          Json?
  keywordsJson          Json?

  // Memory Management
  duplicateOf           String?
  supersedesJson        Json?
  relatedMemoriesJson   Json?

  // Technical Metadata
  confidenceScore       Float    @default(0.8)
  extractionTimestamp   DateTime @default(now())
  classificationReason  String?

  chat ChatHistory? @relation(fields: [originalChatId], references: [id], onDelete: SetNull)

  @@map("long_term_memory")
}
```

**Reference:** Original SQLAlchemy models in `memori/memori/database/models.py`

### 2.2 Zod Schemas

```typescript
// src/types/schemas.ts
import { z } from 'zod';

export enum MemoryCategoryType {
  FACT = "fact",
  PREFERENCE = "preference",
  SKILL = "skill",
  CONTEXT = "context",
  RULE = "rule"
}

export enum MemoryClassification {
  ESSENTIAL = "essential",
  CONTEXTUAL = "contextual",
  CONVERSATIONAL = "conversational",
  REFERENCE = "reference",
  PERSONAL = "personal",
  CONSCIOUS_INFO = "conscious-info"
}

export enum MemoryImportanceLevel {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low"
}

// Constrained types
export const ConfidenceScore = z.number().min(0).max(1);
export const ImportanceScore = z.number().min(0).max(1);

// Core schemas
export const ProcessedLongTermMemorySchema = z.object({
  content: z.string(),
  summary: z.string(),
  classification: z.nativeEnum(MemoryClassification),
  importance: z.nativeEnum(MemoryImportanceLevel),
  topic: z.string().optional(),
  entities: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  conversationId: z.string(),
  confidenceScore: ConfidenceScore.default(0.8),
  classificationReason: z.string(),
  promotionEligible: z.boolean().default(false)
});

export const ConversationContextSchema = z.object({
  userId: z.string().optional(),
  sessionId: z.string(),
  conversationId: z.string(),
  modelUsed: z.string(),
  userPreferences: z.array(z.string()).default([]),
  currentProjects: z.array(z.string()).default([]),
  relevantSkills: z.array(z.string()).default([])
});

export type ProcessedLongTermMemory = z.infer<typeof ProcessedLongTermMemorySchema>;
export type ConversationContext = z.infer<typeof ConversationContextSchema>;
```

**Reference:** Original Pydantic models in `memori/memori/utils/pydantic_models.py`

---

## Phase 3: Core Implementation

### 3.1 Database Manager

```typescript
// src/core/database/DatabaseManager.ts
import { PrismaClient } from '@prisma/client';

export class DatabaseManager {
  private prisma: PrismaClient;

  constructor(databaseUrl: string) {
    this.prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
    });
  }

  // Schema is auto-created by Prisma on first run - no explicit initialization needed

  async storeChatHistory(data: {
    chatId: string;
    userInput: string;
    aiOutput: string;
    model: string;
    sessionId: string;
    namespace: string;
    metadata?: any;
  }): Promise<string> {
    const result = await this.prisma.chatHistory.create({
      data: {
        id: data.chatId,
        userInput: data.userInput,
        aiOutput: data.aiOutput,
        model: data.model,
        sessionId: data.sessionId,
        namespace: data.namespace,
        metadataJson: data.metadata,
      },
    });
    return result.id;
  }

  async storeLongTermMemory(
    memoryData: any,
    chatId: string,
    namespace: string
  ): Promise<string> {
    const result = await this.prisma.longTermMemory.create({
      data: {
        originalChatId: chatId,
        processedData: memoryData,
        importanceScore: this.calculateImportanceScore(memoryData.importance),
        categoryPrimary: memoryData.classification,
        retentionType: "long_term",
        namespace,
        searchableContent: memoryData.content,
        summary: memoryData.summary,
        classification: memoryData.classification,
        memoryImportance: memoryData.importance,
        topic: memoryData.topic,
        entitiesJson: memoryData.entities,
        keywordsJson: memoryData.keywords,
        confidenceScore: memoryData.confidenceScore,
        extractionTimestamp: new Date(),
        classificationReason: memoryData.classificationReason,
      },
    });
    return result.id;
  }

  private calculateImportanceScore(level: string): number {
    const scores = {
      [MemoryImportanceLevel.CRITICAL]: 0.9,
      [MemoryImportanceLevel.HIGH]: 0.7,
      [MemoryImportanceLevel.MEDIUM]: 0.5,
      [MemoryImportanceLevel.LOW]: 0.3,
    };
    return scores[level as MemoryImportanceLevel] || 0.5;
  }

  async searchMemories(query: string, options: {
    namespace?: string;
    limit?: number;
  }): Promise<any[]> {
    // Simple SQLite FTS implementation
    const memories = await this.prisma.longTermMemory.findMany({
      where: {
        namespace: options.namespace || 'default',
        OR: [
          { searchableContent: { contains: query } },
          { summary: { contains: query } },
          { topic: { contains: query } },
        ],
      },
      take: options.limit || 5,
      orderBy: { importanceScore: 'desc' },
    });
    return memories;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}
```

**Reference:** Original database manager in `memori/memori/database/sqlalchemy_manager.py`

### 3.2 Memory Agent

```typescript
// src/core/agents/MemoryAgent.ts
import OpenAI from 'openai';
import { z } from 'zod';
import {
  ProcessedLongTermMemorySchema,
  ConversationContextSchema,
  MemoryClassification,
  MemoryImportanceLevel
} from '../types/schemas';

export class MemoryAgent {
  private openai: OpenAI;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.openai = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4o-mini';
  }

  async processConversation(params: {
    chatId: string;
    userInput: string;
    aiOutput: string;
    context: any;
  }): Promise<z.infer<typeof ProcessedLongTermMemorySchema>> {
    const systemPrompt = `You are a memory processing agent. Analyze the conversation and extract structured memory information.

Classify the memory into appropriate categories and determine its importance level.
Extract entities, topics, and determine if this should be promoted to conscious context.

Return JSON with this structure:
{
  "content": "full memory content",
  "summary": "concise summary",
  "classification": "ESSENTIAL|CONTEXTUAL|CONVERSATIONAL|REFERENCE|PERSONAL|CONSCIOUS_INFO",
  "importance": "CRITICAL|HIGH|MEDIUM|LOW",
  "topic": "main topic",
  "entities": ["entity1", "entity2"],
  "keywords": ["keyword1", "keyword2"],
  "confidenceScore": 0.8,
  "classificationReason": "explanation",
  "promotionEligible": false
}`;

    const userPrompt = `Conversation:
User: ${params.userInput}
AI: ${params.aiOutput}

Context: ${JSON.stringify(params.context)}

Extract and classify this memory:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const parsedMemory = JSON.parse(content);

      // Validate with Zod schema
      const validatedMemory = ProcessedLongTermMemorySchema.parse({
        ...parsedMemory,
        conversationId: params.chatId,
        classification: parsedMemory.classification || MemoryClassification.CONVERSATIONAL,
        importance: parsedMemory.importance || MemoryImportanceLevel.MEDIUM,
        entities: parsedMemory.entities || [],
        keywords: parsedMemory.keywords || [],
      });

      return validatedMemory;
    } catch (error) {
      console.error('Memory processing failed:', error);
      // Return fallback memory structure
      return ProcessedLongTermMemorySchema.parse({
        content: params.userInput + ' ' + params.aiOutput,
        summary: params.userInput.slice(0, 100) + '...',
        classification: MemoryClassification.CONVERSATIONAL,
        importance: MemoryImportanceLevel.MEDIUM,
        entities: [],
        keywords: [],
        conversationId: params.chatId,
        confidenceScore: 0.5,
        classificationReason: 'Fallback processing due to error',
        promotionEligible: false,
      });
    }
  }
}
```

**Reference:** Original memory agent in `memori/memori/agents/memory_agent.py`

### 3.3 OpenAI Provider

```typescript
// src/core/providers/OpenAIProvider.ts
import OpenAI from 'openai';

export class OpenAIProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: { apiKey: string; model?: string }) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.model = config.model || 'gpt-4o-mini';
  }

  getClient(): OpenAI {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }

  async createEmbedding(input: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-ada-002",
      input: input,
    });
    return response.data[0].embedding;
  }
}
```

**Reference:** Original OpenAI integration in `memori/memori/integrations/openai_integration.py`

### 3.4 Configuration Manager

```typescript
// src/core/utils/ConfigManager.ts
import { z } from 'zod';

export const MemoriConfigSchema = z.object({
  databaseUrl: z.string().default('file:./memori.db'),
  namespace: z.string().default('default'),
  consciousIngest: z.boolean().default(false),
  autoIngest: z.boolean().default(false),
  model: z.string().default('gpt-4o-mini'),
  apiKey: z.string(),
  userContext: z.object({
    userPreferences: z.array(z.string()).optional(),
    currentProjects: z.array(z.string()).optional(),
    relevantSkills: z.array(z.string()).optional(),
  }).optional(),
});

export type MemoriConfig = z.infer<typeof MemoriConfigSchema>;

export class ConfigManager {
  static loadConfig(): MemoriConfig {
    const configData: any = {
      databaseUrl: process.env.DATABASE_URL || 'file:./memori.db',
      namespace: process.env.MEMORI_NAMESPACE || 'default',
      consciousIngest: process.env.MEMORI_CONSCIOUS_INGEST === 'true',
      autoIngest: process.env.MEMORI_AUTO_INGEST === 'true',
      model: process.env.MEMORI_MODEL || 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY || '',
    };

    return MemoriConfigSchema.parse(configData);
  }
}
```

**Reference:** Original configuration in `memori/memori/config/settings.py`

### 3.5 Main Memori Class

```typescript
// src/core/Memori.ts
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from './database/DatabaseManager';
import { MemoryAgent } from './agents/MemoryAgent';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ConfigManager, MemoriConfig } from './utils/ConfigManager';
import { ProcessedLongTermMemory } from './types/schemas';

export class Memori {
  private dbManager: DatabaseManager;
  private memoryAgent: MemoryAgent;
  private openaiProvider: OpenAIProvider;
  private config: MemoriConfig;
  private enabled: boolean = false;
  private sessionId: string;

  constructor(config?: Partial<MemoriConfig>) {
    this.config = ConfigManager.loadConfig();
    if (config) {
      Object.assign(this.config, config);
    }

    this.sessionId = uuidv4();
    this.dbManager = new DatabaseManager(this.config.databaseUrl);
    this.openaiProvider = new OpenAIProvider({
      apiKey: this.config.apiKey,
      model: this.config.model,
    });
    this.memoryAgent = new MemoryAgent({
      apiKey: this.config.apiKey,
      model: this.config.model,
    });
  }

  async enable(): Promise<void> {
    if (this.enabled) {
      throw new Error('Memori is already enabled');
    }

    this.enabled = true;
    console.log('Memori enabled successfully');
  }

  async recordConversation(
    userInput: string,
    aiOutput: string,
    options?: {
      model?: string;
      metadata?: any;
    }
  ): Promise<string> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    const chatId = uuidv4();

    await this.dbManager.storeChatHistory({
      chatId,
      userInput,
      aiOutput,
      model: options?.model || this.config.model,
      sessionId: this.sessionId,
      namespace: this.config.namespace,
      metadata: options?.metadata,
    });

    // Process memory asynchronously
    this.processMemory(chatId, userInput, aiOutput).catch(console.error);

    return chatId;
  }

  private async processMemory(
    chatId: string,
    userInput: string,
    aiOutput: string
  ): Promise<void> {
    try {
      const processedMemory = await this.memoryAgent.processConversation({
        chatId,
        userInput,
        aiOutput,
        context: {
          sessionId: this.sessionId,
          modelUsed: this.config.model,
          userPreferences: this.config.userContext?.userPreferences || [],
          currentProjects: this.config.userContext?.currentProjects || [],
          relevantSkills: this.config.userContext?.relevantSkills || [],
        },
      });

      await this.dbManager.storeLongTermMemory(
        processedMemory,
        chatId,
        this.config.namespace
      );

      console.log(`Memory processed for chat ${chatId}`);
    } catch (error) {
      console.error(`Failed to process memory for chat ${chatId}:`, error);
    }
  }

  async searchMemories(query: string, limit: number = 5): Promise<any[]> {
    return this.dbManager.searchMemories(query, {
      namespace: this.config.namespace,
      limit,
    });
  }

  async close(): Promise<void> {
    await this.dbManager.close();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}
```

**Reference:** Original Memori class in `memori/memori/core/memory.py`

---

## Phase 4: OpenAI Integration

### 4.1 OpenAI Client Wrapper

```typescript
// src/integrations/openai.ts
import OpenAI from 'openai';
import { Memori } from '../core/Memori';

export class MemoriOpenAI {
  private client: OpenAI;
  private memori: Memori;

  constructor(memori: Memori, apiKey: string, options?: OpenAI.RequestOptions) {
    this.memori = memori;
    this.client = new OpenAI({ apiKey, ...options });
  }

  get chat(): OpenAI.Chat {
    const originalChat = this.client.chat;

    return {
      completions: {
        create: async (params: OpenAI.Chat.ChatCompletionCreateParams) => {
          // Extract messages for memory recording
          const messages = params.messages;
          const lastUserMessage = messages
            .slice()
            .reverse()
            .find(m => m.role === 'user');

          const userInput = lastUserMessage?.content?.toString() || '';
          const model = params.model || 'gpt-4o-mini';

          // Make the original API call
          const response = await originalChat.completions.create(params);

          // Extract AI response
          const aiOutput = response.choices[0]?.message?.content || '';

          // Record the conversation
          if (userInput && aiOutput) {
            try {
              await this.memori.recordConversation(userInput, aiOutput, {
                model,
                metadata: {
                  temperature: params.temperature,
                  maxTokens: params.max_tokens,
                  tokensUsed: response.usage?.total_tokens || 0,
                },
              });
            } catch (error) {
              console.warn('Failed to record conversation:', error);
            }
          }

          return response;
        },
      },
    } as OpenAI.Chat;
  }
}

export function createMemoriOpenAI(
  memori: Memori,
  apiKey: string,
  options?: OpenAI.RequestOptions
): MemoriOpenAI {
  return new MemoriOpenAI(memori, apiKey, options);
}
```

**Reference:** Original OpenAI integration in `memori/memori/integrations/openai_integration.py`

### 4.2 Usage Example

```typescript
// src/index.ts
export { Memori } from './core/Memori';
export { ConfigManager } from './core/utils/ConfigManager';
export { createMemoriOpenAI } from './integrations/openai';
export { ProcessedLongTermMemorySchema } from './types/schemas';
```

```typescript
// Example usage
import { Memori, ConfigManager, createMemoriOpenAI } from 'memori-ts';

async function main() {
  // Initialize Memori
  const config = ConfigManager.loadConfig();
  const memori = new Memori(config);

  await memori.enable();

  // Create OpenAI client with automatic memory recording
  const openaiClient = createMemoriOpenAI(memori, config.apiKey);

  // Use normally - conversations are automatically recorded
  const response = await openaiClient.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: 'What is TypeScript?' }
    ],
  });

  console.log('Response:', response.choices[0]?.message?.content);

  // Search memories
  const memories = await memori.searchMemories('TypeScript');
  console.log('Relevant memories:', memories);

  await memori.close();
}

main().catch(console.error);
```

---

## Phase 5: Testing Setup

### 5.1 Database Tests

```typescript
// tests/integration/database/DatabaseManager.test.ts
import { DatabaseManager } from '../../../src/core/database/DatabaseManager';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;

  beforeEach(async () => {
    dbManager = new DatabaseManager('file:./test.db');
    // Schema is auto-created by Prisma on first run - no explicit initialization needed
  });

  afterEach(async () => {
    await dbManager.close();
  });

  it('should store chat history', async () => {
    const chatId = await dbManager.storeChatHistory({
      chatId: 'test-chat-1',
      userInput: 'Hello world',
      aiOutput: 'Hi there!',
      model: 'gpt-4o-mini',
      sessionId: 'test-session',
      namespace: 'test',
    });

    expect(chatId).toBe('test-chat-1');
  });

  it('should search memories', async () => {
    // Add test data
    await dbManager.storeChatHistory({
      chatId: 'test-chat-2',
      userInput: 'TypeScript is great',
      aiOutput: 'Yes, TypeScript provides excellent type safety',
      model: 'gpt-4o-mini',
      sessionId: 'test-session',
      namespace: 'test',
    });

    const memories = await dbManager.searchMemories('TypeScript', {
      namespace: 'test',
      limit: 5,
    });

    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0]).toHaveProperty('searchableContent');
  });
});
```

### 5.2 Memory Agent Tests

```typescript
// tests/unit/core/MemoryAgent.test.ts
import { MemoryAgent } from '../../../src/core/agents/MemoryAgent';

describe('MemoryAgent', () => {
  let memoryAgent: MemoryAgent;

  beforeEach(() => {
    memoryAgent = new MemoryAgent({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      model: 'gpt-4o-mini',
    });
  });

  it('should process conversation', async () => {
    const result = await memoryAgent.processConversation({
      chatId: 'test-chat',
      userInput: 'What is TypeScript?',
      aiOutput: 'TypeScript is a programming language',
      context: {
        sessionId: 'test-session',
        modelUsed: 'gpt-4o-mini',
        userPreferences: [],
        currentProjects: [],
        relevantSkills: [],
      },
    });

    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('classification');
    expect(result).toHaveProperty('importance');
    expect(result).toHaveProperty('conversationId', 'test-chat');
  });
});
```

---

## Phase 6: Deployment and Documentation

### 6.1 Environment Configuration

```bash
# .env
DATABASE_URL="file:./memori.db"
MEMORI_NAMESPACE="development"
MEMORI_CONSCIOUS_INGEST="false"
MEMORI_AUTO_INGEST="false"
MEMORI_MODEL="gpt-4o-mini"
OPENAI_API_KEY="your-openai-api-key-here"
```

### 6.2 Package.json Scripts

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "jest",
    "test:watch": "jest --watch",
    "prisma:generate": "prisma generate",
    "prisma:push": "prisma db push",
    "prisma:studio": "prisma studio",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix"
  }
}
```

### 6.3 README.md

```markdown
# Memori TypeScript

A type-safe memory engine for AI conversations with OpenAI integration.

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
import { Memori, ConfigManager, createMemoriOpenAI } from 'memori-ts';

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

See detailed API documentation in `docs/API.md`.

## Development

- Run tests: `npm test`
- Watch tests: `npm run test:watch`
- Lint code: `npm run lint`
- Database studio: `npm run prisma:studio`
```

---

## Implementation Timeline

### Week 1: Foundation
- [x] Project setup and dependencies
- [x] Database schema design
- [x] Type definitions and Zod schemas
- [x] Basic DatabaseManager implementation

### Week 2: Core Features
- [ ] MemoryAgent implementation
- [ ] Main Memori class
- [ ] OpenAI integration
- [ ] Configuration management

### Week 3: Testing and Polish
- [ ] Comprehensive test suite
- [ ] Error handling and edge cases
- [ ] Documentation completion
- [ ] Performance optimization

## Success Metrics

1. **Type Safety:** 100% with TypeScript + Zod validation
2. **OpenAI Integration:** Seamless memory recording
3. **Database Performance:** SQLite with efficient querying
4. **Test Coverage:** >90% with Jest
5. **API Compatibility:** Drop-in replacement for OpenAI use cases

This plan provides a complete roadmap for implementing Memori in TypeScript with full type safety and OpenAI integration, focusing on the core functionality while maintaining compatibility with the original Python implementation.