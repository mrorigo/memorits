import { ILLMProvider } from '../ILLMProvider';
import { IProviderConfig } from '../IProviderConfig';
import { ProviderType } from '../ProviderType';
import { ChatCompletionParams } from '../types/ChatCompletionParams';
import { ChatCompletionResponse } from '../types/ChatCompletionResponse';
import { EmbeddingParams } from '../types/EmbeddingParams';
import { EmbeddingResponse } from '../types/EmbeddingResponse';
import { ProviderDiagnostics } from '../types/ProviderDiagnostics';

import { ConnectionPool, globalConnectionPool } from './ConnectionPool';
import { RequestCache, globalRequestCache } from './RequestCache';
import { HealthMonitor, globalHealthMonitor } from './HealthMonitor';
import { logInfo, logError } from '../../config/Logger';

/**
 * Configuration for the optimized provider
 */
export interface OptimizedProviderConfig {
  /** Enable connection pooling */
  enableConnectionPooling: boolean;
  /** Enable request/response caching */
  enableCaching: boolean;
  /** Enable health monitoring */
  enableHealthMonitoring: boolean;
  /** Cache TTL for chat completions in milliseconds */
  chatCacheTTL: number;
  /** Cache TTL for embeddings in milliseconds */
  embeddingCacheTTL: number;
  /** Connection pool configuration */
  connectionPoolConfig?: any;
  /** Health monitor configuration */
  healthMonitorConfig?: any;
  /** Request cache configuration */
  cacheConfig?: any;
}

/**
 * Optimized provider wrapper that integrates connection pooling,
 * intelligent caching, and health monitoring for improved performance
 */
export class OptimizedProvider implements ILLMProvider {
  private provider: ILLMProvider;
  private config: OptimizedProviderConfig;
  private connectionPool?: ConnectionPool;
  private requestCache?: RequestCache;
  private healthMonitor?: HealthMonitor;
  private isInitialized = false;

  constructor(
    provider: ILLMProvider,
    config: Partial<OptimizedProviderConfig> = {}
  ) {
    this.provider = provider;
    this.config = {
      enableConnectionPooling: true,
      enableCaching: true,
      enableHealthMonitoring: true,
      chatCacheTTL: 300000, // 5 minutes
      embeddingCacheTTL: 3600000, // 1 hour
      ...config,
    };

    this.initializeOptimizations();
  }

  async initialize(config: IProviderConfig): Promise<void> {
    await this.provider.initialize(config);
    this.isInitialized = true;

    // Start health monitoring if enabled
    if (this.config.enableHealthMonitoring && this.healthMonitor) {
      this.healthMonitor.startMonitoring(this.provider);
    }

    logInfo('OptimizedProvider initialized', {
      component: 'OptimizedProvider',
      providerType: this.provider.getProviderType(),
      optimizationsEnabled: {
        connectionPooling: this.config.enableConnectionPooling,
        caching: this.config.enableCaching,
        healthMonitoring: this.config.enableHealthMonitoring,
      },
    });
  }

  async dispose(): Promise<void> {
    if (this.healthMonitor) {
      this.healthMonitor.stopMonitoring(this.provider);
    }

    if (this.connectionPool) {
      await this.connectionPool.dispose();
    }

    await this.provider.dispose();

    logInfo('OptimizedProvider disposed', {
      component: 'OptimizedProvider',
      providerType: this.provider.getProviderType(),
    });
  }

  async isHealthy(): Promise<boolean> {
    return await this.provider.isHealthy();
  }

  async getDiagnostics(): Promise<ProviderDiagnostics> {
    const baseDiagnostics = await this.provider.getDiagnostics();

    // Add optimization metrics to diagnostics
    const optimizationMetrics = {
      connectionPool: this.connectionPool?.getPoolStats(),
      cache: this.requestCache?.getStats(),
      health: this.healthMonitor?.getProviderHealth(this.provider),
    };

    return {
      ...baseDiagnostics,
      metadata: {
        ...baseDiagnostics.metadata,
        optimizations: optimizationMetrics,
        optimized: true,
      },
    };
  }

  getModel(): string {
    return this.provider.getModel();
  }

  getProviderType(): ProviderType {
    return this.provider.getProviderType();
  }

  getConfig(): IProviderConfig {
    return this.provider.getConfig();
  }

  getClient(): any {
    return this.provider.getClient();
  }

  async createChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (this.config.enableCaching && this.requestCache) {
        const cachedResponse = this.requestCache.getChatCompletion(params);
        if (cachedResponse) {
          // Record successful request for health monitoring
          if (this.healthMonitor) {
            this.healthMonitor.recordRequestResult(
              this.provider,
              true,
              Date.now() - startTime,
              undefined
            );
          }
          return cachedResponse;
        }
      }

      // Get provider from connection pool if enabled
      let providerToUse = this.provider;
      if (this.config.enableConnectionPooling && this.connectionPool) {
        providerToUse = await this.connectionPool.getConnection(
          this.provider.getProviderType(),
          await this.getProviderConfig()
        );
      }

