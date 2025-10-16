/**
 * Base LLM Wrapper - Eliminates code duplication across all provider wrappers
 * Integrates with existing sophisticated infrastructure (MemoryEnabledLLMProvider, ConnectionPool, RequestCache)
 */
import { Memori } from '../core/Memori';
import { ChatMessage, ChatResponse, EmbeddingResponse } from './types';
import { MemoryEnabledLLMProvider } from '../core/infrastructure/providers/MemoryEnabledLLMProvider';
import { ProviderType } from '../core/infrastructure/providers/ProviderType';
import { IProviderConfig, extractPerformanceConfig, extractMemoryConfig } from '../core/infrastructure/providers/IProviderConfig';
import { globalConnectionPool } from '../core/infrastructure/providers/performance/ConnectionPool';
import { globalRequestCache } from '../core/infrastructure/providers/performance/RequestCache';
import { logInfo, logError } from '../core/infrastructure/config/Logger';

/**
 * Base class for all LLM provider wrappers
 * Provides common functionality and integrates with sophisticated infrastructure
 */
export abstract class BaseLLMWrapper<T extends ProviderType> {
  protected memori?: Memori;
  protected memoryProvider?: MemoryEnabledLLMProvider;
  protected config: IProviderConfig;
  protected providerType: T;
  protected performanceConfig = extractPerformanceConfig({} as IProviderConfig);
  protected memoryConfig = extractMemoryConfig({} as IProviderConfig);

  constructor(
    memori: Memori | undefined,
    config: IProviderConfig = {} as IProviderConfig,
    providerType: T
  ) {
    this.memori = memori;
    this.config = config;
    this.providerType = providerType;

    // Update configurations based on provider config
    this.updateConfigurations();
  }

  /**
   * Initialize the wrapper with sophisticated memory and performance features
   */
  protected async initialize(): Promise<void> {
    // Check if memory is enabled via features config
    const enableMemory = this.config.features?.memory?.enableChatMemory ?? this.config.memory?.enableChatMemory ?? true;

    if (enableMemory && this.memori) {
      try {
        // Use the existing config as-is for MemoryEnabledLLMProvider
        const providerConfig: IProviderConfig = {
          ...this.config,
          // Ensure required fields have defaults
          apiKey: this.config.apiKey || 'default-api-key',
        };

        // Create the underlying provider using the factory pattern
        const { LLMProviderFactory } = require('../core/infrastructure/providers/LLMProviderFactory');
        const baseProvider = await LLMProviderFactory.createProvider(this.providerType, providerConfig);

        // Wrap with memory-enabled provider for sophisticated memory handling
        this.memoryProvider = new MemoryEnabledLLMProvider(baseProvider, providerConfig);

        logInfo('BaseLLMWrapper initialized with memory and performance features', {
          component: 'BaseLLMWrapper',
          providerType: this.providerType,
          enableMemory: enableMemory,
          enablePooling: this.config.features?.performance?.enableConnectionPooling ?? true,
          enableCaching: this.config.features?.performance?.enableCaching ?? true,
        });
      } catch (error) {
        logError('Failed to initialize BaseLLMWrapper with advanced features', {
          component: 'BaseLLMWrapper',
          providerType: this.providerType,
          error: error instanceof Error ? error.message : String(error),
        });
        // Fallback to basic initialization if advanced features fail
      }
    }
  }

