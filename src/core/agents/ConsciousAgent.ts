// src/core/agents/ConsciousAgent.ts
import { DatabaseManager } from '../database/DatabaseManager';
import { logInfo, logError, logDebug } from '../utils/Logger';
import { MemoryProcessingState } from '../memory/MemoryProcessingStateManager';

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

      // Initialize state tracking for conscious processing
      try {
        await this.dbManager.transitionMemoryState(
          memory.id,
          MemoryProcessingState.CONSCIOUS_PROCESSING,
          {
            reason: 'Starting conscious memory processing',
            agentId: 'ConsciousAgent',
            metadata: {
              namespace: this.namespace,
              classification: memory.classification,
              importance: memory.importance,
            },
          },
        );
      } catch (stateError) {
        logDebug(`State tracking failed for memory ${memory.id}, continuing processing`, {
          component: 'ConsciousAgent',
          namespace: this.namespace,
          memoryId: memory.id,
          error: stateError instanceof Error ? stateError.message : String(stateError),
        });
      }

      // Copy memory to short-term storage for immediate availability
      await this.copyToShortTermMemory(memory);

      // Mark as processed to avoid duplicates
      this.processedMemoryIds.add(memory.id);

      // Update state to processed
      try {
        await this.dbManager.transitionMemoryState(
          memory.id,
          MemoryProcessingState.CONSCIOUS_PROCESSED,
          {
            reason: 'Conscious memory processing completed successfully',
            agentId: 'ConsciousAgent',
            metadata: {
              namespace: this.namespace,
              shortTermStorage: true,
            },
          },
        );
      } catch (stateError) {
        logDebug(`Failed to update state for processed memory ${memory.id}`, {
          component: 'ConsciousAgent',
          namespace: this.namespace,
          memoryId: memory.id,
          error: stateError instanceof Error ? stateError.message : String(stateError),
        });
      }

      logDebug(`Processed conscious memory: ${memory.summary}`, {
        component: 'ConsciousAgent',
        namespace: this.namespace,
        memoryId: memory.id,
      });
      return memory;
    } catch (error) {
      // Update state to failed
      try {
        await this.dbManager.transitionMemoryState(
          memory.id,
          MemoryProcessingState.FAILED,
          {
            reason: 'Conscious memory processing failed',
            agentId: 'ConsciousAgent',
            errorMessage: error instanceof Error ? error.message : String(error),
            metadata: {
              namespace: this.namespace,
              errorType: 'processing_failure',
            },
          },
        );
      } catch (stateError) {
        logDebug(`Failed to update state for failed memory ${memory.id}`, {
          component: 'ConsciousAgent',
          namespace: this.namespace,
          memoryId: memory.id,
          error: stateError instanceof Error ? stateError.message : String(stateError),
        });
      }

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
    * Consolidate duplicate conscious memories with enhanced error handling and statistics
    */
  async consolidateDuplicates(options?: {
    namespace?: string;
    similarityThreshold?: number;
    dryRun?: boolean;
    batchSize?: number;
    enableProgressTracking?: boolean;
  }): Promise<{
    totalProcessed: number;
    duplicatesFound: number;
    consolidated: number;
    errors: string[];
    skipped: number;
    processingTime: number;
    memoryUsage: { before: number; after: number; peak: number };
    consolidationStats: {
      groupsProcessed: number;
      totalDuplicates: number;
      averageSimilarity: number;
      safetyChecksPassed: number;
      safetyChecksFailed: number;
    };
  }> {
    const namespace = options?.namespace || this.namespace;
    const similarityThreshold = options?.similarityThreshold || 0.7;
    const dryRun = options?.dryRun || false;
    const batchSize = options?.batchSize || 10;
    const enableProgressTracking = options?.enableProgressTracking !== false;

    const startTime = Date.now();
    let memoryUsage = { before: 0, after: 0, peak: 0 };

    // Track memory usage if available
    if (typeof process !== 'undefined' && process.memoryUsage) {
      memoryUsage.before = process.memoryUsage().heapUsed;
    }

    try {
      logInfo(`Starting enhanced conscious memory consolidation in namespace: ${namespace}`, {
        component: 'ConsciousAgent',
        similarityThreshold,
        dryRun,
        batchSize,
        enableProgressTracking,
        namespace,
      });

      // Initialize consolidation statistics
      const consolidationStats = {
        groupsProcessed: 0,
        totalDuplicates: 0,
        averageSimilarity: 0,
        safetyChecksPassed: 0,
        safetyChecksFailed: 0,
      };

      // Get all conscious memories for analysis
      const consciousMemories = await this.dbManager.getProcessedConsciousMemories(namespace);
      let peakMemory = memoryUsage.before;

      if (consciousMemories.length === 0) {
        logInfo('No conscious memories found for consolidation', {
          component: 'ConsciousAgent',
          namespace,
        });
        return {
          totalProcessed: 0,
          duplicatesFound: 0,
          consolidated: 0,
          errors: [],
          skipped: 0,
          processingTime: Date.now() - startTime,
          memoryUsage,
          consolidationStats,
        };
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
        safetyCheckPassed: boolean;
        safetyCheckReason?: string;
      }> = [];

      const processedIds = new Set<string>();
      const errors: string[] = [];
      let skipped = 0;
      let totalSimilarity = 0;

      // Find potential duplicates by comparing each memory with others
      for (let i = 0; i < consciousMemories.length; i++) {
        const memory = consciousMemories[i];
        if (processedIds.has(memory.id)) {
          continue; // Already processed as a duplicate
        }

        try {
          // Track progress for large batches
          if (enableProgressTracking && i % Math.max(1, Math.floor(consciousMemories.length / 10)) === 0) {
            const progress = Math.round((i / consciousMemories.length) * 100);
            logDebug(`Consolidation progress: ${progress}% (${i}/${consciousMemories.length})`, {
              component: 'ConsciousAgent',
              namespace,
              progress,
              processed: i,
              total: consciousMemories.length,
            });
          }

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

            // Perform safety checks
            const safetyCheck = await this.performSafetyChecks(memory, consciousDuplicates, namespace);

            if (safetyCheck.passed) {
              consolidationStats.safetyChecksPassed++;

              if (averageSimilarity >= similarityThreshold) {
                duplicatesFound.push({
                  primary: memory,
                  duplicates: consciousDuplicates,
                  similarity: averageSimilarity,
                  safetyCheckPassed: true,
                });

                totalSimilarity += averageSimilarity;

                // Mark these duplicates as processed
                consciousDuplicates.forEach(duplicate => processedIds.add(duplicate.id));
              }
            } else {
              consolidationStats.safetyChecksFailed++;
              skipped++;

              logDebug(`Skipped consolidation group due to safety check failure: ${safetyCheck.reason}`, {
                component: 'ConsciousAgent',
                namespace,
                primaryId: memory.id,
                reason: safetyCheck.reason,
              });
            }
          }

          // Track peak memory usage
          if (typeof process !== 'undefined' && process.memoryUsage) {
            const currentMemory = process.memoryUsage().heapUsed;
            if (currentMemory > peakMemory) {
              peakMemory = currentMemory;
            }
          }

        } catch (error) {
          const errorMessage = `Error processing memory ${memory.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMessage);

          logError(errorMessage, {
            component: 'ConsciousAgent',
            namespace,
            memoryId: memory.id,
            error: error instanceof Error ? error.stack : String(error),
          });
        }
      }

      logInfo(`Found ${duplicatesFound.length} groups of potential duplicate memories`, {
        component: 'ConsciousAgent',
        namespace,
        duplicateGroups: duplicatesFound.length,
        skipped,
        safetyChecksPassed: consolidationStats.safetyChecksPassed,
        safetyChecksFailed: consolidationStats.safetyChecksFailed,
      });

      let consolidated = 0;
      consolidationStats.groupsProcessed = duplicatesFound.length;
      consolidationStats.totalDuplicates = duplicatesFound.reduce((sum, group) => sum + group.duplicates.length, 0);

      if (consolidationStats.totalDuplicates > 0) {
        consolidationStats.averageSimilarity = totalSimilarity / duplicatesFound.length;
      }

      // Process each group of duplicates in batches
      const batches = this.createBatches(duplicatesFound, batchSize);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];

        logDebug(`Processing consolidation batch ${batchIndex + 1}/${batches.length}`, {
          component: 'ConsciousAgent',
          namespace,
          batchIndex: batchIndex + 1,
          totalBatches: batches.length,
          groupsInBatch: batch.length,
        });

        const batchPromises = batch.map(async (group) => {
          try {
            return await this.processConsolidationGroup(group, namespace, dryRun, consolidationStats);
          } catch (error) {
            const errorMessage = `Error consolidating group with primary ${group.primary.id}: ${error instanceof Error ? error.message : String(error)}`;
            errors.push(errorMessage);
            return null;
          }
        });

        const batchResults = await Promise.allSettled(batchPromises);

        // Process batch results
        for (const result of batchResults) {
          if (result.status === 'fulfilled' && result.value) {
            consolidated += result.value.consolidated;
            errors.push(...result.value.errors);
          }
        }

        // Update memory usage tracking
        if (typeof process !== 'undefined' && process.memoryUsage) {
          const currentMemory = process.memoryUsage().heapUsed;
          if (currentMemory > peakMemory) {
            peakMemory = currentMemory;
          }
        }
      }

      // Final memory usage tracking
      if (typeof process !== 'undefined' && process.memoryUsage) {
        memoryUsage.after = process.memoryUsage().heapUsed;
        memoryUsage.peak = peakMemory;
      }

      const processingTime = Date.now() - startTime;

      logInfo('Enhanced consolidation completed successfully', {
        component: 'ConsciousAgent',
        namespace,
        totalProcessed: consolidationStats.groupsProcessed,
        duplicatesFound: consolidationStats.totalDuplicates,
        consolidated,
        skipped,
        errors: errors.length,
        processingTime: `${processingTime}ms`,
        memoryUsage: {
          before: `${Math.round(memoryUsage.before / 1024 / 1024)}MB`,
          after: `${Math.round(memoryUsage.after / 1024 / 1024)}MB`,
          peak: `${Math.round(memoryUsage.peak / 1024 / 1024)}MB`,
        },
        consolidationStats,
      });

      return {
        totalProcessed: consolidationStats.groupsProcessed,
        duplicatesFound: consolidationStats.totalDuplicates,
        consolidated,
        errors,
        skipped,
        processingTime,
        memoryUsage,
        consolidationStats,
      };

    } catch (error) {
      const errorMessage = `Error during conscious memory consolidation: ${error instanceof Error ? error.message : String(error)}`;
      logError(errorMessage, {
        component: 'ConsciousAgent',
        namespace,
        error: error instanceof Error ? error.stack : String(error),
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

  /**
    * Perform safety checks before consolidation
    */
  private async performSafetyChecks(
    primaryMemory: ConsciousMemory,
    duplicateMemories: ConsciousMemory[],
    namespace: string,
  ): Promise<{ passed: boolean; reason?: string }> {
    try {
      // Safety Check 1: Ensure no self-consolidation
      if (duplicateMemories.some(dup => dup.id === primaryMemory.id)) {
        return { passed: false, reason: 'Primary memory cannot be in duplicate list' };
      }

      // Safety Check 2: Check namespace consistency
      const allMemoryIds = [primaryMemory.id, ...duplicateMemories.map(d => d.id)];
      for (const memoryId of allMemoryIds) {
        const memory = await this.dbManager.getPrismaClient().longTermMemory.findUnique({
          where: { id: memoryId },
          select: { namespace: true },
        });

        if (!memory) {
          return { passed: false, reason: `Memory ${memoryId} not found` };
        }

        if (memory.namespace !== namespace) {
          return { passed: false, reason: `Memory ${memoryId} is not in namespace ${namespace}` };
        }
      }

      // Safety Check 3: Verify all memories still exist
      const existingMemories = await this.dbManager.getPrismaClient().longTermMemory.findMany({
        where: {
          id: { in: allMemoryIds },
          namespace,
        },
        select: { id: true },
      });

      if (existingMemories.length !== allMemoryIds.length) {
        const foundIds = existingMemories.map(m => m.id);
        const missingIds = allMemoryIds.filter(id => !foundIds.includes(id));
        return { passed: false, reason: `Some memories no longer exist: ${missingIds.join(', ')}` };
      }

      // Safety Check 4: Check for circular consolidation references
      for (const duplicate of duplicateMemories) {
        const duplicateData = await this.dbManager.getPrismaClient().longTermMemory.findUnique({
          where: { id: duplicate.id },
          select: {
            processedData: true,
            searchableContent: true,
          },
        });

        if (duplicateData?.processedData &&
            (duplicateData.processedData as Record<string, unknown>)?.consolidatedInto === primaryMemory.id) {
          return { passed: false, reason: `Circular consolidation detected for memory ${duplicate.id}` };
        }
      }

      return { passed: true };
    } catch (error) {
      logError('Error performing safety checks', {
        component: 'ConsciousAgent',
        namespace,
        primaryId: primaryMemory.id,
        error: error instanceof Error ? error.message : String(error),
      });
      return { passed: false, reason: `Safety check error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  /**
    * Create batches from an array for processing
    */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }

  /**
     * Process a single consolidation group
     */
  private async processConsolidationGroup(
    group: {
      primary: ConsciousMemory;
      duplicates: ConsciousMemory[];
      similarity: number;
      safetyCheckPassed: boolean;
    },
    namespace: string,
    dryRun: boolean,
    _consolidationStats: {
      groupsProcessed: number;
      totalDuplicates: number;
      averageSimilarity: number;
      safetyChecksPassed: number;
      safetyChecksFailed: number;
    },
  ): Promise<{ consolidated: number; errors: string[] }> {
    const errors: string[] = [];

    // Initialize state tracking for consolidation process
    const primaryMemoryId = group.primary.id;
    const duplicateIds = group.duplicates.map(d => d.id);

    try {
      // Set primary memory to consolidation processing
      await this.dbManager.transitionMemoryState(
        primaryMemoryId,
        MemoryProcessingState.CONSOLIDATION_PROCESSING,
        {
          reason: 'Starting memory consolidation',
          agentId: 'ConsciousAgent',
          metadata: {
            namespace,
            duplicateCount: duplicateIds.length,
            similarity: group.similarity,
            dryRun,
          },
        },
      );

      // Set all duplicates to consolidation processing
      for (const duplicateId of duplicateIds) {
        await this.dbManager.transitionMemoryState(
          duplicateId,
          MemoryProcessingState.CONSOLIDATION_PROCESSING,
          {
            reason: 'Memory marked for consolidation',
            agentId: 'ConsciousAgent',
            metadata: {
              namespace,
              consolidatedInto: primaryMemoryId,
              similarity: group.similarity,
            },
          },
        );
      }

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

        return { consolidated: 1, errors: [] };
      } else {
        // Actually consolidate the duplicates
        const consolidationResult = await this.dbManager.consolidateDuplicateMemories(
          group.primary.id,
          group.duplicates.map(d => d.id),
          namespace,
        );

        if (consolidationResult.consolidated > 0) {
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

        return { consolidated: consolidationResult.consolidated, errors };
      }
    } catch (error) {
      const errorMessage = `Error consolidating group with primary ${group.primary.id}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMessage);

      logError(errorMessage, {
        component: 'ConsciousAgent',
        namespace,
        primaryId: group.primary.id,
        error: error instanceof Error ? error.stack : String(error),
      });

      return { consolidated: 0, errors };
    }
  }
}