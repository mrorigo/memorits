# Consolidation Service API Reference

## Overview

The Consolidation Service API provides a comprehensive interface for memory consolidation operations in the Memori system. This API follows a clean service-oriented architecture with clear separation between business logic and data access concerns.

## Core Interfaces

### ConsolidationService

**Location**: [`src/core/database/interfaces/ConsolidationService.ts`](src/core/database/interfaces/ConsolidationService.ts)

Primary business interface for memory consolidation operations. Provides high-level consolidation functionality with comprehensive error handling and validation.

#### Methods

##### detectDuplicateMemories

Detect potential duplicate memories for given content using similarity analysis.

```typescript
async detectDuplicateMemories(
  content: string,
  threshold?: number,
  config?: DuplicateDetectionConfig,
): Promise<DuplicateCandidate[]>
```

**Parameters**:
- `content` (string): Content to analyze for duplicates
- `threshold` (number, optional): Similarity threshold for duplicate detection (0-1), default: 0.7
- `config` (DuplicateDetectionConfig, optional): Configuration for detection algorithm

**Returns**: Promise resolving to array of duplicate candidates with similarity scores and recommendations

**Example**:
```typescript
const duplicates = await consolidationService.detectDuplicateMemories(
  "Sample content to check for duplicates",
  0.8,
  {
    similarityThreshold: 0.8,
    maxCandidates: 50,
    enableFuzzyMatching: true
  }
);
```

##### consolidateMemories

Consolidate multiple duplicate memories into a primary memory.

```typescript
async consolidateMemories(
  primaryId: string,
  duplicateIds: string[],
): Promise<ConsolidationResult>
```

**Parameters**:
- `primaryId` (string): ID of the primary memory to keep after consolidation
- `duplicateIds` (string[]): Array of IDs of duplicate memories to consolidate

**Returns**: Promise resolving to consolidation operation result with success status and metadata

**Example**:
```typescript
const result = await consolidationService.consolidateMemories(
  "primary-memory-id",
  ["duplicate-1", "duplicate-2", "duplicate-3"]
);

if (result.success) {
  console.log(`Consolidated ${result.consolidatedCount} memories`);
} else {
  console.error("Consolidation failed:", result.errors);
}
```

##### markMemoryAsDuplicate

Mark a specific memory as a duplicate of another memory.

```typescript
async markMemoryAsDuplicate(
  duplicateId: string,
  originalId: string,
  reason?: string,
): Promise<void>
```

**Parameters**:
- `duplicateId` (string): ID of the memory being marked as duplicate
- `originalId` (string): ID of the original memory
- `reason` (string, optional): Reason for marking as duplicate

**Example**:
```typescript
await consolidationService.markMemoryAsDuplicate(
  "duplicate-memory-id",
  "original-memory-id",
  "automatic_detection"
);
```

##### cleanupOldConsolidatedMemories

Clean up old consolidated memories based on age criteria.

```typescript
async cleanupOldConsolidatedMemories(
  olderThanDays?: number,
  dryRun?: boolean,
): Promise<CleanupResult>
```

**Parameters**:
- `olderThanDays` (number, optional): Remove memories older than this many days, default: 30
- `dryRun` (boolean, optional): If true, only simulate the cleanup, default: false

**Returns**: Promise resolving to cleanup operation result

**Example**:
```typescript
const result = await consolidationService.cleanupOldConsolidatedMemories(60, false);
console.log(`Cleaned ${result.cleaned} memories, ${result.errors.length} errors`);
```

##### getConsolidationAnalytics

Get comprehensive consolidation analytics and statistics.

```typescript
async getConsolidationAnalytics(): Promise<ConsolidationStats>
```

**Returns**: Promise resolving to current consolidation statistics including trends and metrics

**Example**:
```typescript
const analytics = await consolidationService.getConsolidationAnalytics();
console.log(`Total memories: ${analytics.totalMemories}`);
console.log(`Consolidated: ${analytics.consolidatedMemories}`);
console.log(`Consolidation ratio: ${analytics.averageConsolidationRatio}`);
```

##### validateConsolidationEligibility

Validate that memories can be safely consolidated.

```typescript
async validateConsolidationEligibility(
  primaryId: string,
  duplicateIds: string[],
): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }>
```

