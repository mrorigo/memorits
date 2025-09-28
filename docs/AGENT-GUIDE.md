# AI Agent Guide: Using memorits Library

## Overview
memorits is a TypeScript library enabling AI agents with persistent memory, LLM integration, and advanced planning capabilities.

## Quick Start

### Installation
```bash
npm install memorits
```

### Basic Memory-Enabled Agent
```typescript
import { Memori, MemoryAgent, OpenAIProvider } from 'memorits';

const memori = new Memori();
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY
});

memori.registerProvider(provider);
const agent = new MemoryAgent({ name: 'assistant', memori });

// Store memory
await agent.addMemory({
  content: "Important fact to remember",
  tags: ['category', 'context']
});

// Recall memories
const memories = await agent.searchMemories({
  query: "What do I know about...",
  limit: 3
});
```

## Core Components

### 1. Memori Instance
- Central orchestrator
- Manages providers and agents
- Handles memory persistence

### 2. Agents
Three main types:
- **MemoryAgent**: Basic memory operations with search and retrieval
- **ConsciousAgent**: Advanced planning + memory with relationship processing
- **ProcessingStateManager**: Enterprise-grade memory processing state management

### 3. Providers
LLM integration (e.g., OpenAI)

## Key Operations

### Memory Management
```typescript
// Add memory
await agent.addMemory({
  content: "Information to store",
  tags: ['context']
});

// Search
const results = await agent.searchMemories({
  query: "Search terms",
  limit: 5
});

// Summarize
const summary = await agent.summarizeMemories({
  filter: { tags: ['meeting'] }
});
```

### Advanced Agent Features

#### **Memory Processing State Management**
```typescript
import { ProcessingStateManager, MemoryProcessingState } from 'memorits';

class SmartAgent extends ConsciousAgent {
  private stateManager: ProcessingStateManager;

  constructor() {
    super();
    this.stateManager = new ProcessingStateManager({
      enableHistoryTracking: true,
      maxHistoryEntries: 100,
      enableMetrics: true,
      retryAttempts: 3
    });
  }

  async processTaskWithStateTracking(goal: string) {
    const memoryId = await this.generateMemoryId();

    // Initialize memory state
    await this.stateManager.initializeMemoryState(
      memoryId,
      MemoryProcessingState.PENDING
    );

    try {
      // Transition to processing
      await this.stateManager.transitionToState(
        memoryId,
        MemoryProcessingState.PROCESSING,
        { reason: 'Starting task processing', agentId: this.name }
      );

      // Generate plan with relationship context
      const plan = await this.plan(goal);

      // Execute with memory context and state tracking
      for (const step of plan.steps) {
        await this.stateManager.transitionToState(
          memoryId,
          MemoryProcessingState.CONSCIOUS_PROCESSING,
          { reason: `Executing step: ${step.description}` }
        );

        const context = await this.searchMemories({
          query: step.description,
          limit: 2,
          includeRelatedMemories: true,
          maxRelationshipDepth: 2
        });

        await this.executeStep(step, context);
      }

      // Mark as completed
      await this.stateManager.transitionToState(
        memoryId,
        MemoryProcessingState.CONSCIOUS_PROCESSED,
        { reason: 'Task completed successfully' }
      );

    } catch (error) {
      // Handle failure with retry logic
      await this.stateManager.transitionToState(
        memoryId,
        MemoryProcessingState.FAILED,
        {
          reason: 'Task failed',
          errorMessage: error.message
        }
      );

      // Attempt retry
      const retrySuccess = await this.stateManager.retryTransition(
        memoryId,
        MemoryProcessingState.CONSCIOUS_PROCESSING,
        { maxRetries: 3 }
      );

      if (!retrySuccess) {
        throw new Error(`Task failed permanently: ${error.message}`);
      }
    }
  }

  // Get state statistics for monitoring
  getProcessingStats() {
    const stats = this.stateManager.getStateStatistics();
    const history = this.stateManager.getMetrics();

    return {
      stateDistribution: stats,
      transitionCounts: history,
      pendingMemories: this.stateManager.getMemoriesByState(MemoryProcessingState.PENDING),
      failedMemories: this.stateManager.getMemoriesByState(MemoryProcessingState.FAILED)
    };
  }
}
```

