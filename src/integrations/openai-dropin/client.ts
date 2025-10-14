import OpenAI from 'openai';
import { v4 as uuidv4 } from 'uuid';
import { MemoryEnabledLLMProvider, LLMProviderFactory, IProviderConfig } from '../../core/infrastructure/providers/';
import type {
  MemoriOpenAI,
  MemoryManager,
  ChatCompletionCreateParams,
  EmbeddingCreateParams,
} from './types';

/**
 * Simplified MemoriOpenAIClient implementation
 * Provides OpenAI SDK compatibility with transparent memory functionality
 */
export class MemoriOpenAIClient implements MemoriOpenAI {
  private memoryEnabledProvider?: MemoryEnabledLLMProvider;
  public config: IProviderConfig;

  constructor(config: IProviderConfig) {
    this.config = {
      ...config,
      memory: {
        enableChatMemory: true,
        enableEmbeddingMemory: false,
        memoryProcessingMode: 'auto',
        minImportanceLevel: 'all',
        sessionId: uuidv4(),
        ...config.memory,
      },
    };
  }

  private async initializeProvider(): Promise<void> {
    if (this.memoryEnabledProvider) return;

    const baseProvider = await LLMProviderFactory.createProviderFromConfig(this.config);
    this.memoryEnabledProvider = new MemoryEnabledLLMProvider(baseProvider, this.config);
    await this.memoryEnabledProvider.initialize(this.config);
  }

  // Simple OpenAI SDK adapter methods
  get chat(): OpenAI.Chat {
    return this.createChatInterface();
  }

  get embeddings(): OpenAI.Embeddings {
    return this.createEmbeddingsInterface();
  }

  get memory(): MemoryManager {
    if (!this.memoryEnabledProvider) {
      throw new Error('MemoriOpenAIClient not initialized. Call enable() first.');
    }
    return this.memoryEnabledProvider;
  }

  private createChatInterface(): OpenAI.Chat {
    return {
      completions: {
        create: async (params: ChatCompletionCreateParams, options?: OpenAI.RequestOptions) => {
          if (!this.memoryEnabledProvider) {
            await this.initializeProvider();
          }

          if (!this.memoryEnabledProvider) {
            throw new Error('Failed to initialize MemoriOpenAIClient');
          }

          const response = await this.memoryEnabledProvider.createChatCompletion({
            model: params.model || this.memoryEnabledProvider.getModel(),
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
            return {
              id: response.id || 'memori-generated-id',
              object: 'chat.completion',
              created: response.created || Date.now(),
              model: response.model || params.model || this.memoryEnabledProvider.getModel(),
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

          return {
            id: response.id || 'memori-generated-id',
            object: 'chat.completion',
            created: response.created || Date.now(),
            model: response.model || params.model || this.memoryEnabledProvider.getModel(),
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

  private createEmbeddingsInterface(): OpenAI.Embeddings {
    return {
      create: async (params: EmbeddingCreateParams, options?: OpenAI.RequestOptions) => {
        if (!this.memoryEnabledProvider) {
          await this.initializeProvider();
        }

        if (!this.memoryEnabledProvider) {
          throw new Error('Failed to initialize MemoriOpenAIClient');
        }

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

  async enable(): Promise<void> {
    if (!this.memoryEnabledProvider) {
      await this.initializeProvider();
    }
  }

  async disable(): Promise<void> {
    if (this.memoryEnabledProvider) {
      await this.memoryEnabledProvider.dispose();
    }
  }

  async close(): Promise<void> {
    await this.disable();
  }

  async getMetrics(): Promise<any> {
    if (!this.memoryEnabledProvider) {
      return {
        totalRequests: 0,
        memoryRecordingSuccess: 0,
        memoryRecordingFailures: 0,
        averageResponseTime: 0,
        averageMemoryProcessingTime: 0,
      };
    }
    return this.memoryEnabledProvider.getMetrics();
  }

  async resetMetrics(): Promise<void> {
    // Metrics are handled by MemoryEnabledLLMProvider
  }

  async updateConfig(config: any): Promise<void> {
    this.config = { ...this.config, ...config };
    if (this.memoryEnabledProvider) {
      this.memoryEnabledProvider.updateMemoryConfig(config.memory || {});
    }
  }

  get isEnabled(): boolean {
    return this.memoryEnabledProvider !== undefined;
  }

  get sessionId(): string {
    return this.config.memory?.sessionId || '';
  }

  getConfig(): IProviderConfig {
    return { ...this.config };
  }
}

// Export types for external usage
export type { MemoriOpenAI };
export default MemoriOpenAIClient;