**Parameters**:
- `primaryId` (string): ID of the primary memory
- `duplicateIds` (string[]): Array of duplicate memory IDs to validate

**Returns**: Promise resolving to validation result with errors and warnings

**Example**:
```typescript
const validation = await consolidationService.validateConsolidationEligibility(
  "primary-id",
  ["duplicate-1", "duplicate-2"]
);

if (!validation.isValid) {
  console.error("Validation errors:", validation.errors);
}
```

##### getConsolidationHistory

Get detailed consolidation history for a specific memory.

```typescript
async getConsolidationHistory(memoryId: string): Promise<{
  consolidationEvents: Array<{
    timestamp: Date;
    operation: 'marked_duplicate' | 'consolidated' | 'rollback';
    relatedMemoryIds: string[];
    reason?: string;
    rollbackToken?: string;
  }>;
  currentStatus: 'active' | 'duplicate' | 'consolidated' | 'cleaned';
}>
```

**Parameters**:
- `memoryId` (string): ID of the memory to get history for

**Returns**: Promise resolving to consolidation history and current status

**Example**:
```typescript
const history = await consolidationService.getConsolidationHistory("memory-id");
console.log(`Current status: ${history.currentStatus}`);
console.log(`Events: ${history.consolidationEvents.length}`);
```

##### previewConsolidation

Preview what would happen during a consolidation operation.

```typescript
async previewConsolidation(
  primaryId: string,
  duplicateIds: string[],
): Promise<{
  estimatedResult: {
    consolidatedCount: number;
    dataIntegrityHash: string;
    contentChanges: string[];
    metadataChanges: Record<string, any>;
  };
  warnings: string[];
  recommendations: string[];
}>
```

**Parameters**:
- `primaryId` (string): ID of the primary memory
- `duplicateIds` (string[]): Array of duplicate memory IDs

**Returns**: Promise resolving to preview of consolidation results

**Example**:
```typescript
const preview = await consolidationService.previewConsolidation(
  "primary-id",
  ["duplicate-1", "duplicate-2"]
);

console.log("Estimated changes:", preview.estimatedResult.contentChanges);
console.log("Warnings:", preview.warnings);
console.log("Recommendations:", preview.recommendations);
```

##### rollbackConsolidation

Rollback a previously completed consolidation operation.

```typescript
async rollbackConsolidation(
  primaryMemoryId: string,
  rollbackToken: string,
): Promise<{
  success: boolean;
  restoredMemories: number;
  errors: string[];
}>
```

**Parameters**:
- `primaryMemoryId` (string): ID of the primary memory to rollback
- `rollbackToken` (string): Token from the original consolidation for verification

**Returns**: Promise resolving to rollback result

**Example**:
```typescript
const rollback = await consolidationService.rollbackConsolidation(
  "primary-id",
  "rollback-token-from-original-consolidation"
);

if (rollback.success) {
  console.log(`Restored ${rollback.restoredMemories} memories`);
}
```

##### getOptimizationRecommendations

Get consolidation recommendations for optimizing memory storage.

```typescript
async getOptimizationRecommendations(): Promise<{
  recommendations: Array<{
    type: 'cleanup' | 'consolidation' | 'archival';
    priority: 'low' | 'medium' | 'high';
    description: string;
    estimatedBenefit: string;
    actionRequired: string[];
  }>;
  overallHealth: 'good' | 'fair' | 'poor';
  nextMaintenanceDate?: Date;
}>
```

**Returns**: Promise resolving to optimization recommendations and system health

**Example**:
```typescript
const recommendations = await consolidationService.getOptimizationRecommendations();

console.log(`System health: ${recommendations.overallHealth}`);
recommendations.recommendations.forEach(rec => {
  console.log(`${rec.priority} priority: ${rec.description}`);
});
```

### IConsolidationRepository

**Location**: [`src/core/database/interfaces/IConsolidationRepository.ts`](src/core/database/interfaces/IConsolidationRepository.ts)

Data access abstraction layer for memory consolidation operations.

#### Key Methods

##### findDuplicateCandidates

Find potential duplicate memory candidates based on content similarity.