#### **Advanced Memory Relationship Processing**
```typescript
class RelationshipAwareAgent extends ConsciousAgent {
  async processConversationWithRelationships(userInput: string, context: string) {
    // Extract entities and relationships using LLM
    const relationships = await this.extractRelationships(userInput, context);

    // Search with relationship context
    const relatedMemories = await this.searchMemories(userInput, {
      includeRelatedMemories: true,
      maxRelationshipDepth: 3,
      minRelationshipConfidence: 0.7,
      filterExpression: 'importance_score >= 0.6'
    });

    // Process relationships for enhanced context
    const enhancedContext = await this.buildRelationshipContext(relatedMemories);

    // Generate response with relationship awareness
    const response = await this.generateResponse(userInput, enhancedContext);

    // Store with relationship metadata
    await this.addMemory({
      content: `User: ${userInput}\nAssistant: ${response}`,
      tags: ['conversation', 'relationship-processed'],
      metadata: {
        relationships: relationships,
        relatedMemoryCount: relatedMemories.length,
        contextEnhancement: enhancedContext.enhancement
      }
    });

    return response;
  }

  private async extractRelationships(content: string, context: string) {
    // Use OpenAI to extract relationships
    const extractionPrompt = `
      Analyze the following conversation and extract relationships:

      Content: ${content}
      Context: ${context}

      Identify:
      1. Entity relationships (people, places, concepts)
      2. Temporal relationships (before, after, during)
      3. Semantic relationships (similar, related, opposite)
      4. Continuation patterns

      Return as JSON structure.
    `;

    const response = await this.provider.complete({
      prompt: extractionPrompt,
      temperature: 0.3
    });

    return JSON.parse(response);
  }

  private async buildRelationshipContext(memories: any[]) {
    // Build enhanced context using relationship graph
    const relationshipGraph = this.buildRelationshipGraph(memories);
    const contextPaths = this.findOptimalContextPaths(relationshipGraph);

    return {
      primaryContext: contextPaths.primary,
      relatedContext: contextPaths.related,
      enhancement: contextPaths.improvement,
      confidence: this.calculateContextConfidence(contextPaths)
    };
  }
}
```

#### **Duplicate Consolidation Agent**
```typescript
class ConsolidationAgent extends MemoryAgent {
  async consolidateDuplicateMemories() {
    // Find potential duplicates using multiple strategies
    const candidates = await this.findConsolidationCandidates({
      similarityThreshold: 0.8,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
      minContentLength: 100
    });

    for (const candidate of candidates) {
      try {
        // Validate consolidation safety
        const safetyCheck = await this.validateConsolidationSafety(candidate);

        if (safetyCheck.isSafe) {
          // Perform consolidation with rollback support
          const result = await this.performSafeConsolidation(candidate, {
            enableBackup: true,
            preserveMetadata: true,
            qualityScoring: true
          });

          console.log(`Consolidated ${result.consolidatedCount} memories`);
          console.log(`Quality score: ${result.qualityScore}`);
        } else {
          console.warn(`Skipping unsafe consolidation: ${safetyCheck.reason}`);
        }
      } catch (error) {
        console.error(`Consolidation failed for candidate ${candidate.id}:`, error);

        // Log failure for analysis
        await this.logConsolidationFailure(candidate, error);
      }
    }
  }

  private async findConsolidationCandidates(options: {
    similarityThreshold: number;
    maxAge: number;
    minContentLength: number;
  }) {
    // Search for similar memories
    const memories = await this.searchMemories('', {
      limit: 1000,
      filterExpression: `created_at > '${new Date(Date.now() - options.maxAge).toISOString()}'`
    });

    // Find duplicates using semantic similarity
    const duplicates = await this.findDuplicateMemories(memories, {
      similarityThreshold: options.similarityThreshold,
      includeSemanticSimilarity: true
    });

    return duplicates.filter(d => d.similarity > options.similarityThreshold);
  }
}
```

## Best Practices

1. **Environment Setup**
```typescript
// config.ts
export const config = {
  openaiKey: process.env.OPENAI_API_KEY,
  dbUrl: process.env.DATABASE_URL || 'file:./memori.db'
};
```

2. **Error Handling**
```typescript
try {
  await agent.addMemory({
    content: "Critical info",
    tags: ['important']
  });
} catch (error) {
  if (error.code === 'DB_ERROR') {
    // Handle storage issues
  }
  // Re-throw unexpected errors
  throw error;
}
```

