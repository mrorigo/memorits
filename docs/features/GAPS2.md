rchest

# GAPS2: SearchStrategyConfigManager Implementation Gaps Closure Plan

## Overview

This document outlines a comprehensive plan to address critical implementation gaps in the SearchStrategyConfigManager and related search infrastructure. Based on analysis of the current codebase, multiple placeholder implementations and missing functionality have been identified that prevent the search system from operating effectively.

## Priority Classification

### Phase 1: Critical Infrastructure (Week 1)
**Objective**: Implement core file system operations and configuration persistence

### Phase 2: Search Strategy Completion (Week 2)
**Objective**: Complete missing search strategy implementations

### Phase 3: Advanced Features (Week 3-4)
**Objective**: Implement memory relationships and advanced filtering

### Phase 4: Optimization (Week 5)
**Objective**: Performance tuning and maintenance systems

---

## Phase 1: Critical Infrastructure

### 1.1 File System Implementation Gaps
**Priority**: Critical | **Impact**: High | **Effort**: Low

**Current State**:
- `FileConfigurationPersistenceManager` has placeholder implementations that throw errors
- File reading/writing operations are not implemented (Lines 474-492)
- File existence checks always return false
- Directory listing returns empty array
- Delete operation just logs instead of actually deleting (Line 534)

**Files Affected**:
- `memori-ts/src/core/search/SearchStrategyConfigManager.ts`

**Implementation Plan**:

#### Step 1.1.1: Replace Placeholder File System
**Location**: Lines 474-492

```typescript
// Replace placeholder file system with actual Node.js fs implementation
private readonly fs: any = {
  readFile: async (path: string) => {
    const fs = await import('fs/promises');
    return await fs.readFile(path, 'utf8');
  },
  writeFile: async (path: string, data: string) => {
    const fs = await import('fs/promises');
    await fs.writeFile(path, data, 'utf8');
  },
  exists: async (path: string) => {
    const fs = await import('fs/promises');
    try {
      await fs.access(path);
      return true;
    } catch {
      return false;
    }
  },
  listDir: async (path: string) => {
    const fs = await import('fs/promises');
    return await fs.readdir(path);
  },
};
```

#### Step 1.1.2: Complete Delete Implementation
**Location**: Line 534

```typescript
async delete(strategyName: string): Promise<void> {
  const filename = `${strategyName}.json`;
  const filepath = `${this.configDir}/${filename}`;

  try {
    const exists = await this.fs.exists(filepath);
    if (!exists) {
      return;
    }

    const fs = await import('fs/promises');
    await fs.unlink(filepath);
  } catch (error) {
    throw new Error(`Failed to delete configuration for ${strategyName}: ${error}`);
  }
}
```

#### Step 1.1.3: Add Configuration Directory Initialization
**Location**: Constructor

```typescript
constructor(configDir: string = './config/search') {
  this.configDir = configDir;
  this.initializeConfigDirectory();
  // In a real implementation, this would use the actual file system
  this.fs = this.getFileSystemImplementation();
}

private async initializeConfigDirectory(): Promise<void> {
  try {
    const fs = await import('fs/promises');
    await fs.mkdir(this.configDir, { recursive: true });
    await fs.mkdir(`${this.configDir}/backups`, { recursive: true });
  } catch (error) {
    console.warn(`Failed to initialize config directory: ${error}`);
  }
}
```

### 1.2 Configuration Backup System Enhancement
**Priority**: High | **Impact**: Medium | **Effort**: Low

**Current State**: Backup functionality exists but uses placeholder file operations

**Implementation Plan**:
- Ensure backup directory creation
- Add backup validation and integrity checks
- Implement backup rotation and cleanup

---

## Phase 2: Search Strategy Completion

### 2.1 Semantic Search Implementation
**Priority**: Critical | **Impact**: High | **Effort**: High

**Current State**:
- Semantic search strategy exists but is just a placeholder (Lines 571-574)
- Returns empty results with console log message
- No embedding integration or vector similarity search

**Files Affected**:
- `memori-ts/src/core/search/SearchService.ts`

**Implementation Plan**:

#### Step 2.1.1: Embedding Integration Setup
**Add to SearchService constructor**:

