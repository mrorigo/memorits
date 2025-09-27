# Duplicate Management in Memorits

Duplicate management is a critical feature of Memorits that ensures memory quality and prevents redundancy. The system automatically detects, consolidates, and manages duplicate memories to maintain a clean, efficient, and accurate knowledge base for AI agents.

## Overview

The duplicate management system provides:

- **Automatic Detection**: Intelligent similarity analysis to find duplicate memories
- **Smart Consolidation**: Merge duplicate memories while preserving the best information
- **Quality Preservation**: Maintain memory quality through deduplication
- **Performance Optimization**: Reduce storage and search overhead from duplicates
- **Audit Trail**: Track consolidation history and decisions
- **Configurable Thresholds**: Adjustable similarity thresholds for different use cases

## Core Components

### Duplicate Detection Engine

The system uses multiple strategies to detect potential duplicates:

```typescript
interface DuplicateDetectionStrategy {
  similarityThreshold: number;        // 0.0 to 1.0
  comparisonFields: string[];         // Fields to compare
  weighting: Record<string, number>;  // Field importance weights
  caseSensitive: boolean;             // Case sensitivity setting
}
```

### Consolidation Process

```typescript
interface ConsolidationProcess {
  primaryMemory: Memory;              // Memory to keep
  duplicateMemories: Memory[];        // Memories to consolidate
  consolidationStrategy: 'merge' | 'keep_best' | 'manual';
  preserveFields: string[];           // Fields to preserve during merge
  conflictResolution: 'primary_wins' | 'latest_wins' | 'merge_values';
}
```

## Automatic Duplicate Detection

### Similarity-Based Detection

```typescript
// Configure duplicate detection
const duplicateConfig = {
  similarityThreshold: 0.8,           // 80% similarity threshold
  comparisonFields: [
    'content',
    'summary',
    'topic',
    'entities'
  ],
  weighting: {
    'content': 0.4,                  // Content is most important
    'summary': 0.3,
    'topic': 0.2,
    'entities': 0.1
  },
  caseSensitive: false
};
```

### Detection Algorithm

```typescript
// Automatic duplicate detection
const duplicates = await memori.detectDuplicates({
  similarityThreshold: 0.8,
  maxDuplicatesPerMemory: 5,
  includeConsolidated: false
});

// Process detected duplicates
for (const group of duplicates) {
  console.log(`Found ${group.duplicates.length} duplicates for memory: ${group.primary.id}`);
  console.log(`Average similarity: ${group.averageSimilarity}`);

  // Consolidate automatically
  await memori.consolidateDuplicates(group.primary.id, group.duplicates.map(d => d.id));
}
```

### Content-Based Similarity

```typescript
// Content similarity analysis
const similarity = await memori.calculateSimilarity(memory1, memory2, {
  algorithm: 'jaccard',               // Jaccard similarity
  fields: ['content', 'summary'],
  normalizeText: true,
  removeStopWords: true
});

console.log(`Similarity score: ${similarity.score}`);
console.log(`Confidence: ${similarity.confidence}`);
```

## Duplicate Consolidation Strategies

### 1. Merge Strategy

Combine information from multiple duplicate memories:

```typescript
// Merge duplicate memories
const consolidationResult = await memori.consolidateDuplicates(
  primaryMemoryId,
  duplicateIds,
  {
    strategy: 'merge',
    preserveFields: ['entities', 'keywords', 'confidenceScore'],
    conflictResolution: 'latest_wins'
  }
);

// Result includes merged metadata
console.log('Consolidated entities:', consolidationResult.mergedMetadata.entities);
console.log('Consolidated keywords:', consolidationResult.mergedMetadata.keywords);
```

### 2. Keep Best Strategy

Select the highest quality memory and discard others:

```typescript
// Keep only the best memory
const bestMemoryResult = await memori.consolidateDuplicates(
  primaryMemoryId,
  duplicateIds,
  {
    strategy: 'keep_best',
    qualityCriteria: [
      'importanceScore',              // Weight importance
      'confidenceScore',              // Weight confidence
      'accessCount',                  // Weight usage frequency
      'createdAt'                     // Weight recency
    ],
    weights: {
      'importanceScore': 0.4,
      'confidenceScore': 0.3,
      'accessCount': 0.2,
      'createdAt': 0.1
    }
  }
);
```

### 3. Manual Strategy

Allow manual review and decision making:

```typescript
// Manual consolidation with review
const manualResult = await memori.consolidateDuplicates(
  primaryMemoryId,
  duplicateIds,
  {
    strategy: 'manual',
    requireReview: true,
    preserveHistory: true,
    allowPartialConsolidation: false
  }
);

// Review required before consolidation
if (manualResult.requiresReview) {
  console.log('Manual review required for consolidation');
  console.log('Duplicate details:', manualResult.duplicateDetails);
}
```

## Advanced Duplicate Management

### Batch Processing

