// src/integrations/openai.ts
import OpenAI from 'openai';
import { Memori } from '../core/Memori';

export class MemoriOpenAI {
  private client: OpenAI;
  private memori: Memori;

  constructor(memori: Memori, apiKey: string, options?: OpenAI.RequestOptions & { baseUrl?: string }) {
    this.memori = memori;
    this.client = new OpenAI({ apiKey, baseURL: options?.baseUrl, ...options });
  }

  get chat(): OpenAI.Chat {
    const originalChat = this.client.chat;

    return {
      completions: {
        create: async (params: OpenAI.Chat.ChatCompletionCreateParams) => {
          // Extract messages for memory recording
          const messages = params.messages;
          const lastUserMessage = messages
            .slice()
            .reverse()
            .find(m => m.role === 'user');

          const userInput = lastUserMessage?.content?.toString() || '';
          const model = params.model || 'gpt-4o-mini';

          // Make the original API call
          const response = await originalChat.completions.create(params);

          // Handle both streaming and non-streaming responses
          if ('choices' in response) {
            // Non-streaming response
            const aiOutput = response.choices[0]?.message?.content || '';

            // Record the conversation
            if (userInput && aiOutput) {
              try {
                await this.memori.recordConversation(userInput, aiOutput, {
                  model,
                  metadata: {
                    temperature: params.temperature,
                    maxTokens: params.max_tokens,
                    tokensUsed: response.usage?.total_tokens || 0,
                  },
                });
              } catch (error) {
                console.warn('Failed to record conversation:', error);
              }
            }
          } else {
            // Streaming response - we can't record memory for streaming
            // as the content comes in chunks and we don't know the final result
            console.warn('Memory recording not supported for streaming responses');
          }

          return response;
        },
      },
    } as OpenAI.Chat;
  }
}

export function createMemoriOpenAI(
  memori: Memori,
  apiKey: string,
  options?: OpenAI.RequestOptions & { baseUrl?: string }
): MemoriOpenAI {
  return new MemoriOpenAI(memori, apiKey, options);
}