import { ILLMProvider } from './ILLMProvider';
import { IProviderConfig } from './IProviderConfig';
import { ProviderType } from './ProviderType';
import { ChatCompletionParams } from './types/ChatCompletionParams';
import { ChatCompletionResponse } from './types/ChatCompletionResponse';
import { EmbeddingParams } from './types/EmbeddingParams';
import { EmbeddingResponse } from './types/EmbeddingResponse';
import { ProviderDiagnostics } from './types/ProviderDiagnostics';

/**
 * Anthropic API client types (based on Anthropic SDK)
 */
interface AnthropicMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<{ type: string; text?: string; source?: any }>;
}

interface AnthropicCompletionParams {
  model: string;
  messages: AnthropicMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  system?: string;
  metadata?: Record<string, any>;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  model: string;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Anthropic provider implementation
 * Implements the ILLMProvider interface for Anthropic Claude models
 */
export class AnthropicProvider implements ILLMProvider {
  private config: IProviderConfig;
  private model: string;
  private isInitialized = false;
  private baseUrl: string;

  constructor(config: IProviderConfig) {
    this.config = config;
    this.model = config.model || 'claude-sonnet-4-20250514';
    this.baseUrl = config.baseUrl || 'https://api.anthropic.com/v1';
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
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
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
      // Simple health check - try to list models (if endpoint exists)
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
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
        baseUrl: this.baseUrl,
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
      // Convert messages to Anthropic format
      const anthropicMessages = this.convertToAnthropicMessages(params.messages);
      const systemMessage = this.extractSystemMessage(params.messages);

      const requestBody: AnthropicCompletionParams = {
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

      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        let errorMessage = response.statusText;
        try {
          const errorData = await response.json() as { error?: { message: string } };
          errorMessage = errorData.error?.message || errorMessage;
        } catch {
          // Use default error message if JSON parsing fails
        }
        throw new Error(`Anthropic API error: ${response.status} - ${errorMessage}`);
      }

      const anthropicResponse = await response.json() as AnthropicResponse;

      // Handle streaming response
      if (params.stream) {
        throw new Error('Streaming responses are not yet supported in this provider implementation');
      }

      return {
        message: {
          role: anthropicResponse.role as 'user' | 'assistant',
          content: anthropicResponse.content[0]?.text || '',
        },
        finish_reason: this.mapStopReason(anthropicResponse.stop_reason) as 'stop' | 'length' | 'function_call' | 'content_filter' | 'tool_calls' | 'null',
        usage: {
          prompt_tokens: anthropicResponse.usage.input_tokens,
          completion_tokens: anthropicResponse.usage.output_tokens,
          total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens,
        },
        id: anthropicResponse.id,
        model: anthropicResponse.model,
        created: Date.now(),
        metadata: {},
      };
    } catch (error) {
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

  getClient(): any {
    // Return a mock client for compatibility
    return {
      providerType: 'anthropic',
      model: this.model,
      baseUrl: this.baseUrl,
    };
  }

  /**
   * Convert standard messages to Anthropic format
   */
  private convertToAnthropicMessages(messages: ChatCompletionParams['messages']): AnthropicMessage[] {
    const anthropicMessages: AnthropicMessage[] = [];

    for (const message of messages) {
      // Handle system messages separately
      if (message.role === 'system') {
        continue;
      }

      // Handle function and tool messages by converting to assistant
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
        // Fallback for any other roles (including 'tool' if it exists)
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
   * Map Anthropic stop reasons to standard format
   */
  private mapStopReason(stopReason: string | null): 'stop' | 'length' | 'function_call' | 'content_filter' | null {
    switch (stopReason) {
      case 'endofturn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return null;
    }
  }
}