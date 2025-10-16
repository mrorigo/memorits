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
import { IProviderConfig, extractPerformanceConfig, extractMemoryConfig, DEFAULT_PERFORMANCE_CONFIG, DEFAULT_MEMORY_CONFIG } from './infrastructure/providers/IProviderConfig';
import { LLMProviderFactory } from './infrastructure/providers/LLMProviderFactory';
import { MemoryEnabledLLMProvider } from './infrastructure/providers/MemoryEnabledLLMProvider';
import { ILLMProvider } from './infrastructure/providers/ILLMProvider';
import { Memori } from './Memori';
import { MemoriConfig } from './infrastructure/config/ConfigManager';
import { logInfo, logError } from './infrastructure/config/Logger';
import { MemoryImportanceLevel, MemoryClassification } from './types/schemas';

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
  private memoryProvider?: MemoryEnabledLLMProvider;
  private memori: Memori;
  private sessionId: string;
  private initialized: boolean = false;
  private initializing: boolean = false;

  constructor(config: MemoriAIConfig) {
    this.sessionId = uuidv4();

    // Auto-detect provider from simple config
    this.providerType = this.detectProvider(config);

    // Convert simple config to complex internal config
    this.config = this.simplifyConfiguration(config);

    logInfo('MemoriAI constructor started', {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      baseUrl: this.config.baseUrl,
      providerType: this.providerType,
      databaseUrl: config.databaseUrl,
      model: this.config.model,
      namespace: this.config.features?.memory?.sessionId,
      initialized: this.initialized,
      initializing: this.initializing,
    });

    // Create Memori instance for database operations
    this.memori = new Memori(this.buildMemoriConfig(config));

    // Initialize synchronously to avoid race conditions
    this.initializeSync();

    logInfo('MemoriAI constructor completed', {
      component: 'MemoriAI',
      sessionId: this.sessionId,
      initialized: this.initialized,
      initializing: this.initializing,
    });
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

     // Use memory-enabled provider for chat with automatic memory recording
     const response = await this.memoryProvider!.createChatCompletion(providerParams);

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
     logError('Chat completion failed', {
       component: 'MemoriAI',
       sessionId: this.sessionId,
       providerType: this.providerType,
       error: error instanceof Error ? error.message : String(error),
     });
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
      logError('Memory search failed', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        query,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Unified embeddings API - works with any provider internally
   */
  async createEmbeddings(params: EmbeddingParams): Promise<EmbeddingResponse> {
    await this.ensureInitialized();

    try {
      // Use memory-enabled provider for embeddings
      const response = await this.memoryProvider!.createEmbedding({
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
      // Close memory provider if initialized
      if (this.memoryProvider) {
        await this.memoryProvider.dispose();
      }

      // Close Memori instance
      await this.memori.close();

      logInfo('MemoriAI closed successfully', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
      });

    } catch (error) {
      logError('Error during MemoriAI close', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
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
   * Convert simple user config to complex internal config
   */
  private simplifyConfiguration(userConfig: MemoriAIConfig): IProviderConfig {
    // Get smart defaults for the detected provider
    const providerDefaults = this.getProviderDefaults(this.providerType);

    // Generate session ID if not provided
    const sessionId = userConfig.namespace || `memoriai_${Date.now()}`;
    console.log(`*** simplifyConfiguration sessionId: ${sessionId} baseUrl: ${userConfig.baseUrl} model: ${userConfig.model}`);
    return {
      apiKey: userConfig.apiKey || this.getDefaultApiKey(this.providerType),
      model: userConfig.model || providerDefaults.defaultModel,
      baseUrl: userConfig.baseUrl || providerDefaults.baseUrl,

      features: {
        performance: {
          ...DEFAULT_PERFORMANCE_CONFIG,
          // Enable all performance optimizations by default
          enableConnectionPooling: true,
          enableCaching: true,
          enableHealthMonitoring: true,
        },
        memory: {
          ...DEFAULT_MEMORY_CONFIG,
          sessionId,
          // Enable chat memory by default for all providers
          enableChatMemory: true,
          enableEmbeddingMemory: false,
          memoryProcessingMode: 'auto',
          minImportanceLevel: 'all',
        }
      }
    };
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
   * Build Memori configuration from simple config
   */
  private buildMemoriConfig(userConfig: MemoriAIConfig): Partial<MemoriConfig> {
    return {
      databaseUrl: userConfig.databaseUrl,
      apiKey: userConfig.apiKey,
      model: userConfig.model || this.getDefaultModel(),
      namespace: userConfig.namespace,
      autoIngest: true, // Enable auto-ingestion by default
      consciousIngest: false, // Disable conscious mode by default
    };
  }

  /**
   * Get default model for current provider
   */
  private getDefaultModel(): string {
    return this.getProviderDefaults(this.providerType).defaultModel;
  }

  /**
    * Initialize the provider infrastructure (synchronous version for constructor)
    */
  private initializeSync(): void {
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
      // Register providers (synchronous)
      LLMProviderFactory.registerDefaultProviders();

      // Initialize Memori instance first (synchronous until enable)
      logInfo('MemoriAI initializing Memori instance', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        databaseUrl: this.config.features?.memory?.sessionId,
      });

      // Create the base provider synchronously - avoid the complex async factory pattern
      const ProviderClass = this.getProviderClass(this.providerType);
      const baseProvider = new ProviderClass(this.config);

      // Initialize base provider synchronously
      baseProvider.initialize(this.config);

      // Create memory-enabled provider wrapper
      this.memoryProvider = new MemoryEnabledLLMProvider(baseProvider, this.config);

      // Initialize memory provider with existing Memori instance synchronously
      this.memoryProvider.initialize(this.config, this.memori);

      this.initialized = true;

      logInfo('MemoriAI initialization completed successfully', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        providerType: this.providerType,
        model: this.config.model,
      });

    } catch (error) {
      logError('MemoriAI initialization failed', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        error: error instanceof Error ? error.message : String(error),
      });
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

    if (!this.initialized) {
      logInfo('MemoriAI not initialized, calling initialize', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        initialized: this.initialized,
        initializing: this.initializing,
      });
      this.initializeSync();
    } else {
      logInfo('MemoriAI already initialized in ensureInitialized', {
        component: 'MemoriAI',
        sessionId: this.sessionId,
        initialized: this.initialized,
        initializing: this.initializing,
      });
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
}
