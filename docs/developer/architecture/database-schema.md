# Database Schema Design

This document explains the **actual implemented** database schema design for Memorits, including table structures, relationships, and optimization strategies.

## Core Database Schema Architecture

Memorits uses **Prisma ORM** with a **3-table architecture** for optimal performance and maintainability. The schema is defined in Prisma schema format and uses JSON-based metadata storage for maximum flexibility and extensibility.

### Design Philosophy

**Prisma-Based Architecture**: Memorits uses Prisma ORM for type-safe database operations with:
- **Type Safety**: Full TypeScript integration with compile-time validation
- **Schema Flexibility**: Prisma migrations for schema evolution
- **Rich Relationships**: Native foreign key relationships where appropriate
- **Performance**: Optimized queries with proper indexing
- **JSON Metadata Storage**: Complex data stored as JSON for extensibility

### Database Models (Prisma Schema)

```prisma
// Core database models defined in Prisma schema
model ChatHistory {
  id        String   @id @default(cuid())
  userInput String
  aiOutput  String
  model     String?
  timestamp DateTime @default(now())
  sessionId String
  namespace String   @default("default")
  tokensUsed Int     @default(0)
  metadata  Json?

  shortTermMemories ShortTermMemory[]
  longTermMemories  LongTermMemory[]

  @@map("chat_history")
  @@index([sessionId, timestamp])
  @@index([namespace, timestamp])
  @@index([timestamp])
}

model LongTermMemory {
  id                    String   @id @default(cuid())
  originalChatId        String?
  processedData         Json?
  importanceScore       Float    @default(0.5)
  categoryPrimary       String
  retentionType         String   @default("long_term")
  namespace             String   @default("default")
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
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

  // Conscious Processing
  consciousProcessed    Boolean  @default(false)

  chat ChatHistory? @relation(fields: [originalChatId], references: [id], onDelete: SetNull)

  @@map("long_term_memory")
  @@index([namespace, createdAt])
  @@index([categoryPrimary, importanceScore])
  @@index([searchableContent])
  @@index([topic])
  @@index([classification])
}

model ShortTermMemory {
  id               String   @id @default(cuid())
  chatId           String?
  processedData    Json?
  importanceScore  Float    @default(0.5)
  categoryPrimary  String
  retentionType    String   @default("short_term")
  namespace        String   @default("default")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  expiresAt        DateTime?
  accessCount      Int      @default(0)
  lastAccessed     DateTime?
  searchableContent String
  summary          String
  isPermanentContext Boolean @default(false)

  chat ChatHistory? @relation(fields: [chatId], references: [id], onDelete: SetNull)

  @@map("short_term_memory")
  @@index([namespace, expiresAt])
  @@index([namespace, isPermanentContext])
  @@index([accessCount])
}
```

### Actual Database Table Names

The Prisma models above map to these physical database tables:

| Prisma Model | Database Table | Description |
|-------------|---------------|-------------|
| `ChatHistory` | `chat_history` | Raw conversation storage |
| `LongTermMemory` | `long_term_memory` | Processed, searchable memories |
| `ShortTermMemory` | `short_term_memory` | Temporary working context |

### Database Operations

```bash
# Check actual table names in SQLite
sqlite3 ./memories.db ".tables"

# Query actual tables (note: snake_case table names)
sqlite3 ./memories.db "SELECT COUNT(*) FROM chat_history;"
sqlite3 ./memories.db "SELECT COUNT(*) FROM long_term_memory;"
sqlite3 ./memories.db "SELECT COUNT(*) FROM short_term_memory;"

# View recent conversations from actual table
sqlite3 ./memories.db "SELECT userInput, aiOutput, createdAt FROM chat_history ORDER BY createdAt DESC LIMIT 5;"

# View processed memories from actual table
sqlite3 ./memories.db "SELECT summary, classification, importanceScore FROM long_term_memory ORDER BY createdAt DESC LIMIT 5;"
```

### LongTermMemory Table