```typescript
async findDuplicateCandidates(
  content: string,
  threshold: number,
  config?: DuplicateDetectionConfig,
): Promise<MemorySearchResult[]>
```

##### markMemoryAsDuplicate

Mark a memory as a duplicate of another memory.

```typescript
async markMemoryAsDuplicate(
  duplicateId: string,
  originalId: string,
  consolidationReason?: string,
): Promise<void>
```

##### consolidateMemories

Consolidate multiple duplicate memories into a primary memory.

```typescript
async consolidateMemories(
  primaryId: string,
  duplicateIds: string[],
): Promise<ConsolidationResult>
```

##### getConsolidationStatistics

Get consolidation statistics for the current namespace.

```typescript
async getConsolidationStatistics(): Promise<ConsolidationStats>
```

##### cleanupConsolidatedMemories

Clean up old consolidated memories based on age criteria.

```typescript
async cleanupConsolidatedMemories(
  olderThanDays: number,
  dryRun: boolean,
): Promise<CleanupResult>
```

##### getConsolidatedMemory

Get detailed information about a specific consolidated memory.

```typescript
async getConsolidatedMemory(memoryId: string): Promise<ConsolidationMemorySearchResult | null>
```

##### getConsolidatedMemories

Get all memories that were consolidated into a primary memory.

```typescript
async getConsolidatedMemories(primaryMemoryId: string): Promise<string[]>
```

##### updateDuplicateTracking

Update duplicate tracking information for multiple memories.

```typescript
async updateDuplicateTracking(updates: Array<{
  memoryId: string;
  isDuplicate?: boolean;
  duplicateOf?: string;
  consolidationReason?: string;
  markedAsDuplicateAt?: Date;
}>): Promise<{ updated: number; errors: string[] }>
```

##### performPreConsolidationValidation

Perform pre-consolidation validation to ensure data integrity.

```typescript
async performPreConsolidationValidation(
  primaryMemoryId: string,
  duplicateIds: string[],
): Promise<{ isValid: boolean; errors: string[] }>
```

##### backupMemoryData

Backup memory data for potential rollback operations.

```typescript
async backupMemoryData(memoryIds: string[]): Promise<Map<string, any>>
```

##### rollbackConsolidation

Rollback a consolidation operation using backup data.

```typescript
async rollbackConsolidation(
  primaryMemoryId: string,
  duplicateIds: string[],
  originalData: Map<string, any>,
): Promise<void>
```

##### generateDataIntegrityHash

Generate data integrity hash for validation.

```typescript
generateDataIntegrityHash(data: any): string
```

## Data Models

### DuplicateCandidate

Represents a potential duplicate memory candidate found during similarity analysis.

```typescript
interface DuplicateCandidate {
  id: string;
  content: string;
  similarityScore: number;
  confidence: number;
  consolidationRecommendation: 'merge' | 'replace' | 'ignore';
}
```

### ConsolidationResult

Result of a memory consolidation operation.

```typescript
interface ConsolidationResult {
  success: boolean;
  consolidatedCount: number;
  primaryMemoryId: string;
  consolidatedMemoryIds: string[];
  dataIntegrityHash: string;
  consolidationTimestamp: Date;
  rollbackToken?: string;
}
```

### ConsolidationStats

Statistics about consolidation activities.

```typescript
interface ConsolidationStats {
  totalMemories: number;
  duplicateCount: number;
  consolidatedMemories: number;
  averageConsolidationRatio: number;
  lastConsolidationActivity?: Date;
  consolidationTrends: ConsolidationTrend[];
}
```

### CleanupResult

Result of a cleanup operation.

```typescript
interface CleanupResult {
  cleaned: number;
  skipped: number;
  errors: string[];
  dryRun: boolean;
}
```

### DuplicateDetectionConfig

Configuration for duplicate detection algorithms.

```typescript
interface DuplicateDetectionConfig {
  similarityThreshold: number;
  maxCandidates?: number;
  enableFuzzyMatching?: boolean;
  contentWeights?: {
    content: number;
    summary: number;
    entities: number;
    keywords: number;
  };
}
```

### ConsolidationMemorySearchResult

Extended memory search result with consolidation metadata.

