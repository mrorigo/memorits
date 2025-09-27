# Conscious Processing in Memorits

Conscious processing is Memorits' sophisticated background memory management system that mimics human-like reflection and learning. This advanced feature enables AI agents to maintain persistent context, learn from interactions, and provide increasingly relevant responses over time by intelligently promoting important memories to working memory.

## Overview

The conscious processing system provides:

- **Human-like Memory Management**: Automatic promotion of important memories to working context
- **One-Shot Context Injection**: Permanent context that's injected once and maintained
- **Background Analysis**: Continuous analysis and organization of conversational data
- **Quality-based Selection**: Intelligent selection of the most relevant memories
- **Duplicate Prevention**: Automatic deduplication of conscious memories
- **Session Persistence**: Context maintained across conversation sessions

## Core Architecture

### ConsciousAgent Class

The `ConsciousAgent` manages the entire conscious processing lifecycle:

```typescript
import { ConsciousAgent, ConsciousMemory } from 'memorits';

const consciousAgent = new ConsciousAgent(databaseManager, 'default');

// Initialize existing conscious memories
await consciousAgent.initialize_existing_conscious_memories();

// Run conscious ingestion process
await consciousAgent.run_conscious_ingest();

// Check for new conscious memories
await consciousAgent.check_for_context_updates();

// Consolidate duplicate conscious memories
await consciousAgent.consolidateDuplicates();
```

### Memory Classification

Conscious processing works with memories classified as 'conscious-info':

```typescript
interface ConsciousMemory {
  id: string;
  content: string;
  summary: string;
  classification: 'conscious-info';
  importance: 'critical' | 'high' | 'medium' | 'low';
  topic?: string;
  entities: string[];
  keywords: string[];
  confidenceScore: number;
  classificationReason: string;
}
```

## Conscious Memory Lifecycle

### 1. Memory Classification

```typescript
// Automatic classification during memory processing
const memoryAnalysis = await memoryAgent.processConversation({
  userInput: 'I am a software engineer specializing in AI',
  aiOutput: 'Great! I\'ll remember that you\'re an AI software engineer.',
  context: conversationContext
});

// Result may be classified as conscious-info
if (memoryAnalysis.classification === 'conscious-info') {
  console.log('This memory will be processed for conscious context');
}
```

### 2. Conscious Ingestion Process

```typescript
// Run the conscious ingestion process
const ingestionResult = await consciousAgent.run_conscious_ingest();

// Process includes:
// 1. Find unprocessed conscious-info memories
// 2. Evaluate importance and relevance
// 3. Copy to short-term memory for immediate availability
// 4. Mark as processed to prevent duplicates
```

### 3. Context Initialization

```typescript
// Initialize context from existing conscious memories
const existingContext = await consciousAgent.initialize_existing_conscious_memories();

// Returns conscious memories currently available as context
console.log(`Initialized ${existingContext.length} conscious memories as context`);
```

### 4. Continuous Monitoring

```typescript
// Check for new conscious memories periodically
const newContext = await consciousAgent.check_for_context_updates();

// Returns any new conscious memories that were processed
if (newContext.length > 0) {
  console.log(`Added ${newContext.length} new memories to conscious context`);
}
```

## Advanced Configuration

### Conscious Processing Configuration

```typescript
interface ConsciousProcessingConfig {
  enabled: boolean;
  autoRun: boolean;                    // Run automatically on startup
  monitoringInterval: number;         // Check interval in milliseconds
  maxConsciousMemories: number;       // Maximum conscious memories to maintain
  importanceThreshold: number;        // Minimum importance score
  enableDuplicateDetection: boolean;  // Enable automatic duplicate detection
  processingBatchSize: number;        // Batch size for processing
}
```

### Memory Selection Criteria

