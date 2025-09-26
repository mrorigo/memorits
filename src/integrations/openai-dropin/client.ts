// src/integrations/openai-dropin/client.ts
// Main MemoriOpenAIClient implementation with full OpenAI SDK compatibility
// Provides transparent memory functionality while maintaining exact API compatibility

import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { Memori } from '../../core/Memori';
import { MemoryAgent } from '../../core/agents/MemoryAgent';
import { OpenAIProvider } from '../../core/providers/OpenAIProvider';
import { ConfigManager, MemoriConfig } from '../../core/utils/ConfigManager';
import { logInfo, logError } from '../../core/utils/Logger';
import { OpenAIMemoryManager } from './memory-manager';
import { ChatProxy } from './chat-proxy';
import { EmbeddingProxy } from './embedding-proxy';
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
  DatabaseType,
} from './types';

// Import required types from core
import type {
  MemoryClassification,
  MemoryImportanceLevel,
  MemorySearchResult,
} from '../../core/types/models';

// Import error classes as values, not types
import {
  MemoryError,
  MemoryErrorType,
} from './types';

/**
 * Default configuration for MemoriOpenAI
 */
const DEFAULT_CONFIG: Partial<MemoriOpenAIConfig> = {
  enableChatMemory: true,
  enableEmbeddingMemory: false,
  memoryProcessingMode: 'auto',
  autoInitialize: true,
  bufferTimeout: 30000,
  maxBufferSize: 50000,
  backgroundUpdateInterval: 30000,
  debugMode: false,
  enableMetrics: false,
  metricsInterval: 60000,
};

/**
 * Validates and merges configuration
 */
function validateAndMergeConfig(
  apiKey: string,
  config: Partial<MemoriOpenAIConfig> = {},
): MemoriOpenAIConfig {
  const mergedConfig: MemoriOpenAIConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    apiKey,
  };

  // Validate required fields
  if (!apiKey) {
    throw new MemoryError(
      MemoryErrorType.CONFIGURATION_ERROR,
      'API key is required for MemoriOpenAI',
      { config: mergedConfig },
      false,
    );
  }

  // Validate buffer settings
  if (mergedConfig.bufferTimeout && mergedConfig.bufferTimeout < 1000) {
    throw new MemoryError(
      MemoryErrorType.CONFIGURATION_ERROR,
      'Buffer timeout must be at least 1000ms',
      { bufferTimeout: mergedConfig.bufferTimeout },
      false,
    );
  }

  if (mergedConfig.maxBufferSize && mergedConfig.maxBufferSize < 1000) {
    throw new MemoryError(
      MemoryErrorType.CONFIGURATION_ERROR,
      'Max buffer size must be at least 1000 characters',
      { maxBufferSize: mergedConfig.maxBufferSize },
      false,
    );
  }

  return mergedConfig;
}

/**
 * Creates database configuration from MemoriOpenAI config
 */
function createDatabaseConfig(config: MemoriOpenAIConfig): DatabaseConfig {
  const databaseType: DatabaseType = 'sqlite'; // Default to SQLite for simplicity
  const databaseUrl = config.databaseConfig?.url || 'sqlite:./memori-openai.db';

  return {
    type: databaseType,
    url: databaseUrl,
    namespace: config.namespace || 'memori-openai',
  };
}


/**
 * Main MemoriOpenAIClient implementation
 * Provides 100% compatibility with OpenAI SDK while adding transparent memory functionality
 */
export class MemoriOpenAIClient implements MemoriOpenAI {
  private openaiClient: OpenAI;
  private memori: Memori;
  private memoryManager: OpenAIMemoryManager;
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

    // Create OpenAI provider for memory agent
    const openaiProvider = new OpenAIProvider({
      apiKey: this.config.apiKey!,
      model: 'gpt-4o-mini',
      baseUrl: this.config.baseUrl,
    });

    // Create memory agent
    const memoryAgent = new MemoryAgent(openaiProvider);

    // Initialize memory manager with proper architecture
    this.memoryManager = new OpenAIMemoryManager(this.memori, memoryAgent);

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

  // OpenAI SDK interface implementation with ChatProxy
  get chat(): OpenAI.Chat {
    // Create ChatProxy with memory recording enabled by default
    const chatProxy = new ChatProxy(
      this.openaiClient.chat,
      this.memoryManager,
      this.config.enableChatMemory ?? true,
    );

    return {
      completions: {
        create: chatProxy.create.bind(chatProxy),
      },
    } as OpenAI.Chat;
  }

  get embeddings(): OpenAI.Embeddings {
    // Create EmbeddingProxy with memory recording enabled based on configuration
    const embeddingProxy = new EmbeddingProxy(
      this.openaiClient.embeddings,
      this.memoryManager,
      this.config.enableEmbeddingMemory ?? false,
      this.config.enableEmbeddingMemory ?? false,
    );

    return {
      create: embeddingProxy.create.bind(embeddingProxy),
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