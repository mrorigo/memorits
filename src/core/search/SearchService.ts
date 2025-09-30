import { SearchStrategy, SearchQuery, SearchResult, ISearchStrategy, ISearchService, StrategyNotFoundError, SearchStrategyConfiguration, SearchErrorContext } from './types';
import { SearchError, SearchValidationError, SearchErrorCategory, SearchStrategyError, SearchTimeoutError, SearchParseError, SearchConfigurationError } from './SearchStrategy';
import { AdvancedFilterEngine } from './filtering/AdvancedFilterEngine';
import { SearchIndexManager, IndexHealth, IndexHealthReport, OptimizationType } from './SearchIndexManager';
import { LikeSearchStrategy } from './LikeSearchStrategy';
import { RecentMemoriesStrategy } from './RecentMemoriesStrategy';
import { RelationshipSearchStrategy } from './strategies/RelationshipSearchStrategy';
import { SQLiteFTSStrategy } from './strategies/SQLiteFTSStrategy';
import { SemanticSearchStrategy } from './strategies/SemanticSearchStrategy';
import { CategoryFilterStrategy } from './filtering/CategoryFilterStrategy';
import { TemporalFilterStrategy } from './filtering/TemporalFilterStrategy';
import { MetadataFilterStrategy } from './filtering/MetadataFilterStrategy';
import { DatabaseManager } from '../database/DatabaseManager';
import { SearchStrategyConfigManager } from './SearchStrategyConfigManager';
import { logError } from '../utils/Logger';
import {
  sanitizeString,
  sanitizeSearchQuery,
  sanitizeJsonInput,
  SanitizationError,
  ValidationError,
  containsDangerousPatterns
} from '../utils/SanitizationUtils';

// ===== PERFORMANCE MONITORING AND ANALYTICS INTERFACES =====

/**
 * Performance metrics collection interface
 */
interface PerformanceMetrics {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageResponseTime: number;
  averageQueryTime: number; // Keep for backward compatibility
  strategyUsage: Map<SearchStrategy, number>;
  errorCounts: Map<string, number>;
  memoryUsage: number;
  peakMemoryUsage: number;
  queryComplexity: Map<string, number>;
  performanceTrends: PerformanceTrend[];
  lastMaintenanceCheck: Date;
  maintenanceCheckCount: number;
}

/**
 * Performance trend data structure
 */
interface PerformanceTrend {
  timestamp: number;
  responseTime: number;
  memoryUsage: number;
  queryCount: number;
  errorRate: number;
  strategy: SearchStrategy;
}

/**
 * Performance report structure
 */
interface PerformanceReport {
  totalQueries: number;
  successfulQueries: number;
  failedQueries: number;
  averageResponseTime: number;
  successRate: number;
  strategyUsagePercentages: Record<SearchStrategy, number>;
  topErrors: Array<{ error: string; count: number }>;
  performanceTrends: PerformanceTrend[];
  optimizationRecommendations: string[];
  timestamp: Date;
}

/**
 * Dashboard data structure
 */
interface DashboardData {
  currentMetrics: {
    totalQueries: number;
    averageResponseTime: number;
    memoryUsage: number;
    errorRate: number;
  };
  historicalData: {
    responseTimeHistory: Array<{ timestamp: Date; value: number }>;
    memoryUsageHistory: Array<{ timestamp: Date; value: number }>;
    queryVolumeHistory: Array<{ timestamp: Date; value: number }>;
  };
  strategyComparison: Array<{
    strategy: SearchStrategy;
    usagePercentage: number;
    averageResponseTime: number;
    successRate: number;
  }>;
  errorAnalysis: Array<{
    error: string;
    count: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  optimizationSuggestions: string[];
  systemHealth: 'healthy' | 'degraded' | 'critical';
  lastUpdated: Date;
}

/**
 * Performance monitoring configuration
 */
interface PerformanceMonitoringConfig {
  enabled: boolean;
  collectionInterval: number; // milliseconds
  retentionPeriod: number; // milliseconds
  alertThresholds: {
    maxResponseTime: number;
    maxErrorRate: number;
    maxMemoryUsage: number;
  };
}

/**
 * Performance alert structure
 */
interface PerformanceAlert {
  type: 'response_time' | 'error_rate' | 'memory_usage' | 'system_health';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: {
    currentValue: number;
    threshold: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  };
  recommendations: string[];
}



/**
 * Configuration change listener type
 */
type ConfigurationChangeListener = (oldConfig: SearchStrategyConfiguration, newConfig: SearchStrategyConfiguration) => void;

/**
 * Configuration update state
 */
interface ConfigurationUpdateState {
  isUpdating: boolean;
  lastUpdateAttempt: Date | null;
  lastUpdateSuccess: Date | null;
  updateHistory: ConfigurationUpdateRecord[];
  rollbackInProgress: boolean;
}

/**
 * Configuration update record
 */
interface ConfigurationUpdateRecord {
  timestamp: Date;
  strategyName: string;
  action: 'update' | 'rollback' | 'failed';
  oldConfig?: SearchStrategyConfiguration;
  newConfig?: SearchStrategyConfiguration;
  error?: string;
  success: boolean;
}


/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failureCount: number;
  lastFailureTime: Date | null;
  state: 'closed' | 'open' | 'half-open';
  nextAttemptTime: Date | null;
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

/**
 * Error tracking information
 */
interface ErrorTrackingInfo {
  strategy: SearchStrategy;
  error: unknown;
  context: SearchErrorContext;
  timestamp: Date;
  resolved: boolean;
  recoveryAttempts: number;
}

/**
 * Error trend analysis
 */
interface ErrorTrendAnalysis {
  hasCriticalTrend: boolean;
  strategyTrends: Map<SearchStrategy, ErrorTrendData>;
  timeWindowTrends: ErrorTrendData[];
  recommendations: string[];
}

/**
 * Error trend data
 */
interface ErrorTrendData {
  errorCount: number;
  errorRate: number;
  averageRecoveryTime: number;
  trendDirection: 'improving' | 'stable' | 'degrading';
  affectedOperations: string[];
}

/**
 * Recovery action result
 */
interface RecoveryActionResult {
  success: boolean;
  recoveryTime: number;
  fallbackUsed: boolean;
  error?: string;
}

/**
 * Circuit breaker implementation for fault tolerance
 */
class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.state = {
      failureCount: 0,
      lastFailureTime: null,
      state: 'closed',
      nextAttemptTime: null,
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      throw new Error(`Circuit breaker is OPEN for strategy`);
    }

    try {
      const result = await operation();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  isOpen(): boolean {
    if (this.state.state === 'open') {
      if (this.state.nextAttemptTime && Date.now() >= this.state.nextAttemptTime.getTime()) {
        this.state.state = 'half-open';
        return false;
      }
      return true;
    }
    return false;
  }

  recordSuccess(): void {
    this.state.failureCount = 0;
    this.state.state = 'closed';
    this.state.lastFailureTime = null;
    this.state.nextAttemptTime = null;
  }

  recordFailure(): void {
    this.state.failureCount++;
    this.state.lastFailureTime = new Date();

    if (this.state.failureCount >= this.config.failureThreshold) {
      this.state.state = 'open';
      this.state.nextAttemptTime = new Date(Date.now() + this.config.recoveryTimeout);
    }
  }

  getState(): CircuitBreakerState {
    return { ...this.state };
  }
}

/**
 * Error tracker for trend analysis and metrics
 */
class ErrorTracker {
  private errors: ErrorTrackingInfo[] = [];
  private maxErrors = 1000;
  private trendWindow = 24 * 60 * 60 * 1000; // 24 hours

  recordError(strategy: SearchStrategy, error: unknown, context: SearchErrorContext): void {
    const trackingInfo: ErrorTrackingInfo = {
      strategy,
      error,
      context,
      timestamp: new Date(),
      resolved: false,
      recoveryAttempts: 0,
    };

    this.errors.push(trackingInfo);

    // Maintain error history size
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }
  }

  markErrorResolved(strategy: SearchStrategy, timestamp: Date): void {
    const error = this.errors
      .filter(e => e.strategy === strategy && !e.resolved)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

    if (error) {
      error.resolved = true;
    }
  }

  analyzeTrends(): ErrorTrendAnalysis {
    const now = Date.now();
    const windowStart = now - this.trendWindow;

    const recentErrors = this.errors.filter(e => e.timestamp.getTime() >= windowStart);

    const strategyTrends = new Map<SearchStrategy, ErrorTrendData>();
    const strategyGroups = new Map<SearchStrategy, ErrorTrackingInfo[]>();

    // Group errors by strategy
    for (const error of recentErrors) {
      if (!strategyGroups.has(error.strategy)) {
        strategyGroups.set(error.strategy, []);
      }
      strategyGroups.get(error.strategy)!.push(error);
    }

    // Analyze trends for each strategy
    for (const [strategy, errors] of strategyGroups) {
      const errorCount = errors.length;
      const errorRate = errorCount / (this.trendWindow / 1000); // errors per second
      const resolvedCount = errors.filter(e => e.resolved).length;
      const averageRecoveryTime = this.calculateAverageRecoveryTime(errors);

      let trendDirection: 'improving' | 'stable' | 'degrading' = 'stable';
      if (resolvedCount / errorCount > 0.8) {
        trendDirection = 'improving';
      } else if (errorCount > errors.length * 0.3) {
        trendDirection = 'degrading';
      }

      strategyTrends.set(strategy, {
        errorCount,
        errorRate,
        averageRecoveryTime,
        trendDirection,
        affectedOperations: [...new Set(errors.map(e => e.context.operation))],
      });
    }

    const hasCriticalTrend = Array.from(strategyTrends.values())
      .some(trend => trend.trendDirection === 'degrading' && trend.errorRate > 0.1);

    const recommendations = this.generateRecommendations(strategyTrends);

    return {
      hasCriticalTrend,
      strategyTrends,
      timeWindowTrends: [], // Could implement time-based analysis
      recommendations,
    };
  }

  private calculateAverageRecoveryTime(errors: ErrorTrackingInfo[]): number {
    const resolvedErrors = errors.filter(e => e.resolved);
    if (resolvedErrors.length === 0) return 0;

    const totalRecoveryTime = resolvedErrors.reduce((sum, error) => {
      return sum + (error.context.executionTime || 0);
    }, 0);

    return totalRecoveryTime / resolvedErrors.length;
  }

  private generateRecommendations(trends: Map<SearchStrategy, ErrorTrendData>): string[] {
    const recommendations: string[] = [];

    for (const [strategy, trend] of trends) {
      if (trend.trendDirection === 'degrading') {
        recommendations.push(`Consider disabling ${strategy} strategy due to high error rate`);
      }
      if (trend.errorRate > 0.1) {
        recommendations.push(`High error rate detected for ${strategy}, investigate root cause`);
      }
    }

    return recommendations;
  }

  getRecentErrors(strategy?: SearchStrategy, limit = 50): ErrorTrackingInfo[] {
    let errors = this.errors
      .filter(e => !strategy || e.strategy === strategy)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return errors.slice(0, limit);
  }
}

/**
 * Main SearchService implementation that orchestrates multiple search strategies
 */
export class SearchService implements ISearchService {
  private strategies: Map<SearchStrategy, ISearchStrategy> = new Map();
  private dbManager!: DatabaseManager;
  private advancedFilterEngine?: AdvancedFilterEngine;
  private configManager: SearchStrategyConfigManager;
  private searchIndexManager: SearchIndexManager;

  // Maintenance and monitoring
  private maintenanceTimer?: NodeJS.Timer;
  private performanceMetrics: PerformanceMetrics = {
    totalQueries: 0,
    successfulQueries: 0,
    failedQueries: 0,
    averageResponseTime: 0,
    averageQueryTime: 0,
    strategyUsage: new Map<SearchStrategy, number>(),
    errorCounts: new Map<string, number>(),
    memoryUsage: 0,
    peakMemoryUsage: 0,
    queryComplexity: new Map<string, number>(),
    performanceTrends: [],
    lastMaintenanceCheck: new Date(),
    maintenanceCheckCount: 0,
  };

  // Performance monitoring configuration
  private performanceMonitoringConfig: PerformanceMonitoringConfig = {
    enabled: true,
    collectionInterval: 60000, // 1 minute
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    alertThresholds: {
      maxResponseTime: 5000, // 5 seconds
      maxErrorRate: 0.1, // 10%
      maxMemoryUsage: 100 * 1024 * 1024, // 100MB
    },
  };

  // Performance monitoring timers and alerts
  private performanceCollectionTimer?: NodeJS.Timeout;
  private performanceAlertCallbacks: Array<(alert: PerformanceAlert) => void> = [];

  // Runtime configuration update infrastructure
  private configurationChangeListeners: Map<string, ConfigurationChangeListener[]> = new Map();
  private configurationUpdateState: ConfigurationUpdateState;
  private readonly maxUpdateHistorySize = 100;

  // Enhanced error handling and recovery infrastructure
  private circuitBreakers: Map<SearchStrategy, CircuitBreaker> = new Map();
  private errorTracker: ErrorTracker = new ErrorTracker();
  private operationStartTime: number = 0;
  private criticalErrorThreshold = 10;
  private errorNotificationCallback?: (error: SearchErrorContext) => void;

  constructor(dbManager: DatabaseManager, configManager?: SearchStrategyConfigManager) {
    this.dbManager = dbManager;
    this.advancedFilterEngine = new AdvancedFilterEngine();
    this.configManager = configManager || new SearchStrategyConfigManager();
    this.searchIndexManager = new SearchIndexManager(this.dbManager);
    this.configurationUpdateState = {
      isUpdating: false,
      lastUpdateAttempt: null,
      lastUpdateSuccess: null,
      updateHistory: [],
      rollbackInProgress: false,
    };
    this.initializeStrategies();
    this.startMaintenanceScheduler();
    this.startPerformanceMonitoring();
  }

  /**
   * Initialize all available search strategies
   */
  private async initializeStrategies(): Promise<void> {
    try {
      // Initialize configuration manager and load configurations
      await this.initializeStrategyConfigurations();

      // Initialize filter templates first
      this.initializeFilterTemplates();

      // Initialize strategies with their configurations
      await this.initializeFTSStrategy();
      await this.initializeLikeStrategy();
      await this.initializeRecentStrategy();
      await this.initializeSemanticStrategy();
      await this.initializeCategoryFilterStrategy();
      await this.initializeTemporalFilterStrategy();
      await this.initializeMetadataFilterStrategy();
      await this.initializeRelationshipStrategy();

    } catch (error) {
      console.error('Failed to initialize search strategies:', error);
      // Fall back to basic initialization
      this.initializeStrategiesFallback();
    }
  }

  /**
   * Initialize filter templates during startup
   */
  private initializeFilterTemplates(): void {
    if (!this.advancedFilterEngine) {
      console.warn('AdvancedFilterEngine not available, skipping filter template initialization');
      return;
    }

    try {
      const templateManager = this.advancedFilterEngine.getTemplateManager();
      console.log('Initializing filter templates...');

      // Register common filter templates for frequent use cases
      this.registerCommonFilterTemplates(templateManager);
      this.registerAdvancedFilterTemplates(templateManager);
      this.registerPerformanceFilterTemplates(templateManager);

      const templateCount = templateManager.listAvailableTemplates().length;
      console.log(`Filter template initialization completed. Registered ${templateCount} templates.`);

    } catch (error) {
      console.error('Failed to initialize filter templates:', error);
      // Continue without templates - not critical for basic functionality
    }
  }

