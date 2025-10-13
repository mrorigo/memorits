import OpenAI from 'openai';
import { ILLMProvider } from './ILLMProvider';
import { IProviderConfig } from './IProviderConfig';
import { ProviderType } from './ProviderType';
import { ChatCompletionParams } from './types/ChatCompletionParams';
import { ChatCompletionResponse } from './types/ChatCompletionResponse';
import { EmbeddingParams } from './types/EmbeddingParams';
import { EmbeddingResponse } from './types/EmbeddingResponse';
import { ProviderDiagnostics } from './types/ProviderDiagnostics';

/**
 * OpenAI provider implementation
 * Implements the ILLMProvider interface for OpenAI-compatible APIs
 */
export class OpenAIProvider implements ILLMProvider {
  private client: OpenAI;
  private config: IProviderConfig;
  private model: string;
  private isInitialized = false;

  constructor(config: IProviderConfig) {
    this.config = config;
    this.model = config.model || 'gpt-4o-mini';

    // Handle dummy API key for Ollama
    const apiKey = config.apiKey === 'ollama-local' ? 'sk-dummy-key-for-ollama' : config.apiKey;

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: config.baseUrl,
    });
  }

  getProviderType(): ProviderType {
    return this.config.apiKey === 'ollama-local' ||
           this.config.baseUrl?.includes('ollama') ||
           this.config.baseUrl?.includes('11434')
      ? ProviderType.OLLAMA
      : ProviderType.OPENAI;
  }

  getConfig(): IProviderConfig {
    return { ...this.config };
  }

  async initialize(config: IProviderConfig): Promise<void> {
    this.config = config;
    this.model = config.model || 'gpt-4o-mini';
    this.isInitialized = true;
  }

  async dispose(): Promise<void> {
    // Clean up any resources if needed
    this.isInitialized = false;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Simple health check - try to list models
      await this.client.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getDiagnostics(): Promise<ProviderDiagnostics> {
    return {
      providerType: this.getProviderType(),
      isInitialized: this.isInitialized,
      isHealthy: await this.isHealthy(),
      model: this.model,
      metadata: {
        baseUrl: this.config.baseUrl,
        hasApiKey: !!this.config.apiKey,
        providerType: this.getProviderType(),
      },
      timestamp: new Date(),
    };
  }

  getModel(): string {
    return this.model;
  }

  async createChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    const response = await this.client.chat.completions.create({
      model: params.model || this.model,
      messages: params.messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      temperature: params.temperature,
      max_tokens: params.max_tokens,
      top_p: params.top_p,
      frequency_penalty: params.frequency_penalty,
      presence_penalty: params.presence_penalty,
      stop: params.stop,
      stream: params.stream,
      ...params.options,
    });

    // Handle streaming vs non-streaming response
    if (params.stream && 'choices' in response === false) {
      // This is a stream - for now, we'll throw an error as streaming is not yet supported
      throw new Error('Streaming responses are not yet supported in this provider implementation');
    }

    // Non-streaming response
    const chatResponse = response as OpenAI.Chat.Completions.ChatCompletion;

    return {
      message: {
        role: chatResponse.choices[0].message.role || 'assistant',
        content: chatResponse.choices[0].message.content || '',
        function_call: chatResponse.choices[0].message.function_call ? {
          name: chatResponse.choices[0].message.function_call.name,
          arguments: chatResponse.choices[0].message.function_call.arguments,
        } : undefined,
        tool_calls: chatResponse.choices[0].message.tool_calls?.filter(toolCall =>
          toolCall.type === 'function'
        ).map(toolCall => ({
          id: toolCall.id,
          type: 'function' as const,
          function: {
            name: (toolCall as any).function?.name || '',
            arguments: (toolCall as any).function?.arguments || '',
          },
        })),
      },
      finish_reason: chatResponse.choices[0].finish_reason || 'stop',
      usage: chatResponse.usage ? {
        prompt_tokens: chatResponse.usage.prompt_tokens,
        completion_tokens: chatResponse.usage.completion_tokens,
        total_tokens: chatResponse.usage.total_tokens,
      } : undefined,
      id: chatResponse.id,
      model: chatResponse.model,
      created: chatResponse.created,
      metadata: {
        system_fingerprint: (chatResponse as any).system_fingerprint,
      },
    };
  }

  async createEmbedding(params: EmbeddingParams): Promise<EmbeddingResponse> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    const response = await this.client.embeddings.create({
      model: params.model || 'text-embedding-3-small',
      input: params.input,
      encoding_format: params.encoding_format as 'float' | 'base64',
      dimensions: params.dimensions,
      user: params.user,
      ...params.options,
    });

    return {
      data: response.data.map((item, index) => ({
        index,
        embedding: item.embedding,
        object: item.object,
      })),
      model: response.model,
      usage: response.usage ? {
        prompt_tokens: response.usage.prompt_tokens,
        total_tokens: response.usage.total_tokens,
      } : undefined,
      id: (response as any).id,
      created: (response as any).created,
      metadata: {},
    };
  }

  getClient(): OpenAI {
    return this.client;
  }
}