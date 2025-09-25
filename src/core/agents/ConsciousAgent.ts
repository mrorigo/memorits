// src/core/agents/ConsciousAgent.ts
import { DatabaseManager } from '../database/DatabaseManager';

export interface ConsciousMemory {
  id: string;
  content: string;
  summary: string;
  classification: string;
  importance: string;
  topic?: string;
  entities: string[];
  keywords: string[];
  confidenceScore: number;
  classificationReason: string;
}

export class ConsciousAgent {
  private dbManager: DatabaseManager;
  private namespace: string;
  private processedMemoryIds: Set<string> = new Set();

  constructor(dbManager: DatabaseManager, namespace: string) {
    this.dbManager = dbManager;
    this.namespace = namespace;
  }

  /**
   * Initialize existing conscious memories on startup
   */
  async run_conscious_ingest(): Promise<void> {
    console.log('Starting conscious memory ingestion...');

    try {
      // Get all conscious-info memories that haven't been processed yet
      const consciousMemories = await this.getUnprocessedConsciousMemories();

      if (consciousMemories.length === 0) {
        console.log('No unprocessed conscious memories found');
        return;
      }

      console.log(`Found ${consciousMemories.length} unprocessed conscious memories`);

      // Process each conscious memory
      for (const memory of consciousMemories) {
        await this.processConsciousMemory(memory);
      }

      console.log('Conscious memory ingestion completed');
    } catch (error) {
      console.error('Error during conscious memory ingestion:', error);
      throw error;
    }
  }

  /**
   * Initialize context from existing conscious memories
   */
  async initialize_existing_conscious_memories(): Promise<ConsciousMemory[]> {
    try {
      const memories = await this.getConsciousMemoriesFromShortTerm();
      console.log(`Initialized ${memories.length} existing conscious memories`);
      return memories;
    } catch (error) {
      console.error('Error initializing existing conscious memories:', error);
      return [];
    }
  }

  /**
   * Check for new conscious memories and process them
   */
  async check_for_context_updates(): Promise<ConsciousMemory[]> {
    try {
      const newMemories = await this.getNewConsciousMemories();
      const processedMemories: ConsciousMemory[] = [];

      for (const memory of newMemories) {
        const processed = await this.processConsciousMemory(memory);
        if (processed) {
          processedMemories.push(processed);
        }
      }

      if (processedMemories.length > 0) {
        console.log(`Processed ${processedMemories.length} new conscious memories`);
      }

      return processedMemories;
    } catch (error) {
      console.error('Error checking for context updates:', error);
      return [];
    }
  }

  /**
   * Get unprocessed conscious memories from long-term storage
   */
  private async getUnprocessedConsciousMemories(): Promise<ConsciousMemory[]> {
    const memories = await this.dbManager.getUnprocessedConsciousMemories();
    return memories as ConsciousMemory[];
  }

  /**
   * Get new conscious memories that need processing
   */
  private async getNewConsciousMemories(): Promise<ConsciousMemory[]> {
    const memories = await this.dbManager.getNewConsciousMemories();
    return memories as ConsciousMemory[];
  }

  /**
   * Process a single conscious memory
   */
  private async processConsciousMemory(memory: ConsciousMemory): Promise<ConsciousMemory | null> {
    try {
      // Check if this memory has already been processed
      if (this.processedMemoryIds.has(memory.id)) {
        return null;
      }

      // Copy memory to short-term storage for immediate availability
      await this.copyToShortTermMemory(memory);

      // Mark as processed to avoid duplicates
      this.processedMemoryIds.add(memory.id);

      console.log(`Processed conscious memory: ${memory.summary}`);
      return memory;
    } catch (error) {
      console.error(`Error processing conscious memory ${memory.id}:`, error);
      return null;
    }
  }

  /**
   * Copy conscious memory to short-term storage
   */
  private async copyToShortTermMemory(memory: ConsciousMemory): Promise<void> {
    try {
      // Create short-term memory entry from conscious memory
      const shortTermData = {
        chatId: memory.id, // Using memory ID as chat ID for tracking
        processedData: {
          content: memory.content,
          summary: memory.summary,
          classification: memory.classification,
          importance: memory.importance,
          topic: memory.topic,
          entities: memory.entities,
          keywords: memory.keywords,
          confidenceScore: memory.confidenceScore,
          classificationReason: memory.classificationReason,
          consciousMemory: true, // Mark as conscious memory
        },
        importanceScore: this.calculateImportanceScore(memory.importance),
        categoryPrimary: memory.classification,
        retentionType: 'short_term',
        namespace: this.namespace,
        searchableContent: memory.content,
        summary: memory.summary,
        isPermanentContext: true, // Conscious memories are permanent context
      };

      await this.dbManager.storeConsciousMemoryInShortTerm(shortTermData, this.namespace);
    } catch (error) {
      console.error('Error copying conscious memory to short-term storage:', error);
      throw error;
    }
  }

  /**
   * Get conscious memories currently in short-term storage
   */
  private async getConsciousMemoriesFromShortTerm(): Promise<ConsciousMemory[]> {
    const memories = await this.dbManager.getConsciousMemoriesFromShortTerm(this.namespace);
    return memories as ConsciousMemory[];
  }

  /**
   * Calculate importance score for conscious memory
   */
  private calculateImportanceScore(importance: string): number {
    const scores = {
      'critical': 0.9,
      'high': 0.7,
      'medium': 0.5,
      'low': 0.3,
    };
    return scores[importance as keyof typeof scores] || 0.5;
  }

  /**
   * Consolidate duplicate conscious memories
   */
  async consolidateDuplicates(): Promise<void> {
    try {
      console.log('Starting conscious memory consolidation...');

      // This would identify and merge duplicate conscious memories
      // Implementation depends on the specific consolidation logic needed
      // For now, we'll just log the action

      console.log('Conscious memory consolidation completed');
    } catch (error) {
      console.error('Error during conscious memory consolidation:', error);
      throw error;
    }
  }

  /**
   * Clear processed memory tracking (for testing or reset)
   */
  clearProcessedMemoryTracking(): void {
    this.processedMemoryIds.clear();
  }

  /**
   * Get count of processed memories
   */
  getProcessedMemoryCount(): number {
    return this.processedMemoryIds.size;
  }
}