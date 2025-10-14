// Ultra-lean OpenAI wrapper that integrates directly with Memori
import { Memori } from '../../core/Memori';
import { OpenAIWrapperConfig, ChatMessage, ChatResponse, EmbeddingResponse } from '../types';
import OpenAI from 'openai';

export class OpenAIWrapper {
  private client: OpenAI;

  constructor(
    private memori: Memori,
    private config: OpenAIWrapperConfig = {}
  ) {
    // Initialize OpenAI client with config
    this.client = new OpenAI({
      apiKey: this.config.apiKey || process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Make a chat completion request with automatic memory recording
   * Optimized with proper error handling and validation
   */
  async chat(params: {
    messages: ChatMessage[];
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }): Promise<ChatResponse> {
    try {
      // Validate input parameters
      if (!params.messages || params.messages.length === 0) {
        throw new Error('Messages array cannot be empty');
      }

      // Get the last user message for memory recording
      const lastUserMessage = [...params.messages]
        .reverse()
        .find(m => m.role === 'user');

      if (!lastUserMessage) {
        throw new Error('No user message found in conversation');
      }

      // Validate message format
      for (const message of params.messages) {
        if (!message.content || typeof message.content !== 'string') {
          throw new Error('All messages must have valid content');
        }
      }

      // Make the API call with optimized parameters
      const response = await this.callOpenAIAPI({
        model: params.model || this.config.model || 'gpt-4o-mini',
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
      // Enhanced error handling with suggestions
      const message = `OpenAI chat failed: ${error instanceof Error ? error.message : String(error)}`;
      throw new Error(`${message}. Check your API key and network connection.`);
    }
  }

  /**
   * Create embeddings (memory recording can be added later)
   */
  async embeddings(params: {
    input: string | string[];
    model?: string;
  }): Promise<EmbeddingResponse> {
    try {
      const response = await this.callOpenAIEmbeddingsAPI({
        model: params.model || this.config.model || 'text-embedding-3-small',
        input: params.input,
      });

      return {
        embeddings: response.data.map((d: any) => d.embedding),
        usage: response.usage,
        model: response.model
      };

    } catch (error) {
      throw new Error(`OpenAI embeddings failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Actual OpenAI API calls using the official SDK
   * Optimized for performance and reliability
   */
  private async callOpenAIAPI(params: any) {
    try {
      const response = await this.client.chat.completions.create({
        model: params.model,
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
      });

      return {
        content: response.choices[0].message.content || '',
        model: response.model,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          completion_tokens: response.usage?.completion_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI API error: ${error.message}`);
      }
      throw new Error(`OpenAI API request failed: ${String(error)}`);
    }
  }

  private async callOpenAIEmbeddingsAPI(params: any) {
    try {
      const response = await this.client.embeddings.create({
        model: params.model,
        input: params.input,
      });

      return {
        data: response.data,
        usage: {
          prompt_tokens: response.usage?.prompt_tokens || 0,
          total_tokens: response.usage?.total_tokens || 0
        },
        model: response.model
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`OpenAI embeddings API error: ${error.message}`);
      }
      throw new Error(`OpenAI embeddings request failed: ${String(error)}`);
    }
  }
}