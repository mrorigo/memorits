# Performance Monitoring & Analytics

Memorits provides comprehensive performance monitoring capabilities with real-time dashboards, alerting systems, and predictive analytics. This document covers the performance monitoring infrastructure and how to leverage it for optimal system performance.

## Overview

The performance monitoring system includes:

- **PerformanceDashboardService**: Real-time performance data collection and visualization
- **PerformanceAnalyticsService**: Advanced analytics and reporting
- **Alert System**: Proactive monitoring with customizable thresholds
- **Trend Analysis**: Historical analysis with predictive capabilities

## PerformanceDashboardService

### Basic Setup

```typescript
import { PerformanceDashboardService } from 'memorits';

const dashboard = new PerformanceDashboardService();

// Initialize with default widgets and monitoring
dashboard.initializeDashboard();

// Get system status overview
const status = dashboard.getSystemStatusOverview();
console.log(`Overall health: ${status.overallHealth}`);
console.log(`Active alerts: ${status.activeAlerts}`);
console.log(`Uptime: ${status.uptime}%`);
```

### Real-time Metrics Collection

```typescript
// Get real-time metrics for specific component
const searchMetrics = dashboard.getRealTimeMetrics('search', 'latency', 50);
console.log(`Recent search latency samples: ${searchMetrics.length}`);

// Get metrics across all components
const allMetrics = dashboard.getRealTimeMetrics();
console.log(`Total metrics collected: ${allMetrics.length}`);

// Filter by metric type
const errorRates = dashboard.getRealTimeMetrics(undefined, 'error_rate', 100);
console.log(`Recent error rate samples: ${errorRates.length}`);
```

### Alert Management

```typescript
// Set up alert callbacks
dashboard.addAlertCallback((alert) => {
  console.log(`🚨 Alert: ${alert.title}`);
  console.log(`Description: ${alert.description}`);
  console.log(`Severity: ${alert.severity}`);
  console.log(`Component: ${alert.component}`);

  // Handle based on severity
  switch (alert.severity) {
    case 'critical':
      await handleCriticalAlert(alert);
      break;
    case 'warning':
      await handleWarningAlert(alert);
      break;
    default:
      console.log('Info alert:', alert.description);
  }
});

// Get active alerts
const activeAlerts = dashboard.getActiveAlerts();
console.log(`Active alerts: ${activeAlerts.length}`);

// Get alerts by severity
const criticalAlerts = dashboard.getAlertsBySeverity('critical');
const warningAlerts = dashboard.getAlertsBySeverity('warning');

// Acknowledge alert
const acknowledged = dashboard.acknowledgeAlert(alertId, userId);
if (acknowledged) {
  console.log('Alert acknowledged');
}

// Resolve alert with resolution notes
const resolved = dashboard.resolveAlert(alertId, 'Issue resolved - optimized database queries', userId);
if (resolved) {
  console.log('Alert resolved');
}
```

### Dashboard Widgets

```typescript
// Get available dashboard widgets
const widgets = dashboard.getWidgets();
console.log(`Available widgets: ${widgets.length}`);

widgets.forEach(widget => {
  console.log(`Widget: ${widget.title} (${widget.type})`);
  console.log(`  Component: ${widget.component}`);
  console.log(`  Refresh interval: ${widget.refreshInterval}ms`);
});

// Update specific widget data
dashboard.updateWidgetData('search_performance');

// Customize widget configuration
const customWidgets = [
  {
    id: 'custom_memory_usage',
    type: 'metric_chart',
    title: 'Memory Usage Trends',
    component: 'memory',
    position: { x: 0, y: 0, width: 8, height: 4 },
    data: { chartType: 'area', metrics: ['memory_usage'] },
    refreshInterval: 15000,
  }
];

// Export dashboard configuration
const dashboardConfig = dashboard.exportDashboardConfiguration();
console.log('Dashboard config:', dashboardConfig);

// Import custom configuration
dashboard.importDashboardConfiguration({ widgets: customWidgets });
```

