# Memory Management in Memorits

Memory management is at the heart of Memorits' functionality. Understanding how memories are captured, processed, and stored is crucial for building effective AI agents. Memorits provides two distinct memory processing modes that cater to different use cases and interaction patterns.

## Memory Processing Modes

Memorits operates in two fundamental modes for processing conversational data into long-term memories:

### 1. Auto-Ingestion Mode

**Automatic, real-time memory processing** that captures and processes conversations immediately as they occur.

```typescript
import { Memori } from 'memorits';

const memori = new Memori({
  autoIngest: true,        // Enable automatic processing
  consciousIngest: false,  // Disable conscious mode
});

// Enable the memory system
await memori.enable();

// Conversations are automatically processed when recorded
const chatId = await memori.recordConversation(
  "What's the best way to implement a search algorithm?",
  "For most applications, I'd recommend starting with a simple linear search..."
);
```

#### Auto-Ingestion Characteristics

- **Real-time Processing**: Memories are processed immediately after conversation
- **Immediate Availability**: New memories are instantly searchable
- **Lower Latency**: No background processing delays
- **Resource Intensive**: Higher CPU usage during conversations
- **Best For**: Interactive applications requiring immediate memory access

#### Configuration Options

```typescript
interface AutoIngestionConfig {
  autoIngest: true;
  consciousIngest: false;
  // Processing parameters
  minImportanceLevel?: 'low' | 'medium' | 'high' | 'critical';
  autoClassify?: boolean;
  extractEntities?: boolean;
  generateKeywords?: boolean;
}
```

### 2. Conscious Processing Mode

**Background processing with human-like reflection** that accumulates conversations and processes them thoughtfully over time.

```typescript
const memori = new Memori({
  autoIngest: false,       // Disable automatic processing
  consciousIngest: true,   // Enable conscious mode
  backgroundInterval: 30000, // Check every 30 seconds
});

// Enable with conscious processing
await memori.enable();

// Start background monitoring
memori.setBackgroundUpdateInterval(60000); // Check every minute

// Conversations are stored but not immediately processed
const chatId = await memori.recordConversation(
  "I need to remember this complex algorithm explanation",
  "Here's a detailed walkthrough of the algorithm..."
);

// Check for new memories to process
await memori.checkForConsciousContextUpdates();
```

#### Conscious Processing Characteristics

- **Background Processing**: Conversations accumulate and are processed in batches
- **Reflective Analysis**: More thoughtful processing with context awareness
- **Resource Efficient**: Lower immediate CPU usage during conversations
- **Configurable Timing**: Control when processing occurs
- **Best For**: Applications with high conversation volume or resource constraints

#### Background Monitoring

```typescript
// Configure monitoring interval
memori.setBackgroundUpdateInterval(30000); // 30 seconds

// Check if monitoring is active
const isActive = memori.isBackgroundMonitoringActive();
console.log(`Background monitoring: ${isActive}`);

// Get current interval
const interval = memori.getBackgroundUpdateInterval();
console.log(`Monitoring interval: ${interval}ms`);
```

## Memory Types and Storage

Memorits maintains two distinct types of memory storage:

### Short-Term Memory

**Temporary storage** for immediate context and recent interactions.

```typescript
interface ShortTermMemoryData {
  chatId: string;
  processedData: unknown;
  importanceScore: number;
  categoryPrimary: string;
  retentionType: string;
  namespace: string;
  searchableContent: string;
  summary: string;
  isPermanentContext: boolean;
}
```

**Characteristics:**
- **Temporary**: Designed for immediate context (sessions, recent interactions)
- **Fast Access**: Optimized for quick retrieval
- **Limited Retention**: May be cleaned up based on importance and age
- **Context-Aware**: Can be marked as permanent context for long-term retention

### Long-Term Memory

**Persistent storage** for important information that should be remembered indefinitely.

