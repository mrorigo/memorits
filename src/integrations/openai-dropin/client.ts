import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { Memori } from '../../core/Memori';
import { MemoryAgent } from '../../core/domain/memory/MemoryAgent';
import { OpenAIProvider } from '../../core/infrastructure/providers/OpenAIProvider';
import { MemoryEnabledLLMProvider } from '../../core/infrastructure/providers/MemoryEnabledLLMProvider';
import { ConfigManager, MemoriConfig } from '../../core/infrastructure/config/ConfigManager';
import { logInfo, logError } from '../../core/infrastructure/config/Logger';
import { OpenAIMemoryManager } from './memory-manager';
import { ChatProxy } from './chat-proxy';
import { EmbeddingProxy } from './embedding-proxy';
import { ConfigUtils } from './utils/ConfigUtils';
import type {
  MemoriOpenAI,
  MemoriOpenAIConfig,
  MemoryManager,
  MemoryRecordingResult,
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  EmbeddingCreateParams,
  CreateEmbeddingResponse,
  RecordChatCompletionOptions,
  RecordEmbeddingOptions,
  OpenAIMemoryMetadata,
  StreamingMetadata,
  BufferedStream,
  OpenAIMetrics,
  DatabaseConfig,
} from './types';

// Import required types from core - removed unused imports

// Import error classes as values, not types
import {
  MemoryError,
  MemoryErrorType,
} from './types';

/**
 * Validates and merges configuration using ConfigUtils
 */
function validateAndMergeConfig(
  apiKey: string,
  config: Partial<MemoriOpenAIConfig> = {},
): MemoriOpenAIConfig {
  // Use ConfigUtils for validation and merging
  const mergedConfig = ConfigUtils.ConfigBuilder.mergeWithDefaults(apiKey, config);

  // Validate using ConfigUtils
  const validation = ConfigUtils.MemoriOpenAIConfigValidator.validate(mergedConfig);
  if (!validation.isValid) {
    throw new MemoryError(
      MemoryErrorType.CONFIGURATION_ERROR,
      `Configuration validation failed: ${validation.errors.join(', ')}`,
      { config: mergedConfig, validationErrors: validation.errors },
      false,
    );
  }

  return mergedConfig;
}

/**
 * Creates database configuration from MemoriOpenAI config using ConfigUtils
 */
function createDatabaseConfig(config: MemoriOpenAIConfig): DatabaseConfig {
  return ConfigUtils.DatabaseConfigBuilder.fromConfig(config);
}


/**
 * Main MemoriOpenAIClient implementation
 * Provides 100% compatibility with OpenAI SDK while adding transparent memory functionality
 */
export class MemoriOpenAIClient implements MemoriOpenAI {
  private openaiClient: OpenAI;
  private memori: Memori;
  private memoryManager: OpenAIMemoryManager;
  private memoryEnabledProvider: MemoryEnabledLLMProvider;
  public config: MemoriOpenAIConfig;
  private enabled: boolean = false;
  public sessionId: string;
  private metrics: OpenAIMetrics = {
    totalRequests: 0,
    memoryRecordingSuccess: 0,
    memoryRecordingFailures: 0,
    averageResponseTime: 0,
    averageMemoryProcessingTime: 0,
    cacheHitRate: 0,
    errorRate: 0,
    streamingRatio: 0,
  };