```typescript
// Process large numbers of potential duplicates
const batchResult = await memori.processDuplicateBatch({
  memoryIds: largeMemorySet,
  batchSize: 100,
  similarityThreshold: 0.85,
  autoConsolidate: true,
  dryRun: false
});

console.log(`Processed ${batchResult.totalProcessed} memories`);
console.log(`Found ${batchResult.duplicatesFound} duplicates`);
console.log(`Consolidated ${batchResult.consolidated} duplicates`);
```

### Scheduled Cleanup

```typescript
// Schedule automatic duplicate cleanup
const cleanupSchedule = {
  frequency: 'daily',                 // daily, weekly, monthly
  timeWindow: '02:00',               // 2 AM
  similarityThreshold: 0.9,
  maxConsolidationPerRun: 100,
  enableNotifications: true
};

await memori.scheduleDuplicateCleanup(cleanupSchedule);
```

### Quality-Based Filtering

```typescript
// Filter duplicates by quality criteria
const qualityDuplicates = await memori.findDuplicatesByQuality({
  minQualityScore: 0.7,
  qualityFactors: {
    importance: 0.3,
    confidence: 0.3,
    completeness: 0.2,
    recency: 0.2
  },
  includeLowQuality: false
});
```

## Duplicate Prevention

### Content Normalization

```typescript
// Normalize content before storage to prevent duplicates
const normalizationConfig = {
  enableTextNormalization: true,
  enableEntityNormalization: true,
  enableDateNormalization: true,
  removeRedundantPhrases: true,
  standardizeFormatting: true
};

const normalizedContent = await memori.normalizeContent(
  rawContent,
  normalizationConfig
);
```

### Hash-Based Deduplication

```typescript
// Generate content hashes for fast duplicate detection
const contentHash = await memori.generateContentHash(content, {
  algorithm: 'sha256',
  includeFields: ['content', 'summary', 'entities'],
  normalizeWhitespace: true,
  ignoreCase: true
});

// Check for existing memories with same hash
const existingMemory = await memori.findMemoryByHash(contentHash);
if (existingMemory) {
  // Update existing memory instead of creating duplicate
  await memori.updateMemory(existingMemory.id, newContent);
}
```

## Integration with Search

### Search Result Deduplication

```typescript
// Automatically deduplicate search results
const searchResults = await memori.searchMemories('query', {
  deduplication: {
    enabled: true,
    strategy: 'similarity',
    similarityThreshold: 0.9,
    preserveOrder: true
  }
});

// Results automatically deduplicated
console.log(`Found ${searchResults.total} unique results`);
```

### Cross-Strategy Deduplication

```typescript
// Deduplicate results from multiple search strategies
const multiStrategyResults = await memori.searchMemories('query', {
  strategies: ['fts5', 'recent', 'category_filter'],
  deduplication: {
    enabled: true,
    crossStrategy: true,
    consolidationStrategy: 'merge'
  }
});
```

## Monitoring and Analytics

### Duplicate Statistics

```typescript
// Get comprehensive duplicate statistics
const stats = await memori.getDuplicateStatistics({
  timeRange: {
    start: '2024-01-01',
    end: '2024-12-31'
  },
  includeTrends: true
});

console.log('Duplicate Statistics:', {
  totalDuplicates: stats.totalDuplicates,
  consolidatedDuplicates: stats.consolidated,
  averageSimilarity: stats.averageSimilarity,
  consolidationRate: stats.consolidationRate,
  trends: stats.trends
});
```

### Quality Metrics

```typescript
// Monitor memory quality after deduplication
const qualityMetrics = await memori.getQualityMetrics({
  includeConsolidationImpact: true,
  timeRange: 'last_30_days'
});

console.log('Quality Metrics:', {
  averageQualityBefore: qualityMetrics.beforeConsolidation,
  averageQualityAfter: qualityMetrics.afterConsolidation,
  improvementRate: qualityMetrics.improvementRate,
  qualityDistribution: qualityMetrics.distribution
});
```

## Configuration Options

### Duplicate Detection Configuration

```typescript
interface DuplicateDetectionConfig {
  similarity: {
    threshold: number;                // Similarity threshold (0.0-1.0)
    algorithm: 'jaccard' | 'cosine' | 'levenshtein';
    caseSensitive: boolean;
    normalizeWhitespace: boolean;
  };
  content: {
    fields: string[];                 // Fields to compare
    weights: Record<string, number>;  // Field weights
    minLength: number;                // Minimum content length
  };
  performance: {
    batchSize: number;                // Batch processing size
    maxExecutionTime: number;         // Max execution time (ms)
    enableCaching: boolean;           // Cache similarity results
  };
}
```

### Consolidation Configuration

```typescript
interface ConsolidationConfig {
  strategy: 'merge' | 'keep_best' | 'manual';
  preserveFields: string[];
  conflictResolution: 'primary_wins' | 'latest_wins' | 'merge_values';
  auditTrail: {
    enabled: boolean;
    preserveHistory: boolean;
    trackChanges: boolean;
  };
  notifications: {
    enabled: boolean;
    channels: string[];
    batchSize: number;
  };
}
```