```typescript
// Configure conscious memory selection
const selectionConfig = {
  importanceWeights: {
    'critical': 1.0,
    'high': 0.8,
    'medium': 0.5,
    'low': 0.2
  },
  relevanceFactors: {
    recency: 0.3,                     // Recent memories get boost
    frequency: 0.2,                   // Frequently accessed memories
    entities: 0.3,                    // Entity relevance
    topics: 0.2                       // Topic relevance
  },
  maxMemories: 10,                    // Maximum conscious memories
  minConfidence: 0.7                  // Minimum confidence threshold
};
```

## One-Shot Context Injection

### How It Works

```typescript
// Configure one-shot context injection
const contextConfig = {
  injectionStrategy: 'startup',       // Inject at startup
  persistence: 'permanent',           // Permanent context
  maxContextLength: 4000,             // Max context length
  compressionEnabled: true,           // Enable context compression
  priorityOrder: [                    // Context priority order
    'user_identity',
    'preferences',
    'current_projects',
    'skills',
    'relationships'
  ]
};
```

### Context Categories

Conscious memories are automatically categorized for optimal organization:

```typescript
enum ConsciousContextCategory {
  USER_IDENTITY = 'user_identity',     // Personal identity information
  PREFERENCES = 'preferences',         // User preferences and habits
  SKILLS = 'skills',                   // Skills and expertise
  CURRENT_PROJECTS = 'current_projects', // Ongoing work and projects
  RELATIONSHIPS = 'relationships',     // Important relationships
  KNOWLEDGE = 'knowledge',             // Important knowledge areas
  GOALS = 'goals'                      // Goals and objectives
}
```

## Duplicate Management

### Automatic Duplicate Detection

```typescript
// Configure duplicate detection for conscious memories
const duplicateConfig = {
  similarityThreshold: 0.8,           // 80% similarity threshold
  comparisonFields: ['content', 'summary', 'entities'],
  consolidationStrategy: 'merge',     // Merge or keep best
  preserveOriginals: true             // Keep original memories for audit
};

// Run duplicate consolidation
const consolidationResult = await consciousAgent.consolidateDuplicates({
  similarityThreshold: 0.8,
  dryRun: false
});

console.log(`Consolidated ${consolidationResult.consolidated} duplicate memories`);
```

### Similarity Analysis

```typescript
// Analyze similarity between conscious memories
const similarity = await consciousAgent.calculateSimilarity(
  memory1,
  memory2,
  {
    algorithm: 'jaccard',
    caseSensitive: false,
    includeEntities: true,
    includeTopics: true
  }
);
```

## Integration with Search

### Conscious Context in Search

```typescript
// Search that includes conscious context
const contextAwareResults = await memori.searchMemories('project details', {
  includeConsciousContext: true,
  consciousContextWeight: 0.8,        // Weight conscious context heavily
  maxConsciousMemories: 5             // Include up to 5 conscious memories
});
```

### Context-Aware Ranking

```typescript
// Configure context-aware search ranking
const rankingConfig = {
  baseStrategy: 'fts5',
  contextBoost: 0.3,                  // Boost for conscious context matches
  recencyBoost: 0.2,                  // Boost for recent memories
  importanceBoost: 0.4,               // Boost for high importance
  topicRelevanceBoost: 0.1            // Boost for topic relevance
};
```

## Performance Optimization

### Memory Management

```typescript
// Optimize conscious memory management
const optimizationConfig = {
  memoryLimits: {
    maxConsciousMemories: 20,         // Maximum conscious memories
    maxShortTermCopies: 10,           // Maximum short-term copies
    cleanupThreshold: 0.3             // Cleanup memories below threshold
  },
  performance: {
    enableCaching: true,
    cacheTTL: 300000,                 // 5 minutes
    batchProcessing: true,
    batchSize: 10
  }
};
```

### Background Processing

```typescript
// Configure background processing
const backgroundConfig = {
  enabled: true,
  interval: 60000,                    // Check every minute
  maxProcessingTime: 5000,            // Max 5 seconds per run
  priority: 'normal',                 // Processing priority
  enableParallel: false               // Disable parallel processing
};
```

## Real-World Use Cases

### 1. Personal AI Assistant

