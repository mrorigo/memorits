import { ILLMProvider } from './ILLMProvider';
import { IProviderConfig, PerformanceConfig, MemoryConfig, extractPerformanceConfig, extractMemoryConfig, extractLegacyMemoryConfig } from './IProviderConfig';
import { ProviderType } from './ProviderType';
import { ChatCompletionParams } from './types/ChatCompletionParams';
import { ChatCompletionResponse } from './types/ChatCompletionResponse';
import { EmbeddingParams } from './types/EmbeddingParams';
import { EmbeddingResponse } from './types/EmbeddingResponse';
import { ProviderDiagnostics } from './types/ProviderDiagnostics';

import { ConnectionPool, globalConnectionPool } from './performance/ConnectionPool';
import { RequestCache, globalRequestCache } from './performance/RequestCache';
import { HealthMonitor, globalHealthMonitor } from './performance/HealthMonitor';

import { Memori } from '../../Memori';
import { MemoryAgent } from '../../domain/memory/MemoryAgent';
import { logInfo, logError, logWarn } from '../config/Logger';

/**
 * Unified LLM Provider that integrates performance optimizations and memory capabilities
 * Eliminates the need for wrapper classes by providing all features in a single implementation
 */
export abstract class UnifiedLLMProvider implements ILLMProvider {
  protected config: IProviderConfig;
  protected isInitialized = false;

  // Core LLM client (implemented by subclasses)
  protected client!: any;

  // Performance optimization components
  protected connectionPool?: ConnectionPool;
  protected requestCache?: RequestCache;
  protected healthMonitor?: HealthMonitor;

  // Memory management components
  protected memori?: Memori;
  protected memoryAgent?: MemoryAgent;

  // Extracted configurations
  protected performanceConfig: PerformanceConfig;
  protected memoryConfig: MemoryConfig;

