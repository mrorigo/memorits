// src/core/Memori.ts
import { v4 as uuidv4 } from 'uuid';
import { DatabaseManager } from './database/DatabaseManager';
import { MemoryAgent } from './agents/MemoryAgent';
import { ConsciousAgent } from './agents/ConsciousAgent';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { ConfigManager, MemoriConfig } from './utils/ConfigManager';
import { ProcessedLongTermMemory } from './types/schemas';

export class Memori {
  private dbManager: DatabaseManager;
  private memoryAgent: MemoryAgent;
  private consciousAgent?: ConsciousAgent;
  private openaiProvider: OpenAIProvider;
  private config: MemoriConfig;
  private enabled: boolean = false;
  private sessionId: string;
  private backgroundInterval?: NodeJS.Timeout;
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
      console.log('ConsciousAgent initialized for conscious ingestion mode');

      // Run initial conscious memory ingestion
      try {
        await this.consciousAgent.run_conscious_ingest();
        console.log('Initial conscious memory ingestion completed');
      } catch (error) {
        console.error('Error during initial conscious memory ingestion:', error);
        // Don't fail the entire enable process if conscious ingestion fails
      }
    }

    this.enabled = true;

    // Start background monitoring if conscious mode is enabled
    if (this.config.consciousIngest) {
      this.startBackgroundMonitoring();
    }

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

    // Process memory based on ingestion mode
    if (this.config.autoIngest) {
      // Auto-ingestion mode: automatically process memory
      this.processMemory(chatId, userInput, aiOutput).catch(console.error);
    } else if (this.config.consciousIngest && this.consciousAgent) {
      // Conscious ingestion mode: only store conversation, let conscious agent handle processing
      console.log(`Conversation stored for conscious processing: ${chatId}`);
    } else {
      // No ingestion mode: just store conversation without processing
      console.log(`Conversation stored without processing: ${chatId}`);
    }

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
      console.error('Error checking for conscious context updates:', error);
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
      console.error('Error initializing conscious context:', error);
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

    console.log(`Starting background monitoring with ${this.backgroundUpdateInterval}ms interval`);

    this.backgroundInterval = setInterval(async () => {
      try {
        await this.checkForConsciousContextUpdates();
      } catch (error) {
        console.error('Error in background monitoring:', error);
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
      console.log('Background monitoring stopped');
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