```typescript
// Maintain user context for personal assistant
const personalAssistant = new ConsciousAgent(dbManager, 'user-session');

// Initialize with user's personal context
await personalAssistant.initialize_existing_conscious_memories();

// User mentions they are a developer
const developerMemory = await processConversation(
  'I am a full-stack developer specializing in React and Node.js'
);

// Automatically becomes conscious context
const context = await personalAssistant.check_for_context_updates();
console.log('New conscious context available:', context.length > 0);
```

### 2. Project Management Assistant

```typescript
// Track project context and decisions
const projectAssistant = new ConsciousAgent(dbManager, 'project-alpha');

// Process project-related conversations
const projectContext = await projectAssistant.run_conscious_ingest();

// Project decisions become permanent context
const decisions = await memori.searchMemories('architecture decisions', {
  includeConsciousContext: true,
  categories: ['essential']
});
```

### 3. Learning Companion

```typescript
// Maintain learning context and progress
const learningCompanion = new ConsciousAgent(dbManager, 'learning-session');

// Track learning goals and preferences
const learningContext = await learningCompanion.initialize_existing_conscious_memories();

// Learning sessions build conscious knowledge
const progressContext = await learningCompanion.check_for_context_updates();
```

### 4. Professional Assistant

```typescript
// Maintain professional context and relationships
const professionalAssistant = new ConsciousAgent(dbManager, 'professional');

// Track professional relationships and expertise
const professionalContext = await professionalAssistant.run_conscious_ingest();

// Professional context informs all interactions
const networkContext = await memori.searchMemories('client relationships', {
  includeConsciousContext: true
});
```

## Monitoring and Analytics

### Conscious Memory Statistics

```typescript
// Get conscious memory statistics
const stats = await consciousAgent.getStatistics({
  includeTrends: true,
  timeRange: 'last_30_days'
});

console.log('Conscious Memory Stats:', {
  totalConsciousMemories: stats.total,
  activeContextMemories: stats.active,
  averageImportance: stats.averageImportance,
  processingSuccessRate: stats.successRate,
  trends: stats.trends
});
```

### Context Quality Metrics

```typescript
// Monitor context quality
const qualityMetrics = await consciousAgent.getQualityMetrics();

console.log('Context Quality:', {
  relevance: qualityMetrics.relevance,
  completeness: qualityMetrics.completeness,
  accuracy: qualityMetrics.accuracy,
  freshness: qualityMetrics.freshness
});
```

## Configuration Options

### Complete Configuration Example

```typescript
const consciousConfig = {
  processing: {
    enabled: true,
    autoRun: true,
    monitoringInterval: 60000,        // 1 minute
    maxConsciousMemories: 15,
    importanceThreshold: 0.6,
    enableDuplicateDetection: true,
    processingBatchSize: 5
  },
  selection: {
    importanceWeights: {
      'critical': 1.0,
      'high': 0.8,
      'medium': 0.6,
      'low': 0.3
    },
    relevanceFactors: {
      recency: 0.3,
      frequency: 0.2,
      entities: 0.3,
      topics: 0.2
    }
  },
  context: {
    injectionStrategy: 'startup',
    persistence: 'permanent',
    maxContextLength: 4000,
    compressionEnabled: true,
    priorityOrder: [
      'user_identity',
      'preferences',
      'current_projects',
      'skills'
    ]
  },
  duplicates: {
    similarityThreshold: 0.8,
    consolidationStrategy: 'merge',
    preserveOriginals: true
  }
};
```

## Error Handling and Recovery

### Graceful Error Handling

```typescript
try {
  await consciousAgent.run_conscious_ingest();
} catch (error) {
  if (error instanceof ConsciousProcessingError) {
    // Handle conscious processing specific errors
    console.error('Conscious processing failed:', error.reason);

    // Attempt recovery
    await consciousAgent.recoverFromError(error);
  } else {
    // Handle general errors
    console.error('Unexpected error in conscious processing:', error);
  }
}
```

### Recovery Mechanisms

