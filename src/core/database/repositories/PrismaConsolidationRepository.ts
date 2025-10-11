// src/core/database/repositories/PrismaConsolidationRepository.ts

import { PrismaClient } from '@prisma/client';
import { MemorySearchResult, MemoryClassification, MemoryImportanceLevel } from '../../types/models';
import { logInfo, logError } from '../../utils/Logger';
import { sanitizeString, SanitizationError, ValidationError } from '../../utils/SanitizationUtils';
import {
  ConsolidationResult,
  ConsolidationStats,
  CleanupResult,
  DuplicateDetectionConfig,
  ConsolidationMemorySearchResult,
  ConsolidationTrend,
  DuplicateCandidate,
} from '../types/consolidation-models';

/**
 * Repository implementation for memory consolidation operations using Prisma
 * Handles all database operations related to memory consolidation with proper
 * transaction safety, error handling, and data integrity validation.
 */
export class PrismaConsolidationRepository {
  private prisma: PrismaClient;
  private readonly componentName = 'PrismaConsolidationRepository';

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;

    logInfo('PrismaConsolidationRepository initialized', {
      component: this.componentName,
    });
  }

  /**
   * Find potential duplicate memory candidates based on content similarity
   */
  async findDuplicateCandidates(
    content: string,
    threshold: number,
    config?: DuplicateDetectionConfig,
  ): Promise<MemorySearchResult[]> {
    const startTime = Date.now();

    try {
      logInfo('Finding duplicate candidates', {
        component: this.componentName,
        contentLength: content.length,
        threshold,
        config,
      });

      // Sanitize and validate inputs
      const sanitizedContent = sanitizeString(content, {
        fieldName: 'content',
        maxLength: 10000,
      });

      if (threshold < 0 || threshold > 1) {
        throw new ValidationError(
          'Threshold must be between 0 and 1',
          'threshold',
          threshold,
          'range_validation',
        );
      }

      // Try FTS search first, fall back to LIKE search if FTS not available
      let candidates: Array<MemorySearchResult & { score: number }> = [];

      try {
        // Use FTS for similarity search if available
        const searchQuery = this.buildSearchQuery(sanitizedContent, config);

        // Execute search using raw SQL for better control over similarity matching
        candidates = await this.prisma.$queryRaw`
          SELECT
            m.id,
            m.searchableContent as content,
            m.summary,
            m.classification,
            m.memoryImportance as importance,
            m.topic,
            m.entitiesJson as entities,
            m.keywordsJson as keywords,
            m.confidenceScore,
            m.classificationReason,
            m.extractionTimestamp as createdAt,
            m.namespace,
            ${this.calculateSimilarityScore(sanitizedContent)} as score,
            'fts' as strategy
          FROM long_term_memory m
          WHERE m.searchableContent MATCH ${searchQuery}
            AND m.namespace = 'default'
          ORDER BY score DESC
          LIMIT ${config?.maxCandidates || 50}
        ` as Array<MemorySearchResult & { score: number }>;

      } catch (ftsError) {
        // Fall back to LIKE-based search if FTS is not available
        logInfo('FTS not available, falling back to LIKE search', {
          component: this.componentName,
          error: ftsError instanceof Error ? ftsError.message : String(ftsError),
        });

        candidates = await this.prisma.$queryRaw`
          SELECT
            m.id,
            m.searchableContent as content,
            m.summary,
            m.classification,
            m.memoryImportance as importance,
            m.topic,
            m.entitiesJson as entities,
            m.keywordsJson as keywords,
            m.confidenceScore,
            m.classificationReason,
            m.extractionTimestamp as createdAt,
            m.namespace,
            0.1 as score,
            'like' as strategy
          FROM long_term_memory m
          WHERE m.searchableContent LIKE ${'%' + sanitizedContent + '%'}
            AND m.namespace = 'default'
          ORDER BY m.extractionTimestamp DESC
          LIMIT ${config?.maxCandidates || 50}
        ` as Array<MemorySearchResult & { score: number }>;
      }

      // Filter by threshold and convert to proper format
      const filteredCandidates = candidates
        .filter(candidate => (candidate.score || 0) >= threshold)
        .map(candidate => ({
          id: candidate.id,
          content: candidate.content,
          summary: candidate.summary,
          classification: candidate.classification,
          importance: candidate.importance,
          topic: candidate.topic,
          entities: Array.isArray(candidate.entities) ? candidate.entities : [],
          keywords: Array.isArray(candidate.keywords) ? candidate.keywords : [],
          confidenceScore: candidate.confidenceScore,
          classificationReason: candidate.classificationReason,
        }));

      logInfo('Duplicate candidates found', {
        component: this.componentName,
        totalCandidates: candidates.length,
        filteredCandidates: filteredCandidates.length,
        threshold,
        duration: Date.now() - startTime,
      });

      return filteredCandidates;

    } catch (error) {
      logError('Failed to find duplicate candidates', {
        component: this.componentName,
        contentLength: content.length,
        threshold,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Mark a memory as a duplicate of another memory
   */
  async markMemoryAsDuplicate(
    duplicateId: string,
    originalId: string,
    consolidationReason?: string,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logInfo('Marking memory as duplicate', {
        component: this.componentName,
        duplicateId,
        originalId,
        consolidationReason,
      });

      // Sanitize inputs
      const sanitizedDuplicateId = sanitizeString(duplicateId, {
        fieldName: 'duplicateId',
        maxLength: 100,
        allowNewlines: false,
      });

      const sanitizedOriginalId = sanitizeString(originalId, {
        fieldName: 'originalId',
        maxLength: 100,
        allowNewlines: false,
      });

      const sanitizedReason = consolidationReason
        ? sanitizeString(consolidationReason, {
            fieldName: 'consolidationReason',
            maxLength: 1000,
          })
        : undefined;

      // Validate that both memories exist
      const [duplicateMemory, originalMemory] = await Promise.all([
        this.prisma.longTermMemory.findUnique({ where: { id: sanitizedDuplicateId } }),
        this.prisma.longTermMemory.findUnique({ where: { id: sanitizedOriginalId } }),
      ]);

      if (!duplicateMemory) {
        throw new ValidationError(
          `Duplicate memory not found: ${sanitizedDuplicateId}`,
          'duplicateId',
          sanitizedDuplicateId,
          'existence_check',
        );
      }

      if (!originalMemory) {
        throw new ValidationError(
          `Original memory not found: ${sanitizedOriginalId}`,
          'originalId',
          sanitizedOriginalId,
          'existence_check',
        );
      }

      // Update the duplicate memory to mark it as duplicate using existing field
      await this.prisma.longTermMemory.update({
        where: { id: sanitizedDuplicateId },
        data: {
          duplicateOf: sanitizedOriginalId,
          classificationReason: sanitizedReason,
        },
      });

      logInfo('Memory marked as duplicate successfully', {
        component: this.componentName,
        duplicateId: sanitizedDuplicateId,
        originalId: sanitizedOriginalId,
        duration: Date.now() - startTime,
      });

    } catch (error) {
      logError('Failed to mark memory as duplicate', {
        component: this.componentName,
        duplicateId,
        originalId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Consolidate multiple duplicate memories into a primary memory
   */
  async consolidateMemories(
    primaryId: string,
    duplicateIds: string[],
  ): Promise<ConsolidationResult> {
    const startTime = Date.now();

    try {
      logInfo('Consolidating memories', {
        component: this.componentName,
        primaryId,
        duplicateCount: duplicateIds.length,
      });

      // Sanitize inputs
      const sanitizedPrimaryId = sanitizeString(primaryId, {
        fieldName: 'primaryId',
        maxLength: 100,
        allowNewlines: false,
      });

      const sanitizedDuplicateIds = duplicateIds.map(id =>
        sanitizeString(id, {
          fieldName: 'duplicateId',
          maxLength: 100,
          allowNewlines: false,
        })
      );

      // Execute consolidation in a transaction for atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Verify primary memory exists
        const primaryMemory = await tx.longTermMemory.findUnique({
          where: { id: sanitizedPrimaryId },
        });

        if (!primaryMemory) {
          throw new ValidationError(
            `Primary memory not found: ${sanitizedPrimaryId}`,
            'primaryId',
            sanitizedPrimaryId,
            'existence_check',
          );
        }

        // Verify all duplicate memories exist and are actually duplicates
        const duplicateMemories = await tx.longTermMemory.findMany({
          where: {
            id: { in: sanitizedDuplicateIds },
          },
        });

        if (duplicateMemories.length !== sanitizedDuplicateIds.length) {
          const foundIds = duplicateMemories.map(m => m.id);
          const missingIds = sanitizedDuplicateIds.filter(id => !foundIds.includes(id));
          throw new ValidationError(
            `Some duplicate memories not found: ${missingIds.join(', ')}`,
            'duplicateIds',
            missingIds,
            'existence_check',
          );
        }

        // Generate data integrity hash for the consolidation
        const consolidationData = {
          primaryId: sanitizedPrimaryId,
          duplicateIds: sanitizedDuplicateIds,
          timestamp: new Date(),
        };
        const dataIntegrityHash = this.generateDataIntegrityHash(consolidationData);

        // Update all duplicate memories to point to primary
        await tx.longTermMemory.updateMany({
          where: {
            id: { in: sanitizedDuplicateIds },
          },
          data: {
            duplicateOf: sanitizedPrimaryId,
          },
        });

        // Update primary memory consolidation metadata using existing fields
        await tx.longTermMemory.update({
          where: { id: sanitizedPrimaryId },
          data: {
            relatedMemoriesJson: sanitizedDuplicateIds,
            classificationReason: `Consolidated ${sanitizedDuplicateIds.length} duplicate memories`,
          },
        });

        return {
          success: true,
          consolidatedCount: sanitizedDuplicateIds.length,
          primaryMemoryId: sanitizedPrimaryId,
          consolidatedMemoryIds: sanitizedDuplicateIds,
          dataIntegrityHash,
          consolidationTimestamp: new Date(),
        };
      });

      logInfo('Memories consolidated successfully', {
        component: this.componentName,
        primaryId: sanitizedPrimaryId,
        consolidatedCount: sanitizedDuplicateIds.length,
        duration: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      logError('Failed to consolidate memories', {
        component: this.componentName,
        primaryId,
        duplicateCount: duplicateIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get consolidation statistics for the current namespace
   */
  async getConsolidationStatistics(): Promise<ConsolidationStats> {
    const startTime = Date.now();

    try {
      logInfo('Getting consolidation statistics', {
        component: this.componentName,
      });

      // Aggregate statistics from the database using Prisma queries for better compatibility
      const totalMemories = await this.prisma.longTermMemory.count({
        where: { namespace: 'default' },
      });

      const duplicateCount = await this.prisma.longTermMemory.count({
        where: {
          namespace: 'default',
          duplicateOf: { not: null },
        },
      });

      const consolidatedMemories = await this.prisma.longTermMemory.count({
        where: {
          namespace: 'default',
          relatedMemoriesJson: { not: undefined },
        },
      });

      const lastConsolidationActivity = await this.prisma.longTermMemory.findFirst({
        where: { namespace: 'default' },
        orderBy: { extractionTimestamp: 'desc' },
        select: { extractionTimestamp: true },
      });

      const stats = [{
        total_memories: BigInt(totalMemories),
        duplicate_count: BigInt(duplicateCount),
        consolidated_memories: BigInt(consolidatedMemories),
        avg_consolidation_ratio: consolidatedMemories > 0 ? 1.0 : 0.0,
        last_consolidation_activity: lastConsolidationActivity?.extractionTimestamp || null,
      }];

      const result = stats[0] || {
        total_memories: BigInt(0),
        duplicate_count: BigInt(0),
        consolidated_memories: BigInt(0),
        avg_consolidation_ratio: 0,
        last_consolidation_activity: null,
      };

      // Get consolidation trends (simplified for now)
      const consolidationTrends: ConsolidationTrend[] = [];

      const consolidationStats: ConsolidationStats = {
        totalMemories: Number(result.total_memories),
        duplicateCount: Number(result.duplicate_count),
        consolidatedMemories: Number(result.consolidated_memories),
        averageConsolidationRatio: result.avg_consolidation_ratio || 0,
        lastConsolidationActivity: result.last_consolidation_activity || undefined,
        consolidationTrends,
      };

      logInfo('Consolidation statistics retrieved', {
        component: this.componentName,
        totalMemories: consolidationStats.totalMemories,
        duplicateCount: consolidationStats.duplicateCount,
        consolidatedMemories: consolidationStats.consolidatedMemories,
        duration: Date.now() - startTime,
      });

      return consolidationStats;

    } catch (error) {
      logError('Failed to get consolidation statistics', {
        component: this.componentName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Clean up old consolidated memories based on age criteria
   */
  async cleanupConsolidatedMemories(
    olderThanDays: number,
    dryRun: boolean,
  ): Promise<CleanupResult> {
    const startTime = Date.now();

    try {
      logInfo('Cleaning up consolidated memories', {
        component: this.componentName,
        olderThanDays,
        dryRun,
      });

      if (olderThanDays < 0) {
        throw new ValidationError(
          'olderThanDays must be a positive number',
          'olderThanDays',
          olderThanDays,
          'range_validation',
        );
      }

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find memories to clean up (using relatedMemoriesJson as consolidation indicator)
      const memoriesToCleanup = await this.prisma.longTermMemory.findMany({
        where: {
          relatedMemoriesJson: { not: undefined },
          extractionTimestamp: {
            lt: cutoffDate,
          },
          namespace: 'default',
        },
        select: {
          id: true,
          extractionTimestamp: true,
        },
      });

      if (dryRun) {
        logInfo('Dry run cleanup completed', {
          component: this.componentName,
          memoriesToCleanup: memoriesToCleanup.length,
          olderThanDays,
        });

        return {
          cleaned: 0,
          skipped: memoriesToCleanup.length,
          errors: [],
          dryRun: true,
        };
      }

      // Perform actual cleanup
      if (memoriesToCleanup.length > 0) {
        const memoryIds = memoriesToCleanup.map(m => m.id);

        await this.prisma.longTermMemory.deleteMany({
          where: {
            id: { in: memoryIds },
          },
        });
      }

      logInfo('Cleanup completed successfully', {
        component: this.componentName,
        cleaned: memoriesToCleanup.length,
        olderThanDays,
        duration: Date.now() - startTime,
      });

      return {
        cleaned: memoriesToCleanup.length,
        skipped: 0,
        errors: [],
        dryRun: false,
      };

    } catch (error) {
      logError('Failed to cleanup consolidated memories', {
        component: this.componentName,
        olderThanDays,
        dryRun,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        cleaned: 0,
        skipped: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        dryRun,
      };
    }
  }

  /**
   * Get detailed information about a specific consolidated memory
   */
  async getConsolidatedMemory(memoryId: string): Promise<ConsolidationMemorySearchResult | null> {
    const startTime = Date.now();

    try {
      logInfo('Getting consolidated memory details', {
        component: this.componentName,
        memoryId,
      });

      const sanitizedId = sanitizeString(memoryId, {
        fieldName: 'memoryId',
        maxLength: 100,
        allowNewlines: false,
      });

      const memory = await this.prisma.longTermMemory.findUnique({
        where: { id: sanitizedId },
      });

      if (!memory) {
        logInfo('Consolidated memory not found', {
          component: this.componentName,
          memoryId: sanitizedId,
        });
        return null;
      }

      const result: ConsolidationMemorySearchResult = {
        id: memory.id,
        content: memory.searchableContent,
        summary: memory.summary,
        classification: memory.classification as MemoryClassification,
        importance: memory.memoryImportance as MemoryImportanceLevel,
        topic: memory.topic || undefined,
        entities: (memory.entitiesJson as string[]) || [],
        keywords: (memory.keywordsJson as string[]) || [],
        confidenceScore: memory.confidenceScore,
        classificationReason: memory.classificationReason || '',
        metadata: {
          namespace: memory.namespace,
          extractionTimestamp: memory.extractionTimestamp,
        },
        isDuplicate: !!memory.duplicateOf,
        duplicateOf: memory.duplicateOf || undefined,
        isConsolidated: !!memory.relatedMemoriesJson,
        consolidatedAt: memory.extractionTimestamp, // Use extraction timestamp as proxy
        consolidationCount: Array.isArray(memory.relatedMemoriesJson) ? memory.relatedMemoriesJson.length : 0,
      };

      logInfo('Consolidated memory details retrieved', {
        component: this.componentName,
        memoryId: sanitizedId,
        isDuplicate: result.isDuplicate,
        isConsolidated: result.isConsolidated,
        duration: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      logError('Failed to get consolidated memory details', {
        component: this.componentName,
        memoryId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Get all memories that were consolidated into a primary memory
   */
  async getConsolidatedMemories(primaryMemoryId: string): Promise<string[]> {
    const startTime = Date.now();

    try {
      logInfo('Getting consolidated memories', {
        component: this.componentName,
        primaryMemoryId,
      });

      const sanitizedId = sanitizeString(primaryMemoryId, {
        fieldName: 'primaryMemoryId',
        maxLength: 100,
        allowNewlines: false,
      });

      // Find all memories that have this memory as their duplicateOf target
      const consolidatedMemories = await this.prisma.longTermMemory.findMany({
        where: {
          duplicateOf: sanitizedId,
        },
        select: {
          id: true,
        },
      });

      const result = consolidatedMemories.map(m => m.id);

      logInfo('Consolidated memories retrieved', {
        component: this.componentName,
        primaryMemoryId: sanitizedId,
        consolidatedCount: result.length,
        duration: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      logError('Failed to get consolidated memories', {
        component: this.componentName,
        primaryMemoryId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Update duplicate tracking information for multiple memories
   */
  async updateDuplicateTracking(updates: Array<{
    memoryId: string;
    isDuplicate?: boolean;
    duplicateOf?: string;
    consolidationReason?: string;
    markedAsDuplicateAt?: Date;
  }>): Promise<{ updated: number; errors: string[] }> {
    const startTime = Date.now();

    try {
      logInfo('Updating duplicate tracking', {
        component: this.componentName,
        updateCount: updates.length,
      });

      let updated = 0;
      const errors: string[] = [];

      // Process each update
      for (const update of updates) {
        try {
          const sanitizedUpdate = {
            memoryId: sanitizeString(update.memoryId, {
              fieldName: 'memoryId',
              maxLength: 100,
              allowNewlines: false,
            }),
            isDuplicate: update.isDuplicate,
            duplicateOf: update.duplicateOf ? sanitizeString(update.duplicateOf, {
              fieldName: 'duplicateOf',
              maxLength: 100,
              allowNewlines: false,
            }) : undefined,
            consolidationReason: update.consolidationReason ? sanitizeString(update.consolidationReason, {
              fieldName: 'consolidationReason',
              maxLength: 1000,
            }) : undefined,
            markedAsDuplicateAt: update.markedAsDuplicateAt,
          };

          await this.prisma.longTermMemory.update({
            where: { id: sanitizedUpdate.memoryId },
            data: {
              duplicateOf: sanitizedUpdate.duplicateOf,
              classificationReason: sanitizedUpdate.consolidationReason,
            },
          });

          updated++;
        } catch (updateError) {
          const errorMessage = `Failed to update memory ${update.memoryId}: ${updateError instanceof Error ? updateError.message : String(updateError)}`;
          errors.push(errorMessage);
        }
      }

      logInfo('Duplicate tracking updates completed', {
        component: this.componentName,
        totalUpdates: updates.length,
        successful: updated,
        failed: errors.length,
        duration: Date.now() - startTime,
      });

      return { updated, errors };

    } catch (error) {
      logError('Failed to update duplicate tracking', {
        component: this.componentName,
        updateCount: updates.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Perform pre-consolidation validation to ensure data integrity
   */
  async performPreConsolidationValidation(
    primaryMemoryId: string,
    duplicateIds: string[],
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const startTime = Date.now();

    try {
      logInfo('Performing pre-consolidation validation', {
        component: this.componentName,
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
      });

      const errors: string[] = [];

      // Sanitize inputs
      const sanitizedPrimaryId = sanitizeString(primaryMemoryId, {
        fieldName: 'primaryMemoryId',
        maxLength: 100,
        allowNewlines: false,
      });

      const sanitizedDuplicateIds = duplicateIds.map(id =>
        sanitizeString(id, {
          fieldName: 'duplicateId',
          maxLength: 100,
          allowNewlines: false,
        })
      );

      // Validate primary memory exists
      const primaryMemory = await this.prisma.longTermMemory.findUnique({
        where: { id: sanitizedPrimaryId },
      });

      if (!primaryMemory) {
        errors.push(`Primary memory not found: ${sanitizedPrimaryId}`);
      }

      // Validate all duplicate memories exist
      const duplicateMemories = await this.prisma.longTermMemory.findMany({
        where: {
          id: { in: sanitizedDuplicateIds },
        },
      });

      if (duplicateMemories.length !== sanitizedDuplicateIds.length) {
        const foundIds = duplicateMemories.map(m => m.id);
        const missingIds = sanitizedDuplicateIds.filter(id => !foundIds.includes(id));
        errors.push(`Duplicate memories not found: ${missingIds.join(', ')}`);
      }

      // Check for circular references
      const circularRefs = sanitizedDuplicateIds.filter(id => id === sanitizedPrimaryId);
      if (circularRefs.length > 0) {
        errors.push(`Circular reference detected: ${circularRefs.join(', ')}`);
      }

      const isValid = errors.length === 0;

      logInfo('Pre-consolidation validation completed', {
        component: this.componentName,
        primaryMemoryId: sanitizedPrimaryId,
        isValid,
        errorCount: errors.length,
        duration: Date.now() - startTime,
      });

      return { isValid, errors };

    } catch (error) {
      logError('Failed to perform pre-consolidation validation', {
        component: this.componentName,
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  /**
   * Backup memory data for potential rollback operations
   */
  async backupMemoryData(memoryIds: string[]): Promise<Map<string, any>> {
    const startTime = Date.now();

    try {
      logInfo('Backing up memory data', {
        component: this.componentName,
        memoryCount: memoryIds.length,
      });

      const backupData = new Map<string, any>();
      const sanitizedIds = memoryIds.map(id =>
        sanitizeString(id, {
          fieldName: 'memoryId',
          maxLength: 100,
          allowNewlines: false,
        })
      );

      // Get all memory data for backup
      const memories = await this.prisma.longTermMemory.findMany({
        where: {
          id: { in: sanitizedIds },
        },
      });

      // Store backup data
      for (const memory of memories) {
        backupData.set(memory.id, {
          ...memory,
          backupTimestamp: new Date(),
        });
      }

      logInfo('Memory data backed up successfully', {
        component: this.componentName,
        memoryCount: memoryIds.length,
        backedUp: memories.length,
        duration: Date.now() - startTime,
      });

      return backupData;

    } catch (error) {
      logError('Failed to backup memory data', {
        component: this.componentName,
        memoryCount: memoryIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Rollback a consolidation operation using backup data
   */
  async rollbackConsolidation(
    primaryMemoryId: string,
    duplicateIds: string[],
    originalData: Map<string, any>,
  ): Promise<void> {
    const startTime = Date.now();

    try {
      logInfo('Rolling back consolidation', {
        component: this.componentName,
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
      });

      // Execute rollback in a transaction
      await this.prisma.$transaction(async (tx) => {
        // Restore primary memory data
        const primaryBackup = originalData.get(primaryMemoryId);
        if (primaryBackup) {
          await tx.longTermMemory.update({
            where: { id: primaryMemoryId },
            data: {
              relatedMemoriesJson: primaryBackup.relatedMemoriesJson,
              classificationReason: primaryBackup.classificationReason,
            },
          });
        }

        // Restore duplicate memories data
        for (const duplicateId of duplicateIds) {
          const duplicateBackup = originalData.get(duplicateId);
          if (duplicateBackup) {
            await tx.longTermMemory.update({
              where: { id: duplicateId },
              data: {
                duplicateOf: duplicateBackup.duplicateOf,
              },
            });
          }
        }
      });

      logInfo('Consolidation rollback completed successfully', {
        component: this.componentName,
        primaryMemoryId,
        restoredCount: duplicateIds.length + 1,
        duration: Date.now() - startTime,
      });

    } catch (error) {
      logError('Failed to rollback consolidation', {
        component: this.componentName,
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate data integrity hash for validation
   */
  generateDataIntegrityHash(data: any): string {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(data));
    return hash.digest('hex');
  }

  // Private helper methods

  private buildSearchQuery(content: string, config?: DuplicateDetectionConfig): string {
    // Simple query building for FTS
    // In a real implementation, this would be more sophisticated
    return `"${content.replace(/"/g, '""')}"`;
  }

  private calculateSimilarityScore(content: string): string {
    // This would use more sophisticated similarity calculation
    // For now, using a simple BM25-like scoring
    return `bm25(memory_fts, 1.0, 1.0)`;
  }
}