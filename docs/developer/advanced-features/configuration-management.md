# Advanced Configuration Management

Memorits provides enterprise-grade configuration management with persistent storage, runtime updates, and comprehensive audit trails. This document covers the advanced configuration features including file-based persistence, runtime management, and performance monitoring.

## Overview

The configuration management system consists of several key components:

- **SearchStrategyConfigManager**: Central configuration orchestrator
- **FileConfigurationPersistenceManager**: File system-based persistence with backup/restore
- **MemoryConfigurationAuditManager**: Comprehensive audit trail management
- **Performance monitoring**: Real-time configuration operation analytics

## FileConfigurationPersistenceManager

### Basic Usage

```typescript
import { FileConfigurationPersistenceManager } from 'memorits';

const persistenceManager = new FileConfigurationPersistenceManager('./config/search');

// Save configuration
await persistenceManager.save({
  strategyName: 'FTS5',
  enabled: true,
  priority: 10,
  performance: {
    enableCaching: true,
    cacheSize: 1000,
    enableParallelExecution: false,
  },
  strategySpecific: {
    bm25Weights: { title: 2.0, content: 1.0, category: 1.5 }
  }
});

// Load configuration
const config = await persistenceManager.load('FTS5');
if (config) {
  console.log(`Configuration loaded: ${config.strategyName}`);
}
```

### Advanced Features

#### Automatic Directory Management

```typescript
// Directories are created automatically
const manager = new FileConfigurationPersistenceManager('./config/search/strategies');

// Creates:
// - ./config/search/strategies/ (config directory)
// - ./config/search/strategies/backups/ (backup directory)
```

#### Backup with Integrity Verification

```typescript
// Create backup with metadata
const backup = await persistenceManager.backup('FTS5');

console.log(`Backup created: ${backup.id}`);
console.log(`File size: ${backup.fileSize}`);
console.log(`Checksum: ${backup.checksum}`);
console.log(`Strategy count: ${backup.strategyCount}`);

// Restore with integrity validation
const restoredConfig = await persistenceManager.restoreWithValidation('FTS5', backup.id);
```

#### Backup Rotation and Cleanup

```typescript
// List strategy-specific backups
const backups = await persistenceManager.listStrategyBackups('FTS5');
console.log(`Available backups: ${backups.length}`);

// Cleanup old backups (keep last 10)
await persistenceManager.cleanupOldBackups('FTS5', 10);
```

#### Export and Import

```typescript
// Export all configurations
const allConfigs = await persistenceManager.export();
console.log(`Exported ${Object.keys(allConfigs).length} configurations`);

// Import configurations
await persistenceManager.import(allConfigs);
```

## Runtime Configuration Management

### SearchStrategyConfigManager

The `SearchStrategyConfigManager` provides runtime configuration management with caching, validation, and audit trails.

#### Basic Operations

```typescript
import { SearchStrategyConfigManager } from 'memorits';

const configManager = new SearchStrategyConfigManager(persistenceManager);

// Load configuration (with caching)
const config = await configManager.loadConfiguration('FTS5');

// Save with validation and audit trail
await configManager.saveConfiguration('FTS5', {
  strategyName: 'FTS5',
  enabled: true,
  priority: 15, // Updated priority
  performance: {
    enableCaching: true,
    cacheSize: 2000, // Increased cache size
    enableParallelExecution: false,
  }
});

// Get all configuration names
const strategyNames = await configManager.getConfigurationNames();
console.log(`Available strategies: ${strategyNames.join(', ')}`);
```

#### Configuration Validation

```typescript
// Validate configuration before saving
const validation = await configManager.validateConfiguration(config);

if (!validation.isValid) {
  console.error('Validation errors:', validation.errors);
  console.warn('Validation warnings:', validation.warnings);
} else {
  console.log('Configuration is valid');
}
```

#### Default Configurations

```typescript
// Get default configuration for strategy
const defaultConfig = configManager.getDefaultConfiguration('FTS5');
console.log('Default FTS5 config:', defaultConfig);

// Merge with custom overrides
const customConfig = configManager.mergeConfigurations(defaultConfig, {
  priority: 20,
  performance: {
    cacheSize: 5000
  }
});
```

#### Configuration Change Tracking

```typescript
// Get audit history for specific strategy
const history = await configManager.getAuditHistory('FTS5', 20);
console.log(`Found ${history.length} configuration changes`);

history.forEach(entry => {
  console.log(`${entry.timestamp.toISOString()}: ${entry.action} by ${entry.userId || 'system'}`);
  if (entry.changes) {
    console.log('  Changes:', entry.changes);
  }
});

// Get changes within time range
const recentChanges = await configManager.getAuditHistory(
  'FTS5',
  new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
  new Date()
);
```