  /**
   * Register common filter templates for everyday use cases
   */
  private registerCommonFilterTemplates(templateManager: any): void {
    // Template for recent important memories
    templateManager.registerTemplate('recent_important', {
      name: 'recent_important',
      description: 'Recent memories with high importance score',
      filterExpression: 'importance_score >= 0.7 AND created_at > {days_ago}',
      parameters: [
        { name: 'days_ago', type: 'string', required: true }
      ]
    });

    // Template for category-specific recent memories
    templateManager.registerTemplate('category_recent', {
      name: 'category_recent',
      description: 'Recent memories in specific category',
      filterExpression: 'category = {category_name} AND created_at > {days_ago}',
      parameters: [
        { name: 'category_name', type: 'string', required: true },
        { name: 'days_ago', type: 'string', required: true }
      ]
    });

    // Template for high-confidence memories
    templateManager.registerTemplate('high_confidence', {
      name: 'high_confidence',
      description: 'Memories with high confidence scores',
      filterExpression: 'confidence >= {min_confidence}',
      parameters: [
        { name: 'min_confidence', type: 'number', required: true }
      ]
    });

    // Template for memories within date range
    templateManager.registerTemplate('date_range', {
      name: 'date_range',
      description: 'Memories within specific date range',
      filterExpression: 'created_at >= {start_date} AND created_at <= {end_date}',
      parameters: [
        { name: 'start_date', type: 'string', required: true },
        { name: 'end_date', type: 'string', required: true }
      ]
    });

    // Template for memories by type and category
    templateManager.registerTemplate('type_and_category', {
      name: 'type_and_category',
      description: 'Memories of specific type in specific category',
      filterExpression: 'memory_type = {memory_type} AND category = {category}',
      parameters: [
        { name: 'memory_type', type: 'string', required: true },
        { name: 'category', type: 'string', required: true }
      ]
    });
  }

  /**
   * Register advanced filter templates for complex scenarios
   */
  private registerAdvancedFilterTemplates(templateManager: any): void {
    // Template for memories with multiple categories
    templateManager.registerTemplate('multi_category', {
      name: 'multi_category',
      description: 'Memories matching multiple categories (OR logic)',
      filterExpression: 'category = {category1} OR category = {category2} OR category = {category3}',
      parameters: [
        { name: 'category1', type: 'string', required: true },
        { name: 'category2', type: 'string', required: true },
        { name: 'category3', type: 'string', required: false }
      ]
    });

    // Template for important recent memories with specific content
    templateManager.registerTemplate('important_content_recent', {
      name: 'important_content_recent',
      description: 'Important recent memories containing specific content',
      filterExpression: 'importance_score >= {min_importance} AND created_at > {days_ago} AND content ~ {content_pattern}',
      parameters: [
        { name: 'min_importance', type: 'number', required: true },
        { name: 'days_ago', type: 'string', required: true },
        { name: 'content_pattern', type: 'string', required: true }
      ]
    });

    // Template for memories with metadata filters
    templateManager.registerTemplate('metadata_complex', {
      name: 'metadata_complex',
      description: 'Complex filter using metadata fields',
      filterExpression: '(metadata.tags CONTAINS {tag1} OR metadata.tags CONTAINS {tag2}) AND metadata.source = {source}',
      parameters: [
        { name: 'tag1', type: 'string', required: true },
        { name: 'tag2', type: 'string', required: false },
        { name: 'source', type: 'string', required: true }
      ]
    });

    // Template for temporal pattern matching
    templateManager.registerTemplate('temporal_pattern', {
      name: 'temporal_pattern',
      description: 'Memories matching temporal patterns (e.g., recent activity spikes)',
      filterExpression: 'created_at > {reference_date} AND (category = {primary_category} OR importance_score >= {min_importance})',
      parameters: [
        { name: 'reference_date', type: 'string', required: true },
        { name: 'primary_category', type: 'string', required: true },
        { name: 'min_importance', type: 'number', required: false }
      ]
    });
  }

  /**
   * Register performance-optimized filter templates
   */
  private registerPerformanceFilterTemplates(templateManager: any): void {
    // Template for fast category lookup
    templateManager.registerTemplate('fast_category_lookup', {
      name: 'fast_category_lookup',
      description: 'Optimized category lookup with early termination',
      filterExpression: 'category = {category_name}',
      parameters: [
        { name: 'category_name', type: 'string', required: true }
      ],
      metadata: {
        performanceHints: ['early_termination', 'index_optimized'],
        estimatedCost: 1
      }
    });

    // Template for recent memories with limit
    templateManager.registerTemplate('recent_with_limit', {
      name: 'recent_with_limit',
      description: 'Recent memories with built-in result limiting for performance',
      filterExpression: 'created_at > {cutoff_date} ORDER BY created_at DESC LIMIT {max_results}',
      parameters: [
        { name: 'cutoff_date', type: 'string', required: true },
        { name: 'max_results', type: 'number', required: false }
      ],
      metadata: {
        performanceHints: ['result_limiting', 'order_optimization'],
        estimatedCost: 2
      }
    });

    // Template for batched processing
    templateManager.registerTemplate('batch_optimized', {
      name: 'batch_optimized',
      description: 'Filter optimized for batch processing scenarios',
      filterExpression: 'memory_type = {memory_type} AND created_at >= {batch_start_date}',
      parameters: [
        { name: 'memory_type', type: 'string', required: true },
        { name: 'batch_start_date', type: 'string', required: true }
      ],
      metadata: {
        performanceHints: ['batch_processing', 'parallel_execution'],
        estimatedCost: 3
      }
    });
  }

  /**
   * Initialize strategy configurations
   */
  private async initializeStrategyConfigurations(): Promise<void> {
    const strategyNames = Object.values(SearchStrategy);

    for (const strategyName of strategyNames) {
      try {
        // Try to load existing configuration
        let config = await this.configManager.loadConfiguration(strategyName);

        // If no configuration exists, use default
        if (!config) {
          config = this.configManager.getDefaultConfiguration(strategyName);
          // Save the default configuration for future use
          await this.configManager.saveConfiguration(strategyName, config);
        }

        // Cache the configuration for this strategy
        (this as any)[`${strategyName}_config`] = config;
      } catch (error) {
        console.warn(`Failed to load configuration for ${strategyName}, using defaults:`, error);
        // Use default configuration as fallback
        const config = this.configManager.getDefaultConfiguration(strategyName);
        (this as any)[`${strategyName}_config`] = config;
      }
    }
  }

  /**
   * Initialize FTS5 strategy with configuration
   */
  private async initializeFTSStrategy(): Promise<void> {
    const config = (this as any)[`${SearchStrategy.FTS5}_config`] as SearchStrategyConfiguration;

    if (config?.enabled) {
      const ftsStrategy = new SQLiteFTSStrategy(this.dbManager);

      // Apply FTS5-specific configuration
      if (config.strategySpecific) {
        const ftsConfig = config.strategySpecific as any;
        if (ftsConfig.bm25Weights) {
          // Update BM25 weights if configured
          (ftsStrategy as any).bm25Weights = { ... (ftsStrategy as any).bm25Weights, ...ftsConfig.bm25Weights };
        }
        if (ftsConfig.queryTimeout) {
          (ftsStrategy as any).queryTimeout = ftsConfig.queryTimeout;
        }
        if (ftsConfig.resultBatchSize) {
          (ftsStrategy as any).resultBatchSize = ftsConfig.resultBatchSize;
        }
      }

      this.strategies.set(SearchStrategy.FTS5, ftsStrategy);
    }
  }

  /**
   * Initialize LIKE strategy with configuration
   */
  private async initializeLikeStrategy(): Promise<void> {
    const config = (this as any)[`${SearchStrategy.LIKE}_config`] as SearchStrategyConfiguration;

    if (config?.enabled) {
      const likeStrategy = new LikeSearchStrategy(this.dbManager);

      // Apply LIKE-specific configuration
      if (config.strategySpecific) {
        const likeConfig = config.strategySpecific as any;

        // Update LIKE configuration
        if (likeConfig.wildcardSensitivity) {
          (likeStrategy as any).likeConfig.wildcardSensitivity = likeConfig.wildcardSensitivity;
        }
        if (likeConfig.maxWildcardTerms) {
          (likeStrategy as any).likeConfig.maxWildcardTerms = likeConfig.maxWildcardTerms;
        }
        if (likeConfig.enablePhraseSearch !== undefined) {
          (likeStrategy as any).likeConfig.enablePhraseSearch = likeConfig.enablePhraseSearch;
        }
        if (likeConfig.caseSensitive !== undefined) {
          (likeStrategy as any).likeConfig.caseSensitive = likeConfig.caseSensitive;
        }
        if (likeConfig.relevanceBoost) {
          (likeStrategy as any).likeConfig.relevanceBoost = { ... (likeStrategy as any).likeConfig.relevanceBoost, ...likeConfig.relevanceBoost };
        }
      }

      this.strategies.set(SearchStrategy.LIKE, likeStrategy);
    }
  }

  /**
   * Initialize Recent Memories strategy with configuration
   */
  private async initializeRecentStrategy(): Promise<void> {
    const config = (this as any)[`${SearchStrategy.RECENT}_config`] as SearchStrategyConfiguration;

    if (config?.enabled) {
      const strategyConfig = {
        enabled: config.enabled,
        priority: config.priority,
        timeout: config.timeout,
        maxResults: config.maxResults,
        minScore: config.scoring?.baseWeight || 0.1
      };

      const recentStrategy = new RecentMemoriesStrategy(strategyConfig, this.dbManager);

      // Apply strategy-specific configuration
      if (config.strategySpecific) {
        const recentConfig = config.strategySpecific as any;
        // Update time windows if configured
        if (recentConfig.timeWindows) {
          (recentStrategy as any).timeWindows = { ... (recentStrategy as any).timeWindows, ...recentConfig.timeWindows };
        }
        if (recentConfig.maxAge) {
          (recentStrategy as any).maxAge = recentConfig.maxAge;
        }
      }

      this.strategies.set(SearchStrategy.RECENT, recentStrategy);
    }
  }

  /**
   * Initialize Semantic strategy with configuration
   */
  private async initializeSemanticStrategy(): Promise<void> {
    const config = (this as any)[`${SearchStrategy.SEMANTIC}_config`] as SearchStrategyConfiguration;

    if (config?.enabled) {
      const semanticStrategy = new SemanticSearchStrategy();

      // Apply semantic-specific configuration
      if (config.strategySpecific) {
        // Store configuration for runtime use
        (semanticStrategy as any).config = config.strategySpecific;
      }

      this.strategies.set(SearchStrategy.SEMANTIC, semanticStrategy);
    }
  }

  /**
   * Initialize Category Filter strategy with configuration
   */
  private async initializeCategoryFilterStrategy(): Promise<void> {
    const config = (this as any)[`${SearchStrategy.CATEGORY_FILTER}_config`] as SearchStrategyConfiguration;

    if (config?.enabled) {
      const hierarchyConfig = config.strategySpecific?.hierarchy as any || {};
      const performanceConfig = config.strategySpecific?.performance as any || {};

      const categoryConfig = {
        hierarchy: {
          maxDepth: 5,
          enableCaching: true,
          ...hierarchyConfig,
        },
        performance: {
          enableQueryOptimization: true,
          enableResultCaching: true,
          maxExecutionTime: 10000,
          batchSize: 100,
          ...performanceConfig,
        },
      };

      const categoryStrategy = new CategoryFilterStrategy(categoryConfig, this.dbManager);
      this.strategies.set(SearchStrategy.CATEGORY_FILTER, categoryStrategy);
    }
  }

  /**
   * Initialize Temporal Filter strategy with configuration
   */
  private async initializeTemporalFilterStrategy(): Promise<void> {
    const config = (this as any)[`${SearchStrategy.TEMPORAL_FILTER}_config`] as SearchStrategyConfiguration;

    if (config?.enabled) {
      const naturalLanguageConfig = config.strategySpecific?.naturalLanguage as any || {};
      const temporalPerformanceConfig = config.strategySpecific?.performance as any || {};

      const temporalConfig = {
        naturalLanguage: {
          enableParsing: true,
          enablePatternMatching: true,
          confidenceThreshold: 0.3,
          ...naturalLanguageConfig,
        },
        performance: {
          enableQueryOptimization: true,
          enableResultCaching: true,
          maxExecutionTime: 10000,
          batchSize: 100,
          ...temporalPerformanceConfig,
        },
      };

      const temporalStrategy = new TemporalFilterStrategy(temporalConfig, this.dbManager);
      this.strategies.set(SearchStrategy.TEMPORAL_FILTER, temporalStrategy);
    }
  }

  /**
   * Initialize Metadata Filter strategy with configuration
   */
  private async initializeMetadataFilterStrategy(): Promise<void> {
    const config = (this as any)[`${SearchStrategy.METADATA_FILTER}_config`] as SearchStrategyConfiguration;

    if (config?.enabled) {
      const fieldsConfig = config.strategySpecific?.fields as any || {};
      const validationConfig = config.strategySpecific?.validation as any || {};
      const metadataPerformanceConfig = config.strategySpecific?.performance as any || {};

      const metadataConfig = {
        fields: {
          enableNestedAccess: true,
          maxDepth: 5,
          enableTypeValidation: true,
          enableFieldDiscovery: true,
          ...fieldsConfig,
        },
        validation: {
          strictValidation: false,
          enableCustomValidators: true,
          failOnInvalidMetadata: false,
          ...validationConfig,
        },
        performance: {
          enableQueryOptimization: true,
          enableResultCaching: true,
          maxExecutionTime: 10000,
          batchSize: 100,
          cacheSize: 100,
          ...metadataPerformanceConfig,
        },
      };

      const metadataStrategy = new MetadataFilterStrategy(metadataConfig, this.dbManager);
      this.strategies.set(SearchStrategy.METADATA_FILTER, metadataStrategy);
    }
  }

  /**
   * Initialize Relationship strategy with configuration
   */
  private async initializeRelationshipStrategy(): Promise<void> {
    const config = (this as any)[`${SearchStrategy.RELATIONSHIP}_config`] as SearchStrategyConfiguration;

    if (config?.enabled) {
      const relationshipStrategy = new RelationshipSearchStrategy(this.dbManager);

      // Apply relationship-specific configuration
      if (config.strategySpecific) {
        const relationshipConfig = config.strategySpecific as any;

        // Update relationship configuration
        if (relationshipConfig.maxDepth) {
          (relationshipStrategy as any).maxDepth = relationshipConfig.maxDepth;
        }
        if (relationshipConfig.minRelationshipStrength !== undefined) {
          (relationshipStrategy as any).minRelationshipStrength = relationshipConfig.minRelationshipStrength;
        }
        if (relationshipConfig.minRelationshipConfidence !== undefined) {
          (relationshipStrategy as any).minRelationshipConfidence = relationshipConfig.minRelationshipConfidence;
        }
        if (relationshipConfig.includeRelationshipPaths !== undefined) {
          (relationshipStrategy as any).includeRelationshipPaths = relationshipConfig.includeRelationshipPaths;
        }
        if (relationshipConfig.traversalStrategy) {
          (relationshipStrategy as any).traversalStrategy = relationshipConfig.traversalStrategy;
        }
      }

      this.strategies.set(SearchStrategy.RELATIONSHIP, relationshipStrategy);
    }
  }

  /**
   * Fallback strategy initialization (when configuration loading fails)
   */
  private initializeStrategiesFallback(): void {
    this.strategies.set(SearchStrategy.FTS5, new SQLiteFTSStrategy(this.dbManager));
    this.strategies.set(SearchStrategy.LIKE, new LikeSearchStrategy(this.dbManager));
    this.strategies.set(SearchStrategy.RECENT, new RecentMemoriesStrategy({
      enabled: true,
      priority: 3,
      timeout: 5000,
      maxResults: 100,
      minScore: 0.1
    }, this.dbManager));
    this.strategies.set(SearchStrategy.SEMANTIC, new SemanticSearchStrategy());

    // Add Category Filter Strategy
    this.strategies.set(SearchStrategy.CATEGORY_FILTER, new CategoryFilterStrategy({
      hierarchy: {
        maxDepth: 5,
        enableCaching: true,
      },
      performance: {
        enableQueryOptimization: true,
        enableResultCaching: true,
        maxExecutionTime: 10000,
        batchSize: 100,
      },
    }, this.dbManager));

    // Add Temporal Filter Strategy
    this.strategies.set(SearchStrategy.TEMPORAL_FILTER, new TemporalFilterStrategy({
      naturalLanguage: {
        enableParsing: true,
        enablePatternMatching: true,
        confidenceThreshold: 0.3,
      },
      performance: {
        enableQueryOptimization: true,
        enableResultCaching: true,
        maxExecutionTime: 10000,
        batchSize: 100,
      },
    }, this.dbManager));

    // Add Metadata Filter Strategy
    this.strategies.set(SearchStrategy.METADATA_FILTER, new MetadataFilterStrategy({
      fields: {
        enableNestedAccess: true,
        maxDepth: 5,
        enableTypeValidation: true,
        enableFieldDiscovery: true,
      },
      validation: {
        strictValidation: false,
        enableCustomValidators: true,
        failOnInvalidMetadata: false,
      },
      performance: {
        enableQueryOptimization: true,
        enableResultCaching: true,
        maxExecutionTime: 10000,
        batchSize: 100,
        cacheSize: 100
      },
    }, this.dbManager));

    // Add Relationship Search Strategy
    this.strategies.set(SearchStrategy.RELATIONSHIP, new RelationshipSearchStrategy(this.dbManager));
  }

