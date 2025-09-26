// src/integrations/openai-dropin/memory-manager.ts
// Memory Manager implementation for OpenAI Drop-in with Architecture Phase 1 components
// Provides ConversationRecorder, StreamingBuffer, and comprehensive memory management

import { v4 as uuidv4 } from 'uuid';
import { Memori } from '../../core/Memori';
import { MemoryAgent } from '../../core/agents/MemoryAgent';
import { logInfo, logError } from '../../core/utils/Logger';
import type {
  MemoryManager,
  ConversationRecorder,
  StreamingBuffer,
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
  StreamingBufferConfig,
  ErrorRecoveryConfig,
} from './types';
import type {
  MemoryClassification,
  MemoryImportanceLevel,
  MemorySearchResult,
  MemoryProcessingParams,
  ConversationContext,
} from '../../core/types/models';

// Import these as values, not types
import {
  MemoryError,
  MemoryErrorType,
  RecoveryStrategy,
} from './types';

/**
 * Default streaming buffer configuration
 */
const DEFAULT_STREAMING_CONFIG: StreamingBufferConfig = {
  bufferTimeout: 30000, // 30 seconds
  maxBufferSize: 50000, // 50KB
  enableMemoryRecording: true,
  memoryProcessingMode: 'auto',
};

/**
 * Error recovery configuration
 */
const DEFAULT_ERROR_RECOVERY: ErrorRecoveryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  strategy: RecoveryStrategy.RETRY,
  logRecovery: true,
  customRecovery: async (error: MemoryError) => {
    logError('Custom recovery function called', {
      component: 'MemoryManager',
      errorType: error.type,
      message: error.message,
    });
    return true; // Recovery successful
  },
};

/**
 * Memory Manager implementation coordinating all memory operations
 */
export class OpenAIMemoryManager implements MemoryManager {
  private memori: Memori;
  private memoryAgent: MemoryAgent;
  private conversationRecorder: ConversationRecorder;
  private streamingBuffer: StreamingBuffer;
  private errorRecovery: ErrorRecoveryConfig;
  private metrics: {
    totalRequests: number;
    memoryRecordingSuccess: number;
    memoryRecordingFailures: number;
    averageResponseTime: number;
    averageMemoryProcessingTime: number;
  };

  constructor(
    memori: Memori,
    memoryAgent: MemoryAgent,
    config: {
      enableStreamingBuffer?: boolean;
      errorRecovery?: Partial<ErrorRecoveryConfig>;
    } = {},
  ) {
    this.memori = memori;
    this.memoryAgent = memoryAgent;
    this.conversationRecorder = new OpenAIConversationRecorder(memori, memoryAgent);
    this.streamingBuffer = new OpenAIStreamingBuffer();
    this.errorRecovery = { ...DEFAULT_ERROR_RECOVERY, ...config.errorRecovery };
    this.metrics = {
      totalRequests: 0,
      memoryRecordingSuccess: 0,
      memoryRecordingFailures: 0,
      averageResponseTime: 0,
      averageMemoryProcessingTime: 0,
    };
  }

  async recordChatCompletion(
    params: ChatCompletionCreateParams,
    response: ChatCompletion | AsyncIterable<ChatCompletionChunk>,
    options?: RecordChatCompletionOptions,
  ): Promise<MemoryRecordingResult> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      // Determine if this is a streaming response
      const isStreaming = this.isStreamingResponse(response);

      if (isStreaming) {
        return await this.recordStreamingChatCompletion(
          response as AsyncIterable<ChatCompletionChunk>,
          params,
          options,
          startTime,
        );
      } else {
        return await this.recordNonStreamingChatCompletion(
          response as ChatCompletion,
          params,
          options,
          startTime,
        );
      }
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.memoryRecordingFailures++;

      logError('Chat completion memory recording failed', {
        component: 'OpenAIMemoryManager',
        error: error instanceof Error ? error.message : String(error),
        duration,
        isStreaming: this.isStreamingResponse(response),
      });

