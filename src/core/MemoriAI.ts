/**
 * MemoriAI - Unified API for Sophisticated Memory-Enabled LLM Operations
 *
 * This class provides a clean, unified interface for LLM operations with
 * integrated memory capabilities, eliminating the need for separate provider wrappers.
 *
 * Design Features:
 * - Single class for all LLM providers (OpenAI, Anthropic, Ollama)
 * - Simple configuration interface with access to sophisticated options
 * - Intelligent provider auto-detection from API key patterns
 * - Unified API methods with integrated memory processing
 * - Leverages existing sophisticated infrastructure
 */

import { v4 as uuidv4 } from 'uuid';
import { ProviderType } from './infrastructure/providers/ProviderType';
import { IProviderConfig, DEFAULT_PERFORMANCE_CONFIG, DEFAULT_MEMORY_CONFIG } from './infrastructure/providers/IProviderConfig';
import { MemoryEnabledLLMProvider } from './infrastructure/providers/MemoryEnabledLLMProvider';
import { ILLMProvider } from './infrastructure/providers/ILLMProvider';
import { Memori } from './Memori';
import { MemoriConfig } from './infrastructure/config/ConfigManager';
import { logInfo, logError } from './infrastructure/config/Logger';
import { MemoryImportanceLevel, MemoryClassification } from './types/schemas';
import { MemoryAgent } from './domain/memory/MemoryAgent';
import { ConsciousAgent } from './domain/memory/ConsciousAgent';

// Import simplified configuration types
import {
  MemoriAIConfig,
  ChatParams,
  ChatResponse,
  SearchOptions,
  MemorySearchResult,
  EmbeddingParams,
  EmbeddingResponse,
  ProviderInfo
} from './MemoriAIConfig';

/**
 * Unified MemoriAI class that eliminates all provider wrapper complexity
 */
export class MemoriAI {
  private providerType: ProviderType;
  private config: IProviderConfig;     // Internal complex config
  private mode: 'automatic' | 'manual' | 'conscious';

  // Dual-provider architecture to prevent circular dependencies
  private userProvider?: MemoryEnabledLLMProvider;     // For user chat() calls
  private memoryProvider?: ILLMProvider;               // For internal memory processing

  private memori: Memori;
  private memoryAgent?: MemoryAgent;
  private consciousAgent?: ConsciousAgent;

  private sessionId: string;
  private initialized: boolean = false;
  private initializing: boolean = false;

  // Conscious mode features
  private backgroundInterval?: ReturnType<typeof setInterval>;
  private backgroundUpdateInterval: number = 30000; // 30 seconds default

