import { ILLMProvider } from './ILLMProvider';
import { IProviderConfig } from './IProviderConfig';
import { ProviderType } from './ProviderType';
import { ChatCompletionParams } from './types/ChatCompletionParams';
import { ChatCompletionResponse } from './types/ChatCompletionResponse';
import { EmbeddingParams } from './types/EmbeddingParams';
import { EmbeddingResponse } from './types/EmbeddingResponse';
import { ProviderDiagnostics } from './types/ProviderDiagnostics';

/**
 * Ollama API types (based on Ollama REST API)
 */
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

/**
 * Ollama provider implementation
 * Implements the ILLMProvider interface for local Ollama models
 */
export class OllamaProvider implements ILLMProvider {
  private config: IProviderConfig;
  private model: string;
  private isInitialized = false;
  private baseUrl: string;

  constructor(config: IProviderConfig) {
    this.config = config;
    this.model = config.model || 'llama2:7b';
    this.baseUrl = config.baseUrl || 'http://localhost:11434';
  }

  getProviderType(): ProviderType {
    return ProviderType.OLLAMA;
  }

  getConfig(): IProviderConfig {
    return { ...this.config };
  }

  async initialize(config: IProviderConfig): Promise<void> {
    this.config = config;
    this.model = config.model || 'llama2:7b';
    if (config.baseUrl) {
      this.baseUrl = config.baseUrl;
    }
    this.isInitialized = true;
  }

  async dispose(): Promise<void> {
    this.isInitialized = false;
  }

  async isHealthy(): Promise<boolean> {
    if (!this.isInitialized) {
      return false;
    }

    try {
      // Check if Ollama service is running by listing local models
      const response = await fetch(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        return true;
      }

      // If tags endpoint fails, try the version endpoint
      const versionResponse = await fetch(`${this.baseUrl}/api/version`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      return versionResponse.ok;
    } catch (error) {
      // Network errors or connection refused means Ollama is not running
      return false;
    }
  }

  async getDiagnostics(): Promise<ProviderDiagnostics> {
    const isHealthy = await this.isHealthy();

    return {
      providerType: ProviderType.OLLAMA,
      isInitialized: this.isInitialized,
      isHealthy,
      model: this.model,
      metadata: {
        baseUrl: this.baseUrl,
        hasApiKey: !!this.config.apiKey,
        apiKey: this.config.apiKey || 'ollama-local',
        localModel: true,
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

    try {
      // Convert messages to Ollama format
      const ollamaMessages = this.convertToOllamaMessages(params.messages);

      const requestBody: OllamaChatRequest = {
        model: params.model || this.model,
        messages: ollamaMessages,
        options: {
          temperature: params.temperature,
          top_p: params.top_p,
          repeat_penalty: params.frequency_penalty,
          presence_penalty: params.presence_penalty,
          num_predict: params.max_tokens,
          stop: Array.isArray(params.stop) ? params.stop : params.stop ? [params.stop] : undefined,
        },
        stream: params.stream || false,
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

      // Handle streaming response
      if (params.stream) {
        throw new Error('Streaming responses are not yet supported in this provider implementation');
      }

      return {
        message: {
          role: ollamaResponse.message.role as 'user' | 'assistant',
          content: ollamaResponse.message.content,
        },
        finish_reason: 'stop',
        usage: ollamaResponse.prompt_eval_count ? {
          prompt_tokens: ollamaResponse.prompt_eval_count,
          completion_tokens: ollamaResponse.eval_count || 0,
          total_tokens: (ollamaResponse.prompt_eval_count || 0) + (ollamaResponse.eval_count || 0),
        } : undefined,
        id: `ollama-${Date.now()}`,
        model: ollamaResponse.model,
        created: Date.parse(ollamaResponse.created_at),
        metadata: {
          total_duration: ollamaResponse.total_duration,
          load_duration: ollamaResponse.load_duration,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ollama API request failed: ${String(error)}`);
    }
  }

  async createEmbedding(params: EmbeddingParams): Promise<EmbeddingResponse> {
    if (!this.isInitialized) {
      throw new Error('Provider not initialized');
    }

    try {
      const inputText = Array.isArray(params.input) ? params.input[0] : params.input;

      const requestBody: OllamaEmbeddingRequest = {
        model: params.model || this.model,
        prompt: inputText,
        options: params.dimensions ? {
          num_ctx: 2048,
        } : undefined,
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
        data: ollamaResponse.embeddings.map((embedding, index) => ({
          index,
          embedding,
          object: 'embedding',
        })),
        model: ollamaResponse.model,
        usage: ollamaResponse.prompt_eval_count ? {
          prompt_tokens: ollamaResponse.prompt_eval_count,
          total_tokens: ollamaResponse.prompt_eval_count,
        } : undefined,
        id: `ollama-embedding-${Date.now()}`,
        created: Date.now(),
        metadata: {
          total_duration: ollamaResponse.total_duration,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Ollama embeddings request failed: ${String(error)}`);
    }
  }

  getClient(): any {
    return {
      providerType: 'ollama',
      model: this.model,
      baseUrl: this.baseUrl,
      local: true,
    };
  }

  /**
   * Convert standard messages to Ollama format
   */
  private convertToOllamaMessages(messages: ChatCompletionParams['messages']): OllamaMessage[] {
    return messages
      .filter(msg => msg.role !== 'function') // Ollama doesn't support function calls
      .map(msg => ({
        role: msg.role === 'system' ? 'system' : msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      }));
  }
}