Stores processed, searchable memory data with comprehensive JSON-based metadata.

```sql
-- Actual database table (matches Prisma @@map("long_term_memory"))
CREATE TABLE long_term_memory (
  id                    VARCHAR(255) PRIMARY KEY,     -- CUID unique identifier
  originalChatId        VARCHAR(255),                -- Reference to source conversation
  processedData         JSON NOT NULL,               -- Rich structured memory data (includes relationships, consolidation info, state tracking)
  importanceScore       REAL DEFAULT 0.5,            -- Relevance score (0.0-1.0)
  categoryPrimary       VARCHAR(255) NOT NULL,       -- Primary classification
  retentionType         VARCHAR(50) DEFAULT 'long_term',
  namespace             VARCHAR(255) DEFAULT 'default',
  createdAt             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt             DATETIME DEFAULT CURRENT_TIMESTAMP,
  accessCount           INTEGER DEFAULT 0,           -- Usage tracking
  lastAccessed          DATETIME,                     -- Last access timestamp
  searchableContent     TEXT NOT NULL,               -- Full-text search content
  summary               TEXT NOT NULL,               -- Concise memory summary
  noveltyScore          FLOAT DEFAULT 0.5,            -- Novelty scoring
  relevanceScore        FLOAT DEFAULT 0.5,            -- Relevance scoring
  actionabilityScore    FLOAT DEFAULT 0.5,            -- Actionability scoring

  -- Classification and metadata (stored in processedData JSON)
  classification        VARCHAR(50) DEFAULT 'conversational',
  memoryImportance      VARCHAR(20) DEFAULT 'medium',
  topic                 VARCHAR(255),                -- Main topic/keyword
  entitiesJson          JSON,                        -- Extracted entities (also in processedData)
  keywordsJson          JSON,                        -- Key terms/phrases (also in processedData)
  duplicateOf           VARCHAR(255),                -- Duplicate memory reference
  supersedesJson        JSON,                        -- Superseded memories
  relatedMemoriesJson   JSON,                        -- Related memory references

  -- Technical Metadata
  confidenceScore       FLOAT DEFAULT 0.8,            -- Processing confidence
  extractionTimestamp   DATETIME DEFAULT CURRENT_TIMESTAMP,
  classificationReason  TEXT,                        -- Why classified this way
  consciousProcessed    BOOLEAN DEFAULT FALSE,        -- Conscious processing status

  -- Indexes for performance
  INDEX idx_namespace_created (namespace, createdAt),
  INDEX idx_category_importance (categoryPrimary, importanceScore),
  INDEX idx_searchable_content (searchableContent),
  INDEX idx_topic (topic),
  INDEX idx_classification (classification)
);
```

### ShortTermMemory Table

Stores temporary, immediately accessible memories for working context.

```sql
-- Actual database table (matches Prisma @@map("short_term_memory"))
CREATE TABLE short_term_memory (
  id               VARCHAR(255) PRIMARY KEY,     -- CUID unique identifier
  chatId           VARCHAR(255),                -- Associated chat
  processedData    JSON NOT NULL,               -- Structured memory data
  importanceScore  FLOAT DEFAULT 0.5,           -- Relevance score
  categoryPrimary  VARCHAR(255) NOT NULL,       -- Primary classification
  retentionType    VARCHAR(50) DEFAULT 'short_term',
  namespace        VARCHAR(255) DEFAULT 'default',
  createdAt        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt        DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiresAt        DATETIME,                     -- Expiration timestamp
  accessCount      INTEGER DEFAULT 0,           -- Usage tracking
  lastAccessed     DATETIME,                     -- Last access timestamp
  searchableContent TEXT NOT NULL,               -- Full-text search content
  summary          TEXT NOT NULL,               -- Concise memory summary
  isPermanentContext BOOLEAN DEFAULT FALSE,     -- Permanent working memory

  -- Indexes for performance
  INDEX idx_namespace_expires (namespace, expiresAt),
  INDEX idx_permanent_context (namespace, isPermanentContext),
  INDEX idx_access_count (accessCount)
);
```

