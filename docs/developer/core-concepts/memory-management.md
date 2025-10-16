# Memory Management in Memorits

Memory management is at the heart of Memorits' functionality. Understanding how memories are captured, processed, and stored is crucial for building effective AI agents. Memorits provides two distinct memory processing modes that cater to different use cases and interaction patterns.

## Memory Processing Modes

Memorits operates in two fundamental modes for processing conversational data into long-term memories:

### 1. Automatic Mode

**Automatic, real-time memory processing** that captures and processes conversations immediately as they occur.

```typescript
import { MemoriAI } from 'memorits';

const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
  model: 'gpt-4',
  provider: 'openai',
  mode: 'automatic'  // Enable automatic processing
});

// Conversations are automatically processed during chat
const response = await ai.chat({
  messages: [
    { role: 'user', content: "What's the best way to implement a search algorithm?" }
  ]
});
```

#### Auto-Ingestion Characteristics

- **Real-time Processing**: Memories are processed immediately after conversation
- **Immediate Availability**: New memories are instantly searchable
- **Lower Latency**: No background processing delays
- **Resource Intensive**: Higher CPU usage during conversations
- **Best For**: Interactive applications requiring immediate memory access

#### Configuration Options

```typescript
interface AutomaticModeConfig {
  mode: 'automatic';
  // Processing parameters are handled automatically
  // Importance levels are configured via search options
  // Entity extraction and keyword generation happen automatically
}
```

### 2. Conscious Mode

**Background processing with human-like reflection** that accumulates conversations and processes them thoughtfully over time.

```typescript
const ai = new MemoriAI({
  databaseUrl: 'file:./memori.db',
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
  model: 'gpt-4',
  provider: 'openai',
  mode: 'conscious'  // Enable conscious processing
});

// Conversations are stored for background processing
const response = await ai.chat({
  messages: [
    { role: 'user', content: "I need to remember this complex algorithm explanation" }
  ]
});

// Manually trigger conscious processing when needed
await ai.checkForConsciousContextUpdates();
```

#### Conscious Processing Characteristics

- **Background Processing**: Conversations accumulate and are processed in batches
- **Reflective Analysis**: More thoughtful processing with context awareness
- **Resource Efficient**: Lower immediate CPU usage during conversations
- **Configurable Timing**: Control when processing occurs
- **Best For**: Applications with high conversation volume or resource constraints

#### Background Monitoring

```typescript
// Background monitoring is automatic in conscious mode
// Check if conscious mode is enabled
const isConsciousEnabled = ai.isConsciousModeEnabled();
console.log(`Conscious mode enabled: ${isConsciousEnabled}`);

// Manually trigger conscious processing
await ai.checkForConsciousContextUpdates();
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
// Raw conversation storage (automatic during chat)
const response = await ai.chat({
  messages: [
    { role: 'user', content: userInput }
  ]
});

const chatId = response.chatId; // Chat ID is returned
```

### 2. Processing Phase

Raw conversations are processed into structured memories:

```typescript
// Memory processing happens automatically in automatic mode
// No manual processing needed - handled by MemoryAgent internally
```

### 3. Storage Phase

Processed memories are stored with full metadata:

```typescript
// Storage happens automatically - no manual intervention needed
// MemoriAI handles the complete lifecycle internally
```

### 4. Retrieval Phase

Memories are retrieved using advanced search strategies:

```typescript
// Search with multiple criteria
const memories = await ai.searchMemories('algorithm implementation', {
  minImportance: 'high',
  categories: ['essential', 'reference'],
  limit: 10,
  includeMetadata: true
});
```

## Advanced Memory Operations

### Duplicate Detection and Consolidation

Memorits provides a unified consolidation system for managing duplicate memories:

```typescript
import { RepositoryFactory } from '../src/core/infrastructure/database/factories/RepositoryFactory';
import { MemoryConsolidationService } from '../src/core/infrastructure/database/MemoryConsolidationService';

// Initialize consolidation service
const repository = RepositoryFactory.createConsolidationRepository();
const consolidationService = new MemoryConsolidationService(repository);

// Find potential duplicates with sophisticated similarity analysis
const duplicates = await consolidationService.detectDuplicateMemories(
  newMemoryContent,
  0.7 // 70% similarity threshold
);

// Validate consolidation eligibility
const validation = await consolidationService.validateConsolidationEligibility(
  primaryId,
  duplicates.map(d => d.id)
);

if (validation.isValid) {
  // Consolidate duplicates with transaction safety
  const result = await consolidationService.consolidateMemories(primaryId, duplicates.map(d => d.id));

  if (result.success) {
    console.log(`Consolidated ${result.consolidatedCount} duplicate memories`);
  }
}
```

### Memory Statistics and Monitoring

Monitor memory system health and performance:

```typescript
// Get comprehensive statistics
const stats = await dbManager.getDatabaseStats(namespace);
console.log(`Total memories: ${stats.totalMemories}`);
console.log(`Conscious memories: ${stats.consciousMemories}`);

// Get consolidation statistics via ConsolidationService
const consolidationService = dbManager.getConsolidationService();
const consolidationStats = await consolidationService.getConsolidationAnalytics();
console.log(`Consolidation ratio: ${consolidationStats.averageConsolidationRatio}%`);
console.log(`Duplicate count: ${consolidationStats.duplicateCount}`);
console.log(`Consolidated memories: ${consolidationStats.consolidatedMemories}`);

// Get consolidation performance metrics
const performanceMetrics = await dbManager.getConsolidationPerformanceMetrics();
console.log(`Average consolidation time: ${performanceMetrics.averageConsolidationTime}ms`);
console.log(`Success rate: ${performanceMetrics.consolidationSuccessRate}%`);
```

### Memory Cleanup and Maintenance

Manage memory lifecycle and cleanup:

```typescript
// Get optimization recommendations first
const consolidationService = dbManager.getConsolidationService();
const recommendations = await consolidationService.getOptimizationRecommendations();

if (recommendations.recommendations.some(r => r.type === 'cleanup')) {
  // Clean up old consolidated memories with dry run first
  const dryRunResult = await consolidationService.cleanupOldConsolidatedMemories(30, true);

  if (dryRunResult.cleaned > 0) {
    console.log(`Would clean ${dryRunResult.cleaned} memories`);

    // Perform actual cleanup if dry run looks good
    const cleanupResult = await consolidationService.cleanupOldConsolidatedMemories(30, false);
    console.log(`Cleaned ${cleanupResult.cleaned} memories`);
  }
}
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

### 4. Monitor Memory Usage

```typescript
// Regular monitoring with MemoriAI
setInterval(async () => {
  const stats = await ai.getMemoryStatistics();
  if (stats.totalMemories > 10000) {
    console.log('Memory count threshold reached');
    // Access consolidation service for cleanup
    const consolidationService = ai.getConsolidationService();
    // Trigger cleanup or scaling
  }
}, 60000); // Check every minute
```

## Error Handling

Memory operations include comprehensive error handling:

```typescript
try {
  const response = await ai.chat({
    messages: [
      { role: 'user', content: userInput }
    ]
  });
  const memories = await ai.searchMemories(query);
} catch (error) {
  // Handle memory operation errors
  console.error('Memory operation failed:', error instanceof Error ? error.message : String(error));
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