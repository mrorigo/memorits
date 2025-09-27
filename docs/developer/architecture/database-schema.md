# Database Schema Design

This document explains the database schema design for Memorits, including table structures, relationships, and optimization strategies.

## Core Database Schema

### ChatHistory Table

Stores raw conversation data before processing into memories.

```sql
CREATE TABLE ChatHistory (
  id          VARCHAR(255) PRIMARY KEY,  -- CUID unique identifier
  userInput   TEXT NOT NULL,             -- User's message content
  aiOutput    TEXT NOT NULL,             -- AI's response content
  model       VARCHAR(100),              -- LLM model used
  timestamp   DATETIME DEFAULT CURRENT_TIMESTAMP,
  sessionId   VARCHAR(255),              -- Conversation session ID
  namespace   VARCHAR(255) DEFAULT 'default', -- Multi-tenant isolation
  tokensUsed  INTEGER DEFAULT 0,         -- Token consumption tracking
  metadata    JSON,                      -- Additional conversation metadata

  -- Indexes for performance
  INDEX idx_session_timestamp (sessionId, timestamp),
  INDEX idx_namespace_timestamp (namespace, timestamp),
  INDEX idx_timestamp (timestamp)
);
```

### LongTermMemory Table

Stores processed, searchable memory data with rich classification.

```sql
CREATE TABLE LongTermMemory (
  id                    VARCHAR(255) PRIMARY KEY,     -- CUID unique identifier
  originalChatId        VARCHAR(255),                -- Reference to source conversation
  processedData         JSON NOT NULL,               -- Structured memory data
  importanceScore       REAL DEFAULT 0.5,            -- Relevance score (0.0-1.0)
  categoryPrimary       VARCHAR(255) NOT NULL,       -- Primary classification
  retentionType         VARCHAR(50) DEFAULT 'long_term',
  namespace             VARCHAR(255) DEFAULT 'default',
  createdAt             DATETIME DEFAULT CURRENT_TIMESTAMP,
  accessCount           INTEGER DEFAULT 0,           -- Usage tracking
  lastAccessed          DATETIME,                     -- Last access timestamp
  searchableContent     TEXT NOT NULL,               -- Full-text search content
  summary               TEXT NOT NULL,               -- Concise memory summary

  -- Enhanced classification fields
  classification        VARCHAR(50) DEFAULT 'conversational',
  memoryImportance      VARCHAR(20) DEFAULT 'medium',
  topic                 VARCHAR(255),                -- Main topic/keyword
  entitiesJson          JSON,                        -- Extracted entities
  keywordsJson          JSON,                        -- Key terms/phrases

  -- Conscious processing fields
  isUserContext         BOOLEAN DEFAULT FALSE,
  isPreference          BOOLEAN DEFAULT FALSE,
  isSkillKnowledge      BOOLEAN DEFAULT FALSE,
  isCurrentProject      BOOLEAN DEFAULT FALSE,
  promotionEligible     BOOLEAN DEFAULT FALSE,

  -- Memory management
  duplicateOf           VARCHAR(255),                -- Duplicate tracking
  supersedesJson        JSON,                        -- Superseded memories
  relatedMemoriesJson   JSON,                        -- Related memory references

  -- Technical metadata
  confidenceScore       REAL DEFAULT 0.8,            -- Processing confidence
  extractionTimestamp   DATETIME DEFAULT CURRENT_TIMESTAMP,
  classificationReason  TEXT,                        -- Why classified this way

  -- Processing status
  processedForDuplicates BOOLEAN DEFAULT FALSE,
  consciousProcessed     BOOLEAN DEFAULT FALSE,

  -- GAPS1 Enhanced Features
  processingState       VARCHAR(50) DEFAULT 'PENDING',    -- Memory processing workflow state
  stateTransitionsJson  JSON,                              -- State transition history
  duplicateGroupId      VARCHAR(255),                      -- Duplicate consolidation group
  relationshipMetadataJson JSON,                           -- Memory relationship metadata
  consolidationInfoJson JSON,                              -- Consolidation tracking info
  searchIndexOptimized  BOOLEAN DEFAULT FALSE,            -- Search index optimization status

  -- Indexes for performance
  INDEX idx_namespace_created (namespace, createdAt),
  INDEX idx_category_importance (categoryPrimary, importanceScore),
  INDEX idx_searchable_content (searchableContent),
  INDEX idx_topic (topic),
  INDEX idx_classification (classification),
  INDEX idx_processing_state (namespace, processingState),
  INDEX idx_duplicate_group (duplicateGroupId)
);
```

