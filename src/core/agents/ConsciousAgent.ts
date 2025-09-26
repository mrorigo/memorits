// src/core/agents/ConsciousAgent.ts
import { DatabaseManager } from '../database/DatabaseManager';
import { logInfo, logError, logDebug } from '../utils/Logger';

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
    logInfo('Starting conscious memory ingestion...', {
      component: 'ConsciousAgent',
      namespace: this.namespace,
    });

    try {
      // Get all conscious-info memories that haven't been processed yet
      const consciousMemories = await this.getUnprocessedConsciousMemories();

      if (consciousMemories.length === 0) {
        logInfo('No unprocessed conscious memories found', {
          component: 'ConsciousAgent',
          namespace: this.namespace,
        });
        return;
      }

      logInfo(`Found ${consciousMemories.length} unprocessed conscious memories`, {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        memoryCount: consciousMemories.length,
      });

      // Process each conscious memory
      for (const memory of consciousMemories) {
        await this.processConsciousMemory(memory);
      }

      logInfo('Conscious memory ingestion completed', {
        component: 'ConsciousAgent',
        namespace: this.namespace,
      });
    } catch (error) {
      logError('Error during conscious memory ingestion:', {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Initialize context from existing conscious memories
   */
  async initialize_existing_conscious_memories(): Promise<ConsciousMemory[]> {
    try {
      const memories = await this.getConsciousMemoriesFromShortTerm();
      logInfo(`Initialized ${memories.length} existing conscious memories`, {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        memoryCount: memories.length,
      });
      return memories;
    } catch (error) {
      logError('Error initializing existing conscious memories:', {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        error: error instanceof Error ? error.message : String(error),
      });
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
        logInfo(`Processed ${processedMemories.length} new conscious memories`, {
          component: 'ConsciousAgent',
          namespace: this.namespace,
          memoryCount: processedMemories.length,
        });
      }

      return processedMemories;
    } catch (error) {
      logError('Error checking for context updates:', {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        error: error instanceof Error ? error.message : String(error),
      });
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

      logDebug(`Processed conscious memory: ${memory.summary}`, {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        memoryId: memory.id,
      });
      return memory;
    } catch (error) {
      logError(`Error processing conscious memory ${memory.id}:`, {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        memoryId: memory.id,
        error: error instanceof Error ? error.message : String(error),
      });
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
      logError('Error copying conscious memory to short-term storage:', {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        memoryId: memory.id,
        error: error instanceof Error ? error.message : String(error),
      });
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
  async consolidateDuplicates(options?: {
    namespace?: string;
    similarityThreshold?: number;
    dryRun?: boolean;
  }): Promise<{
    totalProcessed: number;
    duplicatesFound: number;
    consolidated: number;
    errors: string[];
  }> {
    const namespace = options?.namespace || this.namespace;
    const similarityThreshold = options?.similarityThreshold || 0.7;
    const dryRun = options?.dryRun || false;

    try {
      logInfo(`Starting conscious memory consolidation in namespace: ${namespace}`, {
        component: 'ConsciousAgent',
        similarityThreshold,
        dryRun,
        namespace,
      });

      logDebug(`Similarity threshold: ${similarityThreshold}, Dry run: ${dryRun}`, {
        component: 'ConsciousAgent',
        namespace,
      });

      // Get all conscious memories for analysis
      const consciousMemories = await this.dbManager.getProcessedConsciousMemories(namespace);

      if (consciousMemories.length === 0) {
        logInfo('No conscious memories found for consolidation', {
          component: 'ConsciousAgent',
          namespace,
        });
        return { totalProcessed: 0, duplicatesFound: 0, consolidated: 0, errors: [] };
      }

      logInfo(`Found ${consciousMemories.length} conscious memories to analyze for duplicates`, {
        component: 'ConsciousAgent',
        namespace,
        memoryCount: consciousMemories.length,
      });

      const duplicatesFound: Array<{
        primary: ConsciousMemory;
        duplicates: ConsciousMemory[];
        similarity: number;
      }> = [];

      const processedIds = new Set<string>();
      const errors: string[] = [];

      // Find potential duplicates by comparing each memory with others
      for (const memory of consciousMemories) {
        if (processedIds.has(memory.id)) {
          continue; // Already processed as a duplicate
        }

        try {
          // Find potential duplicates for this memory
          const potentialDuplicates = await this.dbManager.findPotentialDuplicates(
            memory.content + ' ' + memory.summary,
            namespace,
            similarityThreshold,
          );

          // Filter to only conscious memories and exclude self
          const consciousDuplicates = potentialDuplicates.filter(potential =>
            potential.id !== memory.id &&
            potential.classification === 'conscious-info',
          );

          if (consciousDuplicates.length > 0) {
            // Calculate average similarity for these duplicates
            const similarities = consciousDuplicates.map(duplicate => {
              const contentWords = new Set((memory.content + ' ' + memory.summary).toLowerCase().split(/\s+/));
              const duplicateWords = new Set((duplicate.content + ' ' + duplicate.summary).toLowerCase().split(/\s+/));
              const intersection = new Set([...contentWords].filter(x => duplicateWords.has(x)));
              const union = new Set([...contentWords, ...duplicateWords]);
              return intersection.size / union.size;
            });

            const averageSimilarity = similarities.reduce((a, b) => a + b, 0) / similarities.length;

            if (averageSimilarity >= similarityThreshold) {
              duplicatesFound.push({
                primary: memory,
                duplicates: consciousDuplicates,
                similarity: averageSimilarity,
              });

              // Mark these duplicates as processed
              consciousDuplicates.forEach(duplicate => processedIds.add(duplicate.id));
            }
          }
        } catch (error) {
          errors.push(`Error processing memory ${memory.id}: ${error}`);
        }
      }

      logInfo(`Found ${duplicatesFound.length} groups of potential duplicate memories`, {
        component: 'ConsciousAgent',
        namespace,
        duplicateGroups: duplicatesFound.length,
      });

      let consolidated = 0;

      // Process each group of duplicates
      for (const group of duplicatesFound) {
        try {
          if (dryRun) {
            logInfo(`DRY RUN: Would consolidate ${group.duplicates.length} duplicates into primary memory ${group.primary.id}`, {
              component: 'ConsciousAgent',
              namespace,
              primaryId: group.primary.id,
              duplicateCount: group.duplicates.length,
              similarity: group.similarity,
            });
            logDebug(`  Similarity: ${(group.similarity * 100).toFixed(1)}%`, {
              component: 'ConsciousAgent',
              namespace,
              primaryId: group.primary.id,
            });
            logDebug(`  Primary: ${group.primary.summary.substring(0, 100)}...`, {
              component: 'ConsciousAgent',
              namespace,
              primaryId: group.primary.id,
            });
            group.duplicates.forEach((dup, idx) => {
              logDebug(`  Duplicate ${idx + 1}: ${dup.summary.substring(0, 100)}...`, {
                component: 'ConsciousAgent',
                namespace,
                primaryId: group.primary.id,
                duplicateId: dup.id,
              });
            });
            consolidated++;
          } else {
            // Actually consolidate the duplicates
            const consolidationResult = await this.dbManager.consolidateDuplicateMemories(
              group.primary.id,
              group.duplicates.map(d => d.id),
              namespace,
            );

            if (consolidationResult.consolidated > 0) {
              consolidated++;
              logInfo(`Consolidated ${consolidationResult.consolidated} duplicates into memory ${group.primary.id}`, {
                component: 'ConsciousAgent',
                namespace,
                primaryId: group.primary.id,
                consolidatedCount: consolidationResult.consolidated,
              });
            }

            if (consolidationResult.errors.length > 0) {
              errors.push(...consolidationResult.errors);
            }
          }
        } catch (error) {
          errors.push(`Error consolidating group with primary ${group.primary.id}: ${error}`);
        }
      }

      logInfo(`Consolidation completed. Processed: ${duplicatesFound.length}, Consolidated: ${consolidated}, Errors: ${errors.length}`, {
        component: 'ConsciousAgent',
        namespace,
        totalProcessed: duplicatesFound.length,
        consolidated,
        errorCount: errors.length,
      });

      return {
        totalProcessed: duplicatesFound.length,
        duplicatesFound: duplicatesFound.reduce((sum, group) => sum + group.duplicates.length, 0),
        consolidated,
        errors,
      };

    } catch (error) {
      const errorMessage = `Error during conscious memory consolidation: ${error}`;
      logError(errorMessage, {
        component: 'ConsciousAgent',
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(errorMessage);
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