```typescript
private embeddingService?: EmbeddingService;
private vectorStore?: VectorStore;

constructor(dbManager: DatabaseManager, configManager?: SearchStrategyConfigManager) {
  this.dbManager = dbManager;
  this.advancedFilterEngine = new AdvancedFilterEngine();
  this.configManager = configManager || new SearchStrategyConfigManager();
  this.embeddingService = new EmbeddingService();
  this.vectorStore = new VectorStore(dbManager);
  this.initializeStrategies();
}
```

#### Step 2.1.2: Complete Semantic Search Implementation
**Replace placeholder implementation**:

```typescript
async search(query: SearchQuery): Promise<SearchResult[]> {
  if (!this.embeddingService || !this.vectorStore) {
    console.warn('Semantic search dependencies not available');
    return [];
  }

  try {
    // Generate embedding for the query
    const queryEmbedding = await this.embeddingService.generateEmbedding(query.text!);

    // Search for similar vectors in the store
    const similarVectors = await this.vectorStore.searchSimilar(
      queryEmbedding,
      query.limit || 10,
      this.getSemanticConfig().similarityThreshold
    );

    // Convert vector results to SearchResult format
    return this.convertVectorResultsToSearchResults(similarVectors, query);

  } catch (error) {
    console.error('Semantic search failed:', error);
    throw new SearchStrategyError(
      this.name,
      `Semantic search failed: ${error instanceof Error ? error.message : String(error)}`,
      'semantic_search',
      { query: query.text },
      error instanceof Error ? error : undefined
    );
  }
}
```

#### Step 2.1.3: Vector Storage Integration
**Files to Create**:
- `memori-ts/src/core/search/embedding/EmbeddingService.ts`
- `memori-ts/src/core/search/embedding/VectorStore.ts`

**Implementation Details**:
1. **EmbeddingService**: Integration with OpenAI embeddings API or local model
2. **VectorStore**: SQLite vector storage with similarity search
3. **Configuration**: Add embedding model and similarity threshold settings

### 2.2 Runtime Configuration Updates
**Priority**: High | **Impact**: Medium | **Effort**: Medium

**Current State**: Configuration loading happens only during initialization

**Implementation Plan**:

#### Step 2.2.1: Add Configuration Update Method
**Add to SearchService**:

```typescript
async updateStrategyConfiguration(strategyName: string, config: Partial<SearchStrategyConfiguration>): Promise<void> {
  try {
    // Load current configuration
    const currentConfig = await this.configManager.loadConfiguration(strategyName);
    if (!currentConfig) {
      throw new Error(`Configuration for ${strategyName} not found`);
    }

    // Merge with updates
    const updatedConfig = this.configManager.mergeConfigurations(currentConfig, config);

    // Validate updated configuration
    const validation = await this.configManager.validateConfiguration(updatedConfig);
    if (!validation.isValid) {
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
    }

    // Save updated configuration
    await this.configManager.saveConfiguration(strategyName, updatedConfig);

    // Apply configuration to running strategy
    await this.applyConfigurationToStrategy(strategyName, updatedConfig);

    // Log the change
    await this.configManager.getAuditHistory(strategyName, 1);

  } catch (error) {
    console.error(`Failed to update configuration for ${strategyName}:`, error);
    throw error;
  }
}
```

#### Step 2.2.2: Strategy Reconfiguration
**Add strategy reconfiguration support**:

```typescript
private async applyConfigurationToStrategy(strategyName: string, config: SearchStrategyConfiguration): Promise<void> {
  const strategy = this.strategies.get(strategyName as SearchStrategy);
  if (!strategy || typeof strategy === 'undefined') {
    return;
  }

  // Apply configuration changes to the running strategy
  if (strategyName === SearchStrategy.FTS5) {
    await this.reconfigureFTSStrategy(strategy, config);
  } else if (strategyName === SearchStrategy.LIKE) {
    await this.reconfigureLikeStrategy(strategy, config);
  }
  // Add other strategy reconfiguration methods
}
```

### 2.3 Enhanced Error Handling and Recovery
**Priority**: High | **Impact**: Medium | **Effort**: Low

**Current State**: Basic error handling exists but lacks detailed context and recovery

