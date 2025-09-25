// src/core/Memori.ts
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from './database/DatabaseManager';
import { MemoryAgent } from './agents/MemoryAgent';
import { ConsciousAgent } from './agents/ConsciousAgent';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ConfigManager, MemoriConfig } from './utils/ConfigManager';
import { logInfo, logError } from './utils/Logger';
import {
  MemorySearchResult,
  RecordConversationOptions,
  SearchOptions,
} from './types/models';

export class Memori {
  private dbManager: DatabaseManager;
  private memoryAgent: MemoryAgent;
  private consciousAgent?: ConsciousAgent;
  private openaiProvider: OpenAIProvider;
  private config: MemoriConfig;
  private enabled: boolean = false;
  private sessionId: string;
  private backgroundInterval?: ReturnType<typeof setInterval>;
  private backgroundUpdateInterval: number = 30000; // 30 seconds default

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
    this.memoryAgent = new MemoryAgent(this.openaiProvider);
  }

  async enable(): Promise<void> {
    if (this.enabled) {
      throw new Error('Memori is already enabled');
    }

    await this.dbManager.initializeSchema();

    // Initialize ConsciousAgent if conscious ingestion is enabled
    if (this.config.consciousIngest) {
      this.consciousAgent = new ConsciousAgent(this.dbManager, this.config.namespace);
      logInfo('ConsciousAgent initialized for conscious ingestion mode', {
        component: 'Memori',
        namespace: this.config.namespace,
      });

      // Run initial conscious memory ingestion
      try {
        await this.consciousAgent.run_conscious_ingest();
        logInfo('Initial conscious memory ingestion completed', {
          component: 'Memori',
          namespace: this.config.namespace,
        });
      } catch (error) {
        logError('Error during initial conscious memory ingestion', {
          component: 'Memori',
          namespace: this.config.namespace,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        // Don't fail the entire enable process if conscious ingestion fails
      }
    }

    this.enabled = true;

    // Start background monitoring if conscious mode is enabled
    if (this.config.consciousIngest) {
      this.startBackgroundMonitoring();
    }

    logInfo('Memori enabled successfully', {
      component: 'Memori',
      namespace: this.config.namespace,
      sessionId: this.sessionId,
    });
  }

  async recordConversation(
    userInput: string,
    aiOutput: string,
    options?: RecordConversationOptions,
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

    // Process memory based on ingestion mode
    if (this.config.autoIngest) {
      // Auto-ingestion mode: automatically process memory
      this.processMemory(chatId, userInput, aiOutput).catch((error) => {
        logError('Error processing memory in auto-ingestion mode', {
          component: 'Memori',
          chatId,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      });
    } else if (this.config.consciousIngest && this.consciousAgent) {
      // Conscious ingestion mode: only store conversation, let conscious agent handle processing
      logInfo(`Conversation stored for conscious processing: ${chatId}`, {
        component: 'Memori',
        chatId,
        mode: 'conscious-ingestion',
      });
    } else {
      // No ingestion mode: just store conversation without processing
      logInfo(`Conversation stored without processing: ${chatId}`, {
        component: 'Memori',
        chatId,
        mode: 'no-ingestion',
      });
    }

    return chatId;
  }

  private async processMemory(
    chatId: string,
    userInput: string,
    aiOutput: string,
  ): Promise<void> {
    try {
      const processedMemory = await this.memoryAgent.processConversation({
        chatId,
        userInput,
        aiOutput,
        context: {
          conversationId: chatId,
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
        this.config.namespace,
      );

      logInfo(`Memory processed for chat ${chatId}`, {
        component: 'Memori',
        chatId,
        namespace: this.config.namespace,
      });
    } catch (error) {
      logError(`Failed to process memory for chat ${chatId}`, {
        component: 'Memori',
        chatId,
        namespace: this.config.namespace,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  async searchMemories(query: string, options: SearchOptions = {}): Promise<MemorySearchResult[]> {
    return this.dbManager.searchMemories(query, {
      namespace: this.config.namespace,
      limit: options.limit || 5,
      minImportance: options.minImportance,
      categories: options.categories,
      includeMetadata: options.includeMetadata,
    });
  }

  async close(): Promise<void> {
    // Stop background monitoring before closing
    this.stopBackgroundMonitoring();
    await this.dbManager.close();
  }

  getSessionId(): string {
    return this.sessionId;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check for new conscious memories and process them
   * This should be called periodically for ongoing monitoring
   */
  async checkForConsciousContextUpdates(): Promise<void> {
    if (!this.enabled || !this.consciousAgent) {
      return;
    }

    try {
      await this.consciousAgent.check_for_context_updates();
    } catch (error) {
      logError('Error checking for conscious context updates', {
        component: 'Memori',
        namespace: this.config.namespace,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Initialize context from existing conscious memories
   */
  async initializeConsciousContext(): Promise<void> {
    if (!this.enabled || !this.consciousAgent) {
      return;
    }

    try {
      await this.consciousAgent.initialize_existing_conscious_memories();
    } catch (error) {
      logError('Error initializing conscious context', {
        component: 'Memori',
        namespace: this.config.namespace,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
    }
  }

  /**
   * Get the ConsciousAgent instance (for advanced usage)
   */
  getConsciousAgent(): ConsciousAgent | undefined {
    return this.consciousAgent;
  }

  /**
   * Check if conscious mode is currently enabled
   */
  isConsciousModeEnabled(): boolean {
    return this.enabled && this.consciousAgent !== undefined;
  }

  /**
   * Check if auto ingestion mode is currently enabled
   */
  isAutoModeEnabled(): boolean {
    return this.enabled && this.config.autoIngest;
  }

  /**
   * Start background monitoring for conscious updates
   */
  private startBackgroundMonitoring(): void {
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
    }

    logInfo(`Starting background monitoring with ${this.backgroundUpdateInterval}ms interval`, {
      component: 'Memori',
      namespace: this.config.namespace,
      intervalMs: this.backgroundUpdateInterval,
    });

    this.backgroundInterval = setInterval(async () => {
      try {
        await this.checkForConsciousContextUpdates();
      } catch (error) {
        logError('Error in background monitoring', {
          component: 'Memori',
          namespace: this.config.namespace,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
      }
    }, this.backgroundUpdateInterval);
  }

  /**
   * Stop background monitoring
   */
  private stopBackgroundMonitoring(): void {
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval);
      this.backgroundInterval = undefined;
      logInfo('Background monitoring stopped', {
        component: 'Memori',
        namespace: this.config.namespace,
      });
    }
  }

  /**
   * Configure background update interval
   */
  setBackgroundUpdateInterval(intervalMs: number): void {
    if (intervalMs <= 0) {
      throw new Error('Background update interval must be positive');
    }

    this.backgroundUpdateInterval = intervalMs;

    // Restart monitoring with new interval if already running
    if (this.enabled && this.config.consciousIngest && this.backgroundInterval) {
      this.stopBackgroundMonitoring();
      this.startBackgroundMonitoring();
    }
  }

  /**
   * Get current background update interval
   */
  getBackgroundUpdateInterval(): number {
    return this.backgroundUpdateInterval;
  }

  /**
   * Check if background monitoring is active
   */
  isBackgroundMonitoringActive(): boolean {
    return this.backgroundInterval !== undefined;
  }
}