# Consolidation Service Architecture

## Overview

The Consolidation Service Architecture provides a clean service-oriented design that separates business logic from data access concerns. This architecture follows SOLID principles and established design patterns to provide a maintainable, testable, and extensible consolidation system.

## Architecture Overview

The consolidation system uses a layered architecture with unified duplicate detection:

```
┌─────────────────────────────────────────────────────────────────┐
│                    ConsolidationService Interface                │
│                    (Business Contract)                          │
├─────────────────────────────────────────────────────────────────┤
│                    MemoryConsolidationService                   │
│                    (Domain Logic + DuplicateManager)            │
├─────────────────────────────────────────────────────────────────┤
│                    IConsolidationRepository Interface           │
│                    (Data Access Contract)                        │
├─────────────────────────────────────────────────────────────────┤
│                    PrismaConsolidationRepository                 │
│                    (FTS-Enhanced Data Implementation)           │
├─────────────────────────────────────────────────────────────────┤
│                    RepositoryFactory                             │
│                    (Dependency Injection)                        │
├─────────────────────────────────────────────────────────────────┤
│                    DatabaseManager (Facade)                      │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### ConsolidationService Interface

**Location**: [`src/core/infrastructure/database/interfaces/ConsolidationService.ts`](src/core/infrastructure/database/interfaces/ConsolidationService.ts)

The `ConsolidationService` interface defines the business-focused contract for memory consolidation operations. It provides high-level consolidation functionality without exposing infrastructure concerns.

**Key Features**:
- Business-focused method signatures
- Comprehensive error handling
- Validation and preview capabilities
- Rollback support for safe operations
- Analytics and optimization recommendations

### MemoryConsolidationService

**Location**: [`src/core/infrastructure/database/MemoryConsolidationService.ts`](src/core/infrastructure/database/MemoryConsolidationService.ts)

Concrete implementation of the `ConsolidationService` interface, containing pure domain logic for memory consolidation operations.

**Responsibilities**:
- **Duplicate Detection**: Intelligent similarity analysis using DuplicateManager's sophisticated algorithms
- **Consolidation Logic**: Safe merging of duplicate memories with data integrity
- **Validation**: Pre-consolidation eligibility checks and business rule enforcement
- **Analytics**: Comprehensive consolidation statistics and trend analysis
- **Optimization**: Recommendations for system health and performance

**Key Features**:
- **Unified Similarity Analysis**: Integration with DuplicateManager for consistent duplicate detection
- **Sophisticated Confidence Scoring**: Advanced algorithm considering content length, similarity, and context
- **FTS-Enhanced Search**: Full-text search integration for high-performance similarity matching
- **Comprehensive Logging**: Structured metadata logging for debugging and monitoring
- **Transaction-Safe Operations**: Rollback capabilities with comprehensive validation

### IConsolidationRepository Interface

**Location**: [`src/core/infrastructure/database/interfaces/IConsolidationRepository.ts`](src/core/infrastructure/database/interfaces/IConsolidationRepository.ts)

Data access abstraction layer that defines the repository pattern interface for consolidation data operations.

**Key Methods**:
- `findDuplicateCandidates()` - Content similarity analysis
- `markMemoryAsDuplicate()` - Duplicate relationship tracking
- `consolidateMemories()` - Atomic consolidation operations
- `getConsolidationStatistics()` - Analytics data retrieval
- `backupMemoryData()` / `rollbackConsolidation()` - Safe operation support

### PrismaConsolidationRepository

**Location**: [`src/core/infrastructure/database/repositories/PrismaConsolidationRepository.ts`](src/core/infrastructure/database/repositories/PrismaConsolidationRepository.ts)

Concrete implementation of `IConsolidationRepository` using Prisma ORM for database operations.

**Features**:
- **Prisma-based data access** with type safety
- **FTS-enhanced duplicate detection** using BM25 similarity scoring
- **Advanced full-text search** with phrase handling and query optimization
- **Transaction management** for data consistency and rollback support
- **Comprehensive error handling** and structured logging
- **Performance optimization** through efficient query strategies and indexing

### RepositoryFactory

**Location**: [`src/core/infrastructure/database/factories/RepositoryFactory.ts`](src/core/infrastructure/database/factories/RepositoryFactory.ts)

Centralized factory for creating repository instances, supporting dependency injection and testing scenarios.

**Benefits**:
- **Singleton Pattern**: Cached repository instances for performance
- **Test Support**: Easy creation of test repositories with custom configurations
- **Dependency Injection**: Clean separation of concerns and testability
- **Prisma Management**: Centralized Prisma client lifecycle management

### DatabaseManager (Facade)

**Location**: [`src/core/infrastructure/database/DatabaseManager.ts`](src/core/infrastructure/database/DatabaseManager.ts)

Uses facade pattern to provide a simplified interface to the consolidation subsystem, delegating operations to the service layer.

**Responsibilities**:
- **Service orchestration** and coordination across all database services
- **Unified API** providing facade pattern for multiple database services
- **Consolidation integration** with automated scheduling and performance monitoring
- **Resource management** and lifecycle coordination
- **Performance monitoring** with consolidation-specific metrics and analytics

**Key Features**:
- **Consolidation scheduling** with configurable intervals and batch processing
- **Performance integration** with real-time consolidation metrics
- **Unified similarity analysis** through DuplicateManager integration
- **Comprehensive health monitoring** for consolidation operations

## Usage Patterns

### Dependency Injection

```typescript
import { RepositoryFactory } from './src/core/infrastructure/database/factories/RepositoryFactory';
import { MemoryConsolidationService } from './src/core/infrastructure/database/MemoryConsolidationService';
import { DatabaseManager } from './src/core/infrastructure/database/DatabaseManager';