### ShortTermMemory Table

Stores temporary, immediately accessible memories for working context.

```sql
CREATE TABLE ShortTermMemory (
  id                    VARCHAR(255) PRIMARY KEY,
  chatId                VARCHAR(255),                -- Associated chat
  processedData         JSON NOT NULL,
  importanceScore       REAL DEFAULT 0.5,
  categoryPrimary       VARCHAR(255) NOT NULL,
  retentionType         VARCHAR(50) DEFAULT 'short_term',
  namespace             VARCHAR(255) DEFAULT 'default',
  createdAt             DATETIME DEFAULT CURRENT_TIMESTAMP,
  expiresAt             DATETIME,                     -- Expiration timestamp
  accessCount           INTEGER DEFAULT 0,
  lastAccessed          DATETIME,
  searchableContent     TEXT NOT NULL,
  summary               TEXT NOT NULL,
  isPermanentContext    BOOLEAN DEFAULT FALSE,       -- Permanent working memory

  -- Indexes
  INDEX idx_namespace_expires (namespace, expiresAt),
  INDEX idx_permanent_context (namespace, isPermanentContext),
  INDEX idx_access_count (accessCount)
```

## GAPS1 Enhanced Database Features

### Memory Processing State Tracking

Comprehensive workflow state management for memory processing operations:

```sql
CREATE TABLE MemoryProcessingStates (
 id              VARCHAR(255) PRIMARY KEY,     -- CUID unique identifier
 memoryId        VARCHAR(255) NOT NULL,       -- Reference to memory being processed
 currentState    VARCHAR(50) NOT NULL,        -- Current processing state
 stateHistory    JSON NOT NULL,               -- Complete transition history
 createdAt       DATETIME DEFAULT CURRENT_TIMESTAMP,
 updatedAt       DATETIME DEFAULT CURRENT_TIMESTAMP,

 -- Processing metadata
 processingAgent VARCHAR(100),                -- Agent performing the processing
 errorMessage    TEXT,                        -- Last error message if failed
 retryCount      INTEGER DEFAULT 0,           -- Number of retry attempts
 metadata        JSON,                        -- Additional processing metadata

 -- Indexes for performance
 INDEX idx_memory_processing (memoryId, currentState),
 INDEX idx_state_timestamp (currentState, updatedAt),
 INDEX idx_processing_agent (processingAgent, updatedAt),

 -- Foreign key constraint
 FOREIGN KEY (memoryId) REFERENCES LongTermMemory(id) ON DELETE CASCADE
);
```

### Search Index Backup System

Automated backup and recovery system for search indexes:

```sql
CREATE TABLE SearchIndexBackups (
 id           VARCHAR(255) PRIMARY KEY,     -- Backup unique identifier
 timestamp    DATETIME NOT NULL,            -- When backup was created
 version      VARCHAR(20) NOT NULL,        -- Backup format version
 data         BLOB NOT NULL,               -- Compressed index data
 metadata     JSON NOT NULL,               -- Backup metadata (size, document count, etc.)
 checksum     VARCHAR(64) NOT NULL,        -- Integrity verification checksum

 -- Backup management
 isActive     BOOLEAN DEFAULT TRUE,        -- Whether this backup is current
 expiresAt    DATETIME,                    -- Optional expiration date
 createdBy    VARCHAR(100),                -- System component that created backup

 -- Indexes for performance
 INDEX idx_backup_timestamp (timestamp DESC),
 INDEX idx_backup_active (isActive, timestamp DESC),
 INDEX idx_backup_expires (expiresAt)
);
```

### Memory Relationship Storage

Enhanced relationship tracking between memories:

