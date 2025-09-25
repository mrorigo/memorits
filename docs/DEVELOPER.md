# Memorits Developer Documentation

## Overview

This document provides comprehensive developer documentation for Memorits (published as 'memorits' on NPM), a conversational memory management system that automatically captures, processes, and retrieves conversational context using Large Language Models (LLMs).

### Dual Attribution and Development Process

**This project represents a dual attribution collaboration:**

#### Original Library Attribution
This is a TypeScript port of the original [Memori Python project](https://github.com/GibsonAI/memori) created by GibsonAI. The core concepts, architecture, and functionality are derived from the original implementation.

#### Port Attribution and AI-Assisted Development
This specific TypeScript port was created by @mrorigo with AI assistance from Roo Code using the code-supernova model. The development process leveraged advanced AI capabilities for:
- Code generation and refactoring
- Architecture design and optimization
- Testing strategy implementation
- Documentation creation and maintenance

## Project Overview

### Technical Description

Memorits is a complete TypeScript rewrite of the original Python implementation, designed to provide robust conversational memory management with the following key capabilities:

- **Automatic Memory Processing**: Captures and processes conversational data in real-time
- **Intelligent Classification**: Uses LLM-powered analysis to categorize and score memories
- **Efficient Search**: Provides fast, contextual search across stored memories
- **Multi-Provider Support**: Compatible with OpenAI GPT models and Ollama local models
- **Type-Safe Architecture**: Built with TypeScript for enhanced development experience

### Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   OpenAI/Ollama │    │     Memori      │    │    Database     │
│    Integration  │◄──►│   Core Class    │◄──►│   (Prisma ORM)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Memory Agent   │    │ Configuration   │    │  Type System    │
│                 │    │    Manager      │    │   (Zod)         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Technology Stack

- **Runtime**: Node.js with TypeScript
- **Database**: SQLite (default) with Prisma ORM
- **LLM Integration**: OpenAI SDK with Ollama support
- **Validation**: Zod schema validation
- **Testing**: Jest with comprehensive mocking
- **Build Tools**: TypeScript compiler, tsx for development

### Design Decisions

#### TypeScript-First Approach
- **Strong Typing**: All components are fully typed with TypeScript interfaces
- **Runtime Validation**: Zod schemas provide runtime type checking
- **Developer Experience**: Enhanced IDE support and compile-time error detection

#### Prisma ORM Choice
- **Type Safety**: Generated types from schema ensure database consistency
- **Migration Support**: Built-in migration system for schema evolution
- **Cross-Platform**: Support for multiple database backends (SQLite, PostgreSQL, MySQL)

#### Provider Pattern
- **Extensibility**: Easy to add new LLM providers
- **Abstraction**: Clean separation between business logic and external APIs
- **Error Handling**: Consistent error handling across providers

## Core Architecture

### Memori Class

The `Memori` class serves as the main orchestrator for the memory management system.

#### Key Responsibilities
- **Lifecycle Management**: Handles initialization, enabling, and cleanup
- **Session Management**: Maintains session state and unique identifiers
- **Conversation Recording**: Processes and stores conversational data
- **Memory Processing**: Orchestrates asynchronous memory analysis

#### Core Methods

```typescript
class Memori {
  constructor(config?: Partial<MemoriConfig>)
  async enable(): Promise<void>
  async recordConversation(
    userInput: string,
    aiOutput: string,
    options?: RecordConversationOptions
  ): Promise<string>
  async searchMemories(query: string, options?: SearchOptions): Promise<MemorySearchResult[]>
  async close(): Promise<void>
  getSessionId(): string
  isEnabled(): boolean
}
```

#### Advanced Interface System

Memorits now features a comprehensive interface system with **15+ clean interfaces**:

- **Core Interfaces**: `MemorySearchResult`, `ConversationMetadata`, `RecordConversationOptions`
- **Search Interfaces**: `SearchOptions` with filtering by importance, categories, and metadata
- **Processing Interfaces**: `MemoryProcessingParams`, `MemoryProcessingResult`
- **Configuration Interfaces**: `UserContext`, `MemoriConfig`, `LogContext`
- **Provider Interfaces**: `LLMProviderConfig`, `EmbeddingResult`, `ConsciousMemory`

**Benefits:**
- **Self-documenting APIs** with clear method signatures
- **Enhanced IDE support** with rich autocomplete
- **Compile-time type safety** replacing runtime errors
- **Better maintainability** with centralized type definitions

#### Implementation Details

The Memori class follows a **composition pattern** where it coordinates between several specialized components:

```typescript
private dbManager: DatabaseManager;
private memoryAgent: MemoryAgent;
private openaiProvider: OpenAIProvider;
private config: MemoriConfig;
private enabled: boolean = false;
private sessionId: string;
```

**Error Handling**: The class implements graceful error handling with fallback mechanisms:
- Database errors are logged but don't crash the application
- Memory processing failures trigger fallback memory creation
- Invalid configurations are caught at initialization time

### Database Layer

#### Prisma ORM Implementation

The database layer uses Prisma ORM for type-safe database operations with automatic schema generation.

**Schema Design**:
```prisma
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
  // ... additional fields for memory classification
}
```

#### DatabaseManager Class

The `DatabaseManager` handles all database operations with a clean abstraction layer.

**Key Operations**:
- **Schema Initialization**: Automatic database setup on first run
- **CRUD Operations**: Type-safe database operations
- **Search Implementation**: Full-text search with relevance scoring
- **Connection Management**: Proper connection lifecycle handling

```typescript
class DatabaseManager {
  private prisma: PrismaClient;

  async initializeSchema(): Promise<void>
  async storeChatHistory(data: ChatHistoryData): Promise<string>
  async storeLongTermMemory(memoryData: any, chatId: string, namespace: string): Promise<string>
  async searchMemories(query: string, options: SearchOptions): Promise<MemorySearchResult[]>
  async close(): Promise<void>
}
```

#### Enhanced Search Capabilities

The `searchMemories` method now supports advanced filtering options:

```typescript
interface SearchOptions {
  namespace?: string;                    // Memory namespace (default: 'default')
  limit?: number;                       // Number of results (default: 5)
  minImportance?: MemoryImportanceLevel; // Filter by importance level
  categories?: MemoryClassification[];   // Filter by memory categories
  includeMetadata?: boolean;            // Include additional metadata
}

interface MemorySearchResult {
  id: string;
  content: string;
  summary: string;
  classification: MemoryClassification;
  importance: MemoryImportanceLevel;
  topic?: string;
  entities: string[];
  keywords: string[];
  confidenceScore: number;
  classificationReason: string;
  metadata?: Record<string, unknown>;
}
```

**Search Strategy**:
- **Text Matching**: Uses SQLite's full-text search capabilities
- **Relevance Scoring**: Orders results by importance score
- **Namespace Isolation**: Supports multi-tenant memory isolation

### Memory Processing Architecture

#### MemoryAgent Class

The `MemoryAgent` handles the intelligent processing of conversational data using LLM analysis.

**Processing Pipeline**:
1. **Prompt Engineering**: Constructs specialized prompts for memory analysis
2. **LLM Interaction**: Calls configured LLM provider for analysis
3. **Response Parsing**: Handles JSON responses with error recovery
4. **Validation**: Applies Zod schemas for data validation
5. **Fallback Handling**: Provides fallback processing for failed analyses

```typescript
class MemoryAgent {
  private openai: OpenAI;
  private model: string;

  async processConversation(params: ConversationParams): Promise<ProcessedLongTermMemory>
}
```

**Memory Classification System**:
- **Categories**: Essential, Contextual, Conversational, Reference, Personal, Conscious Info
- **Importance Levels**: Critical, High, Medium, Low
- **Entity Extraction**: Identifies key entities and topics
- **Confidence Scoring**: Quantifies analysis reliability

#### LLM Integration Strategy

**Provider Abstraction**:
- **OpenAI Provider**: Uses official OpenAI SDK with full feature support
- **Ollama Support**: Local model execution with custom baseUrl configuration
- **Error Recovery**: Automatic fallback to simpler processing on failures

**Prompt Engineering**:
```typescript
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
```

### Configuration System

#### Environment-Based Configuration

The configuration system uses environment variables with sensible defaults and runtime validation.

**Configuration Schema**:
```typescript
const MemoriConfigSchema = z.object({
  databaseUrl: z.string().default('file:./memori.db'),
  namespace: z.string().default('default'),
  consciousIngest: z.boolean().default(false),
  autoIngest: z.boolean().default(false),
  model: z.string().default('gpt-4o-mini'),
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  userContext: z.object({
    userPreferences: z.array(z.string()).optional(),
    currentProjects: z.array(z.string()).optional(),
    relevantSkills: z.array(z.string()).optional(),
  }).optional(),
});
```

**Provider Detection**:
- **OpenAI**: Uses `OPENAI_API_KEY` environment variable
- **Ollama**: Uses `OPENAI_BASE_URL` with dummy API key
- **Validation**: Ensures either valid API key or Ollama configuration

#### ConfigManager Implementation

```typescript
export class ConfigManager {
  static loadConfig(): MemoriConfig {
    const configData: any = {
      databaseUrl: process.env.DATABASE_URL || 'file:./memori.db',
      namespace: process.env.MEMORI_NAMESPACE || 'default',
      consciousIngest: process.env.MEMORI_CONSCIOUS_INGEST === 'true',
      autoIngest: process.env.MEMORI_AUTO_INGEST === 'true',
      model: process.env.MEMORI_MODEL || 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL,
    };

    // Validation logic with provider detection
    if (!configData.apiKey || configData.apiKey === 'your-openai-api-key-here') {
      if (!configData.baseUrl) {
        throw new Error('Invalid configuration: Either provide a valid OPENAI_API_KEY or set OPENAI_BASE_URL for Ollama');
      }
      configData.apiKey = 'ollama-local';
    }

    return MemoriConfigSchema.parse(configData);
  }
}
```

## Implementation Details

### DatabaseManager Deep Dive

#### Connection Management
- **PrismaClient**: Singleton pattern for database connections
- **Connection Pooling**: Automatic connection management
- **Error Handling**: Graceful connection recovery

#### CRUD Operations
```typescript
async storeChatHistory(data: ChatHistoryData): Promise<string> {
  const result = await this.prisma.chatHistory.create({
    data: {
      id: data.chatId,
      userInput: data.userInput,
      aiOutput: data.aiOutput,
      model: data.model,
      sessionId: data.sessionId,
      namespace: data.namespace,
      metadata: data.metadata,
    },
  });
  return result.id;
}
```

#### Search Implementation
```typescript
async searchMemories(query: string, options: SearchOptions): Promise<any[]> {
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
```

### MemoryAgent Deep Dive

#### LLM Interaction
- **Temperature Control**: Low temperature (0.1) for consistent analysis
- **Response Parsing**: Robust JSON parsing with fallback handling
- **Error Recovery**: Multiple fallback strategies for failed processing

```typescript
async processConversation(params: ConversationParams): Promise<ProcessedLongTermMemory> {
  const systemPrompt = `You are a memory processing agent...`;
  const userPrompt = `Conversation: User: ${params.userInput} AI: ${params.aiOutput}`;

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

    // Parse and validate response...
    return validatedMemory;
  } catch (error) {
    // Fallback processing...
    return fallbackMemory;
  }
}
```

#### Response Validation
- **Zod Schemas**: Runtime type checking with detailed error messages
- **Enum Validation**: Ensures valid classification and importance values
- **Data Sanitization**: Cleans and normalizes LLM responses

### Type System Implementation

#### Enhanced Interface Architecture

Memorits features a comprehensive type system with **three layers**:

1. **Zod Schemas** (`src/core/types/schemas.ts`) - Runtime validation and TypeScript inference
2. **Clean Interfaces** (`src/core/types/models.ts`) - Developer-friendly API contracts
3. **Prisma Generated Types** - Database schema types

#### Core Interface Definitions

**Memory Classification System:**
```typescript
export enum MemoryClassification {
  ESSENTIAL = "essential",        // Critical information
  CONTEXTUAL = "contextual",      // Supporting context
  CONVERSATIONAL = "conversational", // General conversation
  REFERENCE = "reference",        // Reference material
  PERSONAL = "personal",          // Personal information
  CONSCIOUS_INFO = "conscious-info" // Conscious context
}

export enum MemoryImportanceLevel {
  CRITICAL = "critical",  // 0.9 score - Must remember
  HIGH = "high",          // 0.7 score - Important information
  MEDIUM = "medium",      // 0.5 score - Useful information
  LOW = "low"             // 0.3 score - Background information
}
```

**Advanced Search Interface:**
```typescript
interface SearchOptions {
  namespace?: string;                    // Memory namespace
  limit?: number;                       // Number of results
  minImportance?: MemoryImportanceLevel; // Filter by importance
  categories?: MemoryClassification[];   // Filter by categories
  includeMetadata?: boolean;            // Include additional data
}

interface MemorySearchResult {
  id: string;
  content: string;
  summary: string;
  classification: MemoryClassification;
  importance: MemoryImportanceLevel;
  topic?: string;
  entities: string[];
  keywords: string[];
  confidenceScore: number;
  classificationReason: string;
  metadata?: Record<string, unknown>;
}
```

#### Memory Processing Interfaces
```typescript
interface MemoryProcessingParams {
  chatId: string;
  userInput: string;
  aiOutput: string;
  context: ConversationContext;
}

interface ConversationContext {
  conversationId: string;
  sessionId: string;
  modelUsed: string;
  userPreferences: string[];
  currentProjects: string[];
  relevantSkills: string[];
  userId?: string;
}
```

## Advanced Features

### OpenAI Integration

#### Wrapper Implementation
The `MemoriOpenAI` class provides a drop-in replacement for the OpenAI client with automatic memory recording:

```typescript
export class MemoriOpenAI {
  constructor(memori: Memori, apiKey: string, options?: OpenAI.RequestOptions)

  get chat(): OpenAI.Chat {
    // Intercepted chat completions with memory recording
  }
}

export function createMemoriOpenAI(
  memori: Memori,
  apiKey: string,
  options?: OpenAI.RequestOptions & { baseUrl?: string }
): MemoriOpenAI
```

#### Conversation Interception
- **Automatic Recording**: Captures all chat completions automatically
- **Metadata Extraction**: Records model, temperature, token usage
- **Streaming Limitations**: Notes limitations with streaming responses
- **Error Handling**: Graceful handling of recording failures

### Ollama Support

#### Local LLM Integration
- **Custom BaseURL**: Uses `OPENAI_BASE_URL` environment variable
- **Dummy API Key**: Uses special 'ollama-local' key for identification
- **Model Compatibility**: Works with various Ollama models
- **Local Execution**: No internet connection required

**Configuration Example**:
```bash
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_API_KEY="ollama-local"
export MEMORI_MODEL="llama2:7b"
```

### Error Handling Strategy

#### Graceful Degradation
- **LLM Failures**: Fallback to basic memory processing
- **Database Errors**: Logged but don't crash the application
- **Configuration Errors**: Caught at initialization with clear messages
- **Network Issues**: Retry mechanisms for transient failures

#### Error Recovery Patterns
```typescript
try {
  const processedMemory = await this.memoryAgent.processConversation(params);
  await this.dbManager.storeLongTermMemory(processedMemory, chatId, namespace);
} catch (error) {
  console.error(`Failed to process memory for chat ${chatId}:`, error);
  // Continue execution - error is logged but not fatal
}
```

### Performance Considerations

#### Query Optimization
- **Indexed Fields**: Proper database indexing on searchable fields
- **Limit Clauses**: Prevents excessive result sets
- **Importance Ordering**: Fast sorting by pre-computed scores

#### Memory Management
- **Connection Pooling**: Efficient database connection reuse
- **Async Processing**: Non-blocking memory processing
- **Batch Operations**: Potential for batch memory processing

#### Caching Strategy
- **No Caching**: Current implementation focuses on real-time processing
- **Future Enhancements**: Could benefit from memory and query result caching

## Testing Strategy

### Test Architecture

The project uses **Jest** with **ts-jest** for TypeScript support and comprehensive mocking strategies.

#### Test Organization
```
tests/
├── unit/
│   ├── core/
│   │   ├── Memori.test.ts
│   │   └── MemoryAgent.test.ts
│   └── utils/
└── integration/
    └── database/
        └── DatabaseManager.test.ts
```

#### Mocking Strategy
- **Dependency Injection**: Extensive use of dependency mocking
- **Isolated Testing**: Each component tested in isolation
- **Behavior Verification**: Focus on interaction patterns rather than implementation details

**Example Mock Setup**:
```typescript
jest.mock('../../../src/core/database/DatabaseManager');
jest.mock('../../../src/core/agents/MemoryAgent');
jest.mock('../../../src/core/providers/OpenAIProvider');
jest.mock('../../../src/core/utils/ConfigManager');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));
```

### Test Coverage
- **Unit Tests**: Core business logic components
- **Integration Tests**: Database operations and external API interactions
- **Error Scenarios**: Comprehensive error handling validation
- **Configuration Testing**: Various configuration scenarios

### Continuous Integration
- **Build Pipeline**: TypeScript compilation and linting
- **Test Execution**: Automated test runs with coverage reporting
- **Code Quality**: ESLint integration with TypeScript support

## Development Guide

### Local Development Setup

#### Prerequisites
- Node.js 18+
- TypeScript 5+
- SQLite (for default database)

#### Environment Configuration
```bash
# For OpenAI
export OPENAI_API_KEY="your-openai-api-key"
export MEMORI_MODEL="gpt-4o-mini"

# For Ollama (optional)
export OPENAI_BASE_URL="http://localhost:11434/v1"
export OPENAI_API_KEY="ollama-local"
export MEMORI_MODEL="llama2:7b"
```

#### Development Commands
```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm run test
npm run test:watch

# Build for production
npm run build

# Run examples
npm run example:basic
npm run example:ollama
npm run example:openai
```

#### Ollama Setup (Optional)
1. Install Ollama from https://ollama.ai
2. Pull a model: `ollama pull llama2:7b`
3. Start Ollama service: `ollama serve`
4. Configure environment variables as shown above

### Debugging and Troubleshooting

#### Common Issues
- **Database Connection**: Ensure proper permissions for SQLite files
- **API Key Issues**: Verify OpenAI API key or Ollama configuration
- **Memory Processing**: Check LLM model availability and network connectivity
- **TypeScript Errors**: Run `npm run build` to catch compilation issues

#### Debug Logging
Enable debug logging by setting environment variables:
```bash
export DEBUG="memori:*"
export NODE_ENV="development"
```

#### Database Inspection
```bash
# View database with Prisma Studio
npm run prisma:studio

# Reset database
rm memori.db
```

### Extension Points

#### Custom Memory Processing
Extend the `MemoryAgent` class to customize memory analysis:
```typescript
class CustomMemoryAgent extends MemoryAgent {
  async processConversation(params: ConversationParams) {
    // Custom processing logic
    return super.processConversation(params);
  }
}
```

#### Additional LLM Providers
Implement new provider by extending the provider pattern:
```typescript
class CustomProvider {
  constructor(config: ProviderConfig) {
    // Provider initialization
  }

  async analyzeMemory(conversation: string): Promise<ProcessedMemory> {
    // Custom analysis logic
  }
}
```

#### Database Adapters
Create custom database adapters by implementing the database interface:
```typescript
class CustomDatabaseManager implements DatabaseInterface {
  async storeChatHistory(data: ChatHistoryData): Promise<string> {
    // Custom storage logic
  }
}
```

### Contributing Guidelines

#### Code Standards
- **TypeScript**: Strict typing with comprehensive interfaces
- **ESLint**: Follow project linting rules
- **Testing**: Write tests for new features and bug fixes
- **Documentation**: Update documentation for API changes

#### Pull Request Process
1. Fork the repository
2. Create a feature branch
3. Write tests for new functionality
4. Ensure all tests pass
5. Update documentation as needed
6. Submit pull request with clear description

#### Development Workflow
```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes with tests
# ...

# Run full test suite
npm run test

# Build and lint
npm run build
npm run lint

# Commit with conventional commits
git commit -m "feat: add new feature"
```

## Technical Specifications

### Database Schema Design Rationale

#### ChatHistory Table
- **CUID Primary Key**: Collision-resistant unique identifiers
- **Namespace Support**: Multi-tenant isolation
- **JSON Metadata**: Flexible metadata storage
- **Model Tracking**: LLM model usage tracking

#### LongTermMemory Table
- **Comprehensive Classification**: Multi-dimensional memory categorization
- **Scoring System**: Numerical scoring for relevance and importance
- **Search Optimization**: Dedicated searchable content field
- **Relationship Tracking**: Memory relationships and duplicates

### Memory Classification System

#### Classification Hierarchy
```typescript
MemoryClassification {
  ESSENTIAL: "essential",        // Critical information
  CONTEXTUAL: "contextual",      // Supporting context
  CONVERSATIONAL: "conversational", // General conversation
  REFERENCE: "reference",        // Reference material
  PERSONAL: "personal",          // Personal information
  CONSCIOUS_INFO: "conscious-info" // Conscious context
}
```

#### Importance Levels
```typescript
MemoryImportanceLevel {
  CRITICAL: "critical",  // 0.9 score - Must remember
  HIGH: "high",          // 0.7 score - Important information
  MEDIUM: "medium",      // 0.5 score - Useful information
  LOW: "low"             // 0.3 score - Background information
}
```

### Search and Retrieval Algorithms

#### Text Search Implementation
- **Full-Text Search**: SQLite FTS for efficient text matching
- **Multi-Field Search**: Search across content, summary, and topic
- **Relevance Scoring**: Importance-based result ranking
- **Namespace Filtering**: Isolated search within namespaces

#### Retrieval Strategy
1. **Query Processing**: Normalize and tokenize search queries
2. **Field Matching**: Search across multiple text fields
3. **Score Calculation**: Combine importance and relevance scores
4. **Result Limiting**: Prevent excessive result sets
5. **Caching**: Future enhancement for frequently accessed memories

### Configuration Options

#### Environment Variables
| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `DATABASE_URL` | Database connection URL | `file:./memori.db` | No |
| `MEMORI_NAMESPACE` | Memory namespace | `default` | No |
| `OPENAI_API_KEY` | OpenAI API key | - | Yes* |
| `OPENAI_BASE_URL` | Custom API base URL | - | No |
| `MEMORI_MODEL` | LLM model name | `gpt-4o-mini` | No |

*Either `OPENAI_API_KEY` or `OPENAI_BASE_URL` is required for Ollama

#### Configuration Effects
- **Database URL**: Determines storage backend and location
- **Namespace**: Enables memory isolation for multi-user scenarios
- **Model Selection**: Affects memory processing quality and speed
- **Provider Configuration**: Switches between OpenAI and local models

## API Reference

### Main Classes

#### Memori
Primary class for memory management operations with enhanced interface support.

**Constructor**:
```typescript
constructor(config?: Partial<MemoriConfig>)
```

**Core Methods**:
- `enable(): Promise<void>` - Initialize database and enable memory processing
- `recordConversation(userInput, aiOutput, options?): Promise<string>` - Record a conversation
- `searchMemories(query, options?): Promise<MemorySearchResult[]>` - Search stored memories
- `close(): Promise<void>` - Close database connections

**Advanced Methods**:
- `isConsciousModeEnabled(): boolean` - Check if conscious mode is active
- `isAutoModeEnabled(): boolean` - Check if auto-ingestion mode is active
- `checkForConsciousContextUpdates(): Promise<void>` - Update conscious context
- `getBackgroundUpdateInterval(): number` - Get monitoring interval

#### DatabaseManager
Handles all database operations with advanced search capabilities.

**Key Methods**:
- `initializeSchema(): Promise<void>` - Set up database schema
- `storeChatHistory(data): Promise<string>` - Store conversation data
- `storeLongTermMemory(memory, chatId, namespace): Promise<string>` - Store processed memory
- `searchMemories(query, options): Promise<MemorySearchResult[]>` - Advanced search with filtering
- `close(): Promise<void>` - Close database connection

**Enhanced Search Features**:
- **Importance filtering** - Filter by memory importance levels
- **Category filtering** - Filter by memory classification types
- **Metadata inclusion** - Optional additional data in results
- **Namespace isolation** - Multi-tenant memory separation

#### MemoryAgent
Processes conversational data using LLM analysis with structured interfaces.

**Key Methods**:
- `processConversation(params): Promise<ProcessedLongTermMemory>` - Analyze conversation

**Processing Features**:
- **Structured parameter interfaces** - Clean, typed input parameters
- **Enhanced context handling** - Rich conversation context
- **Fallback processing** - Graceful error handling
- **Confidence scoring** - Memory quality assessment

### Type Definitions

#### Comprehensive Interface System

Memorits features a **three-layer type system**:

1. **Zod Schemas** (`src/core/types/schemas.ts`) - Runtime validation and type inference
2. **Clean Interfaces** (`src/core/types/models.ts`) - Developer-friendly API contracts
3. **Generated Types** (Prisma) - Database schema types

#### Core Interface Categories

**API Interfaces:**
- `MemorySearchResult` - Structured search results with full typing
- `ConversationMetadata` - Rich conversation metadata
- `RecordConversationOptions` - Conversation recording options

**Search & Filtering Interfaces:**
- `SearchOptions` - Advanced search with importance and category filtering
- `DatabaseStats` - Database statistics and metrics

**Processing Interfaces:**
- `MemoryProcessingParams` - Structured memory processing parameters
- `MemoryProcessingResult` - Processing results with status information

**Configuration Interfaces:**
- `UserContext` - User-specific context data
- `MemoriConfig` - Main configuration with type safety
- `LogContext` - Structured logging context
- `LoggerConfig` - Logger configuration options

#### Memory Classification Enums

**MemoryClassification:**
```typescript
enum MemoryClassification {
  ESSENTIAL = "essential",        // Critical information
  CONTEXTUAL = "contextual",      // Supporting context
  CONVERSATIONAL = "conversational", // General conversation
  REFERENCE = "reference",        // Reference material
  PERSONAL = "personal",          // Personal information
  CONSCIOUS_INFO = "conscious-info" // Conscious context
}
```

**MemoryImportanceLevel:**
```typescript
enum MemoryImportanceLevel {
  CRITICAL = "critical",  // 0.9 score - Must remember
  HIGH = "high",          // 0.7 score - Important information
  MEDIUM = "medium",      // 0.5 score - Useful information
  LOW = "low"             // 0.3 score - Background information
}
```

#### Advanced Type Features

- **Self-documenting APIs** - Interface names clearly indicate purpose
- **Enhanced IDE support** - Rich autocomplete and IntelliSense
- **Compile-time safety** - Type errors caught before runtime
- **Consistent patterns** - Uniform interface design across components

### Error Handling

#### Common Error Types
- **ConfigurationError**: Invalid configuration parameters
- **DatabaseError**: Database connection or operation failures
- **ProcessingError**: Memory processing failures
- **ValidationError**: Data validation failures

#### Error Recovery
- **Graceful Degradation**: System continues operation despite errors
- **Fallback Processing**: Basic memory processing when LLM fails
- **Detailed Logging**: Comprehensive error logging for debugging

## Best Practices

### Development Patterns
- **Type Safety**: Always use TypeScript interfaces and Zod validation
- **Error Handling**: Implement comprehensive error handling with fallbacks
- **Testing**: Write unit tests for all new functionality
- **Documentation**: Keep documentation current with code changes

### Performance Guidelines
- **Async Operations**: Use async/await for all I/O operations
- **Connection Management**: Properly close database connections
- **Memory Efficiency**: Avoid loading large datasets into memory
- **Query Optimization**: Use appropriate limits and filtering

### Security Considerations
- **API Key Security**: Never log or expose API keys
- **Data Validation**: Always validate input data
- **SQL Injection**: Use parameterized queries (handled by Prisma)
- **Environment Variables**: Store sensitive data in environment variables

## Conclusion

Memorits provides a robust, type-safe, and extensible foundation for conversational memory management. Built with modern TypeScript patterns, comprehensive testing, and clear architectural separation, it offers both ease of use and powerful customization capabilities.

### Development Methodology

This project demonstrates the successful application of AI-assisted software development principles:

#### Dual Attribution Model
- **Original Innovation**: Core concepts and architecture from GibsonAI's Memori project
- **AI-Assisted Implementation**: TypeScript port created with advanced AI assistance
- **Human Oversight**: Final decisions, testing, and quality assurance by mrorigo

#### Software Engineering Principles Applied
- **YAGNI (You Aren't Gonna Need It)**: Focus on essential features with extensible architecture
- **DRY (Don't Repeat Yourself)**: Reusable components and consistent patterns
- **SOLID Principles**: Clean abstractions and separation of concerns
- **Type Safety**: Comprehensive TypeScript usage with runtime validation
- **Cognitive Load Optimization**: Code designed for maximum human comprehension

#### AI-Assisted Development Benefits
The use of advanced AI tools (Roo Code with code-supernova model) enabled:
- Rapid prototyping and iteration
- Consistent code quality and patterns
- Comprehensive documentation generation
- Systematic testing implementation
- Architectural optimization

This architecture provides a solid foundation for building sophisticated conversational AI applications with reliable memory management capabilities, while showcasing the potential of AI-assisted software development.