  // Performance metrics
  protected metrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    memoryRecordingSuccess: 0,
    memoryRecordingFailures: 0,
    averageResponseTime: 0,
    averageMemoryProcessingTime: 0,
  };

  constructor(config: IProviderConfig) {
    this.config = config;

    // Extract configurations from unified config system
    this.performanceConfig = extractPerformanceConfig(config);
    this.memoryConfig = this.extractEffectiveMemoryConfig(config);

    this.initializeComponents();
  }

  /**
   * Extract effective memory configuration, supporting both legacy and new formats
   */
  private extractEffectiveMemoryConfig(config: IProviderConfig): MemoryConfig {
    // If new unified config is provided, use it
    if (config.features?.memory) {
      return extractMemoryConfig(config);
    }

    // Otherwise, fall back to legacy config for backward compatibility
    return extractLegacyMemoryConfig(config);
  }

  /**
   * Initialize performance and memory components based on configuration
   */
  private initializeComponents(): void {
    // Initialize performance components if enabled
    if (this.performanceConfig.enableConnectionPooling) {
      this.connectionPool = this.performanceConfig.connectionPool.maxConnections !== 10 ||
                           this.performanceConfig.connectionPool.idleTimeout !== 30000 ||
                           this.performanceConfig.connectionPool.acquireTimeout !== 5000
        ? new ConnectionPool({
            maxConnections: this.performanceConfig.connectionPool.maxConnections,
            maxIdleTime: this.performanceConfig.connectionPool.idleTimeout,
            connectionTimeout: this.performanceConfig.connectionPool.acquireTimeout,
            healthCheckInterval: this.performanceConfig.healthMonitor.checkInterval,
          })
        : globalConnectionPool;
    }

    if (this.performanceConfig.enableCaching) {
      this.requestCache = this.performanceConfig.cacheTTL.chat !== 300000 ||
                         this.performanceConfig.cacheTTL.embedding !== 3600000
        ? new RequestCache({
            defaultTTL: Math.min(this.performanceConfig.cacheTTL.chat, this.performanceConfig.cacheTTL.embedding),
            maxTTL: Math.max(this.performanceConfig.cacheTTL.chat, this.performanceConfig.cacheTTL.embedding),
          })
        : globalRequestCache;
    }

    if (this.performanceConfig.enableHealthMonitoring) {
      this.healthMonitor = this.performanceConfig.healthMonitor.checkInterval !== 60000 ||
                          this.performanceConfig.healthMonitor.failureThreshold !== 3 ||
                          this.performanceConfig.healthMonitor.successRateThreshold !== 0.95
        ? new HealthMonitor({
            checkInterval: this.performanceConfig.healthMonitor.checkInterval,
            failureThreshold: this.performanceConfig.healthMonitor.failureThreshold,
            successThreshold: this.performanceConfig.healthMonitor.successRateThreshold,
          })
        : globalHealthMonitor;
    }
  }

  /**
    * Initialize the provider with the given configuration
    */
   initialize(config?: IProviderConfig): void {
    if (config) {
      this.config = config;
      this.performanceConfig = extractPerformanceConfig(config);
      this.memoryConfig = this.extractEffectiveMemoryConfig(config);
      this.initializeComponents();
    }

    // Initialize the underlying LLM client (implemented by subclasses, synchronous)
    this.initializeClient();

    // Initialize memory system if enabled (synchronous)
    if (this.memoryConfig.enableChatMemory || this.memoryConfig.enableEmbeddingMemory) {
      this.initializeMemorySystem();
    }

    this.isInitialized = true;

    // Start health monitoring if enabled (check if not already monitoring)
    if (this.performanceConfig.enableHealthMonitoring && this.healthMonitor) {
       // Only start monitoring if not already being monitored
       const existingHealth = this.healthMonitor.getProviderHealth(this);
       if (!existingHealth) {
         this.healthMonitor.startMonitoring(this);
       }
     }

    logInfo('UnifiedLLMProvider initialized', {
      component: 'UnifiedLLMProvider',
      providerType: this.getProviderType(),
      featuresEnabled: {
        connectionPooling: this.performanceConfig.enableConnectionPooling,
        caching: this.performanceConfig.enableCaching,
        healthMonitoring: this.performanceConfig.enableHealthMonitoring,
        chatMemory: this.memoryConfig.enableChatMemory,
        embeddingMemory: this.memoryConfig.enableEmbeddingMemory,
        memoryProcessingMode: this.memoryConfig.memoryProcessingMode,
      },
    });
  }

  /**
   * Initialize the underlying LLM client (implemented by subclasses, synchronous)
   */
 protected abstract initializeClient(): void;

  /**
     * Initialize the memory management system (synchronous)
     * Note: Memori instance should be provided externally to avoid recursion
     */
  private initializeMemorySystem(): void {
    try {
      // Skip if no external Memori provided (avoiding recursion)
      if (!this.memori) {
        logInfo('Skipping memory system initialization - no external Memori provided', {
          component: 'UnifiedLLMProvider',
          providerType: this.getProviderType(),
          processingMode: this.memoryConfig.memoryProcessingMode,
        });
        return;
      }

      // Initialize MemoryAgent for sophisticated processing using existing Memori's database
      // The MemoryAgent will create its own analysis provider to avoid recursion
      if (!this.memoryAgent) {
        this.memoryAgent = new MemoryAgent(this, this.memori.getDatabaseManager());
      }

      logInfo('Memory system initialized with external Memori', {
        component: 'UnifiedLLMProvider',
        providerType: this.getProviderType(),
        processingMode: this.memoryConfig.memoryProcessingMode,
        reusedMemori: true,
      });
    } catch (error) {
      logError('Failed to initialize memory system', {
        component: 'UnifiedLLMProvider',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Dispose of the provider and clean up resources
   */
  async dispose(): Promise<void> {
    if (this.healthMonitor) {
      this.healthMonitor.stopMonitoring(this);
    }

    if (this.connectionPool && this.connectionPool !== globalConnectionPool) {
      await this.connectionPool.dispose();
    }

    await this.disposeClient();

    this.isInitialized = false;

    logInfo('UnifiedLLMProvider disposed', {
      component: 'UnifiedLLMProvider',
      providerType: this.getProviderType(),
      totalRequests: this.metrics.totalRequests,
      cacheHits: this.metrics.cacheHits,
      cacheMisses: this.metrics.cacheMisses,
      memoryRecordingSuccess: this.metrics.memoryRecordingSuccess,
      memoryRecordingFailures: this.metrics.memoryRecordingFailures,
    });
  }

  /**
   * Dispose of the underlying LLM client (implemented by subclasses)
   */
  protected abstract disposeClient(): Promise<void>;

  /**
   * Check if the provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      return await this.checkClientHealth();
    } catch (error) {
      return false;
    }
  }

  /**
   * Check the health of the underlying LLM client (implemented by subclasses)
   */
  protected abstract checkClientHealth(): Promise<boolean>;

  /**
   * Get comprehensive diagnostics
   */
  async getDiagnostics(): Promise<ProviderDiagnostics> {
    const baseDiagnostics = await this.getBaseDiagnostics();

    return {
      providerType: this.getProviderType(),
      isInitialized: this.isInitialized,
      isHealthy: await this.isHealthy(),
      model: this.getModel(),
      metadata: {
        ...baseDiagnostics,
        unified: true,
        features: {
          performance: {
            connectionPooling: this.performanceConfig.enableConnectionPooling,
            caching: this.performanceConfig.enableCaching,
            healthMonitoring: this.performanceConfig.enableHealthMonitoring,
          },
          memory: {
            chatMemory: this.memoryConfig.enableChatMemory,
            embeddingMemory: this.memoryConfig.enableEmbeddingMemory,
            processingMode: this.memoryConfig.memoryProcessingMode,
          },
        },
        metrics: this.metrics,
        connectionPool: this.connectionPool?.getPoolStats(),
        cache: this.requestCache?.getStats(),
        health: this.healthMonitor?.getProviderHealth(this),
      },
      timestamp: new Date(),
    };
  }

  /**
   * Get base diagnostics from the underlying client (implemented by subclasses)
   */
  protected abstract getBaseDiagnostics(): Promise<Record<string, any>>;

  /**
   * Get the current model
   */
  abstract getModel(): string;

  /**
   * Get the provider type
   */
  abstract getProviderType(): ProviderType;

  /**
   * Get the provider configuration
   */
  getConfig(): IProviderConfig {
    return { ...this.config };
  }

  /**
   * Get the underlying client (for backward compatibility)
   */
  abstract getClient(): any;

  /**
   * Create a chat completion with integrated performance and memory features
   */
  async createChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    if (!this.isInitialized) {
      throw new Error('UnifiedLLMProvider not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // 1. DISABLE cache checking for now to prevent recursion
      // if (this.performanceConfig.enableCaching && this.requestCache) {
      //   const cachedResponse = this.requestCache.getChatCompletion(params);
      //   if (cachedResponse) {
      //     this.metrics.cacheHits++;
      //     this.recordHealthMetrics(true, Date.now() - startTime);
      //     return cachedResponse;
      //   }
      //   this.metrics.cacheMisses++;
      // }

      // 2. DISABLE connection pooling for now to prevent recursion issues
      let providerToUse: ILLMProvider = this;
      // Temporarily disable connection pooling to isolate the recursion issue
      // if (this.performanceConfig.enableConnectionPooling && this.connectionPool) {
      //   try {
      //     providerToUse = await this.connectionPool.getConnection(
      //       this.getProviderType(),
      //       this.config
      //     );
      //   } catch (error) {
      //     logInfo('Connection pool failed, using direct provider', {
      //       component: 'UnifiedLLMProvider',
      //       providerType: this.getProviderType(),
      //       error: error instanceof Error ? error.message : String(error),
      //     });
      //     providerToUse = this;
      //   }
      // }

      // 3. Execute the actual chat completion
      // Since providerToUse is 'this' (UnifiedLLMProvider), we need to call the concrete subclass implementation
      // Cast to 'any' to access the executeChatCompletion method implemented by subclasses
      const response = await (providerToUse as any).executeChatCompletion(params);
      const responseTime = Date.now() - startTime;

      // 4. DISABLE memory processing for now to prevent recursion
      // if (this.memoryConfig.enableChatMemory && providerToUse === this) {
      //   await this.processChatMemory(params, response);
      // }

      // 5. DISABLE caching for now to prevent recursion
      // if (this.performanceConfig.enableCaching && this.requestCache && providerToUse === this) {
      //   this.requestCache.setChatCompletion(
      //     params,
      //     response,
      //     this.performanceConfig.cacheTTL.chat
      //   );
      // }

      // 6. Record metrics (health monitoring)
      this.recordHealthMetrics(true, responseTime);

      // 7. Return connection to pool if using pooling
      if (this.performanceConfig.enableConnectionPooling &&
          this.connectionPool &&
          providerToUse !== this) {
        try {
          await this.connectionPool.returnConnection(providerToUse);
        } catch (error) {
          logWarn('Failed to return connection to pool', {
            component: 'UnifiedLLMProvider',
            providerType: this.getProviderType(),
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Only log completions occasionally to reduce noise (every 10 requests)
      if (this.metrics.totalRequests % 10 === 0) {
        logInfo('Chat completion completed', {
          component: 'UnifiedLLMProvider',
          providerType: this.getProviderType(),
          responseTime,
          cached: false,
          tokensUsed: response.usage?.total_tokens,
          model: params.model || this.getModel(),
          totalRequests: this.metrics.totalRequests,
        });
      }

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed request for health monitoring
      this.recordHealthMetrics(false, responseTime, error instanceof Error ? error.message : String(error));

      logError('Chat completion failed', {
        component: 'UnifiedLLMProvider',
        providerType: this.getProviderType(),
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        model: params.model || this.getModel(),
      });

      throw error;
    }
  }

  /**
   * Create an embedding with integrated performance and memory features
   */
  async createEmbedding(params: EmbeddingParams): Promise<EmbeddingResponse> {
    if (!this.isInitialized) {
      throw new Error('UnifiedLLMProvider not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // 1. Check cache first if enabled (performance optimization)
      if (this.performanceConfig.enableCaching && this.requestCache) {
        const cachedResponse = this.requestCache.getEmbedding(params);
        if (cachedResponse) {
          this.metrics.cacheHits++;
          this.recordHealthMetrics(true, Date.now() - startTime);
          return cachedResponse;
        }
        this.metrics.cacheMisses++;
      }

      // 2. Get provider from connection pool if enabled (performance optimization)
      let providerToUse: ILLMProvider = this;
      if (this.performanceConfig.enableConnectionPooling && this.connectionPool) {
        providerToUse = await this.connectionPool.getConnection(
          this.getProviderType(),
          this.config
        );
      }

      // 3. Execute the actual embedding request
      const response = await providerToUse.createEmbedding(params);
      const responseTime = Date.now() - startTime;

      // 4. Process memory if enabled (memory capability)
      if (this.memoryConfig.enableEmbeddingMemory) {
        await this.processEmbeddingMemory(params, response);
      }

      // 5. Cache the response if enabled (performance optimization)
      if (this.performanceConfig.enableCaching && this.requestCache) {
        this.requestCache.setEmbedding(
          params,
          response,
          this.performanceConfig.cacheTTL.embedding
        );
      }

      // 6. Record metrics (health monitoring)
      this.recordHealthMetrics(true, responseTime);

      // 7. Return connection to pool if using pooling
      if (this.performanceConfig.enableConnectionPooling &&
          this.connectionPool &&
          providerToUse !== this) {
        await this.connectionPool.returnConnection(providerToUse);
      }

      logInfo('Embedding completed', {
        component: 'UnifiedLLMProvider',
        providerType: this.getProviderType(),
        responseTime,
        cached: false,
        embeddingCount: response.data.length,
        tokensUsed: response.usage?.total_tokens,
        model: params.model || 'text-embedding-3-small',
      });

      return response;

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // Record failed request for health monitoring
      this.recordHealthMetrics(false, responseTime, error instanceof Error ? error.message : String(error));

      logError('Embedding failed', {
        component: 'UnifiedLLMProvider',
        providerType: this.getProviderType(),
        responseTime,
        error: error instanceof Error ? error.message : String(error),
        model: params.model || 'text-embedding-3-small',
      });

      throw error;
    }
  }

  /**
    * Process chat memory using the integrated MemoryAgent
    */
  private async processChatMemory(
    params: ChatCompletionParams,
    response: ChatCompletionResponse
  ): Promise<void> {
    if (!this.memoryAgent || !this.memori) {
      return;
    }

    const memoryStartTime = Date.now();

    try {
      // Extract user message for memory processing
      const messages = params.messages;
      const lastUserMessage = messages
        .slice()
        .reverse()
        .find(msg => msg.role === 'user');
      const userInput = lastUserMessage?.content?.toString() || '';
      const aiOutput = response.message?.content || '';

      // Generate chat ID for this conversation
      const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Temporarily disable memory processing to prevent infinite recursion
      // The MemoryAgent will use the LLM provider for analysis, which would trigger more memory processing
      const originalMemoryConfig = this.memoryConfig;
      this.memoryConfig = {
        ...this.memoryConfig,
        enableChatMemory: false, // Disable to prevent recursion
      };

      try {
        // Use MemoryAgent for sophisticated processing
        const processedMemory = await this.memoryAgent.processConversation({
          chatId,
          userInput,
          aiOutput,
          context: {
            sessionId: this.memoryConfig.sessionId || 'default-session',
            conversationId: chatId,
            modelUsed: params.model || this.getModel(),
            userPreferences: [],
            currentProjects: [],
            relevantSkills: [],
          },
        });

        // Store the processed memory using Memori's database manager
        await this.memori.storeProcessedMemory(processedMemory, chatId);

        this.metrics.memoryRecordingSuccess++;

        // Only log occasionally to reduce noise
        if (this.metrics.memoryRecordingSuccess % 10 === 0) {
          logInfo('Chat memory processed', {
            component: 'UnifiedLLMProvider',
            providerType: this.getProviderType(),
            chatId,
            classification: processedMemory.classification,
            importance: processedMemory.importance,
            entitiesCount: processedMemory.entities.length,
            relationshipsCount: processedMemory.relatedMemories?.length || 0,
          });
        }

      } finally {
        // Restore original memory configuration
        this.memoryConfig = originalMemoryConfig;
      }

      const memoryDuration = Date.now() - memoryStartTime;
      const totalRequests = this.metrics.totalRequests;
      this.metrics.averageMemoryProcessingTime =
        (this.metrics.averageMemoryProcessingTime * (totalRequests - 1) + memoryDuration) / totalRequests;

    } catch (error) {
      this.metrics.memoryRecordingFailures++;
      logError('Failed to process chat memory', {
        component: 'UnifiedLLMProvider',
        error: error instanceof Error ? error.message : String(error),
        providerType: this.getProviderType(),
      });
    }
  }

  /**
    * Process embedding memory using the integrated MemoryAgent
    */
  private async processEmbeddingMemory(
    params: EmbeddingParams,
    response: EmbeddingResponse
  ): Promise<void> {
    if (!this.memoryAgent || !this.memori) {
      return;
    }

    const memoryStartTime = Date.now();

    try {
      // Create summary of embedding input
      const input = params.input;
      let inputSummary: string;
      if (Array.isArray(input)) {
        if (input.length === 0) inputSummary = '';
        else if (input.length === 1) inputSummary = String(input[0]);
        else inputSummary = `${String(input[0])}... (+${input.length - 1} more items)`;
      } else {
        inputSummary = String(input);
      }

      // Generate chat ID for this embedding request
      const chatId = `embedding_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Temporarily disable memory processing to prevent infinite recursion
      const originalMemoryConfig = this.memoryConfig;
      this.memoryConfig = {
        ...this.memoryConfig,
        enableEmbeddingMemory: false, // Disable to prevent recursion
      };

      try {
        // Use MemoryAgent for sophisticated processing of embedding request
        const processedMemory = await this.memoryAgent.processConversation({
          chatId,
          userInput: `Embedding request: ${inputSummary}`,
          aiOutput: `Generated ${response.data.length} embeddings with ${response.data[0]?.embedding?.length || 0} dimensions`,
          context: {
            sessionId: this.memoryConfig.sessionId || 'default-session',
            conversationId: chatId,
            modelUsed: params.model || 'text-embedding-3-small',
            userPreferences: [],
            currentProjects: [],
            relevantSkills: [],
          },
        });

        // Store the processed memory using Memori's database manager
        await this.memori.storeProcessedMemory(processedMemory, chatId);

        this.metrics.memoryRecordingSuccess++;

        // Only log occasionally to reduce noise
        if (this.metrics.memoryRecordingSuccess % 10 === 0) {
          logInfo('Embedding memory processed', {
            component: 'UnifiedLLMProvider',
            providerType: this.getProviderType(),
            chatId,
            classification: processedMemory.classification,
            importance: processedMemory.importance,
            entitiesCount: processedMemory.entities.length,
          });
        }

      } finally {
        // Restore original memory configuration
        this.memoryConfig = originalMemoryConfig;
      }

      const memoryDuration = Date.now() - memoryStartTime;
      const totalRequests = this.metrics.totalRequests;
      this.metrics.averageMemoryProcessingTime =
        (this.metrics.averageMemoryProcessingTime * (totalRequests - 1) + memoryDuration) / totalRequests;

    } catch (error) {
      this.metrics.memoryRecordingFailures++;
      logError('Failed to process embedding memory', {
        component: 'UnifiedLLMProvider',
        error: error instanceof Error ? error.message : String(error),
        providerType: this.getProviderType(),
      });
    }
  }

  /**
   * Record health metrics for monitoring
   */
  private recordHealthMetrics(
    success: boolean,
    responseTime: number,
    errorMessage?: string
  ): void {
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;

    if (this.healthMonitor) {
      this.healthMonitor.recordRequestResult(
        this,
        success,
        responseTime,
        errorMessage
      );
    }
  }

  /**
   * Update memory configuration at runtime
   */
  updateMemoryConfig(config: Partial<IProviderConfig['memory']>): void {
    if (config && this.config.memory) {
      this.config.memory = { ...this.config.memory, ...config };
      this.memoryConfig = extractLegacyMemoryConfig(this.config);

      logInfo('UnifiedLLMProvider memory configuration updated', {
        component: 'UnifiedLLMProvider',
        providerType: this.getProviderType(),
        enableChatMemory: this.memoryConfig.enableChatMemory,
        enableEmbeddingMemory: this.memoryConfig.enableEmbeddingMemory,
        memoryProcessingMode: this.memoryConfig.memoryProcessingMode,
      });
    }
  }

  /**
   * Get comprehensive performance and memory statistics
   */
  getStats(): {
    performance?: any;
    memory?: any;
    health?: any;
    metrics: {
      totalRequests: number;
      cacheHits: number;
      cacheMisses: number;
      memoryRecordingSuccess: number;
      memoryRecordingFailures: number;
      averageResponseTime: number;
      averageMemoryProcessingTime: number;
    };
  } {
    return {
      performance: {
        connectionPool: this.connectionPool?.getPoolStats(),
        cache: this.requestCache?.getStats(),
      },
      memory: this.memori ? {
        totalMemories: 0, // Would need to implement in Memori
        processingMode: this.memoryConfig.memoryProcessingMode,
      } : undefined,
      health: this.healthMonitor?.getProviderHealth(this),
      metrics: this.metrics,
    };
  }
}