# Service Monitoring and Metrics

## Overview

The Consolidation Service provides comprehensive monitoring and metrics capabilities to track system health, performance, and operational efficiency. These features enable proactive maintenance, performance optimization, and troubleshooting of memory consolidation operations.

## Core Monitoring Features

### Consolidation Analytics

The `getConsolidationAnalytics()` method provides comprehensive statistics about consolidation activities:

```typescript
interface ConsolidationStats {
  totalMemories: number;                    // Total memories in system
  duplicateCount: number;                   // Identified duplicates
  consolidatedMemories: number;             // Successfully consolidated
  averageConsolidationRatio: number;        // Average consolidation efficiency
  lastConsolidationActivity?: Date;         // Last consolidation timestamp
  consolidationTrends: ConsolidationTrend[]; // Historical trend data
}

interface ConsolidationTrend {
  period: string;                           // Time period (e.g., "2024-W01")
  consolidationCount: number;               // Consolidations in period
  averageSimilarityScore: number;           // Average similarity of consolidated memories
  averageDuplicatesPerConsolidation: number; // Average duplicates per operation
}
```

**Usage Example**:
```typescript
import { RepositoryFactory } from '../src/core/database/factories/RepositoryFactory';
import { MemoryConsolidationService } from '../src/core/database/MemoryConsolidationService';

const repository = RepositoryFactory.createConsolidationRepository();
const consolidationService = new MemoryConsolidationService(repository);

// Get comprehensive analytics
const analytics = await consolidationService.getConsolidationAnalytics();

console.log('Consolidation Overview:', {
  totalMemories: analytics.totalMemories,
  activeDuplicates: analytics.duplicateCount,
  consolidationRate: `${analytics.consolidatedMemories}/${analytics.totalMemories}`,
  efficiency: `${(analytics.averageConsolidationRatio * 100).toFixed(1)}%`,
  lastActivity: analytics.lastConsolidationActivity?.toISOString(),
});

// Analyze trends
analytics.consolidationTrends.forEach(trend => {
  console.log(`Period ${trend.period}:`, {
    consolidations: trend.consolidationCount,
    avgSimilarity: `${(trend.averageSimilarityScore * 100).toFixed(1)}%`,
    avgDuplicates: trend.averageDuplicatesPerConsolidation.toFixed(1),
  });
});
```

### Optimization Recommendations

The `getOptimizationRecommendations()` method provides actionable insights for system optimization:

```typescript
interface OptimizationRecommendation {
  type: 'cleanup' | 'consolidation' | 'archival';
  priority: 'low' | 'medium' | 'high';
  description: string;
  estimatedBenefit: string;
  actionRequired: string[];
}
```

**Usage Example**:
```typescript
const recommendations = await consolidationService.getOptimizationRecommendations();

console.log(`System Health: ${recommendations.overallHealth}`);
console.log(`Next Maintenance: ${recommendations.nextMaintenanceDate?.toISOString()}`);

recommendations.recommendations.forEach((rec, index) => {
  console.log(`${index + 1}. [${rec.priority.toUpperCase()}] ${rec.type}:`);
  console.log(`   Description: ${rec.description}`);
  console.log(`   Benefit: ${rec.estimatedBenefit}`);
  console.log(`   Actions: ${rec.actionRequired.join(', ')}`);
  console.log('');
});
```

## Performance Monitoring

### Operation Timing

All consolidation operations include built-in performance monitoring:

```typescript
// Operations are automatically logged with timing information
const startTime = Date.now();
const result = await consolidationService.consolidateMemories(primaryId, duplicateIds);
const duration = Date.now() - startTime;

console.log('Operation Performance:', {
  operation: 'consolidateMemories',
  duration: `${duration}ms`,
  success: result.success,
  memoriesProcessed: duplicateIds.length + 1,
  throughput: `${((duplicateIds.length + 1) / duration * 1000).toFixed(2)} memories/sec`,
});
```

### Resource Usage Tracking

Monitor memory and database resource usage patterns:

```typescript
async function trackResourceUsage() {
  const initialMemory = process.memoryUsage();

  const duplicates = await consolidationService.detectDuplicateMemories(content, 0.8);
  const currentMemory = process.memoryUsage();

  console.log('Resource Usage:', {
    memoryIncrease: {
      rss: `${((currentMemory.rss - initialMemory.rss) / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${((currentMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)} MB`,
      external: `${((currentMemory.external - initialMemory.external) / 1024 / 1024).toFixed(2)} MB`,
    },
    candidatesProcessed: duplicates.length,
    averageMemoryPerCandidate: `${((currentMemory.heapUsed - initialMemory.heapUsed) / duplicates.length / 1024).toFixed(2)} KB`,
  });
}
```

## Health Monitoring

### System Health Indicators

Monitor overall system health through key metrics:

```typescript
async function assessSystemHealth() {
  const analytics = await consolidationService.getConsolidationAnalytics();
  const recommendations = await consolidationService.getOptimizationRecommendations();

  const healthMetrics = {
    consolidationRatio: analytics.averageConsolidationRatio,
    duplicateBacklog: analytics.duplicateCount,
    systemActivity: analytics.lastConsolidationActivity ?
      Date.now() - analytics.lastConsolidationActivity.getTime() : Infinity,
    overallHealth: recommendations.overallHealth,
  };

  // Health assessment logic
  let healthScore = 100;

  if (healthMetrics.consolidationRatio < 0.1) healthScore -= 30;
  if (healthMetrics.duplicateBacklog > 1000) healthScore -= 25;
  if (healthMetrics.systemActivity > 7 * 24 * 60 * 60 * 1000) healthScore -= 20; // 7 days
  if (healthMetrics.overallHealth === 'poor') healthScore -= 40;
  else if (healthMetrics.overallHealth === 'fair') healthScore -= 20;

  console.log('System Health Assessment:', {
    score: `${healthScore}/100`,
    metrics: healthMetrics,
    status: healthScore >= 80 ? 'healthy' : healthScore >= 60 ? 'warning' : 'critical',
  });

  return healthScore;
}
```

### Trend Analysis

Track consolidation patterns over time for proactive optimization:

```typescript
async function analyzeConsolidationTrends() {
  const analytics = await consolidationService.getConsolidationAnalytics();

  if (analytics.consolidationTrends.length < 2) {
    console.log('Insufficient trend data available');
    return;
  }

  const recent = analytics.consolidationTrends.slice(-4); // Last 4 periods
  const older = analytics.consolidationTrends.slice(-8, -4); // Previous 4 periods

  const recentAvg = recent.reduce((sum, t) => sum + t.consolidationCount, 0) / recent.length;
  const olderAvg = older.reduce((sum, t) => sum + t.consolidationCount, 0) / older.length;

  const trend = recentAvg > olderAvg ? 'increasing' : recentAvg < olderAvg ? 'decreasing' : 'stable';

  console.log('Consolidation Trend Analysis:', {
    trend,
    recentAverage: recentAvg.toFixed(1),
    olderAverage: olderAvg.toFixed(1),
    changePercent: `${(((recentAvg - olderAvg) / olderAvg) * 100).toFixed(1)}%`,
    periods: recent.map(t => t.period),
  });

  return { trend, recentAvg, olderAvg };
}
```

## Custom Monitoring Dashboard

### Basic Dashboard Implementation

```typescript
class ConsolidationDashboard {
  private consolidationService: MemoryConsolidationService;

  constructor(consolidationService: MemoryConsolidationService) {
    this.consolidationService = consolidationService;
  }

  async generateReport(): Promise<ConsolidationReport> {
    const [analytics, recommendations] = await Promise.all([
      this.consolidationService.getConsolidationAnalytics(),
      this.consolidationService.getOptimizationRecommendations(),
    ]);

    return {
      timestamp: new Date(),
      summary: {
        totalMemories: analytics.totalMemories,
        duplicates: analytics.duplicateCount,
        consolidated: analytics.consolidatedMemories,
        health: recommendations.overallHealth,
      },
      trends: analytics.consolidationTrends,
      recommendations: recommendations.recommendations,
      alerts: this.generateAlerts(analytics, recommendations),
    };
  }

  private generateAlerts(
    analytics: ConsolidationStats,
    recommendations: Awaited<ReturnType<typeof this.consolidationService.getOptimizationRecommendations>>
  ): Alert[] {
    const alerts: Alert[] = [];

    if (analytics.duplicateCount > 1000) {
      alerts.push({
        level: 'warning',
        message: `High duplicate count: ${analytics.duplicateCount} duplicates detected`,
        action: 'Review and consolidate duplicate memories',
      });
    }

    if (recommendations.overallHealth === 'poor') {
      alerts.push({
        level: 'critical',
        message: 'System health is poor',
        action: 'Immediate maintenance required',
      });
    }

    const daysSinceActivity = analytics.lastConsolidationActivity
      ? (Date.now() - analytics.lastConsolidationActivity.getTime()) / (1000 * 60 * 60 * 24)
      : 30;

    if (daysSinceActivity > 7) {
      alerts.push({
        level: 'info',
        message: `No consolidation activity for ${daysSinceActivity.toFixed(1)} days`,
        action: 'Schedule regular consolidation runs',
      });
    }

    return alerts;
  }
}

interface ConsolidationReport {
  timestamp: Date;
  summary: {
    totalMemories: number;
    duplicates: number;
    consolidated: number;
    health: string;
  };
  trends: ConsolidationTrend[];
  recommendations: OptimizationRecommendation[];
  alerts: Alert[];
}

interface Alert {
  level: 'info' | 'warning' | 'critical';
  message: string;
  action: string;
}
```

### Real-time Monitoring

```typescript
async function setupRealTimeMonitoring(intervalMinutes: number = 15) {
  const dashboard = new ConsolidationDashboard(consolidationService);

  const monitor = async () => {
    try {
      const report = await dashboard.generateReport();

      // Log key metrics
      console.log(`[${report.timestamp.toISOString()}] Monitoring Update:`, {
        health: report.summary.health,
        duplicates: report.summary.duplicates,
        newAlerts: report.alerts.filter(a => a.level !== 'info').length,
      });

      // Handle critical alerts
      const criticalAlerts = report.alerts.filter(a => a.level === 'critical');
      if (criticalAlerts.length > 0) {
        await sendCriticalAlert(criticalAlerts);
      }

      // Handle warnings
      const warnings = report.alerts.filter(a => a.level === 'warning');
      if (warnings.length > 0) {
        await sendWarningNotification(warnings);
      }

    } catch (error) {
      console.error('Monitoring error:', error);
    }
  };

  // Initial run
  await monitor();

  // Schedule recurring monitoring
  setInterval(monitor, intervalMinutes * 60 * 1000);

  console.log(`Real-time monitoring started (interval: ${intervalMinutes} minutes)`);
}
```

## Metrics Collection

### Custom Metrics Collector

```typescript
class ConsolidationMetricsCollector {
  private metrics: Map<string, number[]> = new Map();

  recordOperation(operation: string, duration: number, success: boolean): void {
    const key = `${operation}_${success ? 'success' : 'failure'}`;

    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }

    this.metrics.get(key)!.push(duration);

    // Keep only last 1000 measurements
    const values = this.metrics.get(key)!;
    if (values.length > 1000) {
      values.splice(0, values.length - 1000);
    }
  }

  getMetrics(): Record<string, {
    count: number;
    average: number;
    min: number;
    max: number;
    p95: number;
  }> {
    const result: Record<string, any> = {};

    for (const [key, values] of this.metrics.entries()) {
      if (values.length === 0) continue;

      const sorted = [...values].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);

      result[key] = {
        count: values.length,
        average: values.reduce((a, b) => a + b, 0) / values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        p95: sorted[p95Index],
      };
    }

    return result;
  }

  exportMetrics(): string {
    const metrics = this.getMetrics();
    return JSON.stringify(metrics, null, 2);
  }
}

// Usage with consolidation service
const metricsCollector = new ConsolidationMetricsCollector();

// Wrap consolidation operations to collect metrics
const originalConsolidate = consolidationService.consolidateMemories.bind(consolidationService);
consolidationService.consolidateMemories = async (primaryId: string, duplicateIds: string[]) => {
  const startTime = Date.now();
  try {
    const result = await originalConsolidate(primaryId, duplicateIds);
    const duration = Date.now() - startTime;

    metricsCollector.recordOperation('consolidate', duration, result.success);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    metricsCollector.recordOperation('consolidate', duration, false);
    throw error;
  }
};
```

### Database Performance Metrics

Monitor database query performance and resource usage:

```typescript
async function collectDatabaseMetrics() {
  const queryMetrics = {
    duplicateDetection: await measureQueryPerformance(() =>
      consolidationService.detectDuplicateMemories('test content', 0.8)
    ),
    consolidation: await measureQueryPerformance(() =>
      consolidationService.consolidateMemories('test-id', ['test-id-2'])
    ),
    cleanup: await measureQueryPerformance(() =>
      consolidationService.cleanupOldConsolidatedMemories(30, true)
    ),
  };

  console.log('Database Performance Metrics:', queryMetrics);
}

async function measureQueryPerformance<T>(operation: () => Promise<T>): Promise<{
  duration: number;
  success: boolean;
  memoryUsage: NodeJS.MemoryUsage;
}> {
  const startMemory = process.memoryUsage();
  const startTime = Date.now();

  try {
    await operation();
    const endTime = Date.now();
    const endMemory = process.memoryUsage();

    return {
      duration: endTime - startTime,
      success: true,
      memoryUsage: {
        rss: endMemory.rss - startMemory.rss,
        heapUsed: endMemory.heapUsed - startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - startMemory.heapTotal,
        external: endMemory.external - startMemory.external,
      },
    };
  } catch (error) {
    const endTime = Date.now();
    return {
      duration: endTime - startTime,
      success: false,
      memoryUsage: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 },
    };
  }
}
```

## Alerting and Notifications

### Alert Configuration

```typescript
interface AlertConfig {
  duplicateThreshold: number;
  inactivityDays: number;
  healthStatus: ('fair' | 'poor')[];
  consolidationFailureRate: number;
}

const defaultAlertConfig: AlertConfig = {
  duplicateThreshold: 1000,
  inactivityDays: 7,
  healthStatus: ['poor'],
  consolidationFailureRate: 0.1, // 10% failure rate
};

class AlertManager {
  private config: AlertConfig;
  private failureCount = 0;
  private totalOperations = 0;

  constructor(config: AlertConfig = defaultAlertConfig) {
    this.config = config;
  }

  recordOperation(success: boolean): void {
    this.totalOperations++;
    if (!success) {
      this.failureCount++;
    }
  }

  async checkAlerts(analytics: ConsolidationStats, recommendations: any): Promise<Alert[]> {
    const alerts: Alert[] = [];

    // Check duplicate threshold
    if (analytics.duplicateCount > this.config.duplicateThreshold) {
      alerts.push({
        level: 'warning',
        message: `Duplicate count (${analytics.duplicateCount}) exceeds threshold (${this.config.duplicateThreshold})`,
        action: 'Review consolidation strategy',
      });
    }

    // Check inactivity
    if (analytics.lastConsolidationActivity) {
      const daysSinceActivity = (Date.now() - analytics.lastConsolidationActivity.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceActivity > this.config.inactivityDays) {
        alerts.push({
          level: 'info',
          message: `No consolidation activity for ${daysSinceActivity.toFixed(1)} days`,
          action: 'Schedule consolidation run',
        });
      }
    }

    // Check system health
    if (this.config.healthStatus.includes(recommendations.overallHealth)) {
      alerts.push({
        level: 'critical',
        message: `System health is ${recommendations.overallHealth}`,
        action: 'Immediate attention required',
      });
    }

    // Check failure rate
    if (this.totalOperations > 0) {
      const failureRate = this.failureCount / this.totalOperations;
      if (failureRate > this.config.consolidationFailureRate) {
        alerts.push({
          level: 'critical',
          message: `Consolidation failure rate ${(failureRate * 100).toFixed(1)}% exceeds threshold ${(this.config.consolidationFailureRate * 100).toFixed(1)}%`,
          action: 'Investigate consolidation failures',
        });
      }
    }

    return alerts;
  }
}
```

## Integration with External Monitoring

### Prometheus Metrics Export

```typescript
function exportPrometheusMetrics(analytics: ConsolidationStats): string {
  const metrics = [
    `# HELP memori_consolidation_memories_total Total number of memories`,
    `# TYPE memori_consolidation_memories_total gauge`,
    `memori_consolidation_memories_total ${analytics.totalMemories}`,

    `# HELP memori_consolidation_duplicates_total Number of duplicate memories`,
    `# TYPE memori_consolidation_duplicates_total gauge`,
    `memori_consolidation_duplicates_total ${analytics.duplicateCount}`,

    `# HELP memori_consolidation_consolidated_total Number of consolidated memories`,
    `# TYPE memori_consolidation_consolidated_total gauge`,
    `memori_consolidation_consolidated_total ${analytics.consolidatedMemories}`,

    `# HELP memori_consolidation_ratio Average consolidation ratio`,
    `# TYPE memori_consolidation_ratio gauge`,
    `memori_consolidation_ratio ${analytics.averageConsolidationRatio}`,
  ];

  return metrics.join('\n') + '\n';
}
```

### Grafana Dashboard Configuration

```typescript
// Example Grafana panel configuration for consolidation metrics
const grafanaPanels = {
  consolidationOverview: {
    title: 'Consolidation Overview',
    type: 'stat',
    targets: [
      { expr: 'memori_consolidation_memories_total', legendFormat: 'Total Memories' },
      { expr: 'memori_consolidation_duplicates_total', legendFormat: 'Duplicates' },
      { expr: 'memori_consolidation_consolidated_total', legendFormat: 'Consolidated' },
      { expr: 'memori_consolidation_ratio * 100', legendFormat: 'Consolidation Ratio %' },
    ],
  },

  consolidationTrends: {
    title: 'Consolidation Trends',
    type: 'graph',
    targets: [
      { expr: 'increase(memori_consolidation_consolidated_total[1w])', legendFormat: 'Weekly Consolidations' },
    ],
  },

  systemHealth: {
    title: 'System Health',
    type: 'gauge',
    targets: [
      { expr: 'memori_consolidation_ratio * 100', legendFormat: 'Health Score' },
    ],
    thresholds: [
      { color: 'red', value: 0 },
      { color: 'yellow', value: 60 },
      { color: 'green', value: 80 },
    ],
  },
};
```

## Best Practices

### Monitoring Setup
1. **Regular Analytics Collection**: Schedule `getConsolidationAnalytics()` calls during low-traffic periods
2. **Trend Analysis**: Monitor trends over multiple time periods for pattern detection
3. **Alert Thresholds**: Set appropriate thresholds based on your system's scale and requirements
4. **Performance Baselines**: Establish baseline metrics for normal operation comparison

### Performance Optimization
1. **Batch Size Tuning**: Monitor operation duration and adjust batch sizes accordingly
2. **Resource Usage Tracking**: Watch memory and CPU usage patterns during consolidation
3. **Query Optimization**: Use analytics data to identify and optimize slow operations
4. **Cache Management**: Monitor cache hit rates and memory usage for repository instances

### Troubleshooting
1. **Error Pattern Analysis**: Use metrics to identify common failure patterns
2. **Performance Bottleneck Identification**: Use timing data to find optimization opportunities
3. **Resource Leak Detection**: Monitor memory usage trends for potential leaks
4. **System Load Correlation**: Correlate consolidation performance with overall system load

## Related Documentation

- [Architecture Guide](consolidation-service-architecture.md) - System architecture overview
- [API Reference](../api-reference/consolidation-service-api.md) - Complete API documentation
- [Duplicate Management](duplicate-management.md) - Comprehensive duplicate management strategies
- [Consolidation Service Architecture](../advanced-features/consolidation-service-architecture.md) - Service-oriented design overview