  constructor(config: MemoriAIConfig) {
    this.sessionId = uuidv4();

    // Set mode with default
    this.mode = config.mode || 'automatic';

    // Auto-detect provider from simple config
    this.providerType = this.detectProvider(config);

    // Convert simple config to complex internal config
    this.config = this.simplifyConfiguration(config);

    logInfo('MemoriAI constructor started', {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      mode: this.mode,
      providerType: this.providerType,
      databaseUrl: config.databaseUrl,
      model: this.config.model,
      namespace: this.config.features?.memory?.sessionId,
    });

    // Create Memori instance for database operations
    this.memori = new Memori(this.buildMemoriConfig(config));

    // Initialize asynchronously to avoid race conditions
    this.initializeSync().catch(error => {
      logError('MemoriAI initialization failed', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    });

    logInfo('MemoriAI constructor completed', {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      mode: this.mode,
      initialized: this.initialized,
      initializing: this.initializing,
    });
  }

  /**
   * Complete initialization after construction
   */
  async initialize(): Promise<void> {
    await this.initializeSync();
  }

  /**
   * Unified chat API - works with any provider internally
   */
 async chat(params: ChatParams): Promise<ChatResponse> {
   await this.ensureInitialized();

   try {
     // Convert simplified params to provider format
     const providerParams = {
       messages: params.messages,
       model: params.model || this.config.model,
       temperature: params.temperature,
       max_tokens: params.maxTokens,
       stream: params.stream,
       options: params.options,
     };

     // Use appropriate provider based on mode
     const provider = this.userProvider!;
     const response = await provider.createChatCompletion(providerParams);

     // Convert response to unified format
     return {
       message: response.message,
       finishReason: response.finish_reason || 'stop',
       usage: response.usage ? {
         promptTokens: response.usage.prompt_tokens,
         completionTokens: response.usage.completion_tokens,
         totalTokens: response.usage.total_tokens,
       } : undefined,
       id: response.id,
       model: response.model,
       created: response.created,
     };

   } catch (error) {
     this.logOperationError('Chat completion', error);
     throw error;
   }
 }

  /**
   * Unified memory search API - works across all providers
   */
  async searchMemories(query: string, options: SearchOptions = {}): Promise<MemorySearchResult[]> {
    try {
      // Convert simplified options to internal format
      const convertedOptions = this.convertSearchOptions(options);
      return await this.memori.searchMemories(query, convertedOptions);
    } catch (error) {
      this.logOperationError('Memory search', error, { query });
      throw error;
    }
  }

  /**
   * Unified embeddings API - works with any provider internally
   */
  async createEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
    await this.ensureInitialized();

    try {
      // Use user provider for embeddings
      const response = await this.userProvider!.createEmbedding({
        input: params.input,
        model: params.model,
        encoding_format: params.encodingFormat,
        dimensions: params.dimensions,
        user: params.user,
      });

      return {
        embeddings: response.data.map(d => d.embedding),
        usage: response.usage ? {
          promptTokens: response.usage.prompt_tokens,
          totalTokens: response.usage.total_tokens,
        } : undefined,
        model: response.model,
        id: response.id || `embedding_${Date.now()}`,
        created: response.created || Date.now(),
      };

    } catch (error) {
      logError('Embedding creation failed', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        providerType: this.providerType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unified close API - cleans up all resources
   */
  async close(): Promise<void> {
    try {
      // Stop background monitoring first
      this.stopBackgroundMonitoring();

      // Close user provider if initialized
      if (this.userProvider) {
        await this.userProvider.dispose();
      }

      // Close memory provider if initialized
      if (this.memoryProvider && this.memoryProvider !== this.userProvider) {
        await this.memoryProvider.dispose();
      }

      // Close Memori instance
      await this.memori.close();

      logInfo('MemoriAI closed successfully', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        mode: this.mode,
      });

    } catch (error) {
      logError('Error during MemoriAI close', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        mode: this.mode,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get current session ID
   */
  getSessionId(): string {
    return this.sessionId;
  }

  /**
    * Get detected provider type
    */
   getProviderType(): ProviderType {
     return this.providerType;
   }

   /**
    * Get current operating mode
    */
   getMode(): 'automatic' | 'manual' | 'conscious' {
     return this.mode;
   }

   /**
    * Manual conversation recording (for manual/conscious modes)
    */
   async recordConversation(
     userInput: string,
     aiOutput: string,
     options?: {
       model?: string;
       metadata?: Record<string, any>;
       namespace?: string;
     }
   ): Promise<string> {
     if (this.mode === 'automatic') {
       throw new Error('recordConversation() only available in manual/conscious modes. Use chat() for automatic mode.');
     }

     const chatId = uuidv4();

     try {
       await this.memori.recordConversation(userInput, aiOutput, options);

       // Process memory if in manual mode
       if (this.mode === 'manual') {
         await this.processMemory(chatId);
       }

       logInfo(`Conversation recorded manually: ${chatId}`, {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         mode: this.mode,
         chatId,
       });

       return chatId;
     } catch (error) {
       logError('Failed to record conversation manually', {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         error: error instanceof Error ? error.message : String(error),
       });
       throw error;
     }
   }

   /**
    * Manual memory processing trigger (for manual mode)
    */
   async processMemory(chatId: string): Promise<void> {
     if (this.mode === 'automatic') {
       throw new Error('processMemory() only available in manual mode.');
     }

     if (!this.memoryAgent) {
       await this.initializeMemoryAgent();
     }

     try {
       const chatHistoryManager = (this.memori.getDatabaseManager() as any).chatHistoryManager;
       if (!chatHistoryManager) {
         throw new Error('ChatHistoryManager not available');
       }

       const chatHistory = await chatHistoryManager.getChatHistory(chatId);
       if (!chatHistory) {
         throw new Error(`Chat history not found: ${chatId}`);
       }

       const processedMemory = await this.memoryAgent!.processConversation({
         chatId,
         userInput: chatHistory.userInput,
         aiOutput: chatHistory.aiOutput,
         context: {
           conversationId: chatId,
           sessionId: this.sessionId,
           modelUsed: chatHistory.model || this.config.model,
           userPreferences: [],
           currentProjects: [],
           relevantSkills: [],
         },
       });

       await this.memori.storeProcessedMemory(processedMemory, chatId);

       logInfo(`Memory processed manually for chat ${chatId}`, {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         chatId,
         mode: this.mode,
       });
     } catch (error) {
       logError(`Failed to process memory manually for chat ${chatId}`, {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         chatId,
         error: error instanceof Error ? error.message : String(error),
       });
       throw error;
     }
   }

   /**
    * Check for conscious context updates (for conscious mode)
    */
   async checkForConsciousContextUpdates(): Promise<void> {
     if (this.mode !== 'conscious') {
       throw new Error('checkForConsciousContextUpdates() only available in conscious mode.');
     }

     if (!this.consciousAgent) {
       throw new Error('ConsciousAgent not initialized');
     }

     try {
       await this.consciousAgent.check_for_context_updates();

       logInfo('Conscious context updates checked', {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         mode: this.mode,
       });
     } catch (error) {
       logError('Error checking for conscious context updates', {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         error: error instanceof Error ? error.message : String(error),
       });
       throw error;
     }
   }

   /**
    * Initialize conscious context from existing memories (for conscious mode)
    */
   async initializeConsciousContext(): Promise<void> {
     if (this.mode !== 'conscious') {
       throw new Error('initializeConsciousContext() only available in conscious mode.');
     }

     if (!this.consciousAgent) {
       throw new Error('ConsciousAgent not initialized');
     }

     try {
       await this.consciousAgent.initialize_existing_conscious_memories();

       logInfo('Conscious context initialized', {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         mode: this.mode,
       });
     } catch (error) {
       logError('Error initializing conscious context', {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         error: error instanceof Error ? error.message : String(error),
       });
       throw error;
     }
   }

   /**
    * Get the ConsciousAgent instance (for advanced usage in conscious mode)
    */
   getConsciousAgent(): ConsciousAgent | undefined {
     if (this.mode !== 'conscious') {
       throw new Error('getConsciousAgent() only available in conscious mode.');
     }
     return this.consciousAgent;
   }

   /**
    * Check if conscious mode is currently enabled
    */
   isConsciousModeEnabled(): boolean {
     return this.mode === 'conscious' && this.consciousAgent !== undefined;
   }

   /**
    * Check if manual mode is currently enabled
    */
   isManualModeEnabled(): boolean {
     return this.mode === 'manual';
   }

   /**
    * Get the ConsolidationService instance for advanced consolidation operations
    */
   getConsolidationService() {
     return this.memori.getConsolidationService();
   }

   /**
    * Get comprehensive memory statistics for the current namespace
    */
   async getMemoryStatistics(namespace?: string) {
     return this.memori.getMemoryStatistics(namespace);
   }

   /**
    * Search memories with specific strategy (advanced search)
    */
   async searchMemoriesWithStrategy(
     query: string,
     strategy: any,
     options: SearchOptions = {}
   ): Promise<MemorySearchResult[]> {
     // Convert SearchOptions to match models.ts format
     const convertedOptions = this.convertSearchOptions(options);
     return this.memori.searchMemoriesWithStrategy(query, strategy, convertedOptions);
   }

   /**
    * Get available search strategies
    */
   async getAvailableSearchStrategies() {
     return this.memori.getAvailableSearchStrategies();
   }

   /**
    * Start background monitoring for conscious updates (conscious mode only)
    */
   private startBackgroundMonitoring(): void {
     if (this.mode !== 'conscious') return;

     if (this.backgroundInterval) {
       clearInterval(this.backgroundInterval);
     }

     logInfo(`Starting background monitoring with ${this.backgroundUpdateInterval}ms interval`, {
       component: 'MemoriAI',
       sessionId: this.sessionId,
       mode: this.mode,
       intervalMs: this.backgroundUpdateInterval,
     });

     this.backgroundInterval = setInterval(async () => {
       try {
         await this.checkForConsciousContextUpdates();
       } catch (error) {
         logError('Error in background monitoring', {
           component: 'MemoriAI',
           sessionId: this.sessionId,
           mode: this.mode,
           error: error instanceof Error ? error.message : String(error),
         });
       }
     }, this.backgroundUpdateInterval);
   }

   /**
    * Stop background monitoring
    */
   private stopBackgroundMonitoring(): void {
     if (this.backgroundInterval) {
       clearInterval(this.backgroundInterval);
       this.backgroundInterval = undefined;
       logInfo('Background monitoring stopped', {
         component: 'MemoriAI',
         sessionId: this.sessionId,
         mode: this.mode,
       });
     }
   }

   /**
    * Initialize memory agent for manual processing
    */
   private async initializeMemoryAgent(): Promise<void> {
     if (this.memoryAgent) return;

     logInfo('Initializing MemoryAgent for manual processing', {
       component: 'MemoriAI',
       sessionId: this.sessionId,
       mode: this.mode,
     });

     this.memoryAgent = new MemoryAgent(this.memoryProvider!);
   }

   /**
    * Initialize conscious mode components
    */
   private async initializeConsciousMode(): Promise<void> {
     logInfo('Initializing ConsciousAgent for conscious mode', {
       component: 'MemoriAI',
       sessionId: this.sessionId,
       mode: this.mode,
     });

     // Initialize memory agent first
     await this.initializeMemoryAgent();

     // Initialize conscious agent
      this.consciousAgent = new ConsciousAgent(this.memori.getDatabaseManager(), this.config.features?.memory?.sessionId || this.sessionId);

     // Start background monitoring
     this.startBackgroundMonitoring();

     logInfo('Conscious mode initialized successfully', {
       component: 'MemoriAI',
       sessionId: this.sessionId,
       mode: this.mode,
     });
   }

  /**
   * Smart provider auto-detection from minimal configuration
   */
  private detectProvider(config: MemoriAIConfig): ProviderType {
    // Check explicit provider field first (highest priority)
    if (config.provider === 'anthropic') return ProviderType.ANTHROPIC;
    if (config.provider === 'openai') return ProviderType.OPENAI;
    if (config.provider === 'ollama') return ProviderType.OLLAMA;

    // Then check API key patterns
    if (config.apiKey?.startsWith('sk-ant-')) return ProviderType.ANTHROPIC;
    if (config.apiKey?.startsWith('sk-') && config.apiKey.length > 20) return ProviderType.OPENAI;
    if (config.apiKey === 'ollama-local') return ProviderType.OLLAMA;

    // Default to OpenAI
    return ProviderType.OPENAI;
  }

  /**
    * Convert simple user config to complex internal config with mode optimization
    */
   private simplifyConfiguration(userConfig: MemoriAIConfig): IProviderConfig {
     // Get smart defaults for the detected provider
     const providerDefaults = this.getProviderDefaults(this.providerType);

     // Generate session ID if not provided
     const sessionId = userConfig.namespace || `memoriai_${Date.now()}`;

     // Optimize configuration based on mode
     const { performanceConfig, memoryConfig } = this.getOptimizedConfigs(userConfig.mode || 'automatic', sessionId);

     return {
       apiKey: userConfig.apiKey || this.getDefaultApiKey(this.providerType),
       model: userConfig.model || providerDefaults.defaultModel,
       baseUrl: userConfig.baseUrl || providerDefaults.baseUrl,

       features: {
         performance: performanceConfig,
         memory: memoryConfig
       }
     };
   }

   /**
    * Get optimized configurations based on operating mode
    */
   private getOptimizedConfigs(mode: 'automatic' | 'manual' | 'conscious', sessionId: string) {
     const basePerformanceConfig = {
       ...DEFAULT_PERFORMANCE_CONFIG,
       enableHealthMonitoring: true, // Always enable health monitoring
     };

     const baseMemoryConfig = {
       ...DEFAULT_MEMORY_CONFIG,
       sessionId,
       enableEmbeddingMemory: false,
       minImportanceLevel: 'all' as const,
     };

     switch (mode) {
       case 'automatic':
         return {
           performanceConfig: {
             ...basePerformanceConfig,
             // High performance for automatic mode
             enableConnectionPooling: true,
             enableCaching: true,
           },
           memoryConfig: {
             ...baseMemoryConfig,
             enableChatMemory: true,
             memoryProcessingMode: 'auto' as const,
           }
         };

       case 'manual':
         return {
           performanceConfig: {
             ...basePerformanceConfig,
             // Moderate performance for manual mode
             enableConnectionPooling: false,
             enableCaching: false,
           },
           memoryConfig: {
             ...baseMemoryConfig,
             enableChatMemory: false, // Manual control
             memoryProcessingMode: 'none' as const, // Manual control - no auto processing
           }
         };

       case 'conscious':
         return {
           performanceConfig: {
             ...basePerformanceConfig,
             // Balanced performance for conscious mode
             enableConnectionPooling: true,
             enableCaching: true,
           },
           memoryConfig: {
             ...baseMemoryConfig,
             enableChatMemory: false, // Conscious control
             memoryProcessingMode: 'conscious' as const,
           }
         };

       default:
         return {
           performanceConfig: basePerformanceConfig,
           memoryConfig: baseMemoryConfig
         };
     }
   }

  /**
   * Get default configuration for each provider type
   */
  private getProviderDefaults(providerType: ProviderType): ProviderInfo {
    const defaults: Record<ProviderType, ProviderInfo> = {
      [ProviderType.OPENAI]: {
        type: ProviderType.OPENAI,
        name: 'OpenAI',
        defaultModel: 'gpt-4o-mini',
        baseUrl: 'https://api.openai.com/v1',
      },
      [ProviderType.ANTHROPIC]: {
        type: ProviderType.ANTHROPIC,
        name: 'Anthropic',
        defaultModel: 'claude-3-5-sonnet-20241022',
        baseUrl: 'https://api.anthropic.com',
      },
      [ProviderType.OLLAMA]: {
        type: ProviderType.OLLAMA,
        name: 'Ollama',
        defaultModel: 'llama2',
        baseUrl: 'http://localhost:11434',
      },
    };

    return defaults[providerType];
  }

  /**
   * Get default API key for provider (from environment)
   */
  private getDefaultApiKey(providerType: ProviderType): string {
    const envVars = {
      [ProviderType.OPENAI]: 'OPENAI_API_KEY',
      [ProviderType.ANTHROPIC]: 'ANTHROPIC_API_KEY',
      [ProviderType.OLLAMA]: 'ollama-local', // Special case for Ollama
    };

    const envKey = envVars[providerType];
    return process.env[envKey] || `${providerType}-dummy-key`;
  }

  /**
   * Build Memori configuration from simple config with mode support
   */
  private buildMemoriConfig(userConfig: MemoriAIConfig): MemoriAIConfig {
    return {
      databaseUrl: userConfig.databaseUrl,
      apiKey: userConfig.apiKey,
      model: userConfig.model || this.getDefaultModel(),
      namespace: userConfig.namespace,
      mode: userConfig.mode || 'automatic', // Pass the mode to Memori
    };
  }

  /**
   * Get default model for current provider
   */
  private getDefaultModel(): string {
    return this.getProviderDefaults(this.providerType).defaultModel;
  }

  /**
    * Initialize providers with dual-provider architecture
    */
  private async initializeProviders(): Promise<void> {
    logInfo('Initializing dual-provider architecture', {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      mode: this.mode,
      providerType: this.providerType,
    });

    // Create the base provider for the detected provider type
    const ProviderClass = this.getProviderClass(this.providerType);
    const baseProvider = new ProviderClass(this.config);
    baseProvider.initialize(this.config);

    // Create user provider (MemoryEnabledLLMProvider for chat() calls)
    this.userProvider = new MemoryEnabledLLMProvider(baseProvider, this.config);

    // Create separate memory provider (basic provider for internal processing)
    // This prevents circular dependencies during memory analysis
    const memoryConfig = { ...this.config };
    memoryConfig.features = {
      ...memoryConfig.features,
      memory: {
        ...memoryConfig.features?.memory,
        enableChatMemory: false, // Disable to prevent recursion
      }
    };
    const memoryBaseProvider = new ProviderClass(memoryConfig);
    memoryBaseProvider.initialize(memoryConfig);
    this.memoryProvider = memoryBaseProvider;

    // Initialize user provider with existing Memori instance
    this.userProvider.initialize(this.config, this.memori);

    logInfo('Dual-provider architecture initialized', {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      mode: this.mode,
      providerType: this.providerType,
    });
  }

  /**
   * Initialize mode-specific components
   */
  private async initializeModeComponents(): Promise<void> {
    switch (this.mode) {
      case 'manual':
        await this.initializeMemoryAgent();
        break;
      case 'conscious':
        await this.initializeConsciousMode();
        break;
      case 'automatic':
      default:
        // No additional components needed for automatic mode
        break;
    }
  }

  /**
    * Initialize the provider infrastructure (synchronous version for constructor)
    */
  private async initializeSync(): Promise<void> {
    // Prevent double initialization
    if (this.initialized) {
      logInfo('MemoriAI already initialized, skipping', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        initialized: this.initialized,
        initializing: this.initializing,
      });
      return;
    }

    logInfo('MemoriAI initialization starting', {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      providerType: this.providerType,
      model: this.config.model,
    });

    try {
      // Enable Memori instance for memory operations
      await this.memori.enable();

      // Create providers with optimized configuration
      await this.initializeProviders();

      // Initialize mode-specific components
      await this.initializeModeComponents();

      this.initialized = true;

      this.logOperationSuccess('MemoriAI initialization', {
        providerType: this.providerType,
        model: this.config.model,
      });

    } catch (error) {
      this.logOperationError('MemoriAI initialization', error);
      throw error;
    }
  }

  /**
    * Ensure provider is initialized before use
    */
  private async ensureInitialized(): Promise<void> {
    logInfo('MemoriAI ensureInitialized called', {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      initialized: this.initialized,
      initializing: this.initializing,
    });

    if (!this.initialized && !this.initializing) {
      logInfo('MemoriAI not initialized, calling initialize', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        initialized: this.initialized,
        initializing: this.initializing,
      });
      this.initializing = true;
      await this.initializeSync();
    } else if (this.initializing) {
      // Wait for initialization to complete if it's in progress
      while (this.initializing) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  /**
   * Convert simplified search options to internal format
   */
  private convertSearchOptions(options: SearchOptions): import('./types/models').SearchOptions {
    return {
      namespace: options.namespace,
      limit: options.limit,
      includeMetadata: options.includeMetadata,
      minImportance: options.minImportance ? this.mapImportanceLevel(options.minImportance) : undefined,
      categories: options.categories as MemoryClassification[],
      sortBy: options.sortBy,
      offset: options.offset,
    };
  }

  /**
   * Map string importance level to enum value
   */
  private mapImportanceLevel(level: 'low' | 'medium' | 'high' | 'critical'): MemoryImportanceLevel {
    switch (level) {
      case 'low': return MemoryImportanceLevel.LOW;
      case 'medium': return MemoryImportanceLevel.MEDIUM;
      case 'high': return MemoryImportanceLevel.HIGH;
      case 'critical': return MemoryImportanceLevel.CRITICAL;
      default: return MemoryImportanceLevel.MEDIUM;
    }
  }

  /**
   * Get the provider class for the given provider type
   */
  private getProviderClass(providerType: ProviderType): new (config: IProviderConfig) => ILLMProvider {
    // Import provider classes dynamically to avoid circular imports
    const { OpenAIProvider } = require('./infrastructure/providers/OpenAIProvider');
    const { AnthropicProvider } = require('./infrastructure/providers/AnthropicProvider');
    const { OllamaProvider } = require('./infrastructure/providers/OllamaProvider');

    switch (providerType) {
      case ProviderType.OPENAI: return OpenAIProvider;
      case ProviderType.ANTHROPIC: return AnthropicProvider;
      case ProviderType.OLLAMA: return OllamaProvider;
      default: return OpenAIProvider;
    }
  }

  /**
   * Create consistent error logging for all operations
   */
  private logOperationError(operation: string, error: unknown, extraContext?: Record<string, any>): void {
    logError(`${operation} failed`, {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      mode: this.mode,
      providerType: this.providerType,
      error: error instanceof Error ? error.message : String(error),
      ...extraContext,
    });
  }

  /**
   * Create consistent operation logging for all operations
   */
  private logOperationSuccess(operation: string, extraContext?: Record<string, any>): void {
    logInfo(`${operation} completed successfully`, {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      mode: this.mode,
      ...extraContext,
    });
  }
}
