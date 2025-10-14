// Ultra-lean Ollama wrapper that integrates directly with Memori
import { Memori } from '../../core/Memori';
import { OllamaWrapperConfig, ChatMessage, ChatResponse, EmbeddingResponse } from '../types';

// Ollama API types (based on Ollama REST API)
interface OllamaMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OllamaChatRequest {
  model: string;
  messages: OllamaMessage[];
  format?: string;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    repeat_last_n?: number;
    repeat_penalty?: number;
    presence_penalty?: number;
    frequency_penalty?: number;
    mirostat?: number;
    mirostat_eta?: number;
    mirostat_tau?: number;
    num_ctx?: number;
    num_gqa?: number;
    num_gpu?: number;
    num_thread?: number;
    num_predict?: number;
    tfs_z?: number;
    typical_p?: number;
    seed?: number;
    stop?: string[];
  };
  stream?: boolean;
  keep_alive?: string | number;
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
  options?: {
    num_ctx?: number;
    num_gqa?: number;
    num_gpu?: number;
    num_thread?: number;
    numgqa?: number;
    numa?: boolean;
    numbatch?: number;
    numgpulayers?: number;
  };
  keep_alive?: string | number;
}

interface OllamaEmbeddingResponse {
  model: string;
  embeddings: number[][];
  total_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
}

export class OllamaWrapper {
  private baseUrl: string;

  constructor(
    private memori: Memori,
    private config: OllamaWrapperConfig = {}
  ) {
    this.baseUrl = this.config.baseUrl || 'http://localhost:11434';
  }

  /**
   * Make a chat completion request with automatic memory recording
   */
  async chat(params: {
    messages: ChatMessage[];
    model?: string;
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
      const response = await this.callOllamaAPI({
        model: params.model || this.config.model || 'llama2',
        messages: params.messages,
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
      throw new Error(`Ollama chat failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Create embeddings with automatic memory recording
   */
  async embeddings(params: {
    input: string | string[];
    model?: string;
  }): Promise<EmbeddingResponse> {
    try {
      const response = await this.callOllamaEmbeddingsAPI({
        model: params.model || this.config.model || 'nomic-embed-text',
        input: params.input,
      });

      return {
        embeddings: response.embeddings,
        usage: response.usage,
        model: response.model
      };

    } catch (error) {
      throw new Error(`Ollama embeddings failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Actual Ollama API calls using HTTP requests
   */
  private async callOllamaAPI(params: any) {
    try {
      // Convert messages to Ollama format
      const ollamaMessages = this.convertToOllamaMessages(params.messages);

      const requestBody: OllamaChatRequest = {
        model: params.model,
        messages: ollamaMessages,
        options: {
          temperature: params.temperature,
          num_predict: params.max_tokens,
        },
        stream: false,
      };

      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Ollama API error: ${response.status} - ${errorText}`);
      }

      const ollamaResponse = await response.json() as OllamaChatResponse;

      return {
        content: ollamaResponse.message.content,
        model: ollamaResponse.model,
        usage: {
          prompt_tokens: ollamaResponse.prompt_eval_count || 0,
          completion_tokens: ollamaResponse.eval_count || 0,
          total_tokens: (ollamaResponse.prompt_eval_count || 0) + (ollamaResponse.eval_count || 0)
        }
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ollama API request failed: ${String(error)}`);
    }
  }

  private async callOllamaEmbeddingsAPI(params: any) {
    try {
      const inputText = Array.isArray(params.input) ? params.input[0] : params.input;

      const requestBody: OllamaEmbeddingRequest = {
        model: params.model,
        prompt: inputText,
      };

      const response = await fetch(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        throw new Error(`Ollama embeddings API error: ${response.status} - ${errorText}`);
      }

      const ollamaResponse = await response.json() as OllamaEmbeddingResponse;

      return {
        embeddings: ollamaResponse.embeddings,
        usage: {
          prompt_tokens: ollamaResponse.prompt_eval_count || 0,
          total_tokens: ollamaResponse.prompt_eval_count || 0
        },
        model: ollamaResponse.model
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ollama embeddings request failed: ${String(error)}`);
    }
  }

  /**
   * Convert standard messages to Ollama format
   */
  private convertToOllamaMessages(messages: ChatMessage[]): OllamaMessage[] {
    return messages
      .map(msg => ({
        role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));
  }
}