  /**
    * Main search method that orchestrates multiple strategies
    */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    this.operationStartTime = Date.now();

    try {
      // Validate and sanitize input
      const validation = this.validateSearchInput(query);
      if (!validation.isValid) {
        throw new SearchValidationError(
          `Invalid search query: ${validation.errors.join(', ')}`,
          'searchQuery',
          query.text || '',
          'search_service',
          {
            strategy: 'search_service',
            operation: 'search_validation',
            query: query.text,
            parameters: { limit: query.limit, offset: query.offset },
            timestamp: new Date(),
          }
        );
      }
      const results: SearchResult[] = [];
      const seenIds = new Set<string>();

      // Determine strategy execution order based on query characteristics
      const strategyOrder = this.determineStrategyOrder(query);

      for (const strategyName of strategyOrder) {
        const strategy = this.strategies.get(strategyName);
        if (!strategy) continue;

        try {
          // Use circuit breaker protection for strategy execution
          const strategyResults = await this.executeWithCircuitBreaker(strategy, query);

          // Deduplicate results across strategies
          for (const result of strategyResults) {
            if (!seenIds.has(result.id)) {
              seenIds.add(result.id);
              results.push(result);
            }
          }

          // Stop if we have enough results
          if (results.length >= (query.limit || 10)) break;

        } catch (error) {
          // Enhanced error handling with comprehensive recovery
          const errorContext = this.createErrorContext('strategy_execution', strategy, query, {
            strategyOrder: strategyOrder.join(', '),
            currentResultCount: results.length,
          });

          // Track the error for analysis
          this.trackError(strategyName, error, errorContext);

          // Attempt strategy-specific recovery
          const shouldRetry = this.shouldRetryStrategy(strategyName, error);
          const shouldFallback = this.shouldFallbackToAlternative(strategyName, error);

          if (shouldRetry) {
            try {
              console.warn(`Attempting recovery for strategy ${strategyName} after error:`, error);
              const recoveryResults = await this.attemptStrategyRecovery(strategy, query, error);
              for (const result of recoveryResults) {
                if (!seenIds.has(result.id)) {
                  seenIds.add(result.id);
                  results.push(result);
                }
              }
            } catch (recoveryError) {
              console.warn(`Recovery failed for strategy ${strategyName}:`, recoveryError);
              if (shouldFallback) {
                await this.executeFallbackStrategy(strategyName, query, results, seenIds);
              }
            }
          } else if (shouldFallback) {
            await this.executeFallbackStrategy(strategyName, query, results, seenIds);
          } else {
            console.warn(`Strategy ${strategyName} failed and no retry/recovery available:`, error);
          }
          continue;
        }
      }

      // Apply advanced filtering with complete integration
      if (query.filterExpression && this.advancedFilterEngine) {
        try {
          const filteredResults = await this.applyAdvancedFilterWithPreAndPostFiltering(results, query.filterExpression, query);
          return this.rankAndSortResults(filteredResults, query);
        } catch (error) {
          console.warn('Advanced filter execution failed, falling back to regular results:', error);
          // Fall back to regular results if filtering fails
        }
      }

      // Track performance metrics
      const queryTime = Date.now() - this.operationStartTime;
      this.updatePerformanceMetrics(queryTime);

      return this.rankAndSortResults(results, query);

    } catch (error) {
      // Track performance metrics even for failed queries
      const queryTime = Date.now() - this.operationStartTime;
      this.updatePerformanceMetrics(queryTime);

      throw new SearchError(
        `Search operation failed: ${error instanceof Error ? error.message : String(error)}`,
        'search_service',
        {
          strategy: 'search_service',
          operation: 'orchestrated_search',
          query: query.text,
          parameters: { limit: query.limit, offset: query.offset },
          timestamp: new Date(),
        },
        error instanceof Error ? error : undefined,
        SearchErrorCategory.EXECUTION,
      );
    }
  }

  /**
   * Search with a specific strategy
   */
  async searchWithStrategy(query: SearchQuery, strategy: SearchStrategy): Promise<SearchResult[]> {
    this.operationStartTime = Date.now();

    const searchStrategy = this.strategies.get(strategy);
    if (!searchStrategy) {
      throw new StrategyNotFoundError(strategy);
    }

    try {
      // Use circuit breaker protection
      const results = await this.executeWithCircuitBreaker(searchStrategy, query);

      // Track performance metrics with enhanced monitoring
      const queryTime = Date.now() - this.operationStartTime;
      const primaryStrategy = results.length > 0 ? results[0].strategy as SearchStrategy : SearchStrategy.LIKE;
      const success = results.length > 0;
      const queryComplexity = this.calculateQueryComplexity(query);

      this.recordQueryMetrics(primaryStrategy, success, queryTime, queryComplexity);
      this.updatePerformanceMetrics(queryTime);

      return this.rankAndSortResults(results, query);
    } catch (error) {
      // Create comprehensive error context
      const errorContext = this.createErrorContext('search_with_strategy', searchStrategy, query);
      this.trackError(strategy, error, errorContext);

      // Attempt strategy-specific recovery
      try {
        const recoveryResults = await this.attemptStrategyRecovery(searchStrategy, query, error);
        return this.rankAndSortResults(recoveryResults, query);
      } catch (recoveryError) {
        // If recovery fails, throw the original error with enhanced context
        throw new SearchStrategyError(
          strategy,
          `Strategy ${strategy} failed: ${error instanceof Error ? error.message : String(error)}`,
          'search_with_strategy',
          {
            query: query.text,
            limit: query.limit,
            offset: query.offset,
            errorContext: errorContext,
            recoveryAttempted: true,
            recoveryFailed: true,
          },
          error instanceof Error ? error : undefined,
        );
      }
    }
  }

  /**
   * Get all available strategies
   */
  getAvailableStrategies(): SearchStrategy[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get a specific strategy by name
   */
  getStrategy(name: string): ISearchStrategy | null {
    const strategy = this.strategies.get(name as SearchStrategy);
    return strategy || null;
  }

  /**
    * Validate and sanitize search input parameters
    */
  private validateSearchInput(query: SearchQuery): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      // Validate and sanitize query text
      if (query.text) {
        if (typeof query.text !== 'string') {
          errors.push('Query text must be a string');
        } else {
          // Sanitize the query text
          const sanitizedQuery = sanitizeSearchQuery(query.text, {
            fieldName: 'query.text',
            allowWildcards: true,
            allowBoolean: false
          });

          // Additional security check for dangerous patterns
          const queryDangers = containsDangerousPatterns(sanitizedQuery);
          if (queryDangers.hasSQLInjection || queryDangers.hasXSS || queryDangers.hasCommandInjection) {
            errors.push('Query contains dangerous patterns');
          }

          // Update query with sanitized text
          query.text = sanitizedQuery;
        }
      }

      if (query.text && query.text.length > 1000) {
        errors.push('Query text is too long (max 1000 characters)');
      }

      // Validate limit
      if (query.limit !== undefined) {
        if (typeof query.limit !== 'number' || query.limit < 1) {
          errors.push('Limit must be a positive number');
        }

        if (query.limit > 1000) {
          errors.push('Limit is too large (max 1000)');
        }
      }

      // Validate offset
      if (query.offset !== undefined) {
        if (typeof query.offset !== 'number' || query.offset < 0) {
          errors.push('Offset must be a non-negative number');
        }

        if (query.offset > 10000) {
          errors.push('Offset is too large (max 10000)');
        }
      }

      // Validate and sanitize filter expression if present
      if (query.filterExpression) {
        if (typeof query.filterExpression !== 'string') {
          errors.push('Filter expression must be a string');
        } else {
          // Sanitize filter expression
          const sanitizedFilter = sanitizeString(query.filterExpression, {
            fieldName: 'query.filterExpression',
            maxLength: 2000,
            allowHtml: false,
            allowNewlines: true
          });

          // Additional security check
          const filterDangers = containsDangerousPatterns(sanitizedFilter);
          if (filterDangers.hasSQLInjection || filterDangers.hasXSS || filterDangers.hasCommandInjection) {
            errors.push('Filter expression contains dangerous patterns');
          }

          // Update query with sanitized filter
          query.filterExpression = sanitizedFilter;
        }
      }

      if (query.filterExpression && query.filterExpression.length > 2000) {
        errors.push('Filter expression is too long (max 2000 characters)');
      }

      // Validate and sanitize filters object if present
      if (query.filters) {
        if (typeof query.filters !== 'object') {
          errors.push('Filters must be an object');
        } else {
          // Validate specific filter fields
          if (query.filters.minImportance && !['low', 'medium', 'high', 'critical'].includes(query.filters.minImportance as string)) {
            errors.push('Invalid minimum importance level');
          }

          if (query.filters.categories && !Array.isArray(query.filters.categories)) {
            errors.push('Categories filter must be an array');
          } else if (query.filters.categories && Array.isArray(query.filters.categories)) {
            // Sanitize categories
            query.filters.categories = query.filters.categories.map((cat: string) =>
              sanitizeString(cat, {
                fieldName: 'query.filters.categories',
                maxLength: 100,
                allowNewlines: false
              })
            );
          }

          if (query.filters.metadataFilters && typeof query.filters.metadataFilters !== 'object') {
            errors.push('Metadata filters must be an object');
          } else if (query.filters.metadataFilters) {
            // Sanitize metadata filters
            try {
              query.filters.metadataFilters = sanitizeJsonInput(
                JSON.stringify(query.filters.metadataFilters),
                { fieldName: 'query.filters.metadataFilters', maxSize: 10000 }
              );
            } catch (error) {
              errors.push('Invalid metadata filters format');
            }
          }
        }
      }

      // Validate and sanitize sortBy if present
      if (query.sortBy) {
        if (typeof query.sortBy !== 'object' || !query.sortBy.field || !query.sortBy.direction) {
          errors.push('SortBy must have field and direction properties');
        } else {
          // Sanitize sort field
          query.sortBy.field = sanitizeString(query.sortBy.field, {
            fieldName: 'query.sortBy.field',
            maxLength: 100,
            allowNewlines: false
          });

          // Validate sort direction
          if (!['asc', 'desc', 'ASC', 'DESC'].includes(query.sortBy.direction)) {
            errors.push('Sort direction must be asc or desc');
          }
        }
      }

      return {
        isValid: errors.length === 0,
        errors
      };

    } catch (error) {
      if (error instanceof SanitizationError || error instanceof ValidationError) {
        return {
          isValid: false,
          errors: [error.message]
        };
      }

      return {
        isValid: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
    * Determine the order of strategy execution based on query characteristics
    */
  private determineStrategyOrder(query: SearchQuery): SearchStrategy[] {
    const strategies: SearchStrategy[] = [];

    // If query is empty, prioritize recent memories
    if (!query.text || query.text.trim() === '') {
      return [SearchStrategy.RECENT];
    }

    // Add FTS5 as primary strategy for keyword searches (only if FTS5 is available)
    const fts5Strategy = this.strategies.get(SearchStrategy.FTS5);
    if (fts5Strategy && fts5Strategy.canHandle(query)) {
      strategies.push(SearchStrategy.FTS5);
    }

    // Add category filter strategy for category-based queries
    const queryFilters = query.filters || {};
    if (queryFilters.categories || this.hasCategoryIndicators(query.text)) {
      strategies.splice(1, 0, SearchStrategy.CATEGORY_FILTER); // Insert after FTS5
    }

    // Add temporal filter strategy for temporal queries
    if (this.hasTemporalIndicators(query.text) || this.hasTemporalFilters(query)) {
      strategies.splice(2, 0, SearchStrategy.TEMPORAL_FILTER); // Insert after category filter
    }

    // Add metadata filter strategy for metadata-based queries
    const filters = query.filters || {};
    if (filters.metadataFilters || this.hasMetadataIndicators(query.text)) {
      strategies.splice(3, 0, SearchStrategy.METADATA_FILTER); // Insert after temporal filter
    }

    // Add semantic search for complex queries
    if (this.isComplexQuery(query.text)) {
      strategies.push(SearchStrategy.SEMANTIC);
    }

    // Add LIKE as fallback
    strategies.push(SearchStrategy.LIKE);

    return strategies;
  }

  /**
    * Execute a single strategy with error handling
    */
  private async executeStrategy(strategy: ISearchStrategy, query: SearchQuery): Promise<SearchResult[]> {
    const timeout = 5000; // 5 second timeout

    return Promise.race([
      strategy.execute(query, this.dbManager),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new SearchTimeoutError(
          strategy.name,
          timeout,
          'strategy_execution',
          { query: query.text, strategy: strategy.name }
        )), timeout);
      })
    ]);
  }

  /**
   * Rank and sort results based on relevance and query criteria
   */
  private rankAndSortResults(results: SearchResult[], query: SearchQuery): SearchResult[] {
    // Calculate composite scores for ranking
    results.forEach(result => {
      result.score = this.calculateCompositeScore(result, query);
    });

    // Sort by composite score
    results.sort((a, b) => b.score - a.score);

    // Apply limit
    const limit = query.limit || 10;
    return results.slice(0, limit);
  }

  /**
   * Calculate composite score for ranking results
   */
  private calculateCompositeScore(result: SearchResult, query: SearchQuery): number {
    let score = result.score;

    // Boost score based on strategy priority
    const strategy = this.strategies.get(result.strategy as SearchStrategy);
    if (strategy) {
      score *= (1 + strategy.priority / 100);
    }

    // Apply query-specific boosts
    if (query.text && result.content.toLowerCase().includes(query.text.toLowerCase())) {
      score *= 1.2; // Boost exact matches
    }

    return score;
  }

  /**
    * Determine if a query is complex and should use semantic search
    */
  private isComplexQuery(query: string): boolean {
    const words = query.split(/\s+/).length;
    return words > 3 || query.includes('because') || query.includes('therefore') || query.includes('however');
  }

  /**
   * Check if query text contains category indicators
   */
  private hasCategoryIndicators(query: string): boolean {
    if (!query) return false;

    const categoryKeywords = [
      'category', 'type', 'kind', 'sort', 'classification',
      'programming', 'database', 'framework', 'language',
      'personal', 'work', 'project', 'learning', 'education',
    ];

    const lowerQuery = query.toLowerCase();
    return categoryKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Check if query text contains temporal indicators
   */
  private hasTemporalIndicators(query: string): boolean {
    if (!query) return false;

    const temporalKeywords = [
      'time', 'date', 'when', 'before', 'after', 'during',
      'recent', 'old', 'new', 'latest', 'earliest',
      'today', 'yesterday', 'tomorrow', 'week', 'month', 'year',
      'hour', 'minute', 'second', 'ago', 'since', 'until'
    ];

    const lowerQuery = query.toLowerCase();
    return temporalKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Check if query has temporal filters
   */
  private hasTemporalFilters(query: SearchQuery): boolean {
    if (!query.filters) return false;

    const temporalFields = ['createdAfter', 'createdBefore', 'since', 'until', 'age', 'timeRange'];
    return temporalFields.some(field => field in query.filters!);
  }

  /**
   * Check if query text contains metadata indicators
   */
  private hasMetadataIndicators(query: string): boolean {
    if (!query) return false;

    const metadataKeywords = [
      'metadata', 'meta', 'field', 'property', 'key', 'value',
      'json_extract', 'json_type', 'json_valid'
    ];

    const lowerQuery = query.toLowerCase();
    return metadataKeywords.some(keyword => lowerQuery.includes(keyword));
  }

  /**
   * Apply advanced filter expression to search results with pre and post filtering
   */
  private async applyAdvancedFilterWithPreAndPostFiltering(results: SearchResult[], filterExpression: string, query: SearchQuery): Promise<SearchResult[]> {
    if (!this.advancedFilterEngine || !filterExpression.trim()) {
      return results;
    }

    try {
      // Step 1: Validate the filter expression before processing
      const validationResult = this.validateFilterExpression(filterExpression);
      if (!validationResult.isValid) {
        throw new SearchValidationError(
          `Invalid filter expression: ${validationResult.error}`,
          'filterExpression',
          filterExpression,
          'advanced_filter_engine',
          {
            strategy: 'search_service',
            operation: 'filter_validation',
            filterExpression,
            timestamp: new Date(),
          }
        );
      }

      // Step 2: Pre-filtering optimization - analyze filter for early termination opportunities
      const preFilterResult = await this.performPreFiltering(results, filterExpression, query);
      if (preFilterResult.earlyTermination) {
        console.log(`Pre-filtering terminated early with ${preFilterResult.filteredResults.length} results`);
        return preFilterResult.filteredResults;
      }

      // Step 3: Main filter execution with performance monitoring
      const startTime = Date.now();
      const filterNode = validationResult.filterNode!;

      // Use enhanced filter execution with metrics
      const executionResult = await this.advancedFilterEngine.executeFilterWithMetrics(
        filterNode,
        preFilterResult.filteredResults,
        {
          dataSource: 'search_results',
          performanceHints: {
            enableIndexing: true,
            useCaching: true,
            maxExecutionTime: 10000,
            preferDatabaseFiltering: false,
            batchSize: 100
          }
        }
      );

      const executionTime = Date.now() - startTime;
      console.log(`Filter execution completed in ${executionTime}ms, results: ${executionResult.filteredItems.length}/${preFilterResult.filteredResults.length}`);

      // Step 4: Post-filtering refinement - apply additional ranking and scoring
      const postFilteredResults = await this.performPostFiltering(
        executionResult.filteredItems as SearchResult[],
        filterExpression,
        query,
        executionResult.metrics
      );

      return postFilteredResults;

    } catch (error) {
      console.error('Failed to apply advanced filter with pre/post filtering:', error);

      // Enhanced error handling with detailed context
      const errorContext = {
        strategy: 'search_service',
        operation: 'advanced_filter_with_pre_post',
        filterExpression,
        originalResultCount: results.length,
        query: query.text,
        timestamp: new Date(),
        executionTime: Date.now() - (this.operationStartTime || Date.now()),
      };

      if (error instanceof SearchValidationError) {
        throw error; // Re-throw validation errors as-is
      }

      throw new SearchError(
        `Advanced filter execution failed: ${error instanceof Error ? error.message : String(error)}`,
        'advanced_filter_engine',
        errorContext,
        error instanceof Error ? error : undefined,
        SearchErrorCategory.EXECUTION,
      );
    }
  }

  /**
   * Validate filter expression with enhanced error reporting
   */
  private validateFilterExpression(expression: string): { isValid: boolean; filterNode?: any; error?: string } {
    if (!this.advancedFilterEngine) {
      return { isValid: false, error: 'AdvancedFilterEngine not initialized' };
    }

    try {
      // First try basic parsing
      const filterNode = this.advancedFilterEngine.parseFilter(expression);

      // Then validate with advanced rules
      const validationResult = this.advancedFilterEngine.validateComplexExpression(expression);

      if (!validationResult.isValid) {
        return {
          isValid: false,
          error: validationResult.errors.map(e => `${e.code}: ${e.message}`).join(', ')
        };
      }

      return { isValid: true, filterNode };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  /**
   * Perform pre-filtering optimization to reduce the dataset before main filtering
   */
  private async performPreFiltering(results: SearchResult[], filterExpression: string, query: SearchQuery): Promise<{
    filteredResults: SearchResult[];
    earlyTermination: boolean;
    optimizationsApplied: string[];
  }> {
    const optimizations: string[] = [];
    let filteredResults = [...results];
    let earlyTermination = false;

    try {
      // Analyze filter expression for optimization opportunities
      if (this.canApplyEarlyTermination(filterExpression)) {
        // Apply simple field-based pre-filtering for common cases
        filteredResults = this.applyFieldBasedPreFiltering(filteredResults, filterExpression);
        optimizations.push('field_based_pre_filtering');

        // Check if we can terminate early based on result count and filter selectivity
        if (filteredResults.length === 0) {
          earlyTermination = true;
          optimizations.push('early_termination_empty_results');
        } else if (this.shouldTerminateEarly(filteredResults, filterExpression)) {
          earlyTermination = true;
          optimizations.push('early_termination_selectivity');
        }
      }

      // Apply index-based filtering if available
      if (this.searchIndexManager) {
        try {
          const indexFiltered = await this.applyIndexBasedPreFiltering(filteredResults, filterExpression);
          if (indexFiltered.length < filteredResults.length) {
            filteredResults = indexFiltered;
            optimizations.push('index_based_pre_filtering');
          }
        } catch (error) {
          console.warn('Index-based pre-filtering failed:', error);
        }
      }

    } catch (error) {
      console.warn('Pre-filtering optimization failed, continuing with full dataset:', error);
      optimizations.push('pre_filtering_failed');
    }

    return {
      filteredResults,
      earlyTermination,
      optimizationsApplied: optimizations,
    };
  }

  /**
   * Perform post-filtering refinement to improve result quality
   */
  private async performPostFiltering(
    results: SearchResult[],
    filterExpression: string,
    query: SearchQuery,
    metrics?: any
  ): Promise<SearchResult[]> {
    let refinedResults = [...results];

    try {
      // Apply filter-specific post-processing
      refinedResults = this.applyFilterSpecificPostProcessing(refinedResults, filterExpression);

      // Apply result ranking based on filter complexity
      refinedResults = this.applyFilterBasedRanking(refinedResults, filterExpression, query);

      // Apply performance-based adjustments
      if (metrics && metrics.executionTime > 1000) {
        console.warn(`Filter execution was slow (${metrics.executionTime}ms), applying performance optimizations`);
        refinedResults = this.applyPerformanceOptimizations(refinedResults, metrics);
      }

    } catch (error) {
      console.warn('Post-filtering refinement failed, returning original results:', error);
    }

    return refinedResults;
  }

  /**
   * Apply field-based pre-filtering for simple filter expressions
   */
  private applyFieldBasedPreFiltering(results: SearchResult[], filterExpression: string): SearchResult[] {
    // Extract simple field filters like "category = 'important'" or "importance_score > 0.7"
    const simpleFilters = this.extractSimpleFilters(filterExpression);

    if (simpleFilters.length === 0) {
      return results;
    }

    return results.filter(result => {
      return simpleFilters.every(filter => {
        return this.evaluateSimpleFilter(result, filter);
      });
    });
  }

  /**
   * Apply index-based pre-filtering using search indexes
   */
  private async applyIndexBasedPreFiltering(results: SearchResult[], filterExpression: string): Promise<SearchResult[]> {
    if (!this.searchIndexManager) {
      return results;
    }

    // Extract indexable filters
    const indexableFilters = this.extractIndexableFilters(filterExpression);

    if (indexableFilters.length === 0) {
      return results;
    }

    // For each indexable filter, try to get pre-filtered results
    const indexResults = await Promise.all(
      indexableFilters.map(async (filter: { field: string; operator: string; value: any }) => {
        try {
          // Use a simple approach to simulate index-based filtering
          // In a real implementation, this would query a search index
          const filteredIds = await this.performSimpleIndexQuery(filter);
          return filteredIds;
        } catch (error) {
          console.warn('Index query failed for filter:', filter, error);
          return null;
        }
      })
    );

    // Combine results from all index queries
    const validIndexResults = indexResults.filter((result: string[] | null) => result !== null).flat() as string[];
    if (validIndexResults.length === 0) {
      return results;
    }

    // Filter original results to only include those found in index results
    const indexIdSet = new Set(validIndexResults);
    return results.filter(result => indexIdSet.has(result.id));
  }

  /**
   * Apply filter-specific post-processing to improve result quality
   */
  private applyFilterSpecificPostProcessing(results: SearchResult[], filterExpression: string): SearchResult[] {
    // Apply filter-specific optimizations based on the type of filter
    let processedResults = [...results];

    // Boost scores for results that match multiple filter criteria
    if (this.isMultiCriteriaFilter(filterExpression)) {
      processedResults = this.boostMultiCriteriaResults(processedResults, filterExpression);
    }

    // Apply temporal relevance adjustments
    if (this.containsTemporalFilters(filterExpression)) {
      processedResults = this.adjustTemporalRelevance(processedResults, filterExpression);
    }

    return processedResults;
  }

  /**
   * Apply filter-based ranking to improve result ordering
   */
  private applyFilterBasedRanking(results: SearchResult[], filterExpression: string, query: SearchQuery): SearchResult[] {
    // Calculate filter-specific ranking scores
    const rankedResults = results.map(result => {
      const filterScore = this.calculateFilterScore(result, filterExpression, query);
      return {
        ...result,
        score: (result.score * 0.7) + (filterScore * 0.3), // Weighted combination
      };
    });

    // Sort by enhanced score
    rankedResults.sort((a, b) => b.score - a.score);

    return rankedResults;
  }

  /**
   * Apply performance optimizations based on execution metrics
   */
  private applyPerformanceOptimizations(results: SearchResult[], metrics: any): SearchResult[] {
    // If execution was slow, limit results and apply aggressive filtering
    if (results.length > 50) {
      console.log(`Performance optimization: reducing results from ${results.length} to 50`);
      return results.slice(0, 50);
    }

    return results;
  }

  /**
   * Extract simple field-based filters for pre-filtering
   */
  private extractSimpleFilters(filterExpression: string): Array<{ field: string; operator: string; value: any }> {
    const simpleFilters: Array<{ field: string; operator: string; value: any }> = [];

    // Match patterns like "field = 'value'", "field > 0.5", etc.
    const simplePattern = /(\w+)\s*([<>=!~]+)\s*['"]?([^'"&\s]+)['"]?/g;
    let match;

    while ((match = simplePattern.exec(filterExpression)) !== null) {
      const [, field, operator, value] = match;
      simpleFilters.push({
        field: field.trim(),
        operator: operator.trim(),
        value: value.trim().replace(/['"]/g, ''), // Remove quotes
      });
    }

    return simpleFilters;
  }

  /**
   * Evaluate a simple filter against a search result
   */
  private evaluateSimpleFilter(result: SearchResult, filter: { field: string; operator: string; value: any }): boolean {
    const { field, operator, value } = filter;

    // Get the field value from result metadata
    const fieldValue = this.getFieldValue(result, field);

    if (fieldValue === undefined || fieldValue === null) {
      return operator === '!='; // Field not present matches "not equals" operations
    }

    // Handle different operators
    switch (operator) {
      case '=':
        return fieldValue == value; // eslint-disable-line eqeqeq
      case '!=':
        return fieldValue != value; // eslint-disable-line eqeqeq
      case '>':
        return Number(fieldValue) > Number(value);
      case '<':
        return Number(fieldValue) < Number(value);
      case '>=':
        return Number(fieldValue) >= Number(value);
      case '<=':
        return Number(fieldValue) <= Number(value);
      case '~':
        return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
      default:
        return false;
    }
  }

  /**
   * Get field value from search result metadata
   */
  private getFieldValue(result: SearchResult, field: string): any {
    // Handle nested field access like "metadata.category"
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: any = result;

      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }

      return value;
    }

    // Direct field access
    return result.metadata?.[field] || result[field as keyof SearchResult];
  }

  /**
   * Extract filters that can be optimized using indexes
   */
  private extractIndexableFilters(_filterExpression: string): Array<{ field: string; operator: string; value: any }> {
    // For now, return empty array - would need specific index manager integration
    return [];
  }

  /**
   * Perform simple index query simulation
   */
  private async performSimpleIndexQuery(_filter: { field: string; operator: string; value: any }): Promise<string[]> {
    // This is a placeholder implementation
    // In a real implementation, this would query a search index
    return [];
  }

  /**
   * Check if filter supports early termination
   */
  private canApplyEarlyTermination(filterExpression: string): boolean {
    // Simple heuristic: check if expression contains highly selective operators
    const selectiveOperators = ['=', '>', '<', '>=', '<='];
    return selectiveOperators.some(op => filterExpression.includes(op));
  }

  /**
   * Determine if early termination should be applied
   */
  private shouldTerminateEarly(results: SearchResult[], filterExpression: string): boolean {
    // Terminate early if we have very few results and the filter is highly selective
    const hasEqualityFilter = filterExpression.includes('=');
    const hasRangeFilter = /[<>=]/.test(filterExpression);

    if (results.length <= 10 && (hasEqualityFilter || hasRangeFilter)) {
      return true;
    }

    return false;
  }

  /**
   * Check if filter contains multiple criteria
   */
  private isMultiCriteriaFilter(filterExpression: string): boolean {
    const andCount = (filterExpression.match(/\bAND\b/gi) || []).length;
    const orCount = (filterExpression.match(/\bOR\b/gi) || []).length;
    return andCount > 0 || orCount > 1;
  }

  /**
   * Boost scores for results matching multiple filter criteria
   */
  private boostMultiCriteriaResults(results: SearchResult[], filterExpression: string): SearchResult[] {
    const criteriaCount = (filterExpression.match(/\b(AND|OR)\b/gi) || []).length + 1;

    return results.map(result => ({
      ...result,
      score: result.score * (1 + (criteriaCount * 0.1)), // Boost by 10% per criteria
    }));
  }

  /**
   * Check if filter contains temporal components
   */
  private containsTemporalFilters(filterExpression: string): boolean {
    const temporalKeywords = ['created_at', 'updated_at', 'timestamp', 'date', 'time'];
    return temporalKeywords.some(keyword => filterExpression.toLowerCase().includes(keyword));
  }

  /**
   * Adjust temporal relevance based on filter criteria
   */
  private adjustTemporalRelevance(results: SearchResult[], filterExpression: string): SearchResult[] {
    // Boost newer results if filter contains recent time constraints
    const hasRecentFilter = /\b(created_at|timestamp)\s*>\s*['"]?[^'"&\s]+['"]?/i.test(filterExpression);

    if (hasRecentFilter) {
      return results.map(result => ({
        ...result,
        score: result.score * 1.1, // Boost recent results
      }));
    }

    return results;
  }

  /**
   * Calculate filter-specific score for ranking
   */
  private calculateFilterScore(result: SearchResult, filterExpression: string, query: SearchQuery): number {
    let score = 0;

    // Base score from filter matches
    const simpleFilters = this.extractSimpleFilters(filterExpression);
    const matchingFilters = simpleFilters.filter(filter => this.evaluateSimpleFilter(result, filter));
    score += matchingFilters.length * 0.1;

    // Boost for exact matches on primary fields
    if (matchingFilters.some(f => f.field === 'category' && f.operator === '=')) {
      score += 0.2;
    }

    // Boost for importance score matches
    if (matchingFilters.some(f => f.field === 'importance_score' && f.operator === '>=')) {
      score += 0.15;
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }

  /**
   * Determine if a strategy should be retried after failure
   */
  private shouldRetryStrategy(strategyName: SearchStrategy, error: unknown): boolean {
    // Retry on transient errors for certain strategies
    const retryableStrategies = [SearchStrategy.FTS5, SearchStrategy.LIKE];
    if (!retryableStrategies.includes(strategyName)) {
      return false;
    }

    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Retry on database busy/locked errors
    if (errorMessage.includes('database locked') || errorMessage.includes('busy') || errorMessage.includes('timeout')) {
      return true;
    }

    // Retry on network-related errors (if applicable)
    if (errorMessage.includes('network') || errorMessage.includes('connection')) {
      return true;
    }

    return false;
  }

  /**
   * Determine if fallback strategy should be used
   */
  private shouldFallbackToAlternative(strategyName: SearchStrategy, error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Always fallback for critical errors
    if (errorMessage.includes('no such table') || errorMessage.includes('database not found')) {
      return true;
    }

    // Fallback for configuration errors
    if (errorMessage.includes('configuration') || errorMessage.includes('invalid config')) {
      return true;
    }

    // Don't fallback for validation errors (user input issues)
    if (errorMessage.includes('validation') || errorMessage.includes('invalid query')) {
      return false;
    }

    return true; // Default to fallback for most cases
  }

  /**
   * Execute strategy with retry logic
   */
  private async executeStrategyWithRetry(strategy: ISearchStrategy, query: SearchQuery, maxRetries: number): Promise<SearchResult[]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.executeStrategy(strategy, query);
      } catch (error) {
        lastError = error;

        // Don't retry on the last attempt
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff delay
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError;
  }

  /**
   * Execute fallback strategy when primary strategy fails
   */
  private async executeFallbackStrategy(failedStrategy: SearchStrategy, query: SearchQuery, results: SearchResult[], seenIds: Set<string>): Promise<void> {
    // Determine appropriate fallback strategy
    let fallbackStrategy: SearchStrategy;

    switch (failedStrategy) {
      case SearchStrategy.FTS5:
        fallbackStrategy = SearchStrategy.LIKE;
        break;
      case SearchStrategy.LIKE:
        fallbackStrategy = SearchStrategy.RECENT;
        break;
      default:
        fallbackStrategy = SearchStrategy.RECENT;
        break;
    }

    const fallbackStrategyInstance = this.strategies.get(fallbackStrategy);
    if (!fallbackStrategyInstance) {
      console.warn(`No fallback strategy available for ${failedStrategy}`);
      return;
    }

    try {
      console.log(`Executing fallback strategy ${fallbackStrategy} for failed strategy ${failedStrategy}`);
      const fallbackResults = await this.executeStrategy(fallbackStrategyInstance, query);

      // Add fallback results that haven't been seen before
      for (const result of fallbackResults) {
        if (!seenIds.has(result.id)) {
          seenIds.add(result.id);
          results.push(result);
        }
      }
    } catch (fallbackError) {
      console.warn(`Fallback strategy ${fallbackStrategy} also failed:`, fallbackError);
    }
  }

  /**
    * Get index health report
    */
  public async getIndexHealthReport(): Promise<IndexHealthReport> {
    return await this.searchIndexManager.getIndexHealthReport();
  }

  /**
   * Check if index health is acceptable for search operations
   */
  public async isIndexHealthy(): Promise<boolean> {
    try {
      const report = await this.getIndexHealthReport();
      return report.health !== IndexHealth.CORRUPTED && report.health !== IndexHealth.CRITICAL;
    } catch (error) {
      logError('Failed to check index health', {
        component: 'SearchService',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Perform index optimization
   */
  public async optimizeIndex(): Promise<import('./SearchIndexManager').OptimizationResult> {
    return await this.searchIndexManager.optimizeIndex();
  }

  /**
   * Create index backup
   */
  public async createIndexBackup(): Promise<import('./SearchIndexManager').BackupMetadata> {
    return await this.searchIndexManager.createBackup();
  }

  /**
   * Restore index from backup
   */
  public async restoreIndexFromBackup(backupId: string): Promise<boolean> {
    return await this.searchIndexManager.restoreFromBackup(backupId);
  }

  /**
   * Start maintenance scheduler for periodic health checks and optimization
   */
  private startMaintenanceScheduler(): void {
    try {
      // Run health check every hour
      this.maintenanceTimer = setInterval(async () => {
        await this.performMaintenanceCheck();
      }, 60 * 60 * 1000);

      console.log('SearchService maintenance scheduler started');
    } catch (error) {
      console.error('Failed to start maintenance scheduler:', error);
    }
  }

  /**
   * Perform comprehensive maintenance check
   */
  private async performMaintenanceCheck(): Promise<void> {
    try {
      this.performanceMetrics.maintenanceCheckCount++;
      this.performanceMetrics.lastMaintenanceCheck = new Date();

      const healthReport = await this.searchIndexManager.getIndexHealthReport();

      console.log('Maintenance check completed:', {
        health: healthReport.health,
        issues: healthReport.issues.length,
        recommendations: healthReport.recommendations.length,
        checkCount: this.performanceMetrics.maintenanceCheckCount,
      });

      // Handle different health states
      if (healthReport.health === IndexHealth.DEGRADED) {
        console.warn('Search index health is degraded, scheduling optimization');
        await this.handleDegradedHealth(healthReport);
      }

      if (healthReport.health === IndexHealth.CORRUPTED) {
        console.error('Search index is corrupted, attempting recovery');
        await this.handleCorruptedIndex(healthReport);
      }

      if (healthReport.health === IndexHealth.CRITICAL) {
        console.error('Search index health is critical, emergency optimization required');
        await this.handleCriticalHealth(healthReport);
      }

    } catch (error) {
      console.error('Maintenance check failed:', error);
      logError('SearchService maintenance check failed', {
        component: 'SearchService',
        error: error instanceof Error ? error.message : String(error),
        checkCount: this.performanceMetrics.maintenanceCheckCount,
      });
    }
  }

  /**
   * Handle degraded index health
   */
  private async handleDegradedHealth(healthReport: IndexHealthReport): Promise<void> {
    try {
      // Schedule optimization for degraded indexes
      if (healthReport.issues.some(issue => issue.includes('fragmentation') || issue.includes('performance'))) {
        console.log('Scheduling optimization for degraded index');
        // Don't await this - let it run in background
        this.searchIndexManager.optimizeIndex(OptimizationType.MERGE).catch(error => {
          console.error('Background optimization failed:', error);
        });
      }
    } catch (error) {
      console.error('Failed to handle degraded health:', error);
    }
  }

  /**
   * Handle corrupted index
   */
  private async handleCorruptedIndex(healthReport: IndexHealthReport): Promise<void> {
    try {
      console.error('Attempting to repair corrupted index');
      await this.searchIndexManager.repairIndex();
      console.log('Index corruption repair completed');
    } catch (error) {
      console.error('Failed to repair corrupted index:', error);
      // Could implement additional recovery strategies here
    }
  }

  /**
   * Handle critical index health
   */
  private async handleCriticalHealth(healthReport: IndexHealthReport): Promise<void> {
    try {
      console.error('Critical health detected, performing emergency optimization');
      await this.searchIndexManager.optimizeIndex(OptimizationType.REBUILD);
      console.log('Emergency optimization completed');
    } catch (error) {
      console.error('Emergency optimization failed:', error);
    }
  }

  /**
   * Update performance metrics with comprehensive tracking
   */
  private updatePerformanceMetrics(queryTime: number): void {
    this.performanceMetrics.totalQueries++;
    this.performanceMetrics.averageQueryTime = queryTime;

    // Calculate running average for response time
    const currentAvg = this.performanceMetrics.averageResponseTime;
    const totalTime = currentAvg * (this.performanceMetrics.totalQueries - 1) + queryTime;
    this.performanceMetrics.averageResponseTime = totalTime / this.performanceMetrics.totalQueries;
  }

  // ===== COMPREHENSIVE PERFORMANCE MONITORING SYSTEM =====

  /**
   * Start the performance monitoring system
   */
  private startPerformanceMonitoring(): void {
    if (!this.performanceMonitoringConfig.enabled) {
      return;
    }

    // Start periodic performance data collection
    this.performanceCollectionTimer = setInterval(() => {
      this.collectPerformanceSnapshot();
      this.analyzePerformanceTrends();
      this.checkPerformanceAlerts();
    }, this.performanceMonitoringConfig.collectionInterval);

    console.log('Performance monitoring system started');
  }

  /**
   * Collect current performance snapshot
   */
  private collectPerformanceSnapshot(): void {
    const now = Date.now();
    const currentMemory = process.memoryUsage();

    // Add trend data point
    const trendData: PerformanceTrend = {
      timestamp: now,
      responseTime: this.performanceMetrics.averageResponseTime,
      memoryUsage: currentMemory.heapUsed,
      queryCount: this.performanceMetrics.totalQueries,
      errorRate: this.performanceMetrics.totalQueries > 0 ?
        this.performanceMetrics.failedQueries / this.performanceMetrics.totalQueries : 0,
      strategy: SearchStrategy.FTS5, // Default strategy for trend tracking
    };

    this.performanceMetrics.performanceTrends.push(trendData);

    // Update current memory usage
    this.performanceMetrics.memoryUsage = currentMemory.heapUsed;
    if (currentMemory.heapUsed > this.performanceMetrics.peakMemoryUsage) {
      this.performanceMetrics.peakMemoryUsage = currentMemory.heapUsed;
    }

    // Clean old trend data based on retention period
    const retentionCutoff = now - this.performanceMonitoringConfig.retentionPeriod;
    this.performanceMetrics.performanceTrends = this.performanceMetrics.performanceTrends.filter(
      trend => trend.timestamp > retentionCutoff
    );
  }

  /**
   * Record query metrics with detailed tracking
   */
  private recordQueryMetrics(strategy: SearchStrategy, success: boolean, responseTime: number, queryComplexity: number): void {
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

    // Track query complexity
    const complexityKey = queryComplexity.toString();
    const currentComplexity = this.performanceMetrics.queryComplexity.get(complexityKey) || 0;
    this.performanceMetrics.queryComplexity.set(complexityKey, currentComplexity + 1);

    // Update memory usage
    const currentMemory = process.memoryUsage();
    this.performanceMetrics.memoryUsage = currentMemory.heapUsed;
    if (currentMemory.heapUsed > this.performanceMetrics.peakMemoryUsage) {
      this.performanceMetrics.peakMemoryUsage = currentMemory.heapUsed;
    }
  }

  /**
   * Get comprehensive performance report
   */
  public getPerformanceReport(): PerformanceReport {
    return {
      ...this.performanceMetrics,
      successRate: this.performanceMetrics.totalQueries > 0 ?
        this.performanceMetrics.successfulQueries / this.performanceMetrics.totalQueries : 0,
      strategyUsagePercentages: this.calculateStrategyUsagePercentages(),
      topErrors: this.getTopErrors(),
      performanceTrends: this.performanceMetrics.performanceTrends,
      optimizationRecommendations: this.generateOptimizationRecommendations(),
      timestamp: new Date()
    };
  }

  /**
   * Calculate strategy usage percentages
   */
  private calculateStrategyUsagePercentages(): Record<SearchStrategy, number> {
    const percentages: Record<string, number> = {};
    const total = this.performanceMetrics.totalQueries;

    for (const [strategy, count] of this.performanceMetrics.strategyUsage) {
      percentages[strategy] = total > 0 ? (count / total) * 100 : 0;
    }

    return percentages as Record<SearchStrategy, number>;
  }

  /**
   * Get top errors for analysis
   */
  private getTopErrors(): Array<{ error: string; count: number }> {
    return Array.from(this.performanceMetrics.errorCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));
  }

  /**
   * Analyze performance trends and generate insights
   */
  private analyzePerformanceTrends(): void {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    const oneDayAgo = now - (24 * 60 * 60 * 1000);

    const recentTrends = this.performanceMetrics.performanceTrends.filter(
      trend => trend.timestamp > oneHourAgo
    );

    const dailyTrends = this.performanceMetrics.performanceTrends.filter(
      trend => trend.timestamp > oneDayAgo
    );

    // Analyze trends and generate insights
    const hourlyAverage = this.calculateAverageResponseTime(recentTrends);
    const dailyAverage = this.calculateAverageResponseTime(dailyTrends);

    if (hourlyAverage > dailyAverage * 1.5) {
      // Performance degradation detected
      this.generatePerformanceAlert('response_time', hourlyAverage, dailyAverage);
    }

    // Check error rate trends
    const hourlyErrorRate = this.calculateAverageErrorRate(recentTrends);
    const dailyErrorRate = this.calculateAverageErrorRate(dailyTrends);

    if (hourlyErrorRate > dailyErrorRate * 2) {
      this.generatePerformanceAlert('error_rate', hourlyErrorRate, dailyErrorRate);
    }
  }

  /**
   * Calculate average response time from trends
   */
  private calculateAverageResponseTime(trends: PerformanceTrend[]): number {
    if (trends.length === 0) return 0;
    return trends.reduce((sum, trend) => sum + trend.responseTime, 0) / trends.length;
  }

  /**
   * Calculate average error rate from trends
   */
  private calculateAverageErrorRate(trends: PerformanceTrend[]): number {
    if (trends.length === 0) return 0;
    return trends.reduce((sum, trend) => sum + trend.errorRate, 0) / trends.length;
  }

  /**
   * Check for performance alerts based on thresholds
   */
  private checkPerformanceAlerts(): void {
    const currentMemory = process.memoryUsage();
    const currentErrorRate = this.performanceMetrics.totalQueries > 0 ?
      this.performanceMetrics.failedQueries / this.performanceMetrics.totalQueries : 0;

    // Check response time threshold
    if (this.performanceMetrics.averageResponseTime > this.performanceMonitoringConfig.alertThresholds.maxResponseTime) {
      this.generatePerformanceAlert(
        'response_time',
        this.performanceMetrics.averageResponseTime,
        this.performanceMonitoringConfig.alertThresholds.maxResponseTime
      );
    }

    // Check error rate threshold
    if (currentErrorRate > this.performanceMonitoringConfig.alertThresholds.maxErrorRate) {
      this.generatePerformanceAlert(
        'error_rate',
        currentErrorRate,
        this.performanceMonitoringConfig.alertThresholds.maxErrorRate
      );
    }

    // Check memory usage threshold
    if (currentMemory.heapUsed > this.performanceMonitoringConfig.alertThresholds.maxMemoryUsage) {
      this.generatePerformanceAlert(
        'memory_usage',
        currentMemory.heapUsed,
        this.performanceMonitoringConfig.alertThresholds.maxMemoryUsage
      );
    }
  }

  /**
   * Generate performance alert
   */
  private generatePerformanceAlert(type: PerformanceAlert['type'], currentValue: number, threshold: number): void {
    const alert: PerformanceAlert = {
      type,
      severity: this.calculateAlertSeverity(type, currentValue, threshold),
      message: this.generateAlertMessage(type, currentValue, threshold),
      timestamp: new Date(),
      metrics: {
        currentValue,
        threshold,
        trend: this.calculateTrendDirection(type),
      },
      recommendations: this.generateAlertRecommendations(type, currentValue, threshold),
    };

    // Trigger alert callbacks
    this.performanceAlertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Performance alert callback failed:', error);
      }
    });

    console.warn('Performance Alert:', alert);
  }

  /**
   * Calculate alert severity
   */
  private calculateAlertSeverity(type: PerformanceAlert['type'], currentValue: number, threshold: number): PerformanceAlert['severity'] {
    const ratio = currentValue / threshold;

    if (ratio > 3) return 'critical';
    if (ratio > 2) return 'high';
    if (ratio > 1.5) return 'medium';
    return 'low';
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(type: PerformanceAlert['type'], currentValue: number, threshold: number): string {
    const ratio = (currentValue / threshold * 100).toFixed(1);

    switch (type) {
      case 'response_time':
        return `Response time (${currentValue}ms) exceeds threshold (${threshold}ms) by ${ratio}%`;
      case 'error_rate':
        return `Error rate (${(currentValue * 100).toFixed(1)}%) exceeds threshold (${(threshold * 100).toFixed(1)}%) by ${ratio}%`;
      case 'memory_usage':
        return `Memory usage (${(currentValue / 1024 / 1024).toFixed(1)}MB) exceeds threshold (${(threshold / 1024 / 1024).toFixed(1)}MB) by ${ratio}%`;
      case 'system_health':
        return `System health degraded - performance metrics indicate issues`;
      default:
        return `${type} threshold exceeded`;
    }
  }

  /**
   * Calculate trend direction for metrics
   */
  private calculateTrendDirection(type: PerformanceAlert['type']): 'increasing' | 'decreasing' | 'stable' {
    const recentTrends = this.performanceMetrics.performanceTrends.slice(-10); // Last 10 data points

    if (recentTrends.length < 2) return 'stable';

    let values: number[] = [];
    switch (type) {
      case 'response_time':
        values = recentTrends.map(t => t.responseTime);
        break;
      case 'error_rate':
        values = recentTrends.map(t => t.errorRate);
        break;
      case 'memory_usage':
        values = recentTrends.map(t => t.memoryUsage);
        break;
      default:
        return 'stable';
    }

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const change = (secondAvg - firstAvg) / firstAvg;

    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Generate recommendations for performance alerts
   */
  private generateAlertRecommendations(type: PerformanceAlert['type'], currentValue: number, threshold: number): string[] {
    const recommendations: string[] = [];

    switch (type) {
      case 'response_time':
        recommendations.push('Consider optimizing database queries');
        recommendations.push('Check system resource utilization');
        recommendations.push('Review search strategy configurations');
        break;
      case 'error_rate':
        recommendations.push('Investigate recent error patterns');
        recommendations.push('Check system logs for error details');
        recommendations.push('Consider disabling problematic search strategies');
        break;
      case 'memory_usage':
        recommendations.push('Monitor for memory leaks');
        recommendations.push('Consider increasing system memory');
        recommendations.push('Review caching strategies');
        break;
      case 'system_health':
        recommendations.push('Run comprehensive system health check');
        recommendations.push('Review recent configuration changes');
        recommendations.push('Check external dependencies');
        break;
    }

    return recommendations;
  }

  /**
   * Generate optimization recommendations
   */
  private generateOptimizationRecommendations(): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    if (this.performanceMetrics.averageResponseTime > 2000) {
      recommendations.push('Response times are high - consider query optimization');
    }

    // Error rate recommendations
    const errorRate = this.performanceMetrics.totalQueries > 0 ?
      this.performanceMetrics.failedQueries / this.performanceMetrics.totalQueries : 0;
    if (errorRate > 0.05) {
      recommendations.push('Error rate is elevated - investigate failing strategies');
    }

    // Memory usage recommendations
    const memoryUsageMB = this.performanceMetrics.memoryUsage / 1024 / 1024;
    if (memoryUsageMB > 500) {
      recommendations.push('Memory usage is high - consider optimizing memory-intensive operations');
    }

    // Strategy-specific recommendations
    const strategyUsage = this.calculateStrategyUsagePercentages();
    const slowestStrategy = Object.entries(strategyUsage)
      .sort(([, a], [, b]) => b - a)[0];

    if (slowestStrategy && strategyUsage[slowestStrategy[0] as SearchStrategy] > 50) {
      recommendations.push(`Strategy ${slowestStrategy[0]} is heavily used - consider load balancing`);
    }

    return recommendations;
  }

  /**
   * Get dashboard data for performance monitoring UI
   */
  public getDashboardData(): DashboardData {
    return {
      currentMetrics: this.getCurrentPerformanceMetrics(),
      historicalData: this.getHistoricalPerformanceData(),
      strategyComparison: this.getStrategyPerformanceComparison(),
      errorAnalysis: this.getErrorAnalysis(),
      optimizationSuggestions: this.getOptimizationSuggestions(),
      systemHealth: this.getSystemHealthStatus(),
      lastUpdated: new Date()
    };
  }

  /**
   * Get current performance metrics
   */
  private getCurrentPerformanceMetrics() {
    return {
      totalQueries: this.performanceMetrics.totalQueries,
      averageResponseTime: this.performanceMetrics.averageResponseTime,
      memoryUsage: this.performanceMetrics.memoryUsage,
      errorRate: this.performanceMetrics.totalQueries > 0 ?
        this.performanceMetrics.failedQueries / this.performanceMetrics.totalQueries : 0,
    };
  }

  /**
   * Get historical performance data
   */
  private getHistoricalPerformanceData() {
    const recentTrends = this.performanceMetrics.performanceTrends.slice(-50); // Last 50 data points

    return {
      responseTimeHistory: recentTrends.map(trend => ({
        timestamp: new Date(trend.timestamp),
        value: trend.responseTime,
      })),
      memoryUsageHistory: recentTrends.map(trend => ({
        timestamp: new Date(trend.timestamp),
        value: trend.memoryUsage,
      })),
      queryVolumeHistory: recentTrends.map(trend => ({
        timestamp: new Date(trend.timestamp),
        value: trend.queryCount,
      })),
    };
  }

  /**
   * Get strategy performance comparison
   */
  private getStrategyPerformanceComparison() {
    const comparison = [];

    for (const [strategy, usage] of this.performanceMetrics.strategyUsage) {
      const usagePercentage = this.performanceMetrics.totalQueries > 0 ? (usage / this.performanceMetrics.totalQueries) * 100 : 0;
      const strategyTrends = this.performanceMetrics.performanceTrends.filter(t => t.strategy === strategy);

      comparison.push({
        strategy,
        usagePercentage,
        averageResponseTime: strategyTrends.length > 0 ?
          strategyTrends.reduce((sum, t) => sum + t.responseTime, 0) / strategyTrends.length : 0,
        successRate: this.calculateStrategySuccessRate(strategy),
      });
    }

    return comparison.sort((a, b) => b.usagePercentage - a.usagePercentage);
  }

  /**
   * Calculate success rate for a specific strategy
   */
  private calculateStrategySuccessRate(strategy: SearchStrategy): number {
    // This would need to be implemented with strategy-specific success tracking
    // For now, return a placeholder based on overall success rate
    return this.performanceMetrics.totalQueries > 0 ?
      this.performanceMetrics.successfulQueries / this.performanceMetrics.totalQueries : 0;
  }

  /**
   * Get error analysis data
   */
  private getErrorAnalysis() {
    const topErrors = this.getTopErrors();

    return topErrors.map(error => ({
      error: error.error,
      count: error.count,
      trend: this.calculateErrorTrend(error.error),
    }));
  }

  /**
   * Calculate error trend for specific error
   */
  private calculateErrorTrend(errorType: string): 'increasing' | 'decreasing' | 'stable' {
    const recentTrends = this.performanceMetrics.performanceTrends.slice(-20);
    const olderTrends = this.performanceMetrics.performanceTrends.slice(-40, -20);

    const recentErrorRate = recentTrends.length > 0 ?
      recentTrends.reduce((sum, t) => sum + t.errorRate, 0) / recentTrends.length : 0;
    const olderErrorRate = olderTrends.length > 0 ?
      olderTrends.reduce((sum, t) => sum + t.errorRate, 0) / olderTrends.length : 0;

    if (recentErrorRate > olderErrorRate * 1.2) return 'increasing';
    if (recentErrorRate < olderErrorRate * 0.8) return 'decreasing';
    return 'stable';
  }

  /**
   * Get optimization suggestions
   */
  private getOptimizationSuggestions(): string[] {
    return this.generateOptimizationRecommendations();
  }

  /**
   * Get system health status
   */
  private getSystemHealthStatus(): 'healthy' | 'degraded' | 'critical' {
    const errorRate = this.performanceMetrics.totalQueries > 0 ?
      this.performanceMetrics.failedQueries / this.performanceMetrics.totalQueries : 0;
    const memoryUsageRatio = this.performanceMetrics.memoryUsage / this.performanceMonitoringConfig.alertThresholds.maxMemoryUsage;
    const responseTimeRatio = this.performanceMetrics.averageResponseTime / this.performanceMonitoringConfig.alertThresholds.maxResponseTime;

    if (errorRate > 0.2 || memoryUsageRatio > 2 || responseTimeRatio > 3) {
      return 'critical';
    }

    if (errorRate > 0.1 || memoryUsageRatio > 1.5 || responseTimeRatio > 2) {
      return 'degraded';
    }

    return 'healthy';
  }

  /**
   * Add performance alert callback
   */
  public addPerformanceAlertCallback(callback: (alert: PerformanceAlert) => void): void {
    this.performanceAlertCallbacks.push(callback);
  }

  /**
   * Remove performance alert callback
   */
  public removePerformanceAlertCallback(callback: (alert: PerformanceAlert) => void): void {
    const index = this.performanceAlertCallbacks.indexOf(callback);
    if (index > -1) {
      this.performanceAlertCallbacks.splice(index, 1);
    }
  }

  /**
   * Update performance monitoring configuration
   */
  public updatePerformanceMonitoringConfig(config: Partial<PerformanceMonitoringConfig>): void {
    this.performanceMonitoringConfig = { ...this.performanceMonitoringConfig, ...config };

    // Restart monitoring if enabled state changed
    if (config.enabled !== undefined) {
      if (config.enabled) {
        this.startPerformanceMonitoring();
      } else {
        if (this.performanceCollectionTimer) {
          clearInterval(this.performanceCollectionTimer as any);
          this.performanceCollectionTimer = undefined;
        }
      }
    }
  }

  /**
   * Calculate query complexity for performance tracking
   */
  private calculateQueryComplexity(query: SearchQuery): number {
    let complexity = 1;

    // Text complexity
    if (query.text) {
      const words = query.text.split(/\s+/).length;
      complexity += Math.min(words / 10, 5); // Up to 5 points for text length

      // Boolean operators increase complexity
      const booleanOperators = (query.text.match(/\b(AND|OR|NOT)\b/gi) || []).length;
      complexity += booleanOperators * 0.5;

      // Phrase searches increase complexity
      const phraseSearches = (query.text.match(/"[^"]*"/g) || []).length;
      complexity += phraseSearches * 0.3;
    }

    // Filter complexity
    if (query.filters) {
      const filterCount = Object.keys(query.filters).length;
      complexity += filterCount * 0.2;

      // Nested filters increase complexity
      if (query.filterExpression) {
        const nestedLevel = (query.filterExpression.match(/\(/g) || []).length;
        complexity += nestedLevel * 0.5;
      }
    }

    // Limit and offset add minor complexity
    if (query.limit && query.limit > 10) complexity += 0.1;
    if (query.offset && query.offset > 0) complexity += 0.1;

    return Math.min(complexity, 10); // Cap at 10
  }

  /**
   * Get performance monitoring configuration
   */
  public getPerformanceMonitoringConfig(): PerformanceMonitoringConfig {
    return { ...this.performanceMonitoringConfig };
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): {
    totalQueries: number;
    averageQueryTime: number;
    lastMaintenanceCheck: Date;
    maintenanceCheckCount: number;
  } {
    return { ...this.performanceMetrics };
  }

  /**
   * Get maintenance status
   */
  public getMaintenanceStatus(): {
    isOptimizing: boolean;
    lastHealthCheck: Date | null;
    nextHealthCheck: Date | null;
    nextOptimizationCheck: Date | null;
    nextBackup: Date | null;
  } {
    return this.searchIndexManager.getMaintenanceStatus();
  }

  // ===== ENHANCED ERROR HANDLING AND RECOVERY MECHANISMS =====

  /**
   * Create comprehensive error context for detailed error information
   */
  private createErrorContext(
    operation: string,
    strategy: ISearchStrategy,
    query: SearchQuery,
    additionalContext?: Record<string, unknown>
  ): SearchErrorContext {
    const executionTime = this.operationStartTime > 0 ? Date.now() - this.operationStartTime : 0;
    const strategyName = strategy.name as SearchStrategy;

    return {
      strategy: strategyName,
      operation,
      query: query.text,
      parameters: {
        limit: query.limit || 10,
        offset: query.offset || 0,
        hasFilters: !!query.filters,
        hasFilterExpression: !!query.filterExpression,
      },
      timestamp: new Date(),
      executionTime,
      systemState: this.getSystemState(),
      errorCategory: this.categorizeErrorSeverity(strategyName, operation),
      recoveryAttempts: 0,
      circuitBreakerState: this.getCircuitBreakerState(strategyName),
      ...additionalContext,
    };
  }

  /**
   * Attempt strategy-specific error recovery
   */
  private async attemptStrategyRecovery(
    strategy: ISearchStrategy,
    query: SearchQuery,
    error: unknown
  ): Promise<SearchResult[]> {
    const strategyName = strategy.name as SearchStrategy;
    const errorContext = this.createErrorContext('strategy_recovery', strategy, query);

    // Check if error is recoverable
    if (!this.isRecoverableError(error)) {
      this.trackError(strategyName, error, errorContext);
      throw error;
    }

    // Attempt recovery based on strategy type
    switch (strategyName) {
      case SearchStrategy.FTS5:
        return this.recoverFTSStrategy(query, errorContext);
      case SearchStrategy.LIKE:
        return this.recoverLikeStrategy(query, errorContext);
      case SearchStrategy.RECENT:
        return this.recoverRecentStrategy(query, errorContext);
      default:
        this.trackError(strategyName, error, errorContext);
        throw error;
    }
  }

  /**
   * Execute strategy with circuit breaker protection
   */
  private async executeWithCircuitBreaker(
    strategy: ISearchStrategy,
    query: SearchQuery
  ): Promise<SearchResult[]> {
    const strategyName = strategy.name as SearchStrategy;
    const breaker = this.getCircuitBreaker(strategyName);

    return breaker.execute(async () => {
      return this.executeStrategy(strategy, query);
    });
  }

  /**
   * Get or create circuit breaker for a strategy
   */
  private getCircuitBreaker(strategyName: SearchStrategy): CircuitBreaker {
    if (!this.circuitBreakers.has(strategyName)) {
      const config: CircuitBreakerConfig = {
        failureThreshold: 5,
        recoveryTimeout: 30000, // 30 seconds
        monitoringPeriod: 60000, // 1 minute
      };
      this.circuitBreakers.set(strategyName, new CircuitBreaker(config));
    }
    return this.circuitBreakers.get(strategyName)!;
  }

  /**
   * Get current circuit breaker state
   */
  private getCircuitBreakerState(strategyName: SearchStrategy): 'closed' | 'open' | 'half-open' {
    const breaker = this.circuitBreakers.get(strategyName);
    if (!breaker) return 'closed';

    const state = breaker.getState();
    return state.state;
  }

  /**
   * Track error for trend analysis
   */
  private trackError(strategy: SearchStrategy, error: unknown, context: SearchErrorContext): void {
    this.errorTracker.recordError(strategy, error, context);

    // Check for error trends
    const trends = this.errorTracker.analyzeTrends();
    if (trends.hasCriticalTrend) {
      this.handleCriticalErrorTrend(trends);
    }

    // Send notification for critical errors
    if (context.errorCategory === 'critical') {
      this.sendErrorNotification(context);
    }
  }

  /**
   * Handle critical error trends
   */
  private handleCriticalErrorTrend(trends: ErrorTrendAnalysis): void {
    console.warn('Critical error trend detected:', trends);

    // Could implement automatic strategy disabling, alerting, etc.
    for (const [strategy, trend] of trends.strategyTrends) {
      if (trend.trendDirection === 'degrading' && trend.errorRate > 0.1) {
        console.error(`Strategy ${strategy} showing critical error trend. Consider disabling.`);
      }
    }
  }

  /**
   * Send error notification for critical failures
   */
  private sendErrorNotification(context: SearchErrorContext): void {
    if (this.errorNotificationCallback) {
      try {
        this.errorNotificationCallback(context);
      } catch (error) {
        console.error('Error notification callback failed:', error);
      }
    }

    // Log critical errors
    logError('Critical search error occurred', {
      component: 'SearchService',
      strategy: context.strategy,
      operation: context.operation,
      errorCategory: context.errorCategory,
      executionTime: context.executionTime,
      timestamp: context.timestamp,
    });
  }

  /**
   * Get current system state for error context
   */
  private getSystemState(): SearchErrorContext['systemState'] {
    try {
      const dbManager = this.dbManager as any;
      return {
        memoryUsage: process.memoryUsage?.().heapUsed || 0,
        activeConnections: dbManager?.activeConnections || 0,
        databaseStatus: dbManager?.isConnected ? 'connected' : 'disconnected',
      };
    } catch {
      return {
        memoryUsage: 0,
        activeConnections: 0,
        databaseStatus: 'unknown',
      };
    }
  }

  /**
   * Categorize error severity
   */
  private categorizeErrorSeverity(strategy: SearchStrategy, operation: string): 'low' | 'medium' | 'high' | 'critical' {
    // Strategy-specific error categorization
    switch (strategy) {
      case SearchStrategy.FTS5:
        return this.categorizeFTSErrorSeverity(operation);
      case SearchStrategy.LIKE:
        return this.categorizeLikeErrorSeverity(operation);
      default:
        return 'medium';
    }
  }

  /**
   * Check if an error is recoverable
   */
  private isRecoverableError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

    // Non-recoverable errors
    const nonRecoverablePatterns = [
      'syntax error',
      'invalid configuration',
      'authentication failed',
      'permission denied',
      'corrupted database',
    ];

    // Recoverable errors
    const recoverablePatterns = [
      'timeout',
      'database busy',
      'database locked',
      'connection lost',
      'temporary failure',
      'out of memory',
    ];

    // Check for non-recoverable patterns first
    if (nonRecoverablePatterns.some(pattern => errorMessage.includes(pattern))) {
      return false;
    }

    // Check for recoverable patterns
    return recoverablePatterns.some(pattern => errorMessage.includes(pattern));
  }

  /**
   * Recover FTS5 strategy from errors
   */
  private async recoverFTSStrategy(query: SearchQuery, context: SearchErrorContext): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Try to reinitialize FTS support
      const ftsStrategy = this.strategies.get(SearchStrategy.FTS5);
      if (ftsStrategy) {
        // Reset circuit breaker to give FTS another chance
        const breaker = this.circuitBreakers.get(SearchStrategy.FTS5);
        if (breaker) {
          breaker.recordSuccess();
        }

        // Retry the FTS query
        const results = await this.executeStrategy(ftsStrategy, query);
        context.recoveryAttempts = (context.recoveryAttempts || 0) + 1;

        logError('FTS strategy recovered successfully', {
          component: 'SearchService',
          recoveryTime: Date.now() - startTime,
          attempts: context.recoveryAttempts,
        });

        return results;
      }

      throw new Error('FTS strategy not available for recovery');
    } catch (recoveryError) {
      context.recoveryAttempts = (context.recoveryAttempts || 0) + 1;
      this.trackError(SearchStrategy.FTS5, recoveryError, context);
      throw recoveryError;
    }
  }

  /**
   * Recover LIKE strategy from errors
   */
  private async recoverLikeStrategy(query: SearchQuery, context: SearchErrorContext): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      const likeStrategy = this.strategies.get(SearchStrategy.LIKE);
      if (likeStrategy) {
        // Reset circuit breaker
        const breaker = this.circuitBreakers.get(SearchStrategy.LIKE);
        if (breaker) {
          breaker.recordSuccess();
        }

        // Retry with simplified query
        const simplifiedQuery = { ...query, text: this.simplifyQuery(query.text) };
        const results = await this.executeStrategy(likeStrategy, simplifiedQuery);
        context.recoveryAttempts = (context.recoveryAttempts || 0) + 1;

        logError('LIKE strategy recovered successfully', {
          component: 'SearchService',
          recoveryTime: Date.now() - startTime,
          attempts: context.recoveryAttempts,
        });

        return results;
      }

      throw new Error('LIKE strategy not available for recovery');
    } catch (recoveryError) {
      context.recoveryAttempts = (context.recoveryAttempts || 0) + 1;
      this.trackError(SearchStrategy.LIKE, recoveryError, context);
      throw recoveryError;
    }
  }

  /**
   * Recover Recent Memories strategy from errors
   */
  private async recoverRecentStrategy(query: SearchQuery, context: SearchErrorContext): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      const recentStrategy = this.strategies.get(SearchStrategy.RECENT);
      if (recentStrategy) {
        // Reset circuit breaker
        const breaker = this.circuitBreakers.get(SearchStrategy.RECENT);
        if (breaker) {
          breaker.recordSuccess();
        }

        // Retry with reduced limit
        const recoveryQuery = { ...query, limit: Math.min(query.limit || 10, 5) };
        const results = await this.executeStrategy(recentStrategy, recoveryQuery);
        context.recoveryAttempts = (context.recoveryAttempts || 0) + 1;

        logError('Recent strategy recovered successfully', {
          component: 'SearchService',
          recoveryTime: Date.now() - startTime,
          attempts: context.recoveryAttempts,
        });

        return results;
      }

      throw new Error('Recent strategy not available for recovery');
    } catch (recoveryError) {
      context.recoveryAttempts = (context.recoveryAttempts || 0) + 1;
      this.trackError(SearchStrategy.RECENT, recoveryError, context);
      throw recoveryError;
    }
  }

  /**
   * Simplify query for recovery attempts
   */
  private simplifyQuery(query: string): string {
    if (!query) return '';

    // Remove complex operators and special characters
    return query
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100); // Limit length
  }

  /**
   * Categorize FTS error severity
   */
  private categorizeFTSErrorSeverity(operation: string): 'low' | 'medium' | 'high' | 'critical' {
    if (operation.includes('initialization') || operation.includes('configuration')) {
      return 'critical';
    }
    if (operation.includes('timeout') || operation.includes('database')) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Categorize LIKE error severity
   */
  private categorizeLikeErrorSeverity(operation: string): 'low' | 'medium' | 'high' | 'critical' {
    if (operation.includes('configuration')) {
      return 'high';
    }
    return 'medium';
  }

  /**
   * Set error notification callback
   */
  public setErrorNotificationCallback(callback: (error: SearchErrorContext) => void): void {
    this.errorNotificationCallback = callback;
  }

  /**
   * Handle filter-specific errors with comprehensive context and fallback mechanisms
   */
  private handleFilterError(
    error: unknown,
    operation: string,
    filterExpression: string,
    context?: Record<string, unknown>
  ): SearchError {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Create detailed filter error context
    const filterErrorContext = {
      strategy: SearchStrategy.SEMANTIC,
      operation,
      query: filterExpression,
      parameters: {
        limit: 10,
        offset: 0,
        hasFilters: true,
        hasFilterExpression: true,
        ...context,
        filterExpression,
        filterLength: filterExpression.length,
        hasComplexLogic: this.hasComplexFilterLogic(filterExpression),
        hasNestedExpressions: this.hasNestedFilterExpressions(filterExpression),
      },
      timestamp: new Date(),
      executionTime: Date.now() - (this.operationStartTime || Date.now()),
      errorCategory: this.mapFilterErrorCategoryToSeverity(this.categorizeFilterError(errorMessage)),
      recoveryAttempts: 0,
      filterError: true,
    };

    // Log detailed filter error information
    console.error('Filter operation error:', {
      error: errorMessage,
      operation,
      filterExpression: filterExpression.substring(0, 200) + (filterExpression.length > 200 ? '...' : ''),
      context: filterErrorContext,
      errorCategory: filterErrorContext.errorCategory,
    });

    // Create appropriate error type based on the failure
    let searchError: SearchError;

    const severityCategory = filterErrorContext.errorCategory;
    switch (severityCategory) {
      case 'low':
        searchError = new SearchValidationError(
          `Filter validation failed: ${errorMessage}`,
          'filterExpression',
          filterExpression,
          'advanced_filter_engine',
          filterErrorContext
        );
        break;
      case 'medium':
        searchError = new SearchParseError(
          'advanced_filter_engine',
          `Filter parse error: ${errorMessage}`,
          operation,
          filterErrorContext,
          error instanceof Error ? error : undefined
        );
        break;
      case 'high':
        searchError = new SearchTimeoutError(
          'advanced_filter_engine',
          10000, // Default filter timeout
          operation,
          filterErrorContext
        );
        break;
      default:
        searchError = new SearchError(
          `Filter operation failed: ${errorMessage}`,
          'advanced_filter_engine',
          filterErrorContext,
          error instanceof Error ? error : undefined,
          SearchErrorCategory.EXECUTION
        );
    }

    // Track error for trend analysis
    this.trackError(SearchStrategy.SEMANTIC, error, filterErrorContext);

    return searchError;
  }

  /**
   * Categorize filter errors for better error handling
   */
  private categorizeFilterError(errorMessage: string): 'validation' | 'parse' | 'execution' | 'timeout' | 'optimization' {
    const message = errorMessage.toLowerCase();

    if (message.includes('validation') || message.includes('invalid') || message.includes('malformed')) {
      return 'validation';
    }

    if (message.includes('parse') || message.includes('syntax') || message.includes('unexpected token')) {
      return 'parse';
    }

    if (message.includes('timeout') || message.includes('timed out')) {
      return 'timeout';
    }

    if (message.includes('optimization') || message.includes('performance')) {
      return 'optimization';
    }

    return 'execution';
  }

  /**
   * Map filter error category to severity level
   */
  private mapFilterErrorCategoryToSeverity(category: 'validation' | 'parse' | 'execution' | 'timeout' | 'optimization'): 'low' | 'medium' | 'high' | 'critical' {
    switch (category) {
      case 'validation':
        return 'low';
      case 'parse':
        return 'medium';
      case 'timeout':
        return 'high';
      case 'optimization':
        return 'medium';
      case 'execution':
        return 'high';
      default:
        return 'medium';
    }
  }

  /**
   * Check if filter expression has complex logic patterns
   */
  private hasComplexFilterLogic(filterExpression: string): boolean {
    const complexPatterns = [
      /\b(AND|OR)\b.*\b(AND|OR)\b.*\b(AND|OR)\b/, // Multiple logical operators
      /\([^()]*\([^()]*\)[^()]*\)/, // Nested parentheses
      /\bNOT\s+\(/, // NOT with parentheses
    ];

    return complexPatterns.some(pattern => pattern.test(filterExpression.toUpperCase()));
  }

  /**
   * Check if filter expression has nested expressions
   */
  private hasNestedFilterExpressions(filterExpression: string): boolean {
    const openParens = (filterExpression.match(/\(/g) || []).length;
    const closeParens = (filterExpression.match(/\)/g) || []).length;
    return openParens > 1 || closeParens > 1;
  }

  /**
   * Attempt filter recovery with fallback mechanisms
   */
  private async attemptFilterRecovery(
    originalFilterExpression: string,
    results: SearchResult[],
    error: unknown
  ): Promise<SearchResult[]> {
    const recoveryStrategies = [
      () => this.trySimplifiedFilterExpression(originalFilterExpression, results),
      () => this.tryTemplateBasedRecovery(originalFilterExpression, results),
      () => this.tryFieldBasedRecovery(originalFilterExpression, results),
      () => this.tryBasicFilterRecovery(results),
    ];

    for (const strategy of recoveryStrategies) {
      try {
        const recoveryResult = await strategy();
        if (recoveryResult && recoveryResult.length > 0) {
          console.log(`Filter recovery successful using ${strategy.name}`);
          return recoveryResult;
        }
      } catch (recoveryError) {
        console.warn(`Filter recovery strategy failed:`, recoveryError);
        continue;
      }
    }

    // If all recovery strategies fail, return original results
    console.warn('All filter recovery strategies failed, returning original results');
    return results;
  }

  /**
   * Try simplified filter expression for recovery
   */
  private async trySimplifiedFilterExpression(
    filterExpression: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    // Extract the simplest part of the filter expression
    const simplePattern = /^(\w+\s*[=<>]+\s*['"]?[^'"&\s]+['"]?)/;
    const match = filterExpression.match(simplePattern);

    if (match) {
      const simpleFilter = match[1];
      console.log(`Attempting recovery with simplified filter: ${simpleFilter}`);

      try {
        const filterNode = this.advancedFilterEngine!.parseFilter(simpleFilter);
        const filterResult = await this.advancedFilterEngine!.executeFilter(filterNode, results);
        return filterResult.filteredItems as SearchResult[];
      } catch (error) {
        console.warn('Simplified filter also failed:', error);
        throw error;
      }
    }

    throw new Error('No simplifiable filter found');
  }

  /**
   * Try template-based recovery using registered templates
   */
  private async tryTemplateBasedRecovery(
    filterExpression: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    if (!this.advancedFilterEngine) {
      throw new Error('AdvancedFilterEngine not available');
    }

    const templateManager = this.advancedFilterEngine.getTemplateManager();
    const availableTemplates = templateManager.listAvailableTemplates();

    // Try to match filter expression with available templates
    for (const templateName of availableTemplates) {
      try {
        const template = templateManager.getTemplate(templateName);
        if (template && this.matchesTemplatePattern(filterExpression, template)) {
          console.log(`Attempting recovery with template: ${templateName}`);

          // Try to create filter from template
          const filterNode = this.advancedFilterEngine.createFilterTemplate(templateName, {});
          const filterResult = await this.advancedFilterEngine.executeFilter(filterNode, results);
          return filterResult.filteredItems as SearchResult[];
        }
      } catch (error) {
        continue; // Try next template
      }
    }

    throw new Error('No matching template found for recovery');
  }

  /**
   * Try field-based recovery using simple field filters
   */
  private async tryFieldBasedRecovery(
    filterExpression: string,
    results: SearchResult[]
  ): Promise<SearchResult[]> {
    console.log('Attempting field-based filter recovery');

    // Extract basic field filters and apply them manually
    const simpleFilters = this.extractSimpleFilters(filterExpression);

    if (simpleFilters.length === 0) {
      throw new Error('No field-based filters found for recovery');
    }

    return results.filter(result => {
      return simpleFilters.some(filter => this.evaluateSimpleFilter(result, filter));
    });
  }

  /**
   * Try basic filter recovery with minimal filtering
   */
  private async tryBasicFilterRecovery(results: SearchResult[]): Promise<SearchResult[]> {
    console.log('Attempting basic filter recovery');

    // Apply very basic filtering based on result metadata
    return results.filter(result => {
      // Filter out results with very low scores
      if (result.score < 0.1) return false;

      // Filter out results with error flags
      if (result.error) return false;

      // Keep results with basic metadata
      return result.metadata && Object.keys(result.metadata).length > 0;
    });
  }

  /**
   * Check if filter expression matches template pattern
   */
  private matchesTemplatePattern(filterExpression: string, template: any): boolean {
    if (!template.filterExpression) return false;

    // Simple pattern matching - check if key elements are present
    const filterLower = filterExpression.toLowerCase();
    const templateLower = template.filterExpression.toLowerCase();

    // Check for common keywords
    const filterWords = filterLower.split(/\s+/).filter(word => word.length > 2);
    const templateWords = templateLower.split(/\s+/).filter((word: string) => word.length > 2);

    const commonWords = filterWords.filter(word => templateWords.includes(word));
    return commonWords.length > 0;
  }

  /**
   * Get available filter templates for debugging and introspection
   */
  public getAvailableFilterTemplates(): Array<{ name: string; description: string; parameters: any[] }> {
    if (!this.advancedFilterEngine) {
      return [];
    }

    try {
      const templateManager = this.advancedFilterEngine.getTemplateManager();
      const templateNames = templateManager.listAvailableTemplates();

      return templateNames.map(name => {
        const template = templateManager.getTemplate(name);
        return {
          name,
          description: template?.description || 'No description available',
          parameters: template?.parameters || [],
        };
      });
    } catch (error) {
      console.error('Failed to get available filter templates:', error);
      return [];
    }
  }

  /**
   * Validate filter template for correctness
   */
  public validateFilterTemplate(templateName: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    if (!this.advancedFilterEngine) {
      return {
        isValid: false,
        errors: ['AdvancedFilterEngine not available'],
        warnings: [],
      };
    }

    try {
      const templateManager = this.advancedFilterEngine.getTemplateManager();
      const template = templateManager.getTemplate(templateName);

      if (!template) {
        return {
          isValid: false,
          errors: [`Template '${templateName}' not found`],
          warnings: [],
        };
      }

      const validation = templateManager.validateTemplate(template);
      return {
        isValid: validation.isValid,
        errors: validation.errors.map(e => e.message),
        warnings: validation.warnings.map(w => w.message),
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  /**
   * Get error statistics and trends
   */
  public getErrorStatistics(): {
    totalErrors: number;
    recentErrors: ErrorTrackingInfo[];
    trends: ErrorTrendAnalysis;
    circuitBreakerStates: Map<SearchStrategy, CircuitBreakerState>;
  } {
    return {
      totalErrors: this.errorTracker.getRecentErrors().length,
      recentErrors: this.errorTracker.getRecentErrors(undefined, 100),
      trends: this.errorTracker.analyzeTrends(),
      circuitBreakerStates: new Map(
        Array.from(this.circuitBreakers.entries()).map(([strategy, breaker]) => [
          strategy,
          breaker.getState(),
        ])
      ),
    };
  }

  /**
   * Reset circuit breaker for a strategy
   */
  public resetCircuitBreaker(strategyName: SearchStrategy): void {
    const breaker = this.circuitBreakers.get(strategyName);
    if (breaker) {
      breaker.recordSuccess();
    }
  }

  /**
   * Force circuit breaker to open for a strategy
   */
  public tripCircuitBreaker(strategyName: SearchStrategy): void {
    const breaker = this.circuitBreakers.get(strategyName);
    if (breaker) {
      // Simulate multiple failures to trip the breaker
      for (let i = 0; i < 10; i++) {
        breaker.recordFailure();
      }
    }
  }

  // ===== RUNTIME CONFIGURATION UPDATE SUPPORT =====

  /**
   * Update strategy configuration at runtime
   */
  async updateStrategyConfiguration(
    strategyName: string,
    config: Partial<SearchStrategyConfiguration>
  ): Promise<void> {
    const updateStartTime = Date.now();

    // Prevent concurrent updates
    if (this.configurationUpdateState.isUpdating) {
      throw new SearchConfigurationError(
        `Configuration update already in progress for ${strategyName}`,
        'runtime_config_update',
        { strategyName, timestamp: new Date() }
      );
    }

    this.configurationUpdateState.isUpdating = true;
    this.configurationUpdateState.lastUpdateAttempt = new Date();

    try {
      // Load current configuration
      const currentConfig = await this.configManager.loadConfiguration(strategyName);
      if (!currentConfig) {
        throw new SearchConfigurationError(
          `No configuration found for strategy: ${strategyName}`,
          'config_not_found',
          { strategyName }
        );
      }

      // Merge configurations
      const updatedConfig = this.configManager.mergeConfigurations(currentConfig, config);

      // Validate the updated configuration
      const validation = await this.configManager.validateConfiguration(updatedConfig);
      if (!validation.isValid) {
        throw new SearchConfigurationError(
          `Invalid configuration for ${strategyName}: ${validation.errors.join(', ')}`,
          'validation_failed',
          { strategyName, errors: validation.errors, warnings: validation.warnings }
        );
      }

      // Create backup before applying changes
      await this.createConfigurationBackup(strategyName);

      // Apply configuration to running strategy
      await this.applyConfigurationToStrategy(strategyName as SearchStrategy, updatedConfig);

      // Save the updated configuration
      await this.configManager.saveConfiguration(strategyName, updatedConfig);

      // Update cached configuration
      (this as any)[`${strategyName}_config`] = updatedConfig;

      // Record successful update
      this.configurationUpdateState.lastUpdateSuccess = new Date();
      this.recordConfigurationUpdate({
        timestamp: new Date(),
        strategyName,
        action: 'update',
        oldConfig: currentConfig,
        newConfig: updatedConfig,
        success: true,
      });

      // Notify listeners
      this.notifyConfigurationChange(strategyName, currentConfig, updatedConfig);

      const updateDuration = Date.now() - updateStartTime;
      console.log(`Configuration updated for ${strategyName} in ${updateDuration}ms`);

    } catch (error) {
      // Record failed update
      this.recordConfigurationUpdate({
        timestamp: new Date(),
        strategyName,
        action: 'failed',
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });

      throw new SearchConfigurationError(
        `Failed to update configuration for ${strategyName}: ${error instanceof Error ? error.message : String(error)}`,
        'update_failed',
        {
          strategyName,
          updateDuration: Date.now() - updateStartTime,
          timestamp: new Date(),
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    } finally {
      this.configurationUpdateState.isUpdating = false;
    }
  }

  /**
   * Apply configuration changes to a running strategy
   */
  private async applyConfigurationToStrategy(
    strategyName: SearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const strategy = this.strategies.get(strategyName);
    if (!strategy || typeof strategy === 'undefined') {
      console.warn(`Strategy ${strategyName} not found, skipping configuration update`);
      return;
    }

    try {
      // Apply strategy-specific configuration changes
      switch (strategyName) {
        case SearchStrategy.FTS5:
          await this.reconfigureFTSStrategy(strategy, config);
          break;
        case SearchStrategy.LIKE:
          await this.reconfigureLikeStrategy(strategy, config);
          break;
        case SearchStrategy.RECENT:
          await this.reconfigureRecentStrategy(strategy, config);
          break;
        case SearchStrategy.SEMANTIC:
          await this.reconfigureSemanticStrategy(strategy, config);
          break;
        case SearchStrategy.CATEGORY_FILTER:
          await this.reconfigureCategoryFilterStrategy(strategy, config);
          break;
        case SearchStrategy.TEMPORAL_FILTER:
          await this.reconfigureTemporalFilterStrategy(strategy, config);
          break;
        case SearchStrategy.METADATA_FILTER:
          await this.reconfigureMetadataFilterStrategy(strategy, config);
          break;
        case SearchStrategy.RELATIONSHIP:
          await this.reconfigureRelationshipStrategy(strategy, config);
          break;
        default:
          console.warn(`No reconfiguration method available for strategy: ${strategyName}`);
      }
    } catch (error) {
      throw new SearchConfigurationError(
        `Failed to apply configuration to strategy ${strategyName}: ${error instanceof Error ? error.message : String(error)}`,
        'strategy_reconfiguration_failed',
        {
          strategyName,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  /**
   * Register a listener for configuration changes
   */
  onConfigurationChange(strategyName: string, listener: ConfigurationChangeListener): void {
    if (!this.configurationChangeListeners.has(strategyName)) {
      this.configurationChangeListeners.set(strategyName, []);
    }
    this.configurationChangeListeners.get(strategyName)!.push(listener);
  }

  /**
   * Remove a configuration change listener
   */
  offConfigurationChange(strategyName: string, listener: ConfigurationChangeListener): void {
    const listeners = this.configurationChangeListeners.get(strategyName);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Notify all listeners of a configuration change
   */
  private notifyConfigurationChange(
    strategyName: string,
    oldConfig: SearchStrategyConfiguration,
    newConfig: SearchStrategyConfiguration
  ): void {
    const listeners = this.configurationChangeListeners.get(strategyName) || [];
    listeners.forEach(listener => {
      try {
        listener(oldConfig, newConfig);
      } catch (error) {
        console.error(`Configuration change listener error for ${strategyName}:`, error);
      }
    });
  }

  /**
   * Get configuration update history
   */
  getConfigurationUpdateHistory(strategyName?: string): ConfigurationUpdateRecord[] {
    if (strategyName) {
      return this.configurationUpdateState.updateHistory.filter(
        record => record.strategyName === strategyName
      );
    }
    return this.configurationUpdateState.updateHistory;
  }

  /**
   * Get current configuration update state
   */
  getConfigurationUpdateState(): ConfigurationUpdateState {
    return {
      ...this.configurationUpdateState,
      updateHistory: [...this.configurationUpdateState.updateHistory], // Return copy
    };
  }

  /**
   * Record a configuration update in history
   */
  private recordConfigurationUpdate(record: ConfigurationUpdateRecord): void {
    this.configurationUpdateState.updateHistory.unshift(record);

    // Maintain history size limit
    if (this.configurationUpdateState.updateHistory.length > this.maxUpdateHistorySize) {
      this.configurationUpdateState.updateHistory = this.configurationUpdateState.updateHistory.slice(0, this.maxUpdateHistorySize);
    }
  }

  /**
   * Create a backup of current configuration before updates
   */
  private async createConfigurationBackup(strategyName: string): Promise<void> {
    try {
      await this.configManager.getStrategyBackups(strategyName); // This ensures backup directory exists
    } catch (error) {
      console.warn(`Failed to create configuration backup for ${strategyName}:`, error);
      // Continue with update even if backup fails
    }
  }

  /**
   * Rollback configuration to previous version
   */
  async rollbackConfiguration(strategyName: string): Promise<void> {
    if (this.configurationUpdateState.rollbackInProgress) {
      throw new SearchConfigurationError(
        `Rollback already in progress for ${strategyName}`,
        'rollback_in_progress',
        { strategyName }
      );
    }

    this.configurationUpdateState.rollbackInProgress = true;

    try {
      // Get the most recent successful update record
      const lastUpdate = this.configurationUpdateState.updateHistory
        .filter(record => record.strategyName === strategyName && record.action === 'update' && record.success)
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())[0];

      if (!lastUpdate || !lastUpdate.oldConfig) {
        throw new SearchConfigurationError(
          `No previous configuration found for rollback: ${strategyName}`,
          'no_rollback_available',
          { strategyName }
        );
      }

      // Apply the old configuration
      await this.updateStrategyConfiguration(strategyName, lastUpdate.oldConfig);

      // Record the rollback
      this.recordConfigurationUpdate({
        timestamp: new Date(),
        strategyName,
        action: 'rollback',
        oldConfig: lastUpdate.newConfig,
        newConfig: lastUpdate.oldConfig,
        success: true,
      });

      console.log(`Configuration rolled back for ${strategyName}`);

    } catch (error) {
      this.recordConfigurationUpdate({
        timestamp: new Date(),
        strategyName,
        action: 'rollback',
        error: error instanceof Error ? error.message : String(error),
        success: false,
      });

      throw new SearchConfigurationError(
        `Failed to rollback configuration for ${strategyName}: ${error instanceof Error ? error.message : String(error)}`,
        'rollback_failed',
        {
          strategyName,
          originalError: error instanceof Error ? error.message : String(error),
        }
      );
    } finally {
      this.configurationUpdateState.rollbackInProgress = false;
    }
  }

  // ===== STRATEGY RECONFIGURATION METHODS =====

  /**
   * Reconfigure FTS5 strategy with new settings
   */
  private async reconfigureFTSStrategy(
    strategy: ISearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const ftsStrategy = strategy as any; // SQLiteFTSStrategy

    // Update BM25 weights if provided
    if (config.strategySpecific?.bm25Weights) {
      ftsStrategy.bm25Weights = {
        ...ftsStrategy.bm25Weights,
        ...(config.strategySpecific.bm25Weights as any)
      };
    }

    // Update timeout if provided
    if (config.timeout) {
      ftsStrategy.queryTimeout = config.timeout;
    }

    // Update max results if provided
    if (config.maxResults) {
      ftsStrategy.maxResultsPerQuery = config.maxResults;
    }

    // Update result batch size if provided
    if (config.strategySpecific?.resultBatchSize) {
      ftsStrategy.resultBatchSize = config.strategySpecific.resultBatchSize;
    }

    console.log(`FTS5 strategy reconfigured for ${config.strategyName}`);
  }

  /**
   * Reconfigure LIKE strategy with new settings
   */
  private async reconfigureLikeStrategy(
    strategy: ISearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const likeStrategy = strategy as any; // LikeSearchStrategy

    if (config.strategySpecific) {
      const likeConfig = config.strategySpecific;

      // Update wildcard sensitivity
      if (likeConfig.wildcardSensitivity) {
        likeStrategy.likeConfig.wildcardSensitivity = likeConfig.wildcardSensitivity;
      }

      // Update max wildcard terms
      if (likeConfig.maxWildcardTerms) {
        likeStrategy.likeConfig.maxWildcardTerms = likeConfig.maxWildcardTerms;
      }

      // Update phrase search setting
      if (likeConfig.enablePhraseSearch !== undefined) {
        likeStrategy.likeConfig.enablePhraseSearch = likeConfig.enablePhraseSearch;
      }

      // Update case sensitivity
      if (likeConfig.caseSensitive !== undefined) {
        likeStrategy.likeConfig.caseSensitive = likeConfig.caseSensitive;
      }

      // Update relevance boost settings
      if (likeConfig.relevanceBoost) {
        likeStrategy.likeConfig.relevanceBoost = {
          ...likeStrategy.likeConfig.relevanceBoost,
          ...(likeConfig.relevanceBoost as any)
        };
      }
    }

    console.log(`LIKE strategy reconfigured for ${config.strategyName}`);
  }

  /**
   * Reconfigure Recent Memories strategy with new settings
   */
  private async reconfigureRecentStrategy(
    strategy: ISearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const recentStrategy = strategy as any; // RecentMemoriesStrategy

    if (config.strategySpecific) {
      const recentConfig = config.strategySpecific;

      // Update time windows
      if (recentConfig.timeWindows) {
        recentStrategy.timeWindows = {
          ...recentStrategy.timeWindows,
          ...recentConfig.timeWindows
        };
      }

      // Update max age
      if (recentConfig.maxAge) {
        recentStrategy.maxAge = recentConfig.maxAge;
      }
    }

    console.log(`Recent strategy reconfigured for ${config.strategyName}`);
  }

  /**
   * Reconfigure Semantic strategy with new settings
   */
  private async reconfigureSemanticStrategy(
    strategy: ISearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const semanticStrategy = strategy as any; // SemanticSearchStrategy

    if (config.strategySpecific) {
      semanticStrategy.config = {
        ...semanticStrategy.config,
        ...config.strategySpecific
      };
    }

    console.log(`Semantic strategy reconfigured for ${config.strategyName}`);
  }

  /**
   * Reconfigure Category Filter strategy with new settings
   */
  private async reconfigureCategoryFilterStrategy(
    strategy: ISearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const categoryStrategy = strategy as any; // CategoryFilterStrategy

    if (config.strategySpecific) {
      const categoryConfig = config.strategySpecific;

      if (categoryConfig.hierarchy) {
        categoryStrategy.config.hierarchy = {
          ...categoryStrategy.config.hierarchy,
          ...categoryConfig.hierarchy
        };
      }

      if (categoryConfig.performance) {
        categoryStrategy.config.performance = {
          ...categoryStrategy.config.performance,
          ...categoryConfig.performance
        };
      }
    }

    console.log(`Category Filter strategy reconfigured for ${config.strategyName}`);
  }

  /**
   * Reconfigure Temporal Filter strategy with new settings
   */
  private async reconfigureTemporalFilterStrategy(
    strategy: ISearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const temporalStrategy = strategy as any; // TemporalFilterStrategy

    if (config.strategySpecific) {
      const temporalConfig = config.strategySpecific;

      if (temporalConfig.naturalLanguage) {
        temporalStrategy.config.naturalLanguage = {
          ...temporalStrategy.config.naturalLanguage,
          ...temporalConfig.naturalLanguage
        };
      }

      if (temporalConfig.performance) {
        temporalStrategy.config.performance = {
          ...temporalStrategy.config.performance,
          ...temporalConfig.performance
        };
      }
    }

    console.log(`Temporal Filter strategy reconfigured for ${config.strategyName}`);
  }

  /**
   * Reconfigure Metadata Filter strategy with new settings
   */
  private async reconfigureMetadataFilterStrategy(
    strategy: ISearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const metadataStrategy = strategy as any; // MetadataFilterStrategy

    if (config.strategySpecific) {
      const metadataConfig = config.strategySpecific;

      if (metadataConfig.fields) {
        metadataStrategy.config.fields = {
          ...metadataStrategy.config.fields,
          ...metadataConfig.fields
        };
      }

      if (metadataConfig.validation) {
        metadataStrategy.config.validation = {
          ...metadataStrategy.config.validation,
          ...metadataConfig.validation
        };
      }

      if (metadataConfig.performance) {
        metadataStrategy.config.performance = {
          ...metadataStrategy.config.performance,
          ...metadataConfig.performance
        };
      }
    }

    console.log(`Metadata Filter strategy reconfigured for ${config.strategyName}`);
  }

  /**
   * Reconfigure Relationship strategy with new settings
   */
  private async reconfigureRelationshipStrategy(
    strategy: ISearchStrategy,
    config: SearchStrategyConfiguration
  ): Promise<void> {
    const relationshipStrategy = strategy as any; // RelationshipSearchStrategy

    if (config.strategySpecific) {
      const relationshipConfig = config.strategySpecific;

      // Update relationship-specific settings
      if (relationshipConfig.maxDepth !== undefined) {
        relationshipStrategy.maxDepth = relationshipConfig.maxDepth;
      }

      if (relationshipConfig.minRelationshipStrength !== undefined) {
        relationshipStrategy.minRelationshipStrength = relationshipConfig.minRelationshipStrength;
      }

      if (relationshipConfig.minRelationshipConfidence !== undefined) {
        relationshipStrategy.minRelationshipConfidence = relationshipConfig.minRelationshipConfidence;
      }

      if (relationshipConfig.includeRelationshipPaths !== undefined) {
        relationshipStrategy.includeRelationshipPaths = relationshipConfig.includeRelationshipPaths;
      }

      if (relationshipConfig.traversalStrategy) {
        relationshipStrategy.traversalStrategy = relationshipConfig.traversalStrategy;
      }
    }

    console.log(`Relationship strategy reconfigured for ${config.strategyName}`);
  }
}