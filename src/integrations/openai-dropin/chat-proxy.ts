// src/integrations/openai-dropin/chat-proxy.ts
// ChatProxy implementation for OpenAI Drop-in with transparent memory recording
// Provides Chat Phase 2 functionality as specified in the design document

import type OpenAI from 'openai';
import type {
  ChatCompletionCreateParams,
  ChatCompletionMessageParam,
  ChatProxyInterface,
} from './types';
import type { MemoryManager } from './types';
import { logInfo, logError } from '../../core/utils/Logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * ChatProxy class that wraps OpenAI chat completions with memory recording
 * Provides a simplified interface for chat completions with memory functionality
 */
export class ChatProxy implements ChatProxyInterface {
  private openaiChat: OpenAI.Chat;
  private memoryManager: MemoryManager;
  private enabled: boolean;

  constructor(
    openaiChat: OpenAI.Chat,
    memoryManager: MemoryManager,
    enabled: boolean = true,
  ) {
    this.openaiChat = openaiChat;
    this.memoryManager = memoryManager;
    this.enabled = enabled;
  }

  /**
   * Create chat completion with optional memory recording
   * This is the main method that handles both streaming and non-streaming completions
   */
  async create(
    params: ChatCompletionCreateParams,
    options?: OpenAI.RequestOptions,
  ): Promise<OpenAI.ChatCompletion | AsyncIterable<OpenAI.ChatCompletionChunk>> {
    const requestId = uuidv4();
    const startTime = Date.now();

    try {
      logInfo('Chat completion request initiated', {
        component: 'ChatProxy',
        requestId,
        model: params.model,
        isStreaming: Boolean(params.stream),
        messageCount: params.messages.length,
        enabled: this.enabled,
      });

      // Call the actual OpenAI API
      const response = await this.openaiChat.completions.create(params, options);

      // Record memory if enabled and memory recording is configured
      if (this.enabled && this.shouldRecordMemory(params)) {
        try {
          const recordingResult = await this.memoryManager.recordChatCompletion(
            params,
            response,
            {
              forceRecording: false,
              isStreaming: Boolean(params.stream),
            },
          );

          logInfo('Memory recording completed', {
            component: 'ChatProxy',
            requestId,
            chatId: recordingResult.chatId,
            wasStreaming: recordingResult.wasStreaming,
            duration: recordingResult.duration,
            success: recordingResult.success,
          });
        } catch (memoryError) {
          // Memory recording failures should not break the main functionality
          logError('Memory recording failed, but chat completion succeeded', {
            component: 'ChatProxy',
            requestId,
            error: memoryError instanceof Error ? memoryError.message : String(memoryError),
            model: params.model,
            isStreaming: Boolean(params.stream),
          });
        }
      } else {
        logInfo('Memory recording skipped', {
          component: 'ChatProxy',
          requestId,
          reason: this.enabled ? 'Memory recording disabled for this request' : 'ChatProxy disabled',
        });
      }

      const duration = Date.now() - startTime;
      logInfo('Chat completion request completed', {
        component: 'ChatProxy',
        requestId,
        duration,
        model: params.model,
        isStreaming: Boolean(params.stream),
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      logError('Chat completion request failed', {
        component: 'ChatProxy',
        requestId,
        duration,
        error: error instanceof Error ? error.message : String(error),
        model: params.model,
        isStreaming: Boolean(params.stream),
      });
      throw error;
    }
  }

  /**
   * Determine if memory should be recorded for this request
   */
  private shouldRecordMemory(params: ChatCompletionCreateParams): boolean {
    // Don't record memory for requests with empty messages
    if (!params.messages || params.messages.length === 0) {
      return false;
    }

    // Don't record memory for system-only conversations (no user messages)
    const hasUserMessage = params.messages.some(msg => msg.role === 'user');
    if (!hasUserMessage) {
      return false;
    }

    // Don't record memory for very short messages (likely test/debug messages)
    const userContent = this.extractUserContent(params.messages);
    if (userContent.length < 10) {
      return false;
    }

    return true;
  }

  /**
   * Extract user content from messages array
   */
  private extractUserContent(messages: ChatCompletionMessageParam[]): string {
    const lastUserMessage = messages
      .slice()
      .reverse()
      .find(msg => msg.role === 'user');

    if (!lastUserMessage || !lastUserMessage.content) {
      return '';
    }

    if (typeof lastUserMessage.content === 'string') {
      return lastUserMessage.content;
    }

    // Handle array of content blocks with proper type safety
    return lastUserMessage.content
      .map(block => this.extractTextFromContentBlock(block))
      .join(' ');
  }

  /**
   * Safely extract text from a content block using proper OpenAI SDK types
   */
  private extractTextFromContentBlock(block: unknown): string {
    // Handle string content blocks
    if (typeof block === 'string') {
      return block;
    }

    // Handle content part objects with proper type checking
    if (block && typeof block === 'object' && 'type' in block && 'text' in block) {
      const contentPart = block as OpenAI.ChatCompletionContentPart;
      if (contentPart.type === 'text' && typeof contentPart.text === 'string') {
        return contentPart.text;
      }
    }

    // Fallback for unknown content types
    return '';
  }

  /**
   * Update chat proxy enabled state
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    logInfo('ChatProxy enabled state updated', {
      component: 'ChatProxy',
      enabled,
    });
  }

  /**
   * Check if chat proxy is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get the underlying OpenAI chat client
   */
  getOpenAIChat(): OpenAI.Chat {
    return this.openaiChat;
  }

  /**
   * Get the memory manager instance
   */
  getMemoryManager(): MemoryManager {
    return this.memoryManager;
  }
}

export default ChatProxy;