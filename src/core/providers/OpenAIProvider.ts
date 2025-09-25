// src/core/providers/OpenAIProvider.ts
import OpenAI from 'openai';

export class OpenAIProvider {
  private client: OpenAI;
  private model: string;

  constructor(config: { apiKey: string; model?: string; baseUrl?: string }) {
    // Handle dummy API key for Ollama
    const apiKey = config.apiKey === 'ollama-local' ? 'sk-dummy-key-for-ollama' : config.apiKey;

    this.client = new OpenAI({
      apiKey: apiKey,
      baseURL: config.baseUrl
    });
    this.model = config.model || 'gpt-4o-mini';
  }

  getClient(): OpenAI {
    return this.client;
  }

  getModel(): string {
    return this.model;
  }

  async createEmbedding(input: string): Promise<number[]> {
    const response = await this.client.embeddings.create({
      model: "text-embedding-ada-002",
      input: input,
    });
    return response.data[0].embedding;
  }
}