## Performance Analytics

### Performance Snapshots

```typescript
// Get recent performance snapshots
const snapshots = dashboard.getPerformanceSnapshots(20);
console.log(`Performance snapshots: ${snapshots.length}`);

snapshots.forEach(snapshot => {
  console.log(`Timestamp: ${snapshot.timestamp.toISOString()}`);
  console.log(`Search response time: ${snapshot.searchMetrics.responseTime}ms`);
  console.log(`Database latency: ${snapshot.databaseMetrics.latency}ms`);
  console.log(`Cache hit rate: ${snapshot.configurationMetrics.cacheHitRate * 100}%`);
});
```

### Trend Analysis

```typescript
// Get trend analysis for different timeframes
const trends1h = dashboard.calculateTrendsForTimeframe(1);   // 1 hour
const trends24h = dashboard.calculateTrendsForTimeframe(24); // 24 hours
const trends7d = dashboard.calculateTrendsForTimeframe(168); // 7 days

trends24h.forEach(trend => {
  console.log(`Component: ${trend.component}`);
  console.log(`Metric: ${trend.metric}`);
  console.log(`Trend: ${trend.trend} (confidence: ${trend.confidence * 100}%)`);
  console.log(`Analysis: ${trend.analysis}`);

  if (trend.recommendations.length > 0) {
    console.log('Recommendations:');
    trend.recommendations.forEach(rec => console.log(`  - ${rec}`));
  }
});
```

### Performance Reports

```typescript
// Generate daily performance report
const dailyReport = dashboard.generatePerformanceReport('daily', {
  start: new Date(Date.now() - 24 * 60 * 60 * 1000),
  end: new Date()
});

console.log(`Report: ${dailyReport.title}`);
console.log(`Period: ${dailyReport.period.start.toISOString()} to ${dailyReport.period.end.toISOString()}`);
console.log(`Overall health: ${dailyReport.summary.overallHealth}`);

console.log('Key metrics:');
Object.entries(dailyReport.summary.keyMetrics).forEach(([key, value]) => {
  console.log(`  ${key}: ${value}`);
});

console.log('Top issues:');
dailyReport.summary.topIssues.forEach(issue => {
  console.log(`  - ${issue}`);
});

// Generate incident report
const incidentReport = dashboard.generatePerformanceReport('incident', {
  start: new Date(Date.now() - 2 * 60 * 60 * 1000), // Last 2 hours
  end: new Date()
});

console.log('Incident analysis:');
console.log('Search performance:', incidentReport.detailedAnalysis.searchPerformance);
console.log('Database performance:', incidentReport.detailedAnalysis.databasePerformance);
```

## Integration with Configuration Management

### Monitoring Configuration Performance

```typescript
import { SearchStrategyConfigManager } from 'memorits';

// Create configuration manager with performance monitoring
const configManager = new SearchStrategyConfigManager(persistenceManager, auditManager, logger);

// Monitor configuration operations
const configMetrics = configManager.getPerformanceMetrics();
console.log(`Configuration operations: ${configMetrics.totalOperations}`);
console.log(`Average latency: ${configMetrics.averageOperationTime}ms`);

// Get configuration-specific analytics
const configAnalytics = configManager.getPerformanceAnalytics();
console.log(`Configuration cache efficiency: ${configAnalytics.cacheEfficiency * 100}%`);
console.log(`Configuration error rate: ${configAnalytics.errorRate * 100}%`);

// Get detailed configuration performance report
const configReport = configManager.getConfigurationPerformanceReport();
console.log('Configuration performance summary:', configReport.summary);
console.log('Configuration recommendations:', configReport.recommendations);
```

### Correlating Performance Issues