## Performance Monitoring

### Configuration Performance Analytics

```typescript
// Get performance metrics
const metrics = configManager.getPerformanceMetrics();
console.log(`Total operations: ${metrics.totalOperations}`);
console.log(`Average latency: ${metrics.averageOperationTime}ms`);
console.log(`Cache hit rate: ${metrics.cacheHitRate}`);

// Get detailed performance report
const report = configManager.getConfigurationPerformanceReport();
console.log('Performance summary:', report.summary);
console.log('Recommendations:', report.recommendations);

// Get recent operation metrics
const recentOps = configManager.getRecentOperationMetrics(100);
console.log(`Recent operations: ${recentOps.length}`);
```

### Performance Monitoring Configuration

```typescript
// Configure performance monitoring
const configManager = new SearchStrategyConfigManager(persistenceManager, auditManager, {
  enableHistoryTracking: true,
  maxHistoryEntries: 1000,
  enableMetrics: true,
  retryAttempts: 3,
  retryDelayMs: 1000
});

// Clear performance metrics
configManager.clearPerformanceMetrics();

// Get monitoring status
const status = configManager.getPerformanceMonitoringStatus();
console.log(`Monitoring enabled: ${status.enabled}`);
console.log(`Total operations: ${status.totalOperations}`);
```

### Performance Analytics

```typescript
// Get comprehensive performance analytics
const analytics = configManager.getPerformanceAnalytics();

console.log(`Average latency: ${analytics.averageLatency}ms`);
console.log(`Error rate: ${analytics.errorRate * 100}%`);
console.log(`Cache efficiency: ${analytics.cacheEfficiency * 100}%`);

console.log('Operation breakdown:');
Object.entries(analytics.operationBreakdown).forEach(([op, percentage]) => {
  console.log(`  ${op}: ${percentage.toFixed(1)}%`);
});

console.log('Top errors:');
analytics.topErrors.forEach(({ error, count }) => {
  console.log(`  ${error}: ${count} occurrences`);
});
```

## Best Practices

### Configuration Organization

1. **Directory Structure**: Use consistent directory structures for configurations
2. **Naming Conventions**: Use strategy names as filenames for clarity
3. **Backup Strategy**: Implement regular backups with appropriate retention policies
4. **Validation**: Always validate configurations before deployment

### Performance Optimization

1. **Cache Sizing**: Monitor cache hit rates and adjust sizes accordingly
2. **Batch Operations**: Use batch operations for multiple configuration changes
3. **Monitoring**: Set up alerts for performance degradation
4. **Audit Retention**: Balance audit history needs with storage constraints

### Error Handling

1. **Graceful Degradation**: Implement fallback configurations
2. **Retry Logic**: Use appropriate retry strategies for configuration operations
3. **Validation**: Comprehensive validation before applying changes
4. **Rollback**: Maintain ability to rollback configuration changes

## Troubleshooting

### Common Issues

#### Configuration Not Loading
- Check file permissions
- Verify configuration format
- Review audit logs for errors

#### Performance Degradation
- Monitor cache hit rates
- Check for large configuration files
- Review operation frequency

#### Backup/Restore Failures
- Verify backup integrity with checksums
- Check available disk space
- Review error logs for specific failures

### Debug Information

```typescript
// Enable debug logging
const configManager = new SearchStrategyConfigManager(persistenceManager, auditManager, {
  logger: console // Use custom logger for debugging
});

// Get detailed operation history
const history = await configManager.getAuditHistory('FTS5', 50);
history.forEach(entry => {
  if (!entry.success) {
    console.error(`Failed operation: ${entry.action}`, entry.error);
  }
});

// Check performance trends
const trends = configManager.getPerformanceAnalytics().performanceTrends;
trends.forEach(trend => {
  console.log(`${new Date(trend.timestamp).toISOString()}: ${trend.latency}ms avg latency`);
});
```

## Security Considerations

1. **File Permissions**: Ensure appropriate file system permissions
2. **Backup Encryption**: Consider encrypting sensitive configuration backups
3. **Access Control**: Implement proper access controls for configuration changes
4. **Audit Logging**: Maintain comprehensive audit trails for compliance

## Migration Guide

### Upgrading from Basic Configuration

1. **Export existing configurations**
2. **Update configuration format** to include new fields
3. **Test validation** with new schema
4. **Import configurations** with enhanced features
5. **Update monitoring** to use new performance features

This configuration management system provides the foundation for enterprise-grade AI applications with robust configuration handling, comprehensive monitoring, and reliable operation.