// Option 1: Direct service creation with dependency injection
const repository = RepositoryFactory.createConsolidationRepository();
const consolidationService = new MemoryConsolidationService(repository);

// Option 2: Use DatabaseManager (recommended) - automatically injects DuplicateManager
const dbManager = new DatabaseManager('your-database-url');
const consolidationService = dbManager.getConsolidationService(); // Uses unified similarity analysis

// Use service with sophisticated duplicate detection
const duplicates = await consolidationService.detectDuplicateMemories(content, 0.7);
```

### Service Integration

```typescript
// High-level consolidation workflow with DuplicateManager integration
async function consolidateSimilarMemories(content: string) {
  const duplicates = await consolidationService.detectDuplicateMemories(content, 0.8);

  if (duplicates.length > 0) {
    // Validate consolidation eligibility
    const validation = await consolidationService.validateConsolidationEligibility(
      primaryMemoryId,
      duplicates.map(d => d.id)
    );

    if (validation.isValid) {
      // Preview consolidation results
      const preview = await consolidationService.previewConsolidation(
        primaryMemoryId,
        duplicates.map(d => d.id)
      );

      // Perform consolidation
      const result = await consolidationService.consolidateMemories(
        primaryMemoryId,
        duplicates.map(d => d.id)
      );

      return result;
    }
  }
}

// Automated consolidation scheduling
async function setupAutomatedConsolidation() {
  // Start automated consolidation (recommended approach)
  dbManager.startConsolidationScheduling({
    intervalMinutes: 60,        // Run every hour
    maxConsolidationsPerRun: 50, // Process max 50 consolidations per run
    similarityThreshold: 0.7,    // 70% similarity threshold
    dryRun: false               // Perform actual consolidation
  });

  // Monitor consolidation performance
  const metrics = await dbManager.getConsolidationPerformanceMetrics();
  console.log(`Consolidation success rate: ${metrics.consolidationSuccessRate}%`);
  console.log(`Average consolidation time: ${metrics.averageConsolidationTime}ms`);

  // Get scheduling status
  const scheduleStatus = dbManager.getConsolidationSchedulingStatus();
  console.log(`Scheduling enabled: ${scheduleStatus.enabled}`);
  console.log(`Next run in: ${scheduleStatus.nextRunMinutes} minutes`);
}
```

### Error Handling Strategy

```typescript
try {
  const result = await consolidationService.consolidateMemories(primaryId, duplicateIds);

  if (result.success) {
    console.log(`Consolidated ${result.consolidatedCount} memories`);
  } else {
    console.error('Consolidation failed:', result);
  }
} catch (error) {
  // Comprehensive error logging is handled internally
  // Additional application-specific error handling
  console.error('Application error:', error);
}
```

### Testing Approaches

```typescript
// Unit testing with mock repository
const mockRepository = {
  findDuplicateCandidates: jest.fn(),
  consolidateMemories: jest.fn(),
  // ... other methods
};