3. **Testing**
```typescript
// agent.test.ts
describe('Agent Memory', () => {
  let agent: MemoryAgent;
  
  beforeEach(async () => {
    const memori = new Memori({
      database: ':memory:'  // Test database
    });
    agent = new MemoryAgent({ 
      name: 'test-agent',
      memori 
    });
  });

  test('stores and recalls memories', async () => {
    await agent.addMemory({
      content: "Test data",
      tags: ['test']
    });

    const results = await agent.searchMemories({
      query: "test",
      limit: 1
    });

    expect(results[0].content).toBe("Test data");
  });
});
```

## Tips for AI Agent Implementation

1. **Memory Context**
- Tag memories appropriately with relationship metadata
- Use semantic search with relationship context for enhanced relevance
- Maintain memory coherence with state tracking
- Leverage duplicate consolidation for cleaner memory bases

2. **Planning**
- Break complex tasks into steps with state management
- Reference relevant memories using relationship graphs
- Store execution results with processing state tracking
- Use performance monitoring for optimization insights

3. **Performance & Monitoring**
- Batch memory operations with size limits
- Clean up old memories using automated maintenance
- Use memory summaries with quality scoring
- Monitor performance with real-time dashboards
- Implement comprehensive error handling with circuit breakers

4. **Advanced Features**
- Enable relationship processing for context enhancement
- Use duplicate consolidation for memory optimization
- Implement state management for complex workflows
- Leverage performance analytics for continuous improvement

## Common Patterns

### Contextual Agent
```typescript
class ContextualAgent extends MemoryAgent {
  async respond(input: string) {
    // Get relevant context
    const context = await this.searchMemories({
      query: input,
      limit: 3
    });

    // Use LLM with context
    const response = await this.provider.chat({
      messages: [
        { role: 'system', content: this.buildContext(context) },
        { role: 'user', content: input }
      ]
    });

    // Store interaction
    await this.addMemory({
      content: `User: ${input}\nAssistant: ${response}`,
      tags: ['conversation']
    });

    return response;
  }
}
```

### Learning Agent
```typescript
class LearningAgent extends ConsciousAgent {
  async learn(information: string) {
    // Extract key points
    const points = await this.provider.complete({
      prompt: `Extract key facts from: ${information}`
    });

    // Store as separate memories
    for (const point of points) {
      await this.addMemory({
        content: point,
        tags: ['learned', 'fact']
      });
    }

    // Update knowledge summary
    await this.summarizeAndStore();
  }
}
```

## Reference

### Memory Operations
- `addMemory(content, tags?)`
- `searchMemories(query, opts?)`
- `getMemoryById(id)`
- `summarizeMemories(filter?)`

### Agent Methods
- `plan(goal)`
- `executeStep(step)`
- `think()`

### Provider Interface
- `chat(messages)`
- `complete(prompt)`

## Advanced Agent Patterns

### Performance Monitoring Agent
```typescript
class PerformanceMonitoringAgent extends MemoryAgent {
  private dashboard: PerformanceDashboardService;
  private alertThresholds: Record<string, number>;

  constructor() {
    super();
    this.dashboard = new PerformanceDashboardService();
    this.dashboard.initializeDashboard();

    this.alertThresholds = {
      searchLatency: 1000,    // ms
      errorRate: 0.05,        // 5%
      memoryUsage: 100 * 1024 * 1024, // 100MB
    };

    this.setupAlertCallbacks();
  }

  private setupAlertCallbacks() {
    this.dashboard.addAlertCallback(async (alert) => {
      console.log(`Performance Alert: ${alert.title}`);

      // Store alert in memory for analysis
      await this.addMemory({
        content: `Performance alert: ${alert.description}`,
        tags: ['performance', 'alert', alert.severity],
        metadata: {
          alertType: alert.type,
          component: alert.component,
          value: alert.value,
          threshold: alert.threshold
        }
      });

      // Trigger response based on severity
      if (alert.severity === 'critical') {
        await this.handleCriticalAlert(alert);
      }
    });
  }

  async handleCriticalAlert(alert: PerformanceAlert) {
    // Get recent performance data
    const recentMetrics = this.dashboard.getRealTimeMetrics(alert.component, undefined, 20);

    // Analyze root cause
    const analysis = await this.analyzePerformanceIssue(alert, recentMetrics);

    // Store analysis for future reference
    await this.addMemory({
      content: `Critical performance analysis: ${analysis.summary}`,
      tags: ['performance', 'analysis', 'critical'],
      metadata: {
        alertId: alert.id,
        analysis: analysis,
        recommendations: analysis.recommendations
      }
    });

    // Execute remediation if possible
    if (analysis.remediation) {
      await this.executeRemediation(analysis.remediation);
    }
  }

  getPerformanceReport() {
    return {
      status: this.dashboard.getSystemStatusOverview(),
      metrics: this.dashboard.getRealTimeMetrics(undefined, undefined, 100),
      alerts: this.dashboard.getActiveAlerts(),
      trends: this.calculatePerformanceTrends()
    };
  }
}
```