```typescript
// Analyze correlation between search and database performance
const correlationAnalysis = dashboard.analyzeCrossComponentPerformance(snapshots);

console.log('Performance correlations:');
Object.entries(correlationAnalysis.correlations).forEach(([correlation, strength]) => {
  console.log(`  ${correlation}: ${strength}`);
});

console.log('Identified bottlenecks:');
correlationAnalysis.bottlenecks.forEach(bottleneck => {
  console.log(`  - ${bottleneck}`);
});

console.log('Resource utilization:');
console.log(`  Memory efficiency: ${correlationAnalysis.resourceUtilization.memoryEfficiency}`);
console.log(`  CPU utilization: ${correlationAnalysis.resourceUtilization.cpuUtilization}`);
```

## Custom Performance Monitoring

### Creating Custom Metrics

```typescript
// Define custom metric interface
interface CustomMetric {
  name: string;
  value: number;
  timestamp: Date;
  component: string;
  metadata?: Record<string, unknown>;
}

// Extend dashboard service for custom metrics
class CustomPerformanceDashboard extends PerformanceDashboardService {
  private customMetrics: CustomMetric[] = [];

  collectCustomMetric(metric: CustomMetric) {
    this.customMetrics.push(metric);

    // Maintain history limit
    if (this.customMetrics.length > 1000) {
      this.customMetrics = this.customMetrics.slice(-1000);
    }

    // Check custom alert conditions
    this.checkCustomAlertConditions(metric);
  }

  private checkCustomAlertConditions(metric: CustomMetric) {
    // Define custom thresholds
    const thresholds = {
      'custom_memory_usage': 500 * 1024 * 1024, // 500MB
      'custom_api_calls': 1000,                 // 1000 calls
      'custom_error_count': 10,                 // 10 errors
    };

    const threshold = thresholds[metric.name as keyof typeof thresholds];
    if (threshold && metric.value > threshold) {
      // Trigger custom alert
      console.warn(`Custom metric alert: ${metric.name} = ${metric.value}`);
    }
  }

  getCustomMetrics(name?: string, limit: number = 100): CustomMetric[] {
    let metrics = this.customMetrics;

    if (name) {
      metrics = metrics.filter(m => m.name === name);
    }

    return metrics.slice(-limit);
  }
}

// Usage
const customDashboard = new CustomPerformanceDashboard();
customDashboard.initializeDashboard();

// Collect custom metrics
customDashboard.collectCustomMetric({
  name: 'custom_memory_usage',
  value: 256 * 1024 * 1024, // 256MB
  timestamp: new Date(),
  component: 'memory_manager',
  metadata: { processId: process.pid }
});

// Retrieve custom metrics
const memoryUsage = customDashboard.getCustomMetrics('custom_memory_usage', 50);
console.log(`Memory usage samples: ${memoryUsage.length}`);
```

### Custom Alert Rules