## Enhanced Database Features (JSON-Based Implementation)

### Memory Processing State Tracking

**Implementation:** In-Memory State Management with JSON Metadata Storage

Instead of a dedicated table, Memorits implements comprehensive workflow state management through the `MemoryProcessingStateManager` class with metadata stored in `long_term_memory.processedData`:

```typescript
// Features implemented:
✅ 16-state workflow system (PENDING → PROCESSING → PROCESSED → CONSCIOUS_PENDING → etc.)
✅ State transition validation and history tracking
✅ Retry mechanisms with exponential backoff
✅ State-based memory queries and filtering
✅ Processing metrics and analytics
✅ Error handling and recovery

// State tracking stored in processedData JSON:
{
  "stateHistory": [
    {
      "fromState": "PENDING",
      "toState": "PROCESSING",
      "timestamp": "2024-01-01T10:00:00Z",
      "reason": "Memory processing started",
      "agentId": "MemoryAgent"
    }
  ],
  "currentState": "PROCESSED",
  "processingMetrics": { ... }
}
```

### Search Index Backup System

**Implementation:** Dynamic Table Creation with Comprehensive Metadata

The backup system creates the `search_index_backups` table on-demand when first backup is created:

```sql
-- Table created dynamically by SearchIndexManager.createBackup()
CREATE TABLE search_index_backups (
  id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  version TEXT NOT NULL,
  data BLOB NOT NULL,
  metadata TEXT NOT NULL
);
```

**Features implemented:**
✅ **Automated backup scheduling** (every 7 days)
✅ **Data integrity verification** with checksums
✅ **Compression and optimization level tracking**
✅ **Restore functionality** with rollback capabilities
✅ **Backup metadata** (size, document count, timestamp)

### Memory Relationship Storage

**Implementation:** JSON-Based Relationship Storage in long_term_memory

Memory relationships are stored as JSON in the `relatedMemoriesJson` and `supersedesJson` fields:

```json
{
  "relatedMemoriesJson": [
    {
      "type": "reference",
      "targetMemoryId": "mem_456",
      "confidence": 0.8,
      "strength": 0.7,
      "reason": "Both discuss TypeScript interfaces",
      "context": "Programming concepts discussion",
      "entities": ["typescript", "interfaces"]
    }
  ],
  "supersedesJson": [
    {
      "type": "supersedes",
      "targetMemoryId": "mem_123",
      "confidence": 0.9,
      "reason": "Updated information with newer examples"
    }
  ]
}
```

**Features implemented:**
✅ **5 relationship types**: continuation, reference, related, supersedes, contradiction
✅ **Bidirectional relationship queries** with confidence/strength filtering
✅ **Graph traversal** with cycle detection and path tracking
✅ **Relationship validation** and conflict resolution
✅ **Relationship statistics** and analytics

### Duplicate Consolidation Tracking

**Implementation:** JSON-Based Audit Trail in processedData

Consolidation operations are tracked within the `long_term_memory.processedData` field:

```json
{
  "consolidatedAt": "2024-01-01T10:30:00Z",
  "consolidatedFrom": ["mem_789", "mem_101"],
  "consolidationReason": "duplicate_consolidation",
  "consolidationHistory": [
    {
      "timestamp": "2024-01-01T10:30:00Z",
      "consolidatedFrom": ["mem_789", "mem_101"],
      "consolidationReason": "duplicate_consolidation",
      "duplicateCount": 2,
      "dataIntegrityHash": "abc123..."
    }
  ],
  "duplicateCount": 2,
  "lastConsolidationActivity": "2024-01-01T10:30:00Z"
}
```

**Features implemented:**
✅ **Intelligent content merging** with frequency-based weighting
✅ **Transaction safety** with rollback capabilities
✅ **Consolidation history** with data integrity verification
✅ **Quality scoring** and conflict resolution
✅ **Performance optimization** with batch processing

### Enhanced FTS5 Search Index