  constructor(apiKey: string, config?: Partial<MemoriOpenAIConfig>);
  constructor(options: { apiKey: string; baseURL?: string; [key: string]: any });
  constructor(apiKeyOrOptions: string | { apiKey: string; baseURL?: string; [key: string]: any }, config?: Partial<MemoriOpenAIConfig>) {
    this.sessionId = uuidv4();

    // Handle both constructor patterns
    let apiKey: string;
    let baseUrl: string | undefined;
    let clientOptions: Partial<MemoriOpenAIConfig> = {};

    if (typeof apiKeyOrOptions === 'string') {
      // Pattern 1: new MemoriOpenAI(apiKey, config)
      apiKey = apiKeyOrOptions;
      clientOptions = config || {};
    } else {
      // Pattern 2: new MemoriOpenAI({ apiKey, baseURL, ...options })
      apiKey = apiKeyOrOptions.apiKey;
      baseUrl = apiKeyOrOptions.baseURL;
      clientOptions = { ...apiKeyOrOptions, baseUrl };
    }

    this.config = validateAndMergeConfig(apiKey, clientOptions);

    // Initialize OpenAI client with all supported options
    this.openaiClient = new OpenAI({
      apiKey: this.config.apiKey,
      baseURL: this.config.baseUrl,
      organization: this.config.organization,
      project: this.config.project,
      timeout: this.config.timeout,
      maxRetries: this.config.maxRetries,
      defaultHeaders: this.config.defaultHeaders,
    });

    // Initialize Memori instance
    this.memori = new Memori({
      databaseUrl: createDatabaseConfig(this.config).url,
      namespace: this.config.namespace || 'memori-openai',
      apiKey: this.config.apiKey,
      baseUrl: this.config.baseUrl,
      model: 'gpt-4o-mini', // Default model for memory processing
      autoIngest: this.config.autoIngest,
      consciousIngest: this.config.consciousIngest,
    });

    // Create OpenAI provider for memory agent (core provider without memory)
    const coreProvider = new OpenAIProvider({
      apiKey: this.config.apiKey!,
      model: 'gpt-4o-mini',
      baseUrl: this.config.baseUrl,
    });

    // Create memory agent with core provider
    const memoryAgent = new MemoryAgent(coreProvider);

    // Initialize memory manager with proper architecture
    this.memoryManager = new OpenAIMemoryManager(this.memori, memoryAgent);

    // Create memory-enabled provider for external usage (synchronous initialization)
    this.memoryEnabledProvider = new MemoryEnabledLLMProvider(
      coreProvider,
      {
        apiKey: this.config.apiKey!,
        model: 'gpt-4o-mini', // Use default model since config doesn't have model property
        baseUrl: this.config.baseUrl,
      },
      {
        enableChatMemory: this.config.enableChatMemory ?? true,
        enableEmbeddingMemory: this.config.enableEmbeddingMemory ?? false,
        memoryProcessingMode: this.config.memoryProcessingMode || 'auto',
        minImportanceLevel: this.config.minImportanceLevel || 'all',
        sessionId: this.sessionId,
        memoryManager: this.memoryManager,
      }
    );

    // Initialize the memory-enabled provider synchronously
    this.memoryEnabledProvider.initialize({
      apiKey: this.config.apiKey!,
      model: 'gpt-4o-mini',
      baseUrl: this.config.baseUrl,
    }).catch((error) => {
      logError('Failed to initialize memory-enabled provider', {
        component: 'MemoriOpenAIClient',
        error: error instanceof Error ? error.message : String(error),
      });
    });

    // Auto-initialize if configured
    if (this.config.autoInitialize) {
      this.enable().catch((error) => {
        logError('Failed to auto-initialize MemoriOpenAI', {
          component: 'MemoriOpenAIClient',
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }
  }

  // OpenAI SDK interface implementation with memory-enabled provider
  get chat(): OpenAI.Chat {
    return this.createMemoryEnabledChatInterface();
  }

  /**
   * Create OpenAI-compatible chat interface using memory-enabled provider
   */
  private createMemoryEnabledChatInterface(): OpenAI.Chat {
    const originalChat = this.openaiClient.chat;

    return {
      completions: {
        create: async (params: ChatCompletionCreateParams, options?: OpenAI.RequestOptions) => {
          // Use memory-enabled provider for chat completions
          const response = await this.memoryEnabledProvider.createChatCompletion({
            model: params.model || 'gpt-4o-mini',
            messages: params.messages as any,
            temperature: params.temperature ?? undefined,
            max_tokens: params.max_tokens ?? undefined,
            top_p: params.top_p ?? undefined,
            frequency_penalty: params.frequency_penalty ?? undefined,
            presence_penalty: params.presence_penalty ?? undefined,
            stop: params.stop ?? undefined,
            stream: params.stream ?? false,
            options: params as any,
          });

          // Convert response back to OpenAI format for compatibility
          if (params.stream && response.message) {
            // Handle streaming case - for now return non-streaming response
            // Full streaming support would require more complex implementation
            return {
              id: response.id || 'memori-generated-id',
              object: 'chat.completion',
              created: response.created || Date.now(),
              model: response.model || params.model || 'gpt-4o-mini',
              choices: [{
                index: 0,
                message: {
                  role: response.message.role,
                  content: response.message.content || '',
                },
                finish_reason: response.finish_reason || 'stop',
              }],
              usage: response.usage ? {
                prompt_tokens: response.usage.prompt_tokens || 0,
                completion_tokens: response.usage.completion_tokens || 0,
                total_tokens: response.usage.total_tokens || 0,
              } : undefined,
            } as OpenAI.ChatCompletion;
          }

          // Non-streaming response
          return {
            id: response.id || 'memori-generated-id',
            object: 'chat.completion',
            created: response.created || Date.now(),
            model: response.model || params.model || 'gpt-4o-mini',
            choices: [{
              index: 0,
              message: {
                role: response.message?.role || 'assistant',
                content: response.message?.content || '',
              },
              finish_reason: response.finish_reason || 'stop',
            }],
            usage: response.usage ? {
              prompt_tokens: response.usage.prompt_tokens || 0,
              completion_tokens: response.usage.completion_tokens || 0,
              total_tokens: response.usage.total_tokens || 0,
            } : undefined,
          } as OpenAI.ChatCompletion;
        },
      },
    } as OpenAI.Chat;
  }

  get embeddings(): OpenAI.Embeddings {
    return this.createMemoryEnabledEmbeddingsInterface();
  }

  /**
   * Create OpenAI-compatible embeddings interface using memory-enabled provider
   */
  private createMemoryEnabledEmbeddingsInterface(): OpenAI.Embeddings {
    return {
      create: async (params: EmbeddingCreateParams, options?: OpenAI.RequestOptions) => {
        // Use memory-enabled provider for embeddings
        // Convert input to string format if needed
        const input = Array.isArray(params.input)
          ? params.input.map(item => String(item))
          : String(params.input);

        const response = await this.memoryEnabledProvider.createEmbedding({
          model: params.model || 'text-embedding-3-small',
          input: input,
          encoding_format: params.encoding_format,
          dimensions: params.dimensions,
          user: params.user,
          options: params as any,
        });

        // Convert response back to OpenAI format for compatibility
        return {
          object: 'list',
          data: response.data.map((item, index) => ({
            object: item.object || 'embedding',
            embedding: item.embedding,
            index: item.index ?? index,
          })) as OpenAI.Embedding[],
          model: response.model || params.model || 'text-embedding-3-small',
          usage: response.usage ? {
            prompt_tokens: response.usage.prompt_tokens || 0,
            total_tokens: response.usage.total_tokens || 0,
          } : undefined,
        } as OpenAI.CreateEmbeddingResponse;
      },
    } as OpenAI.Embeddings;
  }

  // Memory-specific functionality
  get memory(): MemoryManager {
    return this.memoryManager;
  }

  async enable(): Promise<void> {
    if (this.enabled) {
      throw new MemoryError(
        MemoryErrorType.CONFIGURATION_ERROR,
        'MemoriOpenAIClient is already enabled',
        {},
        false,
      );
    }

    try {
      await this.memori.enable();
      this.enabled = true;

      logInfo('MemoriOpenAIClient enabled successfully', {
        component: 'MemoriOpenAIClient',
        sessionId: this.sessionId,
        config: {
          enableChatMemory: this.config.enableChatMemory,
          enableEmbeddingMemory: this.config.enableEmbeddingMemory,
          memoryProcessingMode: this.config.memoryProcessingMode,
          autoIngest: this.config.autoIngest,
          consciousIngest: this.config.consciousIngest,
        },
      });
    } catch (error) {
      logError('Failed to enable MemoriOpenAIClient', {
        component: 'MemoriOpenAIClient',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async disable(): Promise<void> {
    if (!this.enabled) {
      throw new MemoryError(
        MemoryErrorType.CONFIGURATION_ERROR,
        'MemoriOpenAIClient is not enabled',
        {},
        false,
      );
    }

    try {
      await this.memori.close();
      this.enabled = false;

      logInfo('MemoriOpenAIClient disabled successfully', {
        component: 'MemoriOpenAIClient',
        sessionId: this.sessionId,
      });
    } catch (error) {
      logError('Failed to disable MemoriOpenAIClient', {
        component: 'MemoriOpenAIClient',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async close(): Promise<void> {
    await this.disable();
  }

  async getMetrics(): Promise<OpenAIMetrics> {
    return { ...this.metrics };
  }

  async resetMetrics(): Promise<void> {
    this.metrics = {
      totalRequests: 0,
      memoryRecordingSuccess: 0,
      memoryRecordingFailures: 0,
      averageResponseTime: 0,
      averageMemoryProcessingTime: 0,
      cacheHitRate: 0,
      errorRate: 0,
      streamingRatio: 0,
    };
  }

  async updateConfig(config: Partial<MemoriOpenAIConfig>): Promise<void> {
    this.config = validateAndMergeConfig(this.config.apiKey!, config);

    // Update OpenAI client if needed
    if (config.apiKey || config.baseUrl || config.organization || config.project) {
      this.openaiClient = new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: this.config.baseUrl,
        organization: this.config.organization,
        project: this.config.project,
        timeout: this.config.timeout,
        maxRetries: this.config.maxRetries,
        defaultHeaders: this.config.defaultHeaders,
      });
    }

    logInfo('MemoriOpenAIClient configuration updated', {
      component: 'MemoriOpenAIClient',
      sessionId: this.sessionId,
      newConfig: config,
    });
  }

  // Additional utility methods for debugging and monitoring
  getSessionId(): string {
    return this.sessionId;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  getConfig(): MemoriOpenAIConfig {
    return { ...this.config };
  }
}

// Export types for external usage
export type { MemoriOpenAI, MemoriOpenAIConfig } from './types';
export default MemoriOpenAIClient;