```typescript
// Define custom alert rule interface
interface CustomAlertRule {
  name: string;
  condition: (metrics: any[]) => boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  message: string;
  cooldownMs: number; // Prevent alert spam
}

// Extend alert system with custom rules
class AdvancedAlertSystem extends PerformanceDashboardService {
  private customRules: CustomAlertRule[] = [];
  private lastAlertTimes: Map<string, number> = new Map();

  addCustomAlertRule(rule: CustomAlertRule) {
    this.customRules.push(rule);
  }

  checkCustomAlertRules() {
    const now = Date.now();

    this.customRules.forEach(rule => {
      // Check cooldown
      const lastAlert = this.lastAlertTimes.get(rule.name) || 0;
      if (now - lastAlert < rule.cooldownMs) {
        return;
      }

      // Get relevant metrics
      const metrics = this.getRealTimeMetrics();

      // Check condition
      if (rule.condition(metrics)) {
        // Trigger custom alert
        console.log(`Custom Alert [${rule.severity.toUpperCase()}]: ${rule.message}`);

        // Update last alert time
        this.lastAlertTimes.set(rule.name, now);
      }
    });
  }
}

// Usage
const advancedDashboard = new AdvancedAlertSystem();
advancedDashboard.initializeDashboard();

// Add custom alert rules
advancedDashboard.addCustomAlertRule({
  name: 'high_memory_usage',
  condition: (metrics) => {
    const memoryMetrics = metrics.filter(m => m.metricType === 'memory_usage');
    const avgMemory = memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length;
    return avgMemory > 400 * 1024 * 1024; // 400MB
  },
  severity: 'warning',
  message: 'Memory usage is consistently high',
  cooldownMs: 300000 // 5 minutes
});

advancedDashboard.addCustomAlertRule({
  name: 'search_performance_degradation',
  condition: (metrics) => {
    const searchMetrics = metrics.filter(m => m.component === 'search' && m.metricType === 'latency');
    const recent = searchMetrics.slice(0, 10);
    const older = searchMetrics.slice(10, 20);

    if (recent.length < 10 || older.length < 10) return false;

    const recentAvg = recent.reduce((sum, m) => sum + m.value, 0) / recent.length;
    const olderAvg = older.reduce((sum, m) => sum + m.value, 0) / older.length;

    // Check if recent performance is 50% worse than older period
    return recentAvg > olderAvg * 1.5;
  },
  severity: 'error',
  message: 'Search performance has degraded significantly',
  cooldownMs: 600000 // 10 minutes
});
```

## Best Practices

### Monitoring Setup

1. **Baseline Establishment**: Collect baseline metrics before optimization
2. **Alert Thresholds**: Set appropriate thresholds based on baseline performance
3. **Dashboard Customization**: Configure widgets for relevant metrics
4. **Regular Review**: Regularly review performance reports and trends

### Performance Optimization

1. **Metric Selection**: Monitor only relevant metrics to avoid overhead
2. **Alert Tuning**: Adjust alert thresholds based on operational experience
3. **Trend Analysis**: Use historical data for capacity planning
4. **Proactive Monitoring**: Address degrading trends before they become issues

### Troubleshooting

1. **Alert Storm Management**: Implement alert cooldowns and aggregation
2. **False Positive Reduction**: Tune alert conditions based on operational patterns
3. **Performance Impact**: Monitor the performance impact of monitoring itself
4. **Data Retention**: Balance monitoring history with storage constraints

## Integration Examples

### Application Performance Monitoring

```typescript
// Monitor application-specific metrics
class ApplicationPerformanceMonitor {
  private dashboard: PerformanceDashboardService;

  constructor() {
    this.dashboard = new PerformanceDashboardService();
    this.setupApplicationMetrics();
  }

  private setupApplicationMetrics() {
    // Monitor API endpoint performance
    this.monitorApiEndpoints();

    // Monitor database connection pools
    this.monitorConnectionPools();

    // Monitor memory usage patterns
    this.monitorMemoryPatterns();
  }

  private monitorApiEndpoints() {
    // Track endpoint response times
    const originalFetch = global.fetch;
    global.fetch = async (...args) => {
      const startTime = Date.now();
      const response = await originalFetch(...args);
      const endTime = Date.now();

      // Record API performance metric
      this.recordMetric({
        component: 'api',
        metricType: 'latency',
        value: endTime - startTime,
        metadata: { endpoint: args[0] }
      });

      return response;
    };
  }

  private recordMetric(metric: any) {
    // This would integrate with the actual dashboard service
    console.log(`Recorded metric: ${metric.component}/${metric.metricType} = ${metric.value}`);
  }
}
```

### Business Metrics Integration

```typescript
// Monitor business-relevant metrics
class BusinessMetricsMonitor {
  trackUserEngagement() {
    // Track conversation length, user satisfaction, etc.
  }

  trackFeatureUsage() {
    // Track which search strategies are used most
  }

  trackBusinessValue() {
    // Track time saved, productivity improvements, etc.
  }
}
```

This performance monitoring system provides comprehensive visibility into Memorits operations, enabling proactive optimization and reliable AI application performance.