Advanced full-text search index with metadata support:

```sql
CREATE VIRTUAL TABLE memory_fts_enhanced USING fts5(
 -- Core content fields
 content,                    -- Main searchable content
 summary,                    -- Memory summary
 topic,                      -- Primary topic/keyword
 entities,                   -- Extracted entities (space-separated)
 keywords,                   -- Key terms (space-separated)

 -- Metadata fields for filtering
 category_primary,           -- Memory classification
 importance_score,           -- Numeric importance score
 created_at,                 -- Creation timestamp
 namespace,                  -- Multi-tenant isolation
 memory_type,                -- short_term vs long_term
 processing_state,           -- Current processing state

 -- Content and metadata storage
 content=long_term_memory,
 content_rowid=id,

 -- Advanced tokenization options
 tokenize='porter unicode61 remove_diacritics 2',
 prefix='2,3,4'
);

-- Enhanced FTS5 indexes for different query patterns
CREATE INDEX idx_fts_content ON memory_fts_enhanced(content);
CREATE INDEX idx_fts_metadata ON memory_fts_enhanced(category_primary, importance_score);
CREATE INDEX idx_fts_temporal ON memory_fts_enhanced(created_at, namespace);
CREATE INDEX idx_fts_entities ON memory_fts_enhanced(entities);
CREATE INDEX idx_fts_combined ON memory_fts_enhanced(namespace, category_primary, importance_score);
```

### Duplicate Consolidation Tracking

Audit trail for memory consolidation operations:

```sql
CREATE TABLE MemoryConsolidationLog (
 id                VARCHAR(255) PRIMARY KEY,     -- CUID unique identifier
 primaryMemoryId   VARCHAR(255) NOT NULL,       -- Primary memory that was kept
 consolidatedIds   JSON NOT NULL,               -- Array of consolidated memory IDs
 consolidationReason VARCHAR(100) NOT NULL,     -- Reason for consolidation

 -- Operation details
 operationType     VARCHAR(50) NOT NULL,        -- Type: duplicate_merge, content_merge, etc.
 consolidationDate DATETIME NOT NULL,
 processingTimeMs  INTEGER,                    -- Time taken for operation

 -- Data metrics
 entitiesMerged    INTEGER DEFAULT 0,          -- Number of entities merged
 keywordsMerged    INTEGER DEFAULT 0,          -- Number of keywords merged
 contentLengthBefore INTEGER,                  -- Original total content length
 contentLengthAfter  INTEGER,                  -- Final content length

 -- Status and metadata
 status            VARCHAR(20) DEFAULT 'completed',
 errorMessage      TEXT,                        -- Error details if failed
 metadata          JSON,                        -- Additional operation metadata
 performedBy       VARCHAR(100),               -- System component that performed consolidation

 -- Indexes for performance
 INDEX idx_primary_memory (primaryMemoryId),
 INDEX idx_consolidation_date (consolidationDate DESC),
 INDEX idx_consolidated_memories (consolidatedIds(255)),
 INDEX idx_consolidation_status (status, consolidationDate),

 -- Foreign key constraint
 FOREIGN KEY (primaryMemoryId) REFERENCES long_term_memory(id) ON DELETE CASCADE
);
);
```

## Schema Design Principles

### 1. JSON Flexibility

- **Extensible Metadata**: JSON fields allow flexible metadata storage
- **Schema Evolution**: No migrations needed for new metadata fields
- **Rich Relationships**: Complex relationships stored as JSON

### 2. Performance Optimization

- **Strategic Indexing**: Indexes on frequently queried fields
- **FTS5 Support**: Full-text search indexes for fast text search
- **Partitioning Ready**: Namespace-based logical partitioning

### 3. Data Integrity

- **Referential Integrity**: Foreign key relationships where appropriate
- **Validation Constraints**: Database-level data validation
- **Audit Trail**: Timestamp tracking for all changes

## Database Relationships

### Entity Relationship Diagram