```sql
CREATE TABLE MemoryRelationships (
 id              VARCHAR(255) PRIMARY KEY,     -- CUID unique identifier
 sourceMemoryId  VARCHAR(255) NOT NULL,       -- Source memory reference
 targetMemoryId  VARCHAR(255) NOT NULL,       -- Target memory reference
 relationshipType VARCHAR(50) NOT NULL,      -- Type: continuation, reference, related, supersedes, contradiction

 -- Relationship scoring
 confidence      REAL DEFAULT 0.0,           -- Relationship confidence (0.0-1.0)
 strength        REAL DEFAULT 0.0,           -- Relationship strength (0.0-1.0)

 -- Metadata
 entities        JSON,                        -- Common entities between memories
 context         TEXT,                        -- Relationship context/description
 extractedAt     DATETIME DEFAULT CURRENT_TIMESTAMP,
 extractionMethod VARCHAR(50),               -- How relationship was detected

 -- Indexes for performance
 INDEX idx_source_relationship (sourceMemoryId, relationshipType),
 INDEX idx_target_relationship (targetMemoryId, relationshipType),
 INDEX idx_relationship_confidence (confidence DESC),
 INDEX idx_bidirectional (sourceMemoryId, targetMemoryId),

 -- Foreign key constraints
 FOREIGN KEY (sourceMemoryId) REFERENCES LongTermMemory(id) ON DELETE CASCADE,
 FOREIGN KEY (targetMemoryId) REFERENCES LongTermMemory(id) ON DELETE CASCADE,

 -- Prevent self-references and duplicate relationships
 CONSTRAINT no_self_reference CHECK (sourceMemoryId != targetMemoryId),
 CONSTRAINT unique_relationship UNIQUE (sourceMemoryId, targetMemoryId, relationshipType)
);
```

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
 content=LongTermMemory,
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
 FOREIGN KEY (primaryMemoryId) REFERENCES LongTermMemory(id) ON DELETE CASCADE
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
ChatHistory ───┬─── LongTermMemory (1:N)
               ├─── ShortTermMemory (1:N)

LongTermMemory ───┬─── RelatedMemories (N:N via JSON)
                  ├─── SupersededMemories (1:N)
                  └─── DuplicateTracking (N:1)
```

### Memory Processing Flow

1. **Conversation Recording**: Raw data stored in `ChatHistory`
2. **Memory Processing**: LLM analysis creates `LongTermMemory` entries
3. **Conscious Processing**: Important memories copied to `ShortTermMemory`
4. **Memory Relationships**: Links established between related memories
5. **Duplicate Management**: Duplicate detection and consolidation

## Optimization Strategies

### Index Strategy

```sql
-- Core search performance indexes
CREATE INDEX idx_memory_search ON LongTermMemory(searchableContent);
CREATE INDEX idx_memory_importance ON LongTermMemory(namespace, importanceScore DESC);
CREATE INDEX idx_memory_category ON LongTermMemory(namespace, categoryPrimary, importanceScore DESC);
CREATE INDEX idx_memory_timestamp ON LongTermMemory(namespace, createdAt DESC);

-- Temporal search optimization
CREATE INDEX idx_memory_temporal ON LongTermMemory(namespace, createdAt, importanceScore);

-- Metadata search optimization
CREATE INDEX idx_memory_topic ON LongTermMemory(namespace, topic);
CREATE INDEX idx_memory_entities ON LongTermMemory(namespace, classification);

-- Conscious processing optimization
CREATE INDEX idx_conscious_eligible ON LongTermMemory(promotionEligible, importanceScore DESC);
CREATE INDEX idx_conscious_processed ON LongTermMemory(consciousProcessed, namespace);
```

### Full-Text Search Setup

```sql
-- FTS5 virtual table for advanced text search
CREATE VIRTUAL TABLE memory_fts USING fts5(
  searchableContent,
  summary,
  topic,
  content=LongTermMemory,
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
SELECT * FROM LongTermMemory WHERE namespace = 'tenant_1';

-- Cross-namespace aggregation
SELECT namespace, COUNT(*) as memory_count
FROM LongTermMemory
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
FROM LongTermMemory;

-- Storage usage by category
SELECT
  categoryPrimary,
  COUNT(*) as count,
  AVG(importanceScore) as avg_importance,
  MIN(createdAt) as oldest_memory,
  MAX(createdAt) as newest_memory
FROM LongTermMemory
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