## Real-World Use Cases

### 1. Content Management

```typescript
// Manage duplicate content in knowledge base
const contentDuplicates = await memori.findContentDuplicates({
  contentTypes: ['article', 'documentation'],
  similarityThreshold: 0.9,
  autoConsolidate: true
});

// Consolidate similar articles
for (const group of contentDuplicates) {
  await memori.consolidateContent(group.primary, group.duplicates, {
    strategy: 'merge',
    preserveMetadata: true
  });
}
```

### 2. Chat History Cleanup

```typescript
// Clean up duplicate chat sessions
const chatDuplicates = await memori.findChatDuplicates({
  timeWindow: '24_hours',
  similarityThreshold: 0.95,
  mergeConversations: true
});

// Merge similar conversations
await memori.mergeConversations(chatDuplicates);
```

### 3. Knowledge Base Maintenance

```typescript
// Maintain knowledge base quality
const kbMaintenance = await memori.performKnowledgeBaseMaintenance({
  operations: [
    'detect_duplicates',
    'consolidate_similar',
    'remove_redundant',
    'update_references'
  ],
  qualityThreshold: 0.8,
  dryRun: false
});
```

### 4. Search Result Optimization

```typescript
// Optimize search results by removing duplicates
const optimizedResults = await memori.searchMemories('query', {
  optimization: {
    removeDuplicates: true,
    consolidateSimilar: true,
    boostUniqueContent: true
  }
});
```

## Error Handling and Recovery

### Consolidation Error Handling

```typescript
try {
  const result = await memori.consolidateDuplicates(primaryId, duplicateIds);
} catch (error) {
  if (error instanceof ConsolidationError) {
    // Handle consolidation-specific errors
    console.error('Consolidation failed:', error.reason);

    // Attempt recovery
    if (error.recoveryPossible) {
      await memori.recoverConsolidation(error.consolidationId);
    }
  }
}
```

### Rollback Support

```typescript
// Rollback consolidation if needed
const rollbackResult = await memori.rollbackConsolidation(
  consolidationId,
  {
    reason: 'Quality issues detected',
    preserveBackup: true,
    notifyStakeholders: true
  }
);
```

## Best Practices

### 1. Set Appropriate Similarity Thresholds

```typescript
// Different thresholds for different content types
const thresholds = {
  // High threshold for critical content
  criticalDocuments: 0.95,

  // Medium threshold for general content
  generalContent: 0.85,

  // Lower threshold for conversational content
  conversations: 0.75
};
```

### 2. Monitor Consolidation Impact

```typescript
// Monitor the impact of consolidation
const impact = await memori.measureConsolidationImpact({
  timeRange: 'last_30_days',
  metrics: [
    'storage_saved',
    'search_performance',
    'memory_quality',
    'access_patterns'
  ]
});
```

### 3. Use Progressive Consolidation

```typescript
// Progressive consolidation approach
const progressiveConfig = {
  phases: [
    {
      similarityThreshold: 0.95,    // Very similar first
      batchSize: 10,
      delay: 1000
    },
    {
      similarityThreshold: 0.85,    // Then medium similarity
      batchSize: 25,
      delay: 500
    },
    {
      similarityThreshold: 0.75,    // Finally lower similarity
      batchSize: 50,
      delay: 100
    }
  ]
};
```

### 4. Preserve Important Metadata

```typescript
// Always preserve critical metadata during consolidation
const preservationConfig = {
  preserveFields: [
    'createdAt',                    // Creation timestamp
    'author',                       // Original author
    'source',                       // Source information
    'confidenceScore',              // Quality indicators
    'accessCount',                  // Usage statistics
    'lastAccessed'                  // Access patterns
  ],
  mergeStrategy: 'latest_wins'
};
```

## Performance Optimization

### Indexing for Duplicate Detection

```typescript
// Optimize database for duplicate detection
const duplicateIndexes = [
  'CREATE INDEX idx_memory_content_hash ON long_term_memory(content_hash)',
  'CREATE INDEX idx_memory_similarity ON long_term_memory(similarity_group)',
  'CREATE INDEX idx_memory_duplicate_status ON long_term_memory(is_duplicate, duplicate_of)'
];
```

### Caching Strategy

```typescript
// Cache duplicate detection results
const cacheConfig = {
  similarityCache: {
    enabled: true,
    ttl: 300000,                    // 5 minutes
    maxSize: 1000
  },
  consolidationCache: {
    enabled: true,
    ttl: 3600000,                   // 1 hour
    maxSize: 100
  }
};
```

### Batch Processing Optimization

```typescript
// Optimize batch processing
const batchConfig = {
  optimalBatchSize: 50,
  maxConcurrentBatches: 3,
  retryFailedBatches: true,
  progressReporting: true
};
```

This comprehensive duplicate management system ensures that Memorits maintains high-quality, non-redundant memory storage while providing flexible consolidation strategies and robust error handling for production environments.