      // Make the actual request
      const response = await providerToUse.createChatCompletion(params);
      const responseTime = Date.now() - startTime;

      // Cache the response if enabled
      if (this.config.enableCaching && this.requestCache) {
        this.requestCache.setChatCompletion(params, response, this.config.chatCacheTTL);
      }

      // Record successful request for health monitoring
      if (this.healthMonitor) {
        this.healthMonitor.recordRequestResult(
          this.provider,
          true,
          responseTime,
          undefined
        );
      }

      // Return connection to pool if using pooling
      if (this.config.enableConnectionPooling && this.connectionPool && providerToUse !== this.provider) {
        await this.connectionPool.returnConnection(providerToUse);
      }

      logInfo('Chat completion request completed', {
        component: 'OptimizedProvider',
        providerType: this.provider.getProviderType(),
        responseTime,
        cached: false,
        tokensUsed: response.usage?.total_tokens,
      });

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed request for health monitoring
      if (this.healthMonitor) {
        this.healthMonitor.recordRequestResult(
          this.provider,
          false,
          responseTime,
          error instanceof Error ? error.message : String(error)
        );
      }

      logError('Chat completion request failed', {
        component: 'OptimizedProvider',
        providerType: this.provider.getProviderType(),
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  async createEmbedding(params: EmbeddingParams): Promise<EmbeddingResponse> {
    const startTime = Date.now();

    try {
      // Check cache first if enabled
      if (this.config.enableCaching && this.requestCache) {
        const cachedResponse = this.requestCache.getEmbedding(params);
        if (cachedResponse) {
          // Record successful request for health monitoring
          if (this.healthMonitor) {
            this.healthMonitor.recordRequestResult(
              this.provider,
              true,
              Date.now() - startTime,
              undefined
            );
          }
          return cachedResponse;
        }
      }

      // Get provider from connection pool if enabled
      let providerToUse = this.provider;
      if (this.config.enableConnectionPooling && this.connectionPool) {
        providerToUse = await this.connectionPool.getConnection(
          this.provider.getProviderType(),
          await this.getProviderConfig()
        );
      }

      // Make the actual request
      const response = await providerToUse.createEmbedding(params);
      const responseTime = Date.now() - startTime;

      // Cache the response if enabled
      if (this.config.enableCaching && this.requestCache) {
        this.requestCache.setEmbedding(params, response, this.config.embeddingCacheTTL);
      }

      // Record successful request for health monitoring
      if (this.healthMonitor) {
        this.healthMonitor.recordRequestResult(
          this.provider,
          true,
          responseTime,
          undefined
        );
      }

      // Return connection to pool if using pooling
      if (this.config.enableConnectionPooling && this.connectionPool && providerToUse !== this.provider) {
        await this.connectionPool.returnConnection(providerToUse);
      }

      logInfo('Embedding request completed', {
        component: 'OptimizedProvider',
        providerType: this.provider.getProviderType(),
        responseTime,
        cached: false,
        embeddingCount: response.data.length,
        tokensUsed: response.usage?.total_tokens,
      });

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed request for health monitoring
      if (this.healthMonitor) {
        this.healthMonitor.recordRequestResult(
          this.provider,
          false,
          responseTime,
          error instanceof Error ? error.message : String(error)
        );
      }

      logError('Embedding request failed', {
        component: 'OptimizedProvider',
        providerType: this.provider.getProviderType(),
        responseTime,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }

  /**
   * Get comprehensive performance statistics
   */
  getPerformanceStats(): {
    connectionPool?: any;
    cache?: any;
    health?: any;
    provider: ProviderType;
  } {
    return {
      connectionPool: this.connectionPool?.getPoolStats(),
      cache: this.requestCache?.getStats(),
      health: this.healthMonitor?.getProviderHealth(this.provider),
      provider: this.provider.getProviderType(),
    };
  }

  private initializeOptimizations(): void {
    // Initialize connection pool if enabled
    if (this.config.enableConnectionPooling) {
      this.connectionPool = this.config.connectionPoolConfig
        ? new ConnectionPool(this.config.connectionPoolConfig)
        : globalConnectionPool;
    }

    // Initialize request cache if enabled
    if (this.config.enableCaching) {
      this.requestCache = this.config.cacheConfig
        ? new RequestCache(this.config.cacheConfig)
        : globalRequestCache;
    }

    // Initialize health monitor if enabled
    if (this.config.enableHealthMonitoring) {
      this.healthMonitor = this.config.healthMonitorConfig
        ? new HealthMonitor(this.config.healthMonitorConfig)
        : globalHealthMonitor;
    }
  }

  private async getProviderConfig(): Promise<IProviderConfig> {
    // This would need to be implemented based on how the provider stores its config
    // For now, we'll return a basic config structure
    return {
      apiKey: 'configured',
      model: this.provider.getModel(),
    };
  }
}

/**
 * Factory function to create an optimized provider
 */
export function createOptimizedProvider(
  provider: ILLMProvider,
  config?: Partial<OptimizedProviderConfig>
): OptimizedProvider {
  return new OptimizedProvider(provider, config);
}