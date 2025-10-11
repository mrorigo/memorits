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
import { ProcessedLongTermMemory, MemoryClassification, MemoryImportanceLevel, MemoryRelationship } from './types/schemas';
import { SearchStrategy, SearchQuery } from './search/types';

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
      autoIngest: this.config.autoIngest,
      consciousIngest: this.config.consciousIngest,
      ingestionMode: this.config.autoIngest ? 'auto-ingestion' : (this.config.consciousIngest ? 'conscious-ingestion' : 'no-ingestion'),
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

      const memoryId = await this.dbManager.storeLongTermMemory(
        processedMemory,
        chatId,
        this.config.namespace,
      );

      // Store memory relationships if they were extracted and relationship extraction is enabled
      const extractedRelationships = processedMemory.relatedMemories || [];
      if (extractedRelationships && extractedRelationships.length > 0 && this.config.enableRelationshipExtraction) {
        try {
          // Separate relationships by type for storage
          const generalRelationships = extractedRelationships.filter((r: MemoryRelationship) =>
            r.type !== 'supersedes',
          );
          const supersedingRelationships = extractedRelationships.filter((r: MemoryRelationship) =>
            r.type === 'supersedes',
          );

          // Store relationships using the existing DatabaseManager method
          if (generalRelationships.length > 0 || supersedingRelationships.length > 0) {
            await this.dbManager.storeMemoryRelationships(
              memoryId,
              generalRelationships.concat(supersedingRelationships),
              this.config.namespace,
            );

            logInfo(`Memory relationships stored for chat ${chatId}`, {
              component: 'Memori',
              chatId,
              memoryId,
              namespace: this.config.namespace,
              relationshipCount: extractedRelationships.length,
              generalRelationships: generalRelationships.length,
              supersedingRelationships: supersedingRelationships.length,
            });
          }
        } catch (error) {
          logError(`Failed to store memory relationships for chat ${chatId}`, {
            component: 'Memori',
            chatId,
            memoryId,
            namespace: this.config.namespace,
            error: error instanceof Error ? error.message : String(error),
          });
          // Don't fail the entire process if relationship storage fails
        }
      }

      logInfo(`Memory processed for chat ${chatId}`, {
        component: 'Memori',
        chatId,
        memoryId,
        namespace: this.config.namespace,
        relationshipsStored: processedMemory.relatedMemories?.length || 0,
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

  /**
   * Advanced search using specific search strategy
   */
  async searchMemoriesWithStrategy(query: string, strategy: SearchStrategy, options: SearchOptions = {}): Promise<MemorySearchResult[]> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    try {
      const searchService = await this.dbManager.getSearchService();

      const searchQuery: SearchQuery = {
        text: query,
        limit: options.limit || 10,
        includeMetadata: options.includeMetadata,
      };

      const searchResults = await searchService.searchWithStrategy(searchQuery, strategy);

      return searchResults.map(result => ({
        id: result.id,
        content: result.content,
        summary: result.metadata.summary as string || '',
        classification: (result.metadata.category as string || 'unknown') as MemoryClassification,
        importance: (result.metadata.importance as string || 'medium') as MemoryImportanceLevel,
        topic: result.metadata.category as string || undefined,
        entities: [],
        keywords: [],
        confidenceScore: result.score,
        classificationReason: result.strategy,
        metadata: options.includeMetadata ? {
          searchScore: result.score,
          searchStrategy: result.strategy,
          memoryType: result.metadata.memoryType as string || 'long_term',
          category: result.metadata.category as string,
          importanceScore: result.metadata.importanceScore as number || 0.5,
        } : undefined,
      }));

    } catch (error) {
      logError('Advanced search failed', {
        component: 'Memori',
        query,
        strategy,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Search with strategy ${strategy} failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get available search strategies
   */
  async getAvailableSearchStrategies(): Promise<SearchStrategy[]> {
    const searchService = await this.dbManager.getSearchService();
    return searchService.getAvailableStrategies();
  }

  /**
   * Search for recent memories (empty query)
   */
  async searchRecentMemories(limit: number = 10, includeMetadata: boolean = false): Promise<MemorySearchResult[]> {
    return this.searchMemories('', {
      limit,
      includeMetadata,
    });
  }

  async close(): Promise<void> {
    try {
      // Stop background monitoring before closing
      this.stopBackgroundMonitoring();

      // Clean up search service to stop background timers
      try {
        const searchService = await this.dbManager.getSearchService();
        if (searchService && typeof searchService.cleanup === 'function') {
          searchService.cleanup();
        }
      } catch (error) {
        // Don't fail the close process if search service cleanup fails
        logInfo('Search service cleanup failed during Memori close (non-critical)', {
          component: 'Memori',
          error: error instanceof Error ? error.message : String(error),
        });
      }

      // Close database manager
      await this.dbManager.close();
    } catch (error) {
      logError('Error during Memori close', {
        component: 'Memori',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
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

  /**
   * Store processed memory directly (used by memory manager components)
   */
  async storeProcessedMemory(
    processedMemory: ProcessedLongTermMemory,
    chatId: string,
    namespace?: string,
  ): Promise<string> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    const targetNamespace = namespace || this.config.namespace;

    try {
      const memoryId = await this.dbManager.storeLongTermMemory(
        processedMemory,
        chatId,
        targetNamespace,
      );

      logInfo(`Processed memory stored successfully for chat ${chatId}`, {
        component: 'Memori',
        chatId,
        namespace: targetNamespace,
        classification: processedMemory.classification,
        importance: processedMemory.importance,
      });

      return memoryId;
    } catch (error) {
      logError(`Failed to store processed memory for chat ${chatId}`, {
        component: 'Memori',
        chatId,
        namespace: targetNamespace,
        classification: processedMemory.classification,
        importance: processedMemory.importance,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Consolidate duplicate memories with transaction safety and intelligent data merging
   */
  async consolidateDuplicateMemories(
    primaryMemoryId: string,
    duplicateIds: string[],
    namespace?: string,
  ): Promise<{ consolidated: number; errors: string[] }> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    const targetNamespace = namespace || this.config.namespace;

    try {
      const result = await this.dbManager.consolidateDuplicateMemories(
        primaryMemoryId,
        duplicateIds,
        targetNamespace,
      );

      logInfo(`Consolidated ${result.consolidated} duplicate memories`, {
        component: 'Memori',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace: targetNamespace,
        consolidated: result.consolidated,
        errors: result.errors.length,
      });

      return result;
    } catch (error) {
      logError('Failed to consolidate duplicate memories', {
        component: 'Memori',
        primaryMemoryId,
        duplicateIds,
        namespace: targetNamespace,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Get comprehensive health report for the search index
   */
  async getIndexHealthReport(): Promise<import('./search/SearchIndexManager').IndexHealthReport> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    try {
      const searchIndexManager = this.dbManager.getSearchIndexManager();
      const report = await searchIndexManager.getIndexHealthReport();

      logInfo('Retrieved index health report', {
        component: 'Memori',
        health: report.health,
        issues: report.issues.length,
        recommendations: report.recommendations.length,
      });

      return report;
    } catch (error) {
      logError('Failed to get index health report', {
        component: 'Memori',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Perform index optimization with specified strategy
   */
  async optimizeIndex(type?: import('./search/SearchIndexManager').OptimizationType): Promise<import('./search/SearchIndexManager').OptimizationResult> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    try {
      const searchIndexManager = this.dbManager.getSearchIndexManager();
      const result = await searchIndexManager.optimizeIndex(type);

      logInfo('Index optimization completed', {
        component: 'Memori',
        optimizationType: result.optimizationType,
        duration: result.duration,
        spaceSaved: result.spaceSaved,
        performanceImprovement: result.performanceImprovement,
      });

      return result;
    } catch (error) {
      logError('Failed to optimize index', {
        component: 'Memori',
        optimizationType: type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Create a backup of the current search index
   */
  async createIndexBackup(): Promise<import('./search/SearchIndexManager').BackupMetadata> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    try {
      const searchIndexManager = this.dbManager.getSearchIndexManager();
      const backup = await searchIndexManager.createBackup();

      logInfo('Index backup created', {
        component: 'Memori',
        timestamp: backup.timestamp,
        documentCount: backup.documentCount,
        indexSize: backup.indexSize,
      });

      return backup;
    } catch (error) {
      logError('Failed to create index backup', {
        component: 'Memori',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Restore search index from a backup
   */
  async restoreIndexFromBackup(backupId: string): Promise<boolean> {
    if (!this.enabled) {
      throw new Error('Memori is not enabled');
    }

    try {
      const searchIndexManager = this.dbManager.getSearchIndexManager();
      const success = await searchIndexManager.restoreFromBackup(backupId);

      logInfo('Index backup restore completed', {
        component: 'Memori',
        backupId,
        success,
      });

      return success;
    } catch (error) {
      logError('Failed to restore index from backup', {
        component: 'Memori',
        backupId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }
}