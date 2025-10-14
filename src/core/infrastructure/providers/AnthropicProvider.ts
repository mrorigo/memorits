import Anthropic from '@anthropic-ai/sdk';
import { ILLMProvider } from './ILLMProvider';
import { IProviderConfig } from './IProviderConfig';
import { ProviderType } from './ProviderType';
import { ChatCompletionParams } from './types/ChatCompletionParams';
import { ChatCompletionResponse } from './types/ChatCompletionResponse';
import { EmbeddingParams } from './types/EmbeddingParams';
import { EmbeddingResponse } from './types/EmbeddingResponse';
import { ProviderDiagnostics } from './types/ProviderDiagnostics';

/**
 * Anthropic provider implementation using official SDK
 * Implements the ILLMProvider interface for Anthropic Claude models
 */
export class AnthropicProvider implements ILLMProvider {
  private client: Anthropic;
  private config: IProviderConfig;
  private model: string;
  private isInitialized = false;

  constructor(config: IProviderConfig) {
    this.config = config;
    this.model = config.model || 'claude-3-5-sonnet-20241022';

    // Handle dummy API key for testing
    const apiKey = config.apiKey === 'anthropic-dummy' ? 'sk-ant-api03-dummy-key-for-testing' : config.apiKey;

    this.client = new Anthropic({
      apiKey: apiKey,
      baseURL: config.baseUrl,
    });
  }

  getProviderType(): ProviderType {
    return ProviderType.ANTHROPIC;
  }

  getConfig(): IProviderConfig {
    return { ...this.config };
  }

  async initialize(config: IProviderConfig): Promise<void> {
    this.config = config;
    this.model = config.model || 'claude-3-5-sonnet-20241022';

    // Reinitialize client if configuration changed
    const apiKey = config.apiKey === 'anthropic-dummy' ? 'sk-ant-api03-dummy-key-for-testing' : config.apiKey;

    this.client = new Anthropic({
      apiKey: apiKey,
      baseURL: config.baseUrl,
    });

    this.isInitialized = true;
  }

  async dispose(): Promise<void> {
    this.isInitialized = false;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized || !this.config.apiKey) {
      return false;
    }

    try {
      // Use the SDK's model listing for health check
      await this.client.models.list();
      return true;
    } catch (error) {
      return false;
    }
  }

  async getDiagnostics(): Promise<ProviderDiagnostics> {
    const isHealthy = await this.isHealthy();

    return {
      providerType: ProviderType.ANTHROPIC,
      isInitialized: this.isInitialized,
      isHealthy,
      model: this.model,
      metadata: {
        baseUrl: this.config.baseUrl,
        hasApiKey: !!this.config.apiKey,
        apiKeyPrefix: this.config.apiKey?.substring(0, 7) + '...',
      },
      timestamp: new Date(),
    };
  }

  getModel(): string {
    return this.model;
  }

  async createChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    if (!this.isInitialized || !this.config.apiKey) {
      throw new Error('Provider not initialized or missing API key');
    }

    try {
      // Convert messages to Anthropic SDK format
      const anthropicMessages = this.convertToAnthropicMessages(params.messages);
      const systemMessage = this.extractSystemMessage(params.messages);

      // Prepare request parameters for SDK
      const requestParams: Anthropic.MessageCreateParams = {
        model: params.model || this.model,
        messages: anthropicMessages,
        max_tokens: params.max_tokens || 4096,
        temperature: params.temperature,
        top_p: params.top_p,
        stop_sequences: Array.isArray(params.stop) ? params.stop : params.stop ? [params.stop] : undefined,
        stream: params.stream || false,
        system: systemMessage,
        metadata: params.options,
      };

      // Handle streaming vs non-streaming separately with proper typing
      if (params.stream) {
        // For streaming, collect the complete response
        const streamResult = await this.client.messages.create({
          ...requestParams,
          stream: true,
        });

        let fullContent = '';
        let finalUsage: { input_tokens: number; output_tokens: number } | undefined;

        // Process the stream
        for await (const event of streamResult as AsyncIterable<Anthropic.MessageStreamEvent>) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullContent += event.delta.text;
          } else if (event.type === 'message_delta' && 'usage' in event) {
            finalUsage = {
              input_tokens: event.usage.input_tokens || 0,
              output_tokens: event.usage.output_tokens || 0,
            };
          }
        }

        return {
          message: {
            role: 'assistant',
            content: fullContent,
          },
          finish_reason: 'stop',
          usage: finalUsage ? {
            prompt_tokens: finalUsage.input_tokens,
            completion_tokens: finalUsage.output_tokens,
            total_tokens: finalUsage.input_tokens + finalUsage.output_tokens,
          } : undefined,
          id: `stream-${Date.now()}`,
          model: params.model || this.model,
          created: Date.now(),
          metadata: {},
        };
      } else {
        // Non-streaming request using SDK
        const response = await this.client.messages.create(requestParams) as Anthropic.Message;

        return {
          message: {
            role: response.role,
            content: this.extractTextContent(response.content),
          },
          finish_reason: this.mapStopReason(response.stop_reason),
          usage: response.usage ? {
            prompt_tokens: response.usage.input_tokens || 0,
            completion_tokens: response.usage.output_tokens || 0,
            total_tokens: (response.usage.input_tokens || 0) + (response.usage.output_tokens || 0),
          } : undefined,
          id: response.id,
          model: response.model,
          created: Date.now(),
          metadata: {},
        };
      }
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        throw new Error(`Anthropic API error: ${error.status} - ${error.message}`);
      }
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Anthropic API request failed: ${String(error)}`);
    }
  }

  async createEmbedding(params: EmbeddingParams): Promise<EmbeddingResponse> {
    if (!this.isInitialized || !this.config.apiKey) {
      throw new Error('Provider not initialized or missing API key');
    }

    // Note: Anthropic doesn't have a public embeddings API as of now
    // This is a placeholder for future implementation if they add one
    throw new Error('Embeddings are not supported by Anthropic API');
  }

  getClient(): Anthropic {
    return this.client;
  }

  /**
   * Convert standard messages to Anthropic SDK format
   */
  private convertToAnthropicMessages(messages: ChatCompletionParams['messages']): Anthropic.MessageParam[] {
    const anthropicMessages: Anthropic.MessageParam[] = [];

    for (const message of messages) {
      // Skip system messages - handled separately in SDK
      if (message.role === 'system') {
        continue;
      }

      // Handle function messages by converting to assistant content
      if (message.role === 'function') {
        anthropicMessages.push({
          role: 'assistant',
          content: message.content,
        });
      } else if (message.role === 'user' || message.role === 'assistant') {
        // Standard user and assistant messages
        anthropicMessages.push({
          role: message.role,
          content: message.content,
        });
      } else {
        // Fallback for any other roles
        anthropicMessages.push({
          role: 'user',
          content: message.content,
        });
      }
    }

    return anthropicMessages;
  }

  /**
   * Extract system message from messages array
   */
  private extractSystemMessage(messages: ChatCompletionParams['messages']): string | undefined {
    const systemMessage = messages.find(msg => msg.role === 'system');
    return systemMessage?.content;
  }

  /**
   * Extract text content from Anthropic content blocks
   */
  private extractTextContent(content: Anthropic.Messages.ContentBlock[]): string {
    return content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');
  }

  /**
   * Map Anthropic stop reasons to standard format
   */
  private mapStopReason(stopReason: string | null): 'stop' | 'length' | 'function_call' | 'content_filter' | 'tool_calls' | 'null' {
    switch (stopReason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      case 'tool_use':
        return 'tool_calls';
      default:
        return 'null';
    }
  }
}