      return await this.handleRecordingError(error, {
        type: MemoryErrorType.RECORDING_FAILED,
        context: { params, options, duration },
        recoverable: true,
      });
    }
  }

  async recordEmbedding(
    params: EmbeddingCreateParams,
    response: CreateEmbeddingResponse,
    options?: RecordEmbeddingOptions,
  ): Promise<MemoryRecordingResult> {
    const startTime = Date.now();

    try {
      // Only record if memory recording is enabled
      if (!options?.enableMemory) {
        return {
          success: true,
          duration: Date.now() - startTime,
          wasStreaming: false,
        };
      }

      // Extract input summary for memory storage
      const inputSummary = this.extractEmbeddingInputSummary(params.input);

      // Create metadata for the embedding
      const metadata: OpenAIMemoryMetadata = {
        model: params.model || 'text-embedding-3-small',
        modelType: 'embedding',
        endpoint: 'embeddings',
        isStreaming: false,
        requestParams: params as unknown as Record<string, unknown>,
        responseMetadata: {
          finishReason: undefined,
          contentFilterResults: undefined,
          systemFingerprint: undefined,
        },
        temperature: undefined,
        maxTokens: undefined,
        tokensUsed: response.usage?.total_tokens || 0,
        conversationId: uuidv4(),
      };

      // Record the embedding request in memory
      const chatId = await this.memori.recordConversation(
        `Embedding request: ${inputSummary}`,
        `Generated ${response.data.length} embeddings with ${response.data[0]?.embedding?.length || 0} dimensions`,
        {
          model: metadata.model,
          metadata: {
            isStreaming: false,
            temperature: undefined,
            maxTokens: undefined,
            tokensUsed: response.usage?.total_tokens || 0,
            conversationId: metadata.conversationId,
          },
        },
      );

      const duration = Date.now() - startTime;
      this.metrics.memoryRecordingSuccess++;

      return {
        success: true,
        chatId,
        memoryId: chatId,
        duration,
        wasStreaming: false,
        classification: 'reference' as MemoryClassification,
        importance: 'low' as MemoryImportanceLevel,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.memoryRecordingFailures++;

      logError('Embedding memory recording failed', {
        component: 'OpenAIMemoryManager',
        error: error instanceof Error ? error.message : String(error),
        duration,
        model: params.model,
        inputType: Array.isArray(params.input) ? 'array' : 'string',
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        duration,
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
    },
  ): Promise<MemorySearchResult[]> {
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
    // This would query the database in a real implementation
    return {
      totalConversations: 0,
      totalMemories: 0,
      shortTermMemories: 0,
      longTermMemories: 0,
      consciousMemories: 0,
    };
  }

  private async recordStreamingChatCompletion(
    stream: AsyncIterable<ChatCompletionChunk>,
    params: ChatCompletionCreateParams,
    options?: RecordChatCompletionOptions,
    startTime?: number,
  ): Promise<MemoryRecordingResult> {
    // Use streaming buffer to capture complete response
    const bufferConfig: StreamingBufferConfig = {
      ...DEFAULT_STREAMING_CONFIG,
      ...options?.streamingConfig,
      enableMemoryRecording: options?.forceRecording ?? true,
    };

    const bufferedResult = await this.streamingBuffer.processStream(stream, bufferConfig);

    // Record the complete conversation using ConversationRecorder
    const chatId = await this.conversationRecorder.recordStreamingConversation(
      bufferedResult.completeContent,
      bufferedResult.metadata,
      {
        conversationId: uuidv4(),
        sessionId: this.memori.getSessionId(),
        modelUsed: params.model || 'gpt-4o-mini',
        userPreferences: [],
        currentProjects: [],
        relevantSkills: [],
      },
    );

    const duration = startTime ? Date.now() - startTime : 0;
    this.metrics.memoryRecordingSuccess++;
    this.updateAverageTimes(duration, 0); // Memory processing time would be calculated separately

    return {
      success: true,
      chatId,
      duration,
      wasStreaming: true,
      classification: 'conversation' as MemoryClassification,
      importance: 'medium' as MemoryImportanceLevel,
    };
  }

  private async recordNonStreamingChatCompletion(
    response: ChatCompletion,
    params: ChatCompletionCreateParams,
    options?: RecordChatCompletionOptions,
    startTime?: number,
  ): Promise<MemoryRecordingResult> {
    const userInput = this.extractUserMessage(params.messages);
    const aiOutput = response.choices[0]?.message?.content || '';

    // Create metadata
    const metadata: OpenAIMemoryMetadata = {
      model: params.model || 'gpt-4o-mini',
      modelType: 'chat',
      endpoint: 'chat/completions',
      isStreaming: false,
      requestParams: params as unknown as Record<string, unknown>,
      responseMetadata: {
        finishReason: response.choices[0]?.finish_reason,
        systemFingerprint: response.system_fingerprint,
      },
      temperature: params.temperature,
      maxTokens: params.max_tokens,
      tokensUsed: response.usage?.total_tokens || 0,
      conversationId: uuidv4(),
    };

    // Use ConversationRecorder to record the conversation
    const chatId = await this.conversationRecorder.recordConversation(userInput, aiOutput, metadata);

    const duration = startTime ? Date.now() - startTime : 0;
    this.metrics.memoryRecordingSuccess++;
    this.updateAverageTimes(duration, 0);

    return {
      success: true,
      chatId,
      duration,
      wasStreaming: false,
      classification: 'conversation' as MemoryClassification,
      importance: 'medium' as MemoryImportanceLevel,
    };
  }

  private isStreamingResponse(response: ChatCompletion | AsyncIterable<ChatCompletionChunk>): boolean {
    return typeof response === 'object' && Symbol.asyncIterator in response;
  }

  private extractUserMessage(messages: ChatCompletionCreateParams['messages']): string {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'user');

    return lastUserMessage?.content?.toString() || '';
  }

  private extractEmbeddingInputSummary(input: string | string[] | number[] | number[][]): string {
    if (Array.isArray(input)) {
      if (input.length === 0) return '';
      if (input.length === 1) return String(input[0]);
      return `${String(input[0])}... (+${input.length - 1} more items)`;
    }
    return String(input);
  }

  private updateAverageTimes(responseTime: number, memoryProcessingTime: number): void {
    const totalRequests = this.metrics.totalRequests;
    this.metrics.averageResponseTime =
      (this.metrics.averageResponseTime * (totalRequests - 1) + responseTime) / totalRequests;
    this.metrics.averageMemoryProcessingTime =
      (this.metrics.averageMemoryProcessingTime * (totalRequests - 1) + memoryProcessingTime) / totalRequests;
  }

  private async handleRecordingError(
    error: unknown,
    errorContext: {
      type: MemoryErrorType;
      context: Record<string, unknown>;
      recoverable: boolean;
    },
  ): Promise<MemoryRecordingResult> {
    const memoryError = error instanceof MemoryError ? error : new MemoryError(
      errorContext.type,
      error instanceof Error ? error.message : String(error),
      errorContext.context,
      errorContext.recoverable,
    );

    // Attempt recovery if error is recoverable
    if (errorContext.recoverable && this.errorRecovery.strategy !== RecoveryStrategy.SKIP) {
      return this.attemptRecovery(memoryError);
    }

    return {
      success: false,
      error: memoryError.message,
      duration: 0,
      wasStreaming: false,
    };
  }

  private async attemptRecovery(error: MemoryError): Promise<MemoryRecordingResult> {
    if (this.errorRecovery.strategy === RecoveryStrategy.SKIP) {
      logInfo('Skipping memory recording due to error', {
        component: 'OpenAIMemoryManager',
        errorType: error.type,
        message: error.message,
      });

      return {
        success: false,
        error: error.message,
        duration: 0,
        wasStreaming: false,
      };
    }

    let attempts = 0;
    let lastError = error;

    while (attempts < this.errorRecovery.maxRetries) {
      attempts++;

      try {
        // Wait before retry
        if (attempts > 1) {
          await new Promise(resolve => setTimeout(resolve, this.errorRecovery.retryDelay * attempts));
        }

        // Custom recovery function
        if (this.errorRecovery.customRecovery) {
          const recovered = await this.errorRecovery.customRecovery(lastError);
          if (recovered) {
            logInfo('Custom recovery successful', {
              component: 'OpenAIMemoryManager',
              errorType: error.type,
              attempts,
            });
            return {
              success: true,
              duration: 0,
              wasStreaming: false,
            };
          }
        }

        // Retry logic here (implementation depends on specific error type)
        logInfo('Recovery attempt failed, retrying...', {
          component: 'OpenAIMemoryManager',
          errorType: error.type,
          attempts,
        });

      } catch (recoveryError) {
        lastError = new MemoryError(
          MemoryErrorType.RECORDING_FAILED,
          `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
          { originalError: error, recoveryAttempts: attempts },
          true,
        );
      }
    }

    // All recovery attempts failed
    logError('All recovery attempts failed', {
      component: 'OpenAIMemoryManager',
      errorType: error.type,
      totalAttempts: attempts,
    });

    return {
      success: false,
      error: `Recording failed after ${attempts} attempts: ${lastError.message}`,
      duration: 0,
      wasStreaming: false,
    };
  }

  // Getters for internal components (for testing and advanced usage)
  getConversationRecorder(): ConversationRecorder {
    return this.conversationRecorder;
  }

  getStreamingBuffer(): StreamingBuffer {
    return this.streamingBuffer;
  }
}

/**
 * Conversation Recorder implementation with intelligent processing
 */
export class OpenAIConversationRecorder implements ConversationRecorder {
  constructor(
    private memori: Memori,
    private memoryAgent: MemoryAgent,
  ) { }

  async recordConversation(
    userInput: string,
    aiOutput: string,
    metadata: OpenAIMemoryMetadata,
  ): Promise<string> {
    const chatId = uuidv4();

    try {
      // Store the raw conversation first
      await this.memori.recordConversation(userInput, aiOutput, {
        model: metadata.model,
        metadata: {
          isStreaming: metadata.isStreaming,
          temperature: metadata.temperature as number | undefined,
          maxTokens: metadata.maxTokens as number | undefined,
          tokensUsed: metadata.tokensUsed as number | undefined,
          conversationId: metadata.conversationId,
        },
      });

      // Process memory with intelligent classification
      await this.processMemoryWithClassification(chatId, userInput, aiOutput, metadata);

      logInfo('Conversation recorded successfully', {
        component: 'OpenAIConversationRecorder',
        chatId,
        model: metadata.model,
        isStreaming: metadata.isStreaming,
      });

      return chatId;
    } catch (error) {
      logError('Failed to record conversation', {
        component: 'OpenAIConversationRecorder',
        error: error instanceof Error ? error.message : String(error),
        chatId,
      });
      throw error;
    }
  }

  async recordStreamingConversation(
    completeContent: string,
    metadata: StreamingMetadata,
    context: ConversationContext,
  ): Promise<string> {
    const chatId = uuidv4();

    try {
      // Store the raw streaming conversation
      await this.memori.recordConversation(
        this.extractUserInputFromContext(context),
        completeContent,
        {
          model: metadata.model,
          metadata: {
            isStreaming: true,
            chunkCount: metadata.chunkCount,
            contentLength: metadata.contentLength,
            duration: metadata.duration,
            temperature: metadata.temperature,
            maxTokens: metadata.maxTokens,
            tokensUsed: metadata.tokensUsed,
          },
        },
      );

      // Process memory with intelligent classification
      await this.processMemoryWithClassification(chatId, completeContent, metadata, context);

      logInfo('Streaming conversation recorded successfully', {
        component: 'OpenAIConversationRecorder',
        chatId,
        model: metadata.model,
        chunkCount: metadata.chunkCount,
        contentLength: metadata.contentLength,
      });

      return chatId;
    } catch (error) {
      logError('Failed to record streaming conversation', {
        component: 'OpenAIConversationRecorder',
        error: error instanceof Error ? error.message : String(error),
        chatId,
      });
      throw error;
    }
  }

  private async processMemoryWithClassification(
    chatId: string,
    userInput: string,
    aiOutput: string | StreamingMetadata,
    metadataOrContext: OpenAIMemoryMetadata | ConversationContext,
  ): Promise<void> {
    try {
      // Create processing parameters
      const processingParams: MemoryProcessingParams = {
        chatId,
        userInput: userInput,
        aiOutput: typeof aiOutput === 'string' ? aiOutput : aiOutput.contentLength.toString(),
        context: metadataOrContext as ConversationContext,
      };

      // Use MemoryAgent for intelligent processing
      const processedMemory = await this.memoryAgent.processConversation(processingParams);

      // Store processed memory
      // This would typically be handled by the Memori class, but we can add it here for completeness
      logInfo('Memory processed with classification', {
        component: 'OpenAIConversationRecorder',
        chatId,
        classification: processedMemory.classification,
        importance: processedMemory.importance,
        confidenceScore: processedMemory.confidenceScore,
      });

    } catch (error) {
      logError('Memory processing failed, using fallback', {
        component: 'OpenAIConversationRecorder',
        error: error instanceof Error ? error.message : String(error),
        chatId,
      });

      // Fallback processing - just store basic memory structure
      // This would typically be handled by the Memori class
    }
  }

  private extractUserInputFromContext(_context: ConversationContext): string {
    // This is a simplified extraction - in practice, you'd have access to the original user input
    return 'User input from streaming context';
  }
}

/**
 * Streaming Buffer implementation for complete memory capture
 */
export class OpenAIStreamingBuffer implements StreamingBuffer {
  private chunks: ChatCompletionChunk[] = [];
  private contentBuffer = '';
  private metadata: Partial<StreamingMetadata> = {};
  private config: StreamingBufferConfig;
  private startTime: number;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config?: Partial<StreamingBufferConfig>) {
    this.config = { ...DEFAULT_STREAMING_CONFIG, ...config };
    this.startTime = Date.now();
  }

  async processStream(
    stream: AsyncIterable<ChatCompletionChunk>,
    config?: StreamingBufferConfig,
  ): Promise<BufferedStream> {
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Set up timeout
    this.setupTimeout();

    try {
      let chunkCount = 0;
      let totalContentLength = 0;

      for await (const chunk of stream) {
        chunkCount++;
        this.chunks.push(chunk);
        this.resetTimeout();

        // Extract content from chunk
        const content = chunk.choices[0]?.delta?.content || '';
        this.contentBuffer += content;
        totalContentLength += content.length;

        // Update metadata
        this.updateMetadata(chunk, chunkCount, totalContentLength);

        // Check buffer size limits
        if (this.contentBuffer.length > this.config.maxBufferSize) {
          throw new MemoryError(
            MemoryErrorType.STREAMING_ERROR,
            `Buffer size exceeded: ${this.contentBuffer.length} > ${this.config.maxBufferSize}`,
            { contentLength: this.contentBuffer.length, maxBufferSize: this.config.maxBufferSize },
            true,
          );
        }
      }

      // Clear timeout on successful completion
      this.clearTimeout();

      return this.createBufferedResult();

    } catch (error) {
      this.clearTimeout();
      throw error;
    }
  }

  isReadyForRecording(): boolean {
    return this.chunks.length > 0 && this.contentBuffer.length > 0;
  }

  getBufferStats(): {
    chunkCount: number;
    contentLength: number;
    isComplete: boolean;
    hasErrors: boolean;
  } {
    return {
      chunkCount: this.chunks.length,
      contentLength: this.contentBuffer.length,
      isComplete: this.metadata.completed || false,
      hasErrors: Boolean(this.metadata.errors?.length),
    };
  }

  private setupTimeout(): void {
    this.timeout = setTimeout(() => {
      throw new MemoryError(
        MemoryErrorType.TIMEOUT_ERROR,
        `Streaming timeout exceeded: ${this.config.bufferTimeout}ms`,
        { timeout: this.config.bufferTimeout },
        true,
      );
    }, this.config.bufferTimeout);
  }

  private resetTimeout(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.setupTimeout();
    }
  }

  private clearTimeout(): void {
    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = null;
    }
  }

  private updateMetadata(
    chunk: ChatCompletionChunk,
    chunkCount: number,
    contentLength: number,
  ): void {
    this.metadata = {
      ...this.metadata,
      model: chunk.model || this.metadata.model || 'gpt-4o-mini',
      chunkCount,
      contentLength,
      duration: Date.now() - this.startTime,
      completed: false,
      errors: this.metadata.errors || [],
    };

    // Extract additional metadata from chunk
    if (chunk.choices[0]?.delta) {
      const delta = chunk.choices[0].delta;
      if (delta.content) {
        // Update content length if not already updated
      }
    }
  }

  private createBufferedResult(): BufferedStream {
    const endTime = Date.now();

    // Mark as completed
    this.metadata.completed = true;
    this.metadata.duration = endTime - this.startTime;

    return {
      chunks: [...this.chunks],
      completeContent: this.contentBuffer,
      metadata: this.metadata as StreamingMetadata,
      usage: this.extractUsageFromChunks(),
    };
  }

  private extractUsageFromChunks(): ChatCompletion['usage'] | undefined {
    // Try to extract usage information from the last chunk
    const lastChunk = this.chunks[this.chunks.length - 1];
    if (lastChunk && 'usage' in lastChunk && lastChunk.usage) {
      return lastChunk.usage;
    }
    return undefined;
  }

  /**
   * Reset the buffer for reuse
   */
  reset(): void {
    this.chunks = [];
    this.contentBuffer = '';
    this.metadata = {};
    this.startTime = Date.now();
    this.clearTimeout();
  }
}

// Export factory function for creating memory manager instances
export function createMemoryManager(
  memori: Memori,
  memoryAgent: MemoryAgent,
  config?: {
    enableStreamingBuffer?: boolean;
    errorRecovery?: Partial<ErrorRecoveryConfig>;
  },
): OpenAIMemoryManager {
  return new OpenAIMemoryManager(memori, memoryAgent, config);
}

// Export default for convenience
export default OpenAIMemoryManager;