```typescript
interface ProcessedLongTermMemory {
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

**Characteristics:**
- **Persistent**: Stored indefinitely (subject to cleanup policies)
- **Rich Metadata**: Extensive classification and relationship data
- **Search Optimized**: Enhanced for complex search operations
- **Consolidation**: Supports duplicate detection and merging

## Memory Classification System

Memories are automatically classified using sophisticated algorithms:

### Importance Levels

```typescript
enum MemoryImportanceLevel {
  CRITICAL = 'critical',  // Must remember - essential information
  HIGH = 'high',          // Important information
  MEDIUM = 'medium',      // Useful information
  LOW = 'low'             // Background information
}
```

**Classification Criteria:**
- **Critical**: Security information, personal data, irreversible actions
- **High**: Business logic, important decisions, user preferences
- **Medium**: General knowledge, contextual information
- **Low**: Casual conversation, temporary context

### Memory Categories

```typescript
enum MemoryClassification {
  ESSENTIAL = 'essential',        // Critical information that must be remembered
  CONTEXTUAL = 'contextual',      // Supporting context and background info
  CONVERSATIONAL = 'conversational', // General conversation and chit-chat
  REFERENCE = 'reference',        // Reference material and documentation
  PERSONAL = 'personal',          // Personal information and preferences
  CONSCIOUS_INFO = 'conscious-info' // Conscious context and reflections
}
```

**Category Assignment:**
- **Essential**: Core business logic, critical decisions, key information
- **Contextual**: Background information, supporting details
- **Conversational**: Casual dialogue, greetings, small talk
- **Reference**: Documentation, code examples, technical information
- **Personal**: User preferences, personal history, custom settings
- **Conscious-Info**: Self-reflective information, meta-cognition

## Memory Lifecycle

### 1. Capture Phase

Conversations are captured and stored in raw form:

```typescript
// Raw conversation storage
const chatId = await memori.recordConversation(
  userInput,
  aiOutput,
  {
    model: 'gpt-4o-mini',
    metadata: { source: 'chat_interface' }
  }
);
```

### 2. Processing Phase

Raw conversations are processed into structured memories:

```typescript
// Memory processing (automatic in auto-ingestion mode)
const processedMemory = await memoryAgent.processConversation({
  chatId,
  userInput,
  aiOutput,
  context: {
    conversationId: chatId,
    sessionId: sessionId,
    modelUsed: 'gpt-4o-mini',
    userPreferences: [],
    currentProjects: ['memorits'],
    relevantSkills: ['typescript', 'ai']
  }
});
```

### 3. Storage Phase

Processed memories are stored with full metadata:

```typescript
const memoryId = await dbManager.storeLongTermMemory(
  processedMemory,
  chatId,
  namespace
);
```

### 4. Retrieval Phase

Memories are retrieved using advanced search strategies:

```typescript
// Search with multiple criteria
const memories = await memori.searchMemories('algorithm implementation', {
  minImportance: 'high',
  categories: ['essential', 'reference'],
  limit: 10,
  includeMetadata: true
});
```

## Advanced Memory Operations

### Duplicate Detection and Consolidation

Memorits automatically detects and manages duplicate memories:

```typescript
// Find potential duplicates
const duplicates = await dbManager.findPotentialDuplicates(
  newMemoryContent,
  namespace,
  0.7 // 70% similarity threshold
);

// Mark as duplicate
await dbManager.markAsDuplicate(duplicateId, originalId, 'automatic_consolidation');

// Consolidate duplicates
await dbManager.consolidateDuplicateMemories(primaryId, duplicateIds);
```

### Memory Statistics and Monitoring

Monitor memory system health and performance:

```typescript
// Get comprehensive statistics
const stats = await dbManager.getDatabaseStats(namespace);
console.log(`Total memories: ${stats.totalMemories}`);
console.log(`Conscious memories: ${stats.consciousMemories}`);

// Get consolidation statistics
const consolidationStats = await dbManager.getConsolidationStats(namespace);
console.log(`Consolidation ratio: ${consolidationStats.consolidationRatio}%`);
```

### Memory Cleanup and Maintenance

Manage memory lifecycle and cleanup:

```typescript
// Clean up old consolidated memories
const cleanupResult = await dbManager.cleanupConsolidatedMemories(
  30, // Older than 30 days
  namespace,
  false // Not a dry run
);

console.log(`Cleaned ${cleanupResult.cleaned} memories`);
```

## Best Practices

### 1. Choose the Right Mode

- **Use Auto-Ingestion** for:
  - Interactive applications
  - Real-time memory requirements
  - Low-latency use cases
  - Single-user scenarios

- **Use Conscious Processing** for:
  - High-volume conversation systems
  - Resource-constrained environments
  - Batch processing scenarios
  - Multi-user systems

### 2. Configure Importance Levels Appropriately

```typescript
// Set appropriate importance thresholds
const config = {
  minImportanceLevel: 'medium', // Only process medium+ importance
  autoIngest: true,
  consciousIngest: false
};
```

### 3. Use Namespaces Effectively

```typescript
// Separate memories by context
const userMemori = new Memori({ namespace: 'user_123' });
const projectMemori = new Memori({ namespace: 'project_alpha' });
```

### 4. Monitor Memory Growth

```typescript
// Regular monitoring
setInterval(async () => {
  const stats = await dbManager.getDatabaseStats();
  if (stats.totalMemories > 10000) {
    console.log('Memory count threshold reached');
    // Trigger cleanup or scaling
  }
}, 60000); // Check every minute
```

## Error Handling

Memory operations include comprehensive error handling:

```typescript
try {
  const chatId = await memori.recordConversation(userInput, aiOutput);
  const memories = await memori.searchMemories(query);
} catch (error) {
  if (error instanceof MemoryError) {
    // Handle memory-specific errors
    console.error('Memory operation failed:', error.message);
  } else {
    // Handle general errors
    console.error('Unexpected error:', error);
  }
}
```

## Performance Considerations

### Memory Processing Overhead

- **Auto-Ingestion**: ~10-50ms per conversation
- **Conscious Processing**: ~5-20ms per conversation + background processing

### Search Performance

- **FTS5 Search**: Sub-millisecond for most queries
- **Metadata Filtering**: 1-10ms depending on complexity
- **Temporal Filtering**: 5-50ms for complex date ranges

### Storage Considerations

- **Short-term Memory**: ~1KB per conversation
- **Long-term Memory**: ~2-10KB per processed memory
- **FTS5 Index**: ~30% of main data size

This comprehensive memory management system provides the foundation for building AI agents with sophisticated recall capabilities, enabling them to maintain context, learn from interactions, and provide increasingly relevant responses over time.