```typescript
// Recover from processing failures
const recoveryResult = await consciousAgent.recover({
  failedOperation: 'ingestion',
  memoryIds: failedMemoryIds,
  strategy: 'retry_with_backoff',
  maxRetries: 3
});
```

## Best Practices

### 1. Set Appropriate Memory Limits

```typescript
// Balance context quality vs performance
const memoryLimits = {
  // For personal assistants: More context
  personalAssistant: {
    maxConsciousMemories: 20,
    importanceThreshold: 0.5
  },

  // For professional tools: Focused context
  professionalTool: {
    maxConsciousMemories: 10,
    importanceThreshold: 0.7
  },

  // For general chat: Balanced approach
  generalChat: {
    maxConsciousMemories: 15,
    importanceThreshold: 0.6
  }
};
```

### 2. Monitor Context Quality

```typescript
// Regularly assess context quality
const qualityAssessment = await consciousAgent.assessContextQuality();

if (qualityAssessment.overall < 0.7) {
  console.log('Context quality is low, consider cleanup');
  await consciousAgent.optimizeContext();
}
```

### 3. Handle Context Conflicts

```typescript
// Resolve conflicting conscious memories
const conflictResolution = await consciousAgent.resolveConflicts({
  conflictingMemories: [memory1, memory2],
  resolutionStrategy: 'merge',
  preserveHistory: true
});
```

### 4. Optimize for Performance

```typescript
// Performance optimization strategies
const performanceConfig = {
  processing: {
    enableBatching: true,
    batchSize: 10,
    enableCaching: true,
    cacheTTL: 300000
  },
  memory: {
    enableCompression: true,
    compressionThreshold: 2000,
    enableCleanup: true,
    cleanupInterval: 86400000 // 24 hours
  }
};
```

## Integration with Other Features

### Combining with Temporal Filtering

```typescript
// Use temporal filtering with conscious processing
const temporalConsciousQuery = await memori.searchMemories('recent changes', {
  temporalFilters: {
    relativeExpressions: ['last week']
  },
  includeConsciousContext: true,
  consciousContextCategories: ['current_projects', 'preferences']
});
```

### Combining with Metadata Filtering

```typescript
// Advanced filtering with conscious context
const advancedQuery = await memori.searchMemories('technical decisions', {
  metadataFilters: {
    fields: [
      { key: 'importance', value: 0.8, operator: 'gte' }
    ]
  },
  includeConsciousContext: true,
  contextWeight: 0.7
});
```

## Advanced Usage Patterns

### Context-Aware Conversations

```typescript
// Maintain context across conversation sessions
class ContextAwareAssistant {
  private consciousAgent: ConsciousAgent;

  async startNewSession(userId: string) {
    // Initialize with user's conscious context
    const context = await this.consciousAgent.initialize_existing_conscious_memories();

    // Start conversation with full context awareness
    return {
      context: context,
      sessionId: generateSessionId(),
      contextInjected: true
    };
  }

  async processMessage(message: string, sessionId: string) {
    // Check for new conscious memories
    const newContext = await this.consciousAgent.check_for_context_updates();

    // Process message with updated context
    const response = await this.processWithContext(message, [
      ...sessionContext,
      ...newContext
    ]);

    return response;
  }
}
```

### Dynamic Context Adaptation

```typescript
// Adapt context based on conversation flow
const adaptiveContext = {
  baseContext: await consciousAgent.getBaseContext(),
  situationalContext: await consciousAgent.getSituationalContext(currentTopic),
  userSpecificContext: await consciousAgent.getUserSpecificContext(userId)
};

// Combine contexts dynamically
const combinedContext = await consciousAgent.combineContexts([
  adaptiveContext.baseContext,
  adaptiveContext.situationalContext,
  adaptiveContext.userSpecificContext
]);
```

This sophisticated conscious processing system enables AI agents to maintain persistent, relevant context that evolves and adapts based on user interactions, creating truly intelligent assistants that remember and learn from every conversation.