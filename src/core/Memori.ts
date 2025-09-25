// src/core/Memori.ts
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from './database/DatabaseManager';
import { MemoryAgent } from './agents/MemoryAgent';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ConfigManager, MemoriConfig } from './utils/ConfigManager';
import { ProcessedLongTermMemory } from './types/schemas';

export class Memori {
  private dbManager: DatabaseManager;
  private memoryAgent: MemoryAgent;
  private openaiProvider: OpenAIProvider;
  private config: MemoriConfig;
  private enabled: boolean = false;
  private sessionId: string;

  constructor(config?: Partial<MemoriConfig>) {
    this.config = ConfigManager.loadConfig();
    if (config) {
      Object.assign(this.config, config);
    }

    this.sessionId = uuidv4();
    this.dbManager = new DatabaseManager(this.config.databaseUrl);
    this.openaiProvider = new OpenAIProvider({
      apiKey: this.config.apiKey,
      model: this.config.model,
      baseUrl: this.config.baseUrl,
    });
    this.memoryAgent = new MemoryAgent({
      apiKey: this.config.apiKey,
      model: this.config.model,
      baseUrl: this.config.baseUrl,
    });
  }

  async enable(): Promise<void> {
    if (this.enabled) {
      throw new Error('Memori is already enabled');
    }

    await this.dbManager.initializeSchema();
    this.enabled = true;
    console.log('Memori enabled successfully');
  }

  async recordConversation(
    userInput: string,
    aiOutput: string,
    options?: {
      model?: string;
      metadata?: any;
    }
  ): Promise<string> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    const chatId = uuidv4();

    await this.dbManager.storeChatHistory({
      chatId,
      userInput,
      aiOutput,
      model: options?.model || this.config.model,
      sessionId: this.sessionId,
      namespace: this.config.namespace,
      metadata: options?.metadata,
    });

    // Process memory asynchronously
    this.processMemory(chatId, userInput, aiOutput).catch(console.error);

    return chatId;
  }

  private async processMemory(
    chatId: string,
    userInput: string,
    aiOutput: string
  ): Promise<void> {
    try {
      const processedMemory = await this.memoryAgent.processConversation({
        chatId,
        userInput,
        aiOutput,
        context: {
          sessionId: this.sessionId,
          modelUsed: this.config.model,
          userPreferences: this.config.userContext?.userPreferences || [],
          currentProjects: this.config.userContext?.currentProjects || [],
          relevantSkills: this.config.userContext?.relevantSkills || [],
        },
      });

      await this.dbManager.storeLongTermMemory(
        processedMemory,
        chatId,
        this.config.namespace
      );

      console.log(`Memory processed for chat ${chatId}`);
    } catch (error) {
      console.error(`Failed to process memory for chat ${chatId}:`, error);
    }
  }

  async searchMemories(query: string, limit: number = 5): Promise<any[]> {
    return this.dbManager.searchMemories(query, {
      namespace: this.config.namespace,
      limit,
    });
  }

  async close(): Promise<void> {
    await this.dbManager.close();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}