```typescript
interface ConsolidationMemorySearchResult extends MemorySearchResult {
  isDuplicate?: boolean;
  duplicateOf?: string;
  isConsolidated?: boolean;
  consolidatedAt?: Date;
  consolidationCount?: number;
}
```

## Error Handling

All methods in the Consolidation Service API include comprehensive error handling:

- **Structured Logging**: All operations include detailed logging with component metadata
- **Error Propagation**: Errors are properly caught, logged, and re-thrown with context
- **Validation**: Pre-operation validation prevents invalid operations
- **Rollback Support**: Failed operations can be rolled back using backup data
- **Dry Run Support**: Cleanup operations support simulation mode for safe testing

## Usage Examples

### Basic Duplicate Detection and Consolidation

```typescript
import { RepositoryFactory } from '../src/core/database/factories/RepositoryFactory';
import { MemoryConsolidationService } from '../src/core/database/MemoryConsolidationService';

// Initialize service
const repository = RepositoryFactory.createConsolidationRepository();
const consolidationService = new MemoryConsolidationService(repository);

// Detect duplicates
const content = "This is some content that might have duplicates";
const duplicates = await consolidationService.detectDuplicateMemories(content, 0.8);

if (duplicates.length > 0) {
  // Validate consolidation
  const validation = await consolidationService.validateConsolidationEligibility(
    "primary-memory-id",
    duplicates.map(d => d.id)
  );

  if (validation.isValid) {
    // Perform consolidation
    const result = await consolidationService.consolidateMemories(
      "primary-memory-id",
      duplicates.map(d => d.id)
    );

    if (result.success) {
      console.log(`Successfully consolidated ${result.consolidatedCount} memories`);
    }
  }
}
```

### Batch Operations with Error Handling

```typescript
async function batchConsolidateMemories(memoryGroups: Array<{primary: string, duplicates: string[]}>) {
  const results = [];

  for (const group of memoryGroups) {
    try {
      // Preview before consolidation
      const preview = await consolidationService.previewConsolidation(
        group.primary,
        group.duplicates
      );

      if (preview.warnings.length === 0 || confirm(`Proceed with warnings: ${preview.warnings.join(', ')}?`)) {
        const result = await consolidationService.consolidateMemories(
          group.primary,
          group.duplicates
        );

        results.push({ group, result, success: result.success });
      }
    } catch (error) {
      console.error(`Failed to consolidate group:`, error);
      results.push({ group, error: error.message, success: false });
    }
  }

  return results;
}
```

### Analytics and Monitoring

```typescript
async function generateConsolidationReport() {
  const analytics = await consolidationService.getConsolidationAnalytics();
  const recommendations = await consolidationService.getOptimizationRecommendations();

  const report = {
    summary: {
      totalMemories: analytics.totalMemories,
      duplicateCount: analytics.duplicateCount,
      consolidatedMemories: analytics.consolidatedMemories,
      consolidationRatio: analytics.averageConsolidationRatio,
      lastActivity: analytics.lastConsolidationActivity,
      systemHealth: recommendations.overallHealth,
    },
    trends: analytics.consolidationTrends,
    recommendations: recommendations.recommendations,
    nextMaintenance: recommendations.nextMaintenanceDate,
  };

  return report;
}
```

## Best Practices

1. **Always validate before consolidating**: Use `validateConsolidationEligibility()` before major operations
2. **Preview large operations**: Use `previewConsolidation()` for operations affecting many memories
3. **Implement proper error handling**: All methods can throw errors - handle them appropriately
4. **Use dry runs for cleanup**: Test cleanup operations with `dryRun: true` before executing
5. **Monitor system health**: Regularly check `getOptimizationRecommendations()` for maintenance needs
6. **Keep rollback tokens**: Store rollback tokens from successful consolidations for potential recovery
7. **Batch large operations**: For operations affecting many memories, consider processing in smaller batches
8. **Use appropriate thresholds**: Adjust similarity thresholds based on your use case requirements

## Related Documentation

- [Architecture Overview](consolidation-service-architecture.md) - System architecture and design patterns
- [Migration Guide](consolidation-service-migration.md) - Migration instructions for existing code
- [Type Definitions](../types/consolidation-models.ts) - Complete type definitions
- [Repository Implementation](../repositories/PrismaConsolidationRepository.ts) - Concrete repository implementation