  /**
   * Make a chat completion request with optional memory recording and caching
   */
  async chat(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ChatResponse> {
    try {
      // Initialize if not already done
      if (!this.memoryProvider) {
        await this.initialize();
      }

      // Use caching if enabled
      const enableCaching = this.config.features?.performance?.enableCaching ?? this.config.memory?.enableChatMemory ?? true;
      if (enableCaching && this.memoryProvider) {
        const cacheKey = this.generateCacheKey('chat', params);
        const cachedResponse = globalRequestCache.getChatCompletion({
          messages: params.messages,
          model: params.model || this.config.model,
          temperature: params.temperature,
          max_tokens: params.maxTokens,
        });

        if (cachedResponse) {
          logInfo('Using cached chat response', {
            component: 'BaseLLMWrapper',
            providerType: this.providerType,
            cacheKey,
          });

          // Return cached response with generated chatId for compatibility
          return {
            content: cachedResponse.message?.content || '',
            chatId: `cached_${Date.now()}`,
            model: cachedResponse.model || params.model || this.config.model || 'unknown',
            usage: {
              prompt_tokens: cachedResponse.usage?.prompt_tokens || 0,
              completion_tokens: cachedResponse.usage?.completion_tokens || 0,
              total_tokens: cachedResponse.usage?.total_tokens || 0,
            },
          };
        }
      }

      // Use MemoryEnabledLLMProvider if available, otherwise fallback to basic implementation
      if (this.memoryProvider) {
        const response = await this.memoryProvider.createChatCompletion({
          messages: params.messages,
          model: params.model || this.config.model,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 1000,
        });

        // Cache the response if caching is enabled
        const enableCaching = this.config.features?.performance?.enableCaching ?? this.config.memory?.enableChatMemory ?? true;
        if (enableCaching) {
          globalRequestCache.setChatCompletion(
            {
              messages: params.messages,
              model: params.model || this.config.model,
              temperature: params.temperature ?? 0.7,
              max_tokens: params.maxTokens ?? 1000,
            },
            response,
            this.config.features?.performance?.cacheTTL?.chat || 300000
          );
        }

        return {
          content: response.message?.content || '',
          chatId: `mem_${Date.now()}`, // Memory provider generates its own chatId
          model: response.model || params.model || this.config.model || 'unknown',
          usage: {
            prompt_tokens: response.usage?.prompt_tokens || 0,
            completion_tokens: response.usage?.completion_tokens || 0,
            total_tokens: response.usage?.total_tokens || 0,
          },
        };
      } else {
        // Fallback to basic implementation for when memory provider is not available
        return this.basicChatImplementation(params);
      }
    } catch (error) {
      logError('Chat completion failed in BaseLLMWrapper', {
        component: 'BaseLLMWrapper',
        providerType: this.providerType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`${this.getProviderName()} chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create embeddings with optional caching
   */
  async embeddings(params: {
    input: string | string[];
    model?: string;
  }): Promise<EmbeddingResponse> {
    try {
      // Initialize if not already done
      if (!this.memoryProvider) {
        await this.initialize();
      }

      // Use caching if enabled
      const enableCaching = this.config.features?.performance?.enableCaching ?? this.config.memory?.enableEmbeddingMemory ?? true;
      if (enableCaching && this.memoryProvider) {
        const cacheKey = this.generateCacheKey('embedding', params);
        const cachedResponse = globalRequestCache.getEmbedding({
          input: params.input,
          model: params.model || this.config.model,
        });

        if (cachedResponse) {
          logInfo('Using cached embedding response', {
            component: 'BaseLLMWrapper',
            providerType: this.providerType,
            cacheKey,
          });

          return {
            embeddings: cachedResponse.data.map((d: any) => d.embedding),
            usage: {
              prompt_tokens: cachedResponse.usage?.prompt_tokens || 0,
              total_tokens: cachedResponse.usage?.total_tokens || 0,
            },
            model: cachedResponse.model || params.model || this.config.model || 'unknown',
          };
        }
      }

      // Use MemoryEnabledLLMProvider if available, otherwise fallback to basic implementation
      if (this.memoryProvider) {
        const response = await this.memoryProvider.createEmbedding({
          input: params.input,
          model: params.model || this.config.model,
        });

        // Cache the response if caching is enabled
        if (enableCaching) {
          globalRequestCache.setEmbedding(
            {
              input: params.input,
              model: params.model || this.config.model,
            },
            response,
            this.config.features?.performance?.cacheTTL?.embedding || 3600000
          );
        }

        return {
          embeddings: response.data.map((d: any) => d.embedding),
          usage: {
            prompt_tokens: response.usage?.prompt_tokens || 0,
            total_tokens: response.usage?.total_tokens || 0,
          },
          model: response.model || params.model || this.config.model || 'unknown',
        };
      } else {
        // Fallback to basic implementation
        return this.basicEmbeddingImplementation(params);
      }
    } catch (error) {
      logError('Embedding creation failed in BaseLLMWrapper', {
        component: 'BaseLLMWrapper',
        providerType: this.providerType,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`${this.getProviderName()} embeddings failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Basic chat implementation for fallback when MemoryEnabledLLMProvider is not available
   * Must be implemented by each provider-specific wrapper
   */
  protected abstract basicChatImplementation(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ChatResponse>;

  /**
   * Basic embedding implementation for fallback when MemoryEnabledLLMProvider is not available
   * Must be implemented by each provider-specific wrapper
   */
  protected abstract basicEmbeddingImplementation(params: {
    input: string | string[];
    model?: string;
  }): Promise<EmbeddingResponse>;

  /**
   * Get the human-readable provider name
   */
  protected abstract getProviderName(): string;

  /**
   * Generate a cache key for the given request type and parameters
   */
  private generateCacheKey(type: 'chat' | 'embedding', params: any): string {
    const keyData = {
      type,
      provider: this.providerType,
      model: params.model || this.config.model,
      ...params,
    };

    const keyString = JSON.stringify(keyData);
    let hash = 0;
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return `${this.providerType}_${type}_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Update internal configurations based on provider config
   */
  private updateConfigurations(): void {
    // Update performance config using the existing helper
    this.performanceConfig = extractPerformanceConfig(this.config);

    // Update memory config using the existing helper
    this.memoryConfig = extractMemoryConfig(this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): IProviderConfig {
    return { ...this.config };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<IProviderConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.updateConfigurations();
  }

  /**
   * Check if wrapper is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      if (this.memoryProvider) {
        return await this.memoryProvider.isHealthy();
      }
      return true; // Basic implementation is always healthy
    } catch (error) {
      return false;
    }
  }

  /**
   * Dispose of resources
   */
  async dispose(): Promise<void> {
    if (this.memoryProvider) {
      await this.memoryProvider.dispose();
    }
  }
}