### Error Handling & Recovery Agent
```typescript
class ResilientAgent extends ConsciousAgent {
  private circuitBreakers: Map<string, CircuitBreaker> = new Map();
  private errorRecoveryStrategies: Map<string, ErrorRecoveryStrategy> = new Map();

  async executeWithErrorHandling(operation: () => Promise<any>, context: string) {
    const circuitBreaker = this.getCircuitBreaker(context);

    if (circuitBreaker.isOpen()) {
      // Use fallback strategy
      return await this.executeFallbackStrategy(context, operation);
    }

    try {
      const result = await operation();
      circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      circuitBreaker.recordFailure();

      // Attempt recovery
      const recoveryResult = await this.attemptErrorRecovery(error, context);

      if (recoveryResult.success) {
        return recoveryResult.result;
      } else {
        // Store error for analysis
        await this.logErrorForAnalysis(error, context, recoveryResult);
        throw error;
      }
    }
  }

  private getCircuitBreaker(context: string): CircuitBreaker {
    if (!this.circuitBreakers.has(context)) {
      this.circuitBreakers.set(context, new CircuitBreaker({
        failureThreshold: 5,
        resetTimeout: 60000, // 1 minute
        monitoringPeriod: 300000 // 5 minutes
      }));
    }
    return this.circuitBreakers.get(context)!;
  }

  private async executeFallbackStrategy(context: string, originalOperation: () => Promise<any>) {
    const fallback = this.errorRecoveryStrategies.get(context);

    if (fallback) {
      try {
        return await fallback.execute();
      } catch (fallbackError) {
        console.error(`Fallback also failed for ${context}:`, fallbackError);
      }
    }

    // Last resort: return cached result or default
    return await this.getCachedResult(context);
  }

  private async attemptErrorRecovery(error: Error, context: string) {
    const strategy = this.selectRecoveryStrategy(error, context);

    try {
      const recoveryResult = await strategy.attemptRecovery(error);

      if (recoveryResult.success) {
        // Log successful recovery
        await this.addMemory({
          content: `Error recovery successful for ${context}`,
          tags: ['error-recovery', 'success'],
          metadata: {
            originalError: error.message,
            recoveryStrategy: strategy.name,
            recoveryTime: recoveryResult.timeMs
          }
        });

        return recoveryResult;
      }
    } catch (recoveryError) {
      return {
        success: false,
        error: recoveryError
      };
    }

    return { success: false };
  }

  private selectRecoveryStrategy(error: Error, context: string): ErrorRecoveryStrategy {
    // Select appropriate strategy based on error type and context
    if (error.message.includes('timeout')) {
      return new TimeoutRecoveryStrategy();
    } else if (error.message.includes('database')) {
      return new DatabaseRecoveryStrategy();
    } else if (error.message.includes('memory')) {
      return new MemoryRecoveryStrategy();
    } else {
      return new GenericRecoveryStrategy();
    }
  }
}
```

## Environment Variables
```env
OPENAI_API_KEY=your_key_here
DATABASE_URL=file:./memori.db
LOG_LEVEL=info

# New configuration options
MEMORI_CONFIG_DIR=./config/search
MEMORI_ENABLE_PERFORMANCE_MONITORING=true
MEMORI_ENABLE_RELATIONSHIP_PROCESSING=true
MEMORI_ENABLE_DUPLICATE_CONSOLIDATION=true
MEMORI_MAX_MEMORY_PROCESSING_HISTORY=1000
MEMORI_PERFORMANCE_DASHBOARD_ENABLED=true
```

Remember: Focus on your agent's logic and let memorits handle the memory and LLM integration complexities.