const service = new MemoryConsolidationService(mockRepository);
await service.detectDuplicateMemories(testContent);

// Integration testing with test database
const testRepository = RepositoryFactory.createTestConsolidationRepository(testPrisma);
const testService = new MemoryConsolidationService(testRepository);
```

## Architectural Benefits

### 1. Separation of Concerns
- **Business Logic**: Pure domain logic in `MemoryConsolidationService`
- **Data Access**: Infrastructure concerns isolated in repository layer
- **Service Coordination**: High-level orchestration in facade pattern

### 2. Testability
- **Unit Testing**: Easy testing of business logic with mock repositories
- **Integration Testing**: Test database scenarios with test repositories
- **End-to-End Testing**: Full workflow testing through service interfaces

### 3. Maintainability
- **Single Responsibility**: Each class has one clear purpose
- **Interface Segregation**: Clean contracts for different concerns
- **Dependency Inversion**: Depend on abstractions, not concretions

### 4. Extensibility
- **New Implementations**: Easy to add new repository implementations
- **Additional Services**: Simple to extend with new consolidation strategies
- **Configuration**: Flexible configuration through dependency injection

### 5. Performance
- **Query Optimization**: Repository layer optimizes database operations
- **Caching**: Factory pattern enables repository instance reuse
- **Batch Operations**: Efficient bulk operations for large datasets

## Design Patterns Applied

### Manager Pattern
Specialized managers handle different operational domains with built-in state tracking, performance monitoring, and error recovery.

### Factory Pattern
Centralizes object creation, enabling proper dependency injection and testability.

### Facade Pattern
Provides a simplified interface to a complex subsystem (DatabaseManager as facade to services).

### Strategy Pattern
Different consolidation strategies can be implemented through the service interface.

### Template Method Pattern
Common consolidation workflows with customizable steps through the service layer.

## Development Strategy

For new codebases implementing consolidation features:

1. **Service Integration**: Use `ConsolidationService` interface for all consolidation operations
2. **Dependency Injection**: Leverage `RepositoryFactory` for repository creation
3. **Interface Compliance**: Implement against `ConsolidationService` and `IConsolidationRepository` interfaces
4. **Testing**: Create comprehensive tests using mock repositories for unit testing
5. **Production Usage**: Use concrete implementations for production deployments

## Best Practices

### Service Usage
- Always use interfaces (`ConsolidationService`, `IConsolidationRepository`) in type definitions
- Leverage dependency injection through `RepositoryFactory`
- Implement comprehensive error handling and logging
- Use validation and preview methods before major operations

### Testing
- Unit test business logic with mock repositories
- Integration test with actual database scenarios
- Use factory pattern for test repository creation
- Verify rollback functionality in critical operation tests

### Performance
- Use appropriate similarity thresholds for duplicate detection
- Batch large consolidation operations
- Monitor consolidation analytics for optimization opportunities
- Regular cleanup of old consolidated memories

## Troubleshooting

### Common Issues

1. **High Memory Usage During Consolidation**
   - Reduce batch sizes in cleanup operations
   - Use pagination for large duplicate detection queries

2. **Slow Duplicate Detection**
   - Adjust similarity thresholds
   - Optimize database indexes for full-text search
   - Consider fuzzy matching configuration

3. **Consolidation Validation Failures**
   - Check memory existence before consolidation
   - Verify data integrity constraints
   - Review business rule validations

### Monitoring
- Monitor consolidation statistics through `getConsolidationAnalytics()`
- Track consolidation trends for optimization opportunities
- Set up alerts for unusual consolidation patterns
- Regular review of optimization recommendations

## Related Documentation

- [API Reference](../api-reference/consolidation-service-api.md) - Detailed API documentation
- [Service Monitoring](service-monitoring-metrics.md) - Performance monitoring and metrics
- [Developer Onboarding](../basic-usage.md) - Getting started guide
- [Database Schema](../../architecture/database-schema.md) - Database structure