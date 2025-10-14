// Ultra-lean Anthropic wrapper that integrates directly with Memori
import { Memori } from '../../core/Memori';
import { AnthropicWrapperConfig, ChatMessage, ChatResponse } from '../types';
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicWrapper {
  private client: Anthropic;

  constructor(
    private memori: Memori,
    private config: AnthropicWrapperConfig = {}
  ) {
    // Handle dummy API key for testing
    const apiKey = config.apiKey === 'anthropic-dummy' ? 'sk-ant-api03-dummy-key-for-testing' : config.apiKey;

    this.client = new Anthropic({
      apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
    });
  }

  /**
   * Make a chat completion request with automatic memory recording
   */
  async chat(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ChatResponse> {
    try {
      // Get the last user message for memory recording
      const lastUserMessage = [...params.messages]
        .reverse()
        .find(m => m.role === 'user');

      if (!lastUserMessage) {
        throw new Error('No user message found');
      }

      // Make the API call (simplified for this example)
      const response = await this.callAnthropicAPI({
        model: params.model || this.config.model || 'claude-3-5-sonnet-20241022',
        messages: params.messages,
        temperature: params.temperature ?? this.config.temperature ?? 0.7,
        max_tokens: params.maxTokens ?? this.config.maxTokens ?? 1000,
      });

      // Record the conversation in memory automatically
      const chatId = await this.memori.recordConversation(
        lastUserMessage.content,
        response.content
      );

      return {
        content: response.content,
        chatId,
        model: response.model,
        usage: response.usage
      };

    } catch (error) {
      throw new Error(`Anthropic chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Actual Anthropic API calls using the official SDK
   */
  private async callAnthropicAPI(params: any) {
    try {
      // Convert messages to Anthropic SDK format
      const anthropicMessages = this.convertToAnthropicMessages(params.messages);
      const systemMessage = this.extractSystemMessage(params.messages);

      const response = await this.client.messages.create({
        model: params.model,
        messages: anthropicMessages,
        max_tokens: params.max_tokens || 4096,
        temperature: params.temperature,
        system: systemMessage,
      });

      return {
        content: this.extractTextContent(response.content),
        model: response.model,
        usage: {
          input_tokens: response.usage?.input_tokens || 0,
          output_tokens: response.usage?.output_tokens || 0,
          total_tokens: (response.usage?.input_tokens || 0) + (response.usage?.output_tokens || 0)
        }
      };
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

  /**
   * Convert standard messages to Anthropic SDK format
   */
  private convertToAnthropicMessages(messages: ChatMessage[]) {
    return messages
      .filter(msg => msg.role !== 'system') // System messages are handled separately
      .map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
      }));
  }

  /**
   * Extract system message from messages array
   */
  private extractSystemMessage(messages: ChatMessage[]): string | undefined {
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
}