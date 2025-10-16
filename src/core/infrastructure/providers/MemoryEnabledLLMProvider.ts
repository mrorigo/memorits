import { ILLMProvider } from './ILLMProvider';
import { IProviderConfig } from './IProviderConfig';
import { ProviderType } from './ProviderType';
import { LLMProviderFactory } from './index';
import { ChatCompletionParams } from './types/ChatCompletionParams';
import { ChatCompletionResponse } from './types/ChatCompletionResponse';
import { EmbeddingParams } from './types/EmbeddingParams';
import { EmbeddingResponse } from './types/EmbeddingResponse';
import { ProviderDiagnostics } from './types/ProviderDiagnostics';
import { Memori } from '../../Memori';
import { MemoryAgent } from '../../domain/memory/MemoryAgent';
import { DatabaseManager } from '../../infrastructure/database/DatabaseManager';
import { logInfo, logError } from '../config/Logger';
import type {
  MemoryManager,
  ChatCompletionCreateParams,
  ChatCompletion,
  ChatCompletionChunk,
  CreateEmbeddingResponse,
  RecordChatCompletionOptions,
  RecordEmbeddingOptions,
  MemoryRecordingResult,
} from '../../../integrations/openai-dropin/types';
import type { MemoryClassification, MemoryImportanceLevel, MemorySearchResult } from '../../types/models';


/**
 * Memory-enabled wrapper for ILLMProvider
 * Wraps any ILLMProvider implementation and adds transparent memory recording
 * Maintains 100% compatibility with the underlying provider interface
 */
export class MemoryEnabledLLMProvider implements ILLMProvider, MemoryManager {
  private config: IProviderConfig;
  private wrappedProvider: ILLMProvider;
  private memori?: Memori;
  private memoryAgent?: MemoryAgent;
  private isInitialized = false;
  private metrics = {
    totalRequests: 0,
    memoryRecordingSuccess: 0,
    memoryRecordingFailures: 0,
    averageResponseTime: 0,
    averageMemoryProcessingTime: 0,
  };

  constructor(
    wrappedProvider: ILLMProvider,
    config: IProviderConfig
  ) {
    this.wrappedProvider = wrappedProvider;
    this.config = config;
  }

  /**
   * Get memory configuration from IProviderConfig
   */
  private get memoryConfig() {
    return {
      enableChatMemory: this.config.memory?.enableChatMemory ?? true,
      enableEmbeddingMemory: this.config.memory?.enableEmbeddingMemory ?? false,
      memoryProcessingMode: this.config.memory?.memoryProcessingMode ?? 'auto',
      minImportanceLevel: this.config.memory?.minImportanceLevel ?? 'all',
      sessionId: this.config.memory?.sessionId,
    };
  }

  getProviderType(): ProviderType {
    return this.wrappedProvider.getProviderType();
  }

  getConfig(): IProviderConfig {
    return { ...this.config };
  }

  initialize(config: IProviderConfig, existingMemori?: Memori): void {
    this.config = config;

    // Use existing Memori instance if provided
    if (existingMemori) {
      this.memori = existingMemori;
      logInfo('MemoryEnabledLLMProvider using existing Memori instance', {
        component: 'MemoryEnabledLLMProvider',
        providerType: this.getProviderType(),
        reusedMemori: true,
      });
    }

    // Initialize wrapped provider (base LLM client) with existing Memori
    if (this.wrappedProvider instanceof require('./UnifiedLLMProvider').UnifiedLLMProvider) {
      // For UnifiedLLMProvider, pass the existing Memori to avoid recursion
      (this.wrappedProvider as any).memori = existingMemori;
    }
    this.wrappedProvider.initialize(config);

    // Initialize memory system if enabled and not already using existing Memori
    if ((this.memoryConfig.enableChatMemory || this.memoryConfig.enableEmbeddingMemory) && !existingMemori) {
      // Only create new Memori if none provided
      const memoriMode = this.memoryConfig.memoryProcessingMode === 'auto' ? 'automatic' :
                         this.memoryConfig.memoryProcessingMode === 'conscious' ? 'conscious' : 'manual';

      this.memori = new Memori({
        apiKey: config.apiKey,
        model: config.model,
        baseUrl: config.baseUrl,
        mode: memoriMode,
        namespace: this.memoryConfig.sessionId || 'default',
      });
      logInfo('Created new Memori instance in MemoryEnabledLLMProvider', {
        component: 'MemoryEnabledLLMProvider',
        providerType: this.getProviderType(),
        reusedMemori: false,
      });
    }

    // Initialize memory agent with wrapped provider and database manager
    // The MemoryAgent will create its own analysis provider to avoid recursion
    if (this.memori) {
      this.memoryAgent = new MemoryAgent(this.wrappedProvider, this.memori.getDatabaseManager());
    }

    this.isInitialized = true;

    logInfo('MemoryEnabledLLMProvider initialized successfully', {
      component: 'MemoryEnabledLLMProvider',
      providerType: this.getProviderType(),
      enableChatMemory: this.memoryConfig.enableChatMemory,
      enableEmbeddingMemory: this.memoryConfig.enableEmbeddingMemory,
      memoryProcessingMode: this.memoryConfig.memoryProcessingMode,
      reusedMemori: !!existingMemori,
    });
  }

  async dispose(): Promise<void> {
    await this.wrappedProvider.dispose();
    this.isInitialized = false;

    logInfo('MemoryEnabledLLMProvider disposed', {
      component: 'MemoryEnabledLLMProvider',
      providerType: this.getProviderType(),
      totalRequests: this.metrics.totalRequests,
      memoryRecordingSuccess: this.metrics.memoryRecordingSuccess,
      memoryRecordingFailures: this.metrics.memoryRecordingFailures,
    });
  }

  async isHealthy(): Promise<boolean> {
    return this.isInitialized && await this.wrappedProvider.isHealthy();
  }

  async getDiagnostics(): Promise<ProviderDiagnostics> {
    const baseDiagnostics = await this.wrappedProvider.getDiagnostics();

    return {
      providerType: this.getProviderType(),
      isInitialized: this.isInitialized,
      isHealthy: await this.isHealthy(),
      model: this.wrappedProvider.getModel(),
      metadata: {
        ...baseDiagnostics.metadata,
        memoryEnabled: true,
        enableChatMemory: this.memoryConfig.enableChatMemory,
        enableEmbeddingMemory: this.memoryConfig.enableEmbeddingMemory,
        memoryProcessingMode: this.memoryConfig.memoryProcessingMode,
        sessionId: this.memoryConfig.sessionId,
        metrics: this.metrics,
      },
      timestamp: new Date(),
    };
  }

  getModel(): string {
    return this.wrappedProvider.getModel();
  }

  async createChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    if (!this.isInitialized) {
      throw new Error('MemoryEnabledLLMProvider not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Delegate to wrapped provider for actual LLM call
      const response = await this.wrappedProvider.createChatCompletion(params);

      // Record memory if enabled - using sophisticated MemoryAgent processing
      if (this.memoryConfig.enableChatMemory && this.memoryAgent && this.memori) {
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

          // Use MemoryAgent for sophisticated processing
          const processedMemory = await this.memoryAgent.processConversation({
            chatId,
            userInput,
            aiOutput,
            context: {
              sessionId: this.memoryConfig.sessionId || 'default-session',
              conversationId: chatId,
              modelUsed: params.model || this.getModel(),
              userPreferences: [], // Could be extended to extract from context
              currentProjects: [], // Could be extended to extract from context
              relevantSkills: [], // Could be extended to extract from context
            },
          });

          // Store the processed memory using Memori's database manager
          // Note: For LLM-generated memories, we don't need a corresponding ChatHistory record
          await this.memori.storeProcessedMemory(processedMemory, chatId);

          const memoryDuration = Date.now() - memoryStartTime;
          const totalRequests = this.metrics.totalRequests;
          this.metrics.averageMemoryProcessingTime =
            (this.metrics.averageMemoryProcessingTime * (totalRequests - 1) + memoryDuration) / totalRequests;

          logInfo('Chat completion processed with MemoryAgent', {
            component: 'MemoryEnabledLLMProvider',
            providerType: this.getProviderType(),
            model: params.model || this.getModel(),
            tokensUsed: response.usage?.total_tokens || 0,
            conversationId: this.memoryConfig.sessionId || 'default-session',
            chatId,
            classification: processedMemory.classification,
            importance: processedMemory.importance,
            entitiesCount: processedMemory.entities.length,
            relationshipsCount: processedMemory.relatedMemories?.length || 0,
          });

        } catch (error) {
          logError('Failed to process chat memory with MemoryAgent', {
            component: 'MemoryEnabledLLMProvider',
            error: error instanceof Error ? error.message : String(error),
            providerType: this.getProviderType(),
          });
        }
      }

      // Duration tracking handled inline above

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.memoryRecordingFailures++;

      logError('Chat completion failed in MemoryEnabledLLMProvider', {
        component: 'MemoryEnabledLLMProvider',
        error: error instanceof Error ? error.message : String(error),
        providerType: this.getProviderType(),
        model: params.model || this.getModel(),
        duration,
      });

      throw error;
    }
  }

  async createEmbedding(params: EmbeddingParams): Promise<EmbeddingResponse> {
    if (!this.isInitialized) {
      throw new Error('MemoryEnabledLLMProvider not initialized');
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Delegate to wrapped provider for actual LLM call
      const response = await this.wrappedProvider.createEmbedding(params);

      // Record memory if enabled - using sophisticated MemoryAgent processing
      if (this.memoryConfig.enableEmbeddingMemory && this.memoryAgent && this.memori) {
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

          const memoryDuration = Date.now() - memoryStartTime;
          const totalRequests = this.metrics.totalRequests;
          this.metrics.averageMemoryProcessingTime =
            (this.metrics.averageMemoryProcessingTime * (totalRequests - 1) + memoryDuration) / totalRequests;

          logInfo('Embedding processed with MemoryAgent', {
            component: 'MemoryEnabledLLMProvider',
            providerType: this.getProviderType(),
            model: params.model || 'text-embedding-3-small',
            tokensUsed: response.usage?.total_tokens || 0,
            inputLength: Array.isArray(params.input) ? params.input.length : String(params.input).length,
            conversationId: this.memoryConfig.sessionId || 'default-session',
            chatId,
            classification: processedMemory.classification,
            importance: processedMemory.importance,
            entitiesCount: processedMemory.entities.length,
          });

        } catch (error) {
          logError('Failed to process embedding memory with MemoryAgent', {
            component: 'MemoryEnabledLLMProvider',
            error: error instanceof Error ? error.message : String(error),
            providerType: this.getProviderType(),
          });
        }
      }

      // Duration tracking is handled inline above

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.memoryRecordingFailures++;

      logError('Embedding creation failed in MemoryEnabledLLMProvider', {
        component: 'MemoryEnabledLLMProvider',
        error: error instanceof Error ? error.message : String(error),
        providerType: this.getProviderType(),
        model: params.model || 'text-embedding-3-small',
        duration,
      });

      throw error;
    }
  }

  getClient(): any {
    return this.wrappedProvider.getClient();
  }

  /**
    * Get metrics for monitoring
    */
  getMetrics() {
    return { ...this.metrics };
  }

  /**
    * Update memory configuration via IProviderConfig
    */
  updateMemoryConfig(config: Partial<IProviderConfig['memory']>): void {
    if (config) {
      this.config = {
        ...this.config,
        memory: { ...this.config.memory, ...config }
      };

      logInfo('MemoryEnabledLLMProvider memory configuration updated', {
        component: 'MemoryEnabledLLMProvider',
        providerType: this.getProviderType(),
        enableChatMemory: this.memoryConfig.enableChatMemory,
        enableEmbeddingMemory: this.memoryConfig.enableEmbeddingMemory,
        memoryProcessingMode: this.memoryConfig.memoryProcessingMode,
      });
    }
  }

  // ============================================================================
  // MemoryManager interface implementation - direct delegation to Memori
  // ============================================================================

  async recordChatCompletion(
    params: ChatCompletionCreateParams,
    response: ChatCompletion | AsyncIterable<ChatCompletionChunk>,
    options?: RecordChatCompletionOptions
  ): Promise<MemoryRecordingResult> {
    if (!this.memoryAgent || !this.memori) {
      return { success: false, error: 'MemoryAgent or Memori not initialized', duration: 0, wasStreaming: false };
    }

    const startTime = Date.now();

    try {
      const messages = params.messages;
      const lastUserMessage = messages.slice().reverse().find(msg => msg.role === 'user');
      const userInput = lastUserMessage?.content?.toString() || '';
      const aiOutput = typeof response === 'object' && 'choices' in response
        ? response.choices[0]?.message?.content || ''
        : '';

      // Generate chat ID for this conversation
      const chatId = `record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Temporarily disable memory processing to prevent infinite recursion
      const originalEnableChatMemory = this.config.memory?.enableChatMemory;
      if (this.config.memory) {
        this.config.memory.enableChatMemory = false; // Disable to prevent recursion
      }

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

        return {
          success: true,
          chatId,
          duration: Date.now() - startTime,
          wasStreaming: false,
          classification: processedMemory.classification,
          importance: processedMemory.importance,
        };
      } finally {
        // Restore original memory configuration
        if (this.config.memory && originalEnableChatMemory !== undefined) {
          this.config.memory.enableChatMemory = originalEnableChatMemory;
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        wasStreaming: false,
      };
    }
  }

  async recordEmbedding(
    params: any,
    response: CreateEmbeddingResponse,
    options?: RecordEmbeddingOptions
  ): Promise<MemoryRecordingResult> {
    if (!this.memoryAgent || !this.memori || !options?.enableMemory) {
      return { success: true, duration: 0, wasStreaming: false };
    }

    const startTime = Date.now();

    try {
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
      const chatId = `embedding_record_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // Use MemoryAgent for sophisticated processing of embedding request
      const processedMemory = await this.memoryAgent.processConversation({
        chatId,
        userInput: `Embedding request: ${inputSummary}`,
        aiOutput: `Generated ${response.data.length} embeddings`,
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

      return {
        success: true,
        chatId,
        duration: Date.now() - startTime,
        wasStreaming: false,
        classification: processedMemory.classification,
        importance: processedMemory.importance,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        wasStreaming: false,
      };
    }
  }

  async searchMemories(
    query: string,
    options?: {
      limit?: number;
      minImportance?: MemoryImportanceLevel;
      namespace?: string;
    }
  ): Promise<MemorySearchResult[]> {
    if (!this.memori) {
      return [];
    }
    return this.memori.searchMemories(query, options);
  }

  async getMemoryStats(): Promise<{
    totalConversations: number;
    totalMemories: number;
    shortTermMemories: number;
    longTermMemories: number;
    consciousMemories: number;
    lastActivity?: Date;
  }> {
    if (!this.memori) {
      return {
        totalConversations: 0,
        totalMemories: 0,
        shortTermMemories: 0,
        longTermMemories: 0,
        consciousMemories: 0,
      };
    }

    try {
      return await this.memori.getMemoryStatistics();
    } catch (error) {
      return {
        totalConversations: 0,
        totalMemories: 0,
        shortTermMemories: 0,
        longTermMemories: 0,
        consciousMemories: 0,
      };
    }
  }
}