**Implementation Plan**:

#### Step 2.3.1: Comprehensive Error Context
**Enhance error context throughout SearchService**:

```typescript
private createErrorContext(operation: string, strategy: SearchStrategy, query: SearchQuery, additionalContext?: Record<string, unknown>): SearchErrorContext {
  return {
    strategy: strategy,
    operation,
    query: query.text,
    parameters: {
      limit: query.limit,
      offset: query.offset,
      hasFilters: !!query.filters,
      hasFilterExpression: !!query.filterExpression,
    },
    timestamp: new Date(),
    executionTime: Date.now() - this.operationStartTime,
    ...additionalContext
  };
}
```

#### Step 2.3.2: Strategy-Specific Error Recovery
**Add recovery mechanisms**:

```typescript
private async attemptStrategyRecovery(strategy: ISearchStrategy, query: SearchQuery, error: unknown): Promise<SearchResult[]> {
  const strategyName = strategy.name;

  // Check if error is recoverable
  if (!this.isRecoverableError(error)) {
    throw error;
  }

  // Attempt recovery based on strategy type
  switch (strategyName) {
    case SearchStrategy.FTS5:
      return this.recoverFTSStrategy(query);
    case SearchStrategy.LIKE:
      return this.recoverLikeStrategy(query);
    default:
      throw error;
  }
}
```

---

## Phase 3: Advanced Features

### 3.1 Advanced Filter Engine Integration
**Priority**: High | **Impact**: High | **Effort**: Medium

**Current State**: Basic integration exists but may not be complete

**Implementation Plan**:

#### Step 3.1.1: Complete Filter Integration
**Files**: `memori-ts/src/core/search/SearchService.ts`

```typescript
async search(query: SearchQuery): Promise<SearchResult[]> {
  // ... existing strategy orchestration ...

  // Apply advanced filtering if filter expressions provided
  if (query.filterExpression) {
    const filterNode = this.advancedFilterEngine!.parseFilterExpression(query.filterExpression);
    const filteredResults = await this.advancedFilterEngine!.executeFilter(
      filterNode,
      strategyResults.flat(),
      { enableEarlyTermination: true }
    );
    return this.rankAndSortResults(filteredResults, query);
  }

  // ... rest of existing logic ...
}
```

#### Step 3.1.2: Filter Template Registration
**Add during SearchService initialization**:

```typescript
private initializeFilterTemplates(): void {
  const templateManager = this.advancedFilterEngine!.getTemplateManager();

  // Register common filter templates
  templateManager.registerTemplate('recent_important', {
    name: 'recent_important',
    description: 'Recent memories with high importance',
    filterExpression: 'importance_score >= 0.7 AND created_at > {days_ago}',
    parameters: [
      { name: 'days_ago', type: 'string', required: true }
    ]
  });
}
```

### 3.2 Memory Relationship Processing
**Priority**: High | **Impact**: High | **Effort**: Medium

**Current State**:
- Database schema includes relationship fields but no processing implementation
- MemoryAgent has placeholder relationship extraction

**Files Affected**:
- `memori-ts/src/core/agents/MemoryAgent.ts`
- `memori-ts/src/core/database/DatabaseManager.ts`

**Implementation Plan**:

#### Step 3.2.1: Relationship Extraction in MemoryAgent
**Replace placeholder in MemoryAgent.processConversation()**:

```typescript
// Add relationship extraction to processing
const relationships = await this.extractMemoryRelationships(
  params.userInput,
  params.aiOutput,
  params.context
);

return {
  ...processedMemory,
  relatedMemories: relationships.relatedMemories,
  supersedes: relationships.supersedes,
  relationshipMetadata: {
    extractionMethod: 'llm_analysis',
    confidence: relationships.confidence,
    extractedAt: new Date()
  }
};
```

#### Step 3.2.2: Relationship Storage in DatabaseManager
**Add to DatabaseManager**:

```typescript
async storeMemoryRelationships(
  memoryId: string,
  relationships: {
    relatedMemories: string[];
    supersedes: string[];
  },
  namespace: string = 'default'
): Promise<void> {
  await this.prisma.longTermMemory.update({
    where: { id: memoryId },
    data: {
      relatedMemoriesJson: relationships.relatedMemories,
      supersedesJson: relationships.supersedes,
      extractionTimestamp: new Date()
    }
  });
}
```

### 3.3 Duplicate Consolidation Completion
**Priority**: Critical | **Impact**: High | **Effort**: High

**Current State**:
- ConsciousAgent has sophisticated duplicate detection logic
- `consolidateDuplicates()` method exists but returns placeholder results
- DatabaseManager has `consolidateDuplicateMemories()` with no implementation

**Implementation Plan**:

#### Step 3.3.1: Implement Core Consolidation Logic
**File**: `memori-ts/src/core/database/DatabaseManager.ts`

```typescript
async consolidateDuplicateMemories(
  primaryMemoryId: string,
  duplicateIds: string[],
  namespace: string = 'default',
): Promise<{ consolidated: number; errors: string[] }> {
  const errors: string[] = [];
  let consolidated = 0;

  try {
    // 1. Get primary memory data
    const primaryMemory = await this.prisma.longTermMemory.findUnique({
      where: { id: primaryMemoryId }
    });

    if (!primaryMemory) {
      errors.push(`Primary memory ${primaryMemoryId} not found`);
      return { consolidated: 0, errors };
    }

    // 2. Merge metadata from duplicates
    const mergedData = await this.mergeDuplicateData(
      primaryMemory,
      duplicateIds,
      namespace
    );

    // 3. Update primary memory with merged data
    await this.prisma.longTermMemory.update({
      where: { id: primaryMemoryId },
      data: {
        processedData: mergedData,
        extractionTimestamp: new Date(),
        // Update searchable content with merged information
        searchableContent: this.generateMergedContent(mergedData)
      }
    });

    // 4. Mark duplicates as consolidated
    await this.prisma.longTermMemory.updateMany({
      where: {
        id: { in: duplicateIds },
        namespace
      },
      data: {
        processedData: {
          consolidated: true,
          consolidatedAt: new Date(),
          consolidatedInto: primaryMemoryId,
          consolidationReason: 'duplicate_consolidation'
        } as any
      }
    });

    consolidated = duplicateIds.length;

    return { consolidated, errors };

  } catch (error) {
    const errorMsg = `Failed to consolidate duplicates: ${error}`;
    errors.push(errorMsg);
    return { consolidated: 0, errors };
  }
}
```

#### Step 3.3.2: Add Helper Methods for Data Merging
**File**: `memori-ts/src/core/database/DatabaseManager.ts`

```typescript
private async mergeDuplicateData(
  primaryMemory: any,
  duplicateIds: string[],
  namespace: string
): Promise<any> {
  // Get duplicate memory data
  const duplicates = await this.prisma.longTermMemory.findMany({
    where: {
      id: { in: duplicateIds },
      namespace
    }
  });

  // Merge entities, keywords, and other metadata
  const allEntities = new Set([
    ...(primaryMemory.entitiesJson as string[] || []),
    ...duplicates.flatMap(d => d.entitiesJson as string[] || [])
  ]);

  const allKeywords = new Set([
    ...(primaryMemory.keywordsJson as string[] || []),
    ...duplicates.flatMap(d => d.keywordsJson as string[] || [])
  ]);

  return {
    ...primaryMemory.processedData,
    mergedEntities: Array.from(allEntities),
    mergedKeywords: Array.from(allKeywords),
    consolidationInfo: {
      consolidatedFrom: duplicateIds,
      consolidationDate: new Date(),
      originalCount: duplicates.length + 1
    }
  };
}

private generateMergedContent(mergedData: any): string {
  const baseContent = mergedData.content || '';
  const entities = mergedData.mergedEntities?.join(' ') || '';
  const keywords = mergedData.mergedKeywords?.join(' ') || '';

  return `${baseContent} ${entities} ${keywords}`.trim();
}
```

---

## Phase 4: Optimization and Maintenance

### 4.1 Search Index Maintenance
**Priority**: Medium | **Impact**: High | **Effort**: Low

**Current State**: FTS triggers exist but no maintenance or optimization

**Implementation Plan**:

#### Step 4.1.1: Index Optimization Methods
**Add to SearchService**:

```typescript
public async optimizeIndex(): Promise<OptimizationResult> {
  const indexManager = this.getSearchIndexManager();
  return await indexManager.optimizeIndex();
}

public async getIndexHealthReport(): Promise<IndexHealthReport> {
  const indexManager = this.getSearchIndexManager();
  return await indexManager.getIndexHealthReport();
}
```

#### Step 4.1.2: Periodic Maintenance Scheduling
**Add maintenance scheduling system**:

```typescript
private maintenanceTimer?: NodeJS.Timer;

private startMaintenanceScheduler(): void {
  // Run health check every hour
  this.maintenanceTimer = setInterval(async () => {
    await this.performMaintenanceCheck();
  }, 60 * 60 * 1000);
}

private async performMaintenanceCheck(): Promise<void> {
  try {
    const healthReport = await this.getIndexHealthReport();

    if (healthReport.health === IndexHealth.DEGRADED) {
      console.warn('Search index health is degraded, scheduling optimization');
      await this.optimizeIndex();
    }

    if (healthReport.health === IndexHealth.CORRUPTED) {
      console.error('Search index is corrupted, attempting recovery');
      await this.recoverCorruptedIndex();
    }
  } catch (error) {
    console.error('Maintenance check failed:', error);
  }
}
```

### 4.2 Performance Monitoring and Analytics
**Priority**: Low | **Impact**: Medium | **Effort**: Medium

**Implementation Plan**:

#### Step 4.2.1: Performance Metrics Collection
**Add comprehensive metrics**:

```typescript
private performanceMetrics = {
  totalQueries: 0,
  successfulQueries: 0,
  failedQueries: 0,
  averageResponseTime: 0,
  strategyUsage: new Map<SearchStrategy, number>(),
  errorCounts: new Map<string, number>(),
};

private recordQueryMetrics(strategy: SearchStrategy, success: boolean, responseTime: number): void {
  this.performanceMetrics.totalQueries++;
  if (success) {
    this.performanceMetrics.successfulQueries++;
  } else {
    this.performanceMetrics.failedQueries++;
  }

  // Update average response time
  this.performanceMetrics.averageResponseTime =
    (this.performanceMetrics.averageResponseTime * (this.performanceMetrics.totalQueries - 1) + responseTime) /
    this.performanceMetrics.totalQueries;

  // Record strategy usage
  const currentUsage = this.performanceMetrics.strategyUsage.get(strategy) || 0;
  this.performanceMetrics.strategyUsage.set(strategy, currentUsage + 1);
}
```

#### Step 4.2.2: Analytics and Reporting
**Add analytics methods**:

```typescript
public getPerformanceReport(): PerformanceReport {
  return {
    ...this.performanceMetrics,
    successRate: this.performanceMetrics.totalQueries > 0 ?
      this.performanceMetrics.successfulQueries / this.performanceMetrics.totalQueries : 0,
    strategyUsagePercentages: this.calculateStrategyUsagePercentages(),
    topErrors: this.getTopErrors(),
    timestamp: new Date()
  };
}

private calculateStrategyUsagePercentages(): Record<SearchStrategy, number> {
  const percentages: Record<string, number> = {};
  const total = this.performanceMetrics.totalQueries;

  for (const [strategy, count] of this.performanceMetrics.strategyUsage) {
    percentages[strategy] = total > 0 ? (count / total) * 100 : 0;
  }

  return percentages;
}
```

---

## Success Metrics

### Phase 1 Completion Criteria
- [ ] FileConfigurationPersistenceManager fully functional with real file operations
- [ ] Configuration save/load/delete operations working correctly
- [ ] Backup and restore functionality operational
- [ ] All placeholder implementations replaced
- [ ] Configuration directory initialization working

### Phase 2 Completion Criteria
- [ ] Semantic search returning actual results using embeddings
- [ ] Runtime configuration updates working without service restart
- [ ] Configuration changes properly propagated to active strategies
- [ ] Enhanced error handling and recovery mechanisms functional

### Phase 3 Completion Criteria
- [ ] AdvancedFilterEngine fully integrated with SearchService
- [ ] Memory relationship extraction and storage operational
- [ ] Relationship-based search queries functional