```
chat_history ───┬─── long_term_memory (1:N)
                ├─── short_term_memory (1:N)

long_term_memory ───┬─── RelatedMemories (N:N via JSON)
                    ├─── SupersededMemories (1:N)
                    └─── DuplicateTracking (N:1)
```

### Memory Processing Flow

1. **Conversation Recording**: Raw data stored in `chat_history`
2. **Memory Processing**: LLM analysis creates `long_term_memory` entries
3. **Conscious Processing**: Important memories copied to `short_term_memory`
4. **Memory Relationships**: Links established between related memories
5. **Duplicate Management**: Duplicate detection and consolidation

## Optimization Strategies

### Index Strategy

```sql
-- Core search performance indexes
CREATE INDEX idx_memory_search ON long_term_memory(searchableContent);
CREATE INDEX idx_memory_importance ON long_term_memory(namespace, importanceScore DESC);
CREATE INDEX idx_memory_category ON long_term_memory(namespace, categoryPrimary, importanceScore DESC);
CREATE INDEX idx_memory_timestamp ON long_term_memory(namespace, createdAt DESC);

-- Temporal search optimization
CREATE INDEX idx_memory_temporal ON long_term_memory(namespace, createdAt, importanceScore);

-- Metadata search optimization
CREATE INDEX idx_memory_topic ON long_term_memory(namespace, topic);
CREATE INDEX idx_memory_entities ON long_term_memory(namespace, classification);

-- Conscious processing optimization
CREATE INDEX idx_conscious_eligible ON long_term_memory(importanceScore DESC);
CREATE INDEX idx_conscious_processed ON long_term_memory(consciousProcessed, namespace);
```

### Full-Text Search Setup

```sql
-- FTS5 virtual table for advanced text search
CREATE VIRTUAL TABLE memory_fts USING fts5(
  searchableContent,
  summary,
  topic,
  content=long_term_memory,
  content_rowid=id,
  tokenize='porter ascii'
);

-- FTS5 indexes for different content fields
CREATE INDEX idx_fts_content ON memory_fts(searchableContent);
CREATE INDEX idx_fts_summary ON memory_fts(summary);
CREATE INDEX idx_fts_topic ON memory_fts(topic);
```

## Multi-Tenant Architecture

### Namespace Isolation

- **Logical Separation**: Namespaces provide tenant isolation
- **Resource Quotas**: Optional limits per namespace
- **Cross-Namespace Search**: Controlled cross-tenant search capabilities

```sql
-- Namespace-based queries
SELECT * FROM long_term_memory WHERE namespace = 'tenant_1';

-- Cross-namespace aggregation
SELECT namespace, COUNT(*) as memory_count
FROM long_term_memory
GROUP BY namespace;
```

## Schema Evolution

### Migration Strategy

- **Backward Compatibility**: New fields added with defaults
- **Data Transformation**: Gradual migration of existing data
- **Zero-Downtime**: Schema changes without service interruption

### Version Management

```sql
-- Schema version tracking
CREATE TABLE SchemaVersion (
  version VARCHAR(20) PRIMARY KEY,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);
```

## Performance Monitoring

### Database Metrics

```sql
-- Memory storage statistics
SELECT
  COUNT(*) as total_memories,
  COUNT(DISTINCT namespace) as active_namespaces,
  AVG(importanceScore) as avg_importance,
  SUM(accessCount) as total_accesses
FROM long_term_memory;

-- Storage usage by category
SELECT
  categoryPrimary,
  COUNT(*) as count,
  AVG(importanceScore) as avg_importance,
  MIN(createdAt) as oldest_memory,
  MAX(createdAt) as newest_memory
FROM long_term_memory
GROUP BY categoryPrimary
ORDER BY count DESC;
```

### Query Performance

```sql
-- Slow query identification
SELECT sql, execution_time_ms
FROM query_performance_log
WHERE execution_time_ms > 1000
ORDER BY execution_time_ms DESC;
```

This database schema provides a solid foundation for sophisticated memory management while maintaining flexibility for future enhancements and optimizations.