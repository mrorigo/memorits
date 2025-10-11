import { logInfo, logError } from '../utils/Logger';
import { MemorySearchResult } from '../types/models';
import { MemoryRelationship, MemoryImportanceLevel } from '../types/schemas';

// Node.js crypto module for hashing
import { createHash } from 'node:crypto';

// Prisma client - using relative path to match existing pattern
import type { PrismaClient as PrismaClientType } from '@prisma/client';

/**
 * MemoryConsolidationService - Handles duplicate memory detection, merging, and consolidation
 *
 * Extracted from DatabaseManager to follow Single Responsibility Principle
 */
export class MemoryConsolidationService {
  constructor(
    private prisma: PrismaClientType,
    private namespace: string = 'default',
  ) {}

  /**
    * Find potential duplicate memories based on content similarity
    */
  async findPotentialDuplicates(
    content: string,
    threshold: number = 0.7,
  ): Promise<MemorySearchResult[]> {
    // This method would implement duplicate finding logic
    // For now, return empty array as this is extracted functionality
    logInfo('findPotentialDuplicates called - functionality extracted to MemoryConsolidationService', {
      component: 'MemoryConsolidationService',
      contentLength: content.length,
      threshold,
      namespace: this.namespace,
    });
    return [];
  }

  /**
   * Mark a memory as a duplicate of another memory
   */
  async markAsDuplicate(
    duplicateId: string,
    originalId: string,
    consolidationReason: string = 'automatic_consolidation',
  ): Promise<void> {
    try {
      // Update the duplicate memory with tracking information
      await this.prisma.longTermMemory.update({
        where: { id: duplicateId },
        data: {
          processedData: {
            isDuplicate: true,
            duplicateOf: originalId,
            consolidationReason,
            markedAsDuplicateAt: new Date(),
          },
        },
      });

      logInfo(`Marked memory ${duplicateId} as duplicate of ${originalId}`, {
        component: 'MemoryConsolidationService',
        duplicateId,
        originalId,
        consolidationReason,
      });
    } catch (error) {
      logInfo(`Error marking memory ${duplicateId} as duplicate of ${originalId}`, {
        component: 'MemoryConsolidationService',
        duplicateId,
        originalId,
        consolidationReason,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to mark memory as duplicate: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Update duplicate tracking information for memories
   */
  async updateDuplicateTracking(
    updates: Array<{
      memoryId: string;
      isDuplicate?: boolean;
      duplicateOf?: string;
      consolidationReason?: string;
      markedAsDuplicateAt?: Date;
    }>,
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      // Process each update in parallel for better performance
      const updatePromises = updates.map(async (update) => {
        try {
          const existingMemory = await this.prisma.longTermMemory.findFirst({
            where: {
              id: update.memoryId,
              namespace: this.namespace,
            },
          });

          if (!existingMemory) {
            errors.push(`Memory ${update.memoryId} not found in namespace ${this.namespace}`);
            return;
          }

          // Update the memory with new duplicate tracking information
          await this.prisma.longTermMemory.update({
            where: { id: update.memoryId },
            data: {
              processedData: {
                ...(existingMemory.processedData as Record<string, unknown> || {}),
                ...update,
                updatedAt: new Date(),
              },
            },
          });

          updated++;
        } catch (error) {
          const errorMsg = `Failed to update duplicate tracking for memory ${update.memoryId}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logInfo(errorMsg, {
            component: 'MemoryConsolidationService',
            memoryId: update.memoryId,
            namespace: this.namespace,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.all(updatePromises);

      logInfo(`Updated duplicate tracking for ${updated} memories in namespace '${this.namespace}'`, {
        component: 'MemoryConsolidationService',
        namespace: this.namespace,
        updated,
        errors: errors.length,
      });

      return { updated, errors };
    } catch (error) {
      const errorMsg = `Error updating duplicate tracking: ${error instanceof Error ? error.message : String(error)}`;
      logInfo(errorMsg, {
        component: 'MemoryConsolidationService',
        namespace: this.namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(errorMsg);
    }
  }

  /**
   * Consolidate duplicate memories by merging them into the primary memory with enhanced validation and rollback
   */
  async consolidateDuplicateMemories(
    primaryMemoryId: string,
    duplicateIds: string[],
  ): Promise<{ consolidated: number; errors: string[] }> {
    const errors: string[] = [];
    let consolidatedCount = 0;

    // Enhanced input validation
    if (!primaryMemoryId || duplicateIds.length === 0) {
      errors.push('Primary memory ID and at least one duplicate ID are required');
      return { consolidated: 0, errors };
    }

    if (duplicateIds.includes(primaryMemoryId)) {
      errors.push('Primary memory cannot be in the duplicate list');
      return { consolidated: 0, errors };
    }

    // Pre-consolidation validation
    const validationResult = await this.performPreConsolidationValidation(primaryMemoryId, duplicateIds);
    if (!validationResult.isValid) {
      errors.push(...validationResult.errors);
      return { consolidated: 0, errors };
    }

    // Store original data for potential rollback
    const originalData = await this.backupMemoryData([primaryMemoryId, ...duplicateIds]);

    try {
      logInfo(`Starting enhanced consolidation of ${duplicateIds.length} duplicates into primary memory ${primaryMemoryId}`, {
        component: 'MemoryConsolidationService',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace: this.namespace,
        validationPassed: true,
      });

      // Execute consolidation within a transaction for data integrity
      const result = await this.prisma.$transaction(async (tx) => {
        // Get the primary memory first
        const primaryMemory = await tx.longTermMemory.findUnique({
          where: { id: primaryMemoryId },
        });

        if (!primaryMemory) {
          throw new Error(`Primary memory ${primaryMemoryId} not found`);
        }

        // Get all duplicate memories
        const duplicateMemories = await tx.longTermMemory.findMany({
          where: {
            id: { in: duplicateIds },
            namespace: this.namespace,
          },
        });

        if (duplicateMemories.length !== duplicateIds.length) {
          const foundIds = duplicateMemories.map((m) => m.id);
          const missingIds = duplicateIds.filter(id => !foundIds.includes(id));
          throw new Error(`Some duplicate memories not found: ${missingIds.join(', ')}`);
        }

        // Enhanced data merging with conflict resolution
        const mergedData = await this.mergeDuplicateDataEnhanced(primaryMemory, duplicateMemories);

        // Update the primary memory with consolidated data
        const consolidationTimestamp = new Date();
        await tx.longTermMemory.update({
          where: { id: primaryMemoryId },
          data: {
            searchableContent: mergedData.content,
            summary: mergedData.summary,
            entitiesJson: mergedData.entities,
            keywordsJson: mergedData.keywords,
            topic: mergedData.topic,
            confidenceScore: mergedData.confidenceScore,
            classificationReason: mergedData.classificationReason,
            extractionTimestamp: consolidationTimestamp,
            processedData: {
              ...(primaryMemory.processedData as Record<string, unknown>),
              consolidatedAt: consolidationTimestamp,
              consolidatedFrom: duplicateIds,
              consolidationReason: 'duplicate_consolidation',
              consolidationHistory: [
                ...((primaryMemory.processedData as Record<string, unknown>)?.consolidationHistory as unknown[] || []),
                {
                  timestamp: consolidationTimestamp,
                  consolidatedFrom: duplicateIds,
                  consolidationReason: 'duplicate_consolidation',
                  originalImportance: primaryMemory.memoryImportance,
                  originalClassification: primaryMemory.classification,
                  duplicateCount: duplicateIds.length,
                  dataIntegrityHash: this.generateDataIntegrityHash(mergedData),
                },
              ] as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              originalImportance: primaryMemory.memoryImportance,
              originalClassification: primaryMemory.classification,
              duplicateCount: duplicateIds.length,
              lastConsolidationActivity: consolidationTimestamp,
            } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
          },
        });

        // Mark all duplicates as consolidated with enhanced tracking
        for (const duplicateId of duplicateIds) {
          const duplicateMemory = duplicateMemories.find((m) => m.id === duplicateId);
          await tx.longTermMemory.update({
            where: { id: duplicateId },
            data: {
              processedData: {
                isConsolidated: true,
                consolidatedInto: primaryMemoryId,
                consolidatedAt: consolidationTimestamp,
                consolidationReason: 'duplicate_consolidation',
                originalDataHash: this.generateDataIntegrityHash(duplicateMemory),
                consolidationMetadata: {
                  consolidationMethod: 'enhanced_duplicate_merge',
                  primaryMemoryClassification: primaryMemory.classification,
                  primaryMemoryImportance: primaryMemory.memoryImportance,
                  dataMerged: true,
                },
              } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
              // Mark in searchable content for easy identification
              searchableContent: `[CONSOLIDATED:${consolidationTimestamp.toISOString()}] ${duplicateMemory?.searchableContent}`,
            },
          });
        }

        return { consolidated: duplicateIds.length, duplicateMemories };
      }, {
        timeout: 60000, // 60 second timeout for large consolidations
      });

      consolidatedCount = result.consolidated;

      logInfo(`Successfully completed enhanced consolidation of ${consolidatedCount} duplicates into primary memory ${primaryMemoryId}`, {
        component: 'MemoryConsolidationService',
        primaryMemoryId,
        consolidatedCount,
        namespace: this.namespace,
        consolidationTimestamp: new Date().toISOString(),
        backupAvailable: true,
      });

      return { consolidated: consolidatedCount, errors };

    } catch (error) {
      const errorMsg = `Enhanced consolidation failed for primary memory ${primaryMemoryId}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);

      logError(errorMsg, {
        component: 'MemoryConsolidationService',
        primaryMemoryId,
        duplicateIds,
        namespace: this.namespace,
        error: error instanceof Error ? error.stack : String(error),
      });

      // Attempt rollback if backup data is available
      if (originalData.size > 0) {
        try {
          await this.rollbackConsolidation(primaryMemoryId, duplicateIds, originalData);
          logInfo(`Successfully rolled back consolidation for memory ${primaryMemoryId}`, {
            component: 'MemoryConsolidationService',
            primaryMemoryId,
            namespace: this.namespace,
          });
        } catch (rollbackError) {
          logError(`Rollback failed for memory ${primaryMemoryId}`, {
            component: 'MemoryConsolidationService',
            primaryMemoryId,
            namespace: this.namespace,
            rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          });
        }
      }

      return { consolidated: consolidatedCount, errors };
    }
  }

  // Helper methods for consolidation (these would be moved from DatabaseManager)

  private calculateImportanceScore(level: string): number {
    const scores = {
      [MemoryImportanceLevel.CRITICAL]: 0.9,
      [MemoryImportanceLevel.HIGH]: 0.7,
      [MemoryImportanceLevel.MEDIUM]: 0.5,
      [MemoryImportanceLevel.LOW]: 0.3,
    };
    return scores[level as MemoryImportanceLevel] || 0.5;
  }

  /**
   * Merge relationships to avoid duplicates and combine metadata
   */
  private mergeRelationships(
    existingRelationships: MemoryRelationship[],
    newRelationships: MemoryRelationship[],
  ): MemoryRelationship[] {
    const merged = [...existingRelationships];

    for (const newRel of newRelationships) {
      // Check if relationship already exists (same type and target)
      const existingIndex = merged.findIndex(
        existing => existing.type === newRel.type &&
          existing.targetMemoryId === newRel.targetMemoryId,
      );

      if (existingIndex >= 0) {
        // Update existing relationship with higher confidence/strength
        const existing = merged[existingIndex];
        if (newRel.confidence > existing.confidence || newRel.strength > existing.strength) {
          merged[existingIndex] = {
            ...newRel,
            // Preserve the better metadata from both
            reason: newRel.confidence > existing.confidence ? newRel.reason : existing.reason,
            context: newRel.confidence > existing.confidence ? newRel.context : existing.context,
          };
        }
      } else {
        // Add new relationship
        merged.push(newRel);
      }
    }

    return merged;
  }

  /**
   * Perform pre-consolidation validation to ensure data integrity
   */
  private async performPreConsolidationValidation(
    primaryMemoryId: string,
    duplicateIds: string[],
  ): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      // Validate primary memory exists and is in correct namespace
      const primaryMemory = await this.prisma.longTermMemory.findUnique({
        where: { id: primaryMemoryId },
        select: { id: true, namespace: true, processedData: true },
      });

      if (!primaryMemory) {
        errors.push(`Primary memory ${primaryMemoryId} not found`);
        return { isValid: false, errors };
      }

      if (primaryMemory.namespace !== this.namespace) {
        errors.push(`Primary memory ${primaryMemoryId} is not in namespace ${this.namespace}`);
        return { isValid: false, errors };
      }

      // Check if primary memory is already consolidated
      const processedData = primaryMemory.processedData as Record<string, unknown> | null;
      if (processedData?.consolidatedAt) {
        const lastConsolidation = new Date(processedData.consolidatedAt as string | number | Date);
        const hoursSinceLastConsolidation = (Date.now() - lastConsolidation.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastConsolidation < 1) {
          errors.push(`Primary memory ${primaryMemoryId} was consolidated recently (${hoursSinceLastConsolidation.toFixed(1)} hours ago)`);
        }
      }

      // Validate all duplicate memories exist and are in correct namespace
      const duplicateMemories = await this.prisma.longTermMemory.findMany({
        where: {
          id: { in: duplicateIds },
          namespace: this.namespace,
        },
        select: { id: true, namespace: true, processedData: true },
      });

      if (duplicateMemories.length !== duplicateIds.length) {
        const foundIds = duplicateMemories.map((m) => m.id);
        const missingIds = duplicateIds.filter(id => !foundIds.includes(id));
        errors.push(`Some duplicate memories not found in namespace ${this.namespace}: ${missingIds.join(', ')}`);
      }

      // Check for circular consolidation references
      for (const duplicate of duplicateMemories) {
        const duplicateData = duplicate.processedData as Record<string, unknown>;
        if (duplicateData?.consolidatedInto === primaryMemoryId) {
          errors.push(`Circular consolidation detected: duplicate ${duplicate.id} is already consolidated into primary ${primaryMemoryId}`);
        }
      }

      // Check for over-consolidation (too many duplicates)
      if (duplicateIds.length > 50) {
        errors.push(`Too many duplicates (${duplicateIds.length}) - maximum recommended is 50`);
      }

      const isValid = errors.length === 0;
      logInfo(`Pre-consolidation validation ${isValid ? 'passed' : 'failed'}`, {
        component: 'MemoryConsolidationService',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace: this.namespace,
        errors: errors.length,
        isValid,
      });

      return { isValid, errors };
    } catch (error) {
      const errorMsg = `Pre-consolidation validation error: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      return { isValid: false, errors };
    }
  }

  /**
   * Backup memory data for potential rollback
   */
  private async backupMemoryData(memoryIds: string[]): Promise<Map<string, any>> { // eslint-disable-line @typescript-eslint/no-explicit-any
    const backupData = new Map<string, any>(); // eslint-disable-line @typescript-eslint/no-explicit-any

    try {
      const memories = await this.prisma.longTermMemory.findMany({
        where: {
          id: { in: memoryIds },
          namespace: this.namespace,
        },
      });

      for (const memory of memories) {
        backupData.set(memory.id, {
          id: memory.id,
          searchableContent: memory.searchableContent,
          summary: memory.summary,
          entitiesJson: memory.entitiesJson,
          keywordsJson: memory.keywordsJson,
          topic: memory.topic,
          confidenceScore: memory.confidenceScore,
          classificationReason: memory.classificationReason,
          processedData: memory.processedData,
          extractionTimestamp: memory.extractionTimestamp,
        });
      }

      logInfo(`Backed up data for ${backupData.size} memories`, {
        component: 'MemoryConsolidationService',
        memoryIds: memoryIds,
        namespace: this.namespace,
        backupSize: backupData.size,
      });

      return backupData;
    } catch (error) {
      logError('Failed to backup memory data', {
        component: 'MemoryConsolidationService',
        memoryIds,
        namespace: this.namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      return backupData;
    }
  }

  /**
   * Rollback consolidation if something goes wrong
   */
  private async rollbackConsolidation(
    primaryMemoryId: string,
    duplicateIds: string[],
    originalData: Map<string, any>, // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<void> {
    try {
      logInfo(`Attempting rollback for failed consolidation of memory ${primaryMemoryId}`, {
        component: 'MemoryConsolidationService',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace: this.namespace,
      });

      // Rollback primary memory
      const primaryBackup = originalData.get(primaryMemoryId);
      if (primaryBackup) {
        await this.prisma.longTermMemory.update({
          where: { id: primaryMemoryId },
          data: {
            searchableContent: primaryBackup.searchableContent,
            summary: primaryBackup.summary,
            entitiesJson: primaryBackup.entitiesJson,
            keywordsJson: primaryBackup.keywordsJson,
            topic: primaryBackup.topic,
            confidenceScore: primaryBackup.confidenceScore,
            classificationReason: primaryBackup.classificationReason,
            processedData: {
              ...primaryBackup.processedData,
              rollbackTimestamp: new Date(),
              rollbackReason: 'consolidation_failure',
            },
          },
        });
      }

      // Rollback duplicate memories
      for (const duplicateId of duplicateIds) {
        const duplicateBackup = originalData.get(duplicateId);
        if (duplicateBackup) {
          await this.prisma.longTermMemory.update({
            where: { id: duplicateId },
            data: {
              searchableContent: duplicateBackup.searchableContent,
              summary: duplicateBackup.summary,
              entitiesJson: duplicateBackup.entitiesJson,
              keywordsJson: duplicateBackup.keywordsJson,
              topic: duplicateBackup.topic,
              confidenceScore: duplicateBackup.confidenceScore,
              classificationReason: duplicateBackup.classificationReason,
              processedData: {
                ...duplicateBackup.processedData,
                rollbackTimestamp: new Date(),
                rollbackReason: 'consolidation_failure',
              },
            },
          });
        }
      }

      logInfo(`Successfully rolled back consolidation for memory ${primaryMemoryId}`, {
        component: 'MemoryConsolidationService',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace: this.namespace,
      });
    } catch (error) {
      logError(`Rollback failed for memory ${primaryMemoryId}`, {
        component: 'MemoryConsolidationService',
        primaryMemoryId,
        duplicateIds,
        namespace: this.namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate data integrity hash for validation
   */
  private generateDataIntegrityHash(data: any): string { // eslint-disable-line @typescript-eslint/no-explicit-any
    const content = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Enhanced data merging with conflict resolution and quality scoring
   */
  private async mergeDuplicateDataEnhanced(
    primaryMemory: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    duplicateMemories: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<{
    content: string;
    summary: string;
    entities: string[];
    keywords: string[];
    topic?: string;
    confidenceScore: number;
    classificationReason: string;
  }> {
    try {
      // Input validation
      if (!primaryMemory || !Array.isArray(duplicateMemories)) {
        throw new Error('Invalid input: primaryMemory and duplicateMemories array are required');
      }

      if (duplicateMemories.length === 0) {
        throw new Error('No duplicate memories provided for merging');
      }

      logInfo('Starting intelligent duplicate data merge', {
        component: 'MemoryConsolidationService',
        primaryMemoryId: primaryMemory.id,
        duplicateCount: duplicateMemories.length,
      });

      // Merge entities with frequency-based weighting and 2x primary weight
      const mergedEntities = this.mergeEntitiesWithWeighting(
        (primaryMemory.entitiesJson as string[]) || [],
        duplicateMemories.map(m => (m.entitiesJson as string[]) || []),
      );

      // Merge keywords with priority ranking based on importance
      const mergedKeywords = this.mergeKeywordsWithPriority(
        (primaryMemory.keywordsJson as string[]) || [],
        duplicateMemories.map(m => (m.keywordsJson as string[]) || []),
        primaryMemory,
        duplicateMemories,
      );

      // Calculate weighted confidence scores from all memories
      const consolidatedConfidenceScore = this.calculateWeightedConfidenceScore(
        primaryMemory.confidenceScore,
        duplicateMemories.map(m => m.confidenceScore),
      );

      // Combine classification reasons intelligently
      const consolidatedClassificationReason = this.combineClassificationReasons(
        primaryMemory.classificationReason || '',
        duplicateMemories.map(m => m.classificationReason || ''),
      );

      // Preserve most important topic information from primary memory
      const consolidatedTopic = this.consolidateTopicInformation(
        primaryMemory.topic,
        duplicateMemories.map(m => m.topic).filter(Boolean),
      );

      // Generate consolidated summary with intelligent merging
      const consolidatedSummary = this.generateConsolidatedSummary(
        primaryMemory.summary || '',
        duplicateMemories.map(m => m.summary || '').filter(Boolean),
      );

      // Generate consolidated content with deduplication
      const consolidatedContent = this.generateMergedContent(
        primaryMemory.searchableContent || '',
        duplicateMemories.map(m => m.searchableContent || ''),
      );

      logInfo('Successfully completed intelligent duplicate data merge', {
        component: 'MemoryConsolidationService',
        primaryMemoryId: primaryMemory.id,
        duplicateCount: duplicateMemories.length,
        mergedEntitiesCount: mergedEntities.length,
        mergedKeywordsCount: mergedKeywords.length,
        consolidatedConfidenceScore,
      });

      return {
        content: consolidatedContent,
        summary: consolidatedSummary,
        entities: mergedEntities,
        keywords: mergedKeywords,
        topic: consolidatedTopic,
        confidenceScore: consolidatedConfidenceScore,
        classificationReason: consolidatedClassificationReason,
      };

    } catch (error) {
      logError('Failed to merge duplicate data', {
        component: 'MemoryConsolidationService',
        primaryMemoryId: primaryMemory.id,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to merge duplicate data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Helper method: Merge entities with frequency-based weighting (primary gets 2x weight)
   */
  private mergeEntitiesWithWeighting(
    primaryEntities: string[],
    duplicateEntitiesList: string[][],
  ): string[] {
    const entityCount = new Map<string, number>();

    // Process primary entities with 2x weighting
    primaryEntities.forEach(entity => {
      entityCount.set(entity.toLowerCase().trim(), (entityCount.get(entity.toLowerCase().trim()) || 0) + 2);
    });

    // Process duplicate entities with normal weighting
    duplicateEntitiesList.forEach(entities => {
      entities.forEach(entity => {
        entityCount.set(entity.toLowerCase().trim(), (entityCount.get(entity.toLowerCase().trim()) || 0) + 1);
      });
    });

    // Sort by frequency and take top entities (limit to prevent excessive growth)
    return Array.from(entityCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([entity]) => entity);
  }

  /**
   * Helper method: Merge keywords with priority ranking based on importance
   */
  private mergeKeywordsWithPriority(
    primaryKeywords: string[],
    duplicateKeywordsList: string[][],
    primaryMemory: any, // eslint-disable-line @typescript-eslint/no-explicit-any
    duplicateMemories: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  ): string[] {
    const keywordCount = new Map<string, number>();
    const primaryImportance = this.calculateImportanceScore(primaryMemory.memoryImportance || 'medium');

    // Process primary keywords with importance-based weighting
    primaryKeywords.forEach(keyword => {
      const weight = Math.ceil(primaryImportance * 2); // 2x weighting plus importance factor
      keywordCount.set(keyword.toLowerCase().trim(), (keywordCount.get(keyword.toLowerCase().trim()) || 0) + weight);
    });

    // Process duplicate keywords with their respective importance
    duplicateMemories.forEach((memory, index) => {
      const importance = this.calculateImportanceScore(memory.memoryImportance || 'medium');
      const keywords = duplicateKeywordsList[index] || [];

      keywords.forEach(keyword => {
        const weight = Math.ceil(importance * 1); // Normal weighting with importance factor
        keywordCount.set(keyword.toLowerCase().trim(), (keywordCount.get(keyword.toLowerCase().trim()) || 0) + weight);
      });
    });

    // Sort by priority score and take top keywords
    return Array.from(keywordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([keyword]) => keyword);
  }

  /**
   * Helper method: Calculate weighted confidence scores from all memories
   */
  private calculateWeightedConfidenceScore(
    primaryConfidence: number,
    duplicateConfidences: number[],
  ): number {
    const primaryWeight = 0.6; // Primary memory gets 60% weight
    const totalDuplicateWeight = 0.4; // Remaining 40% distributed among duplicates
    const duplicateWeight = duplicateConfidences.length > 0 ? totalDuplicateWeight / duplicateConfidences.length : 0;

    let totalConfidenceScore = primaryConfidence * primaryWeight;
    duplicateConfidences.forEach(confidence => {
      totalConfidenceScore += confidence * duplicateWeight;
    });

    return Math.round(totalConfidenceScore * 100) / 100;
  }

  /**
   * Helper method: Combine classification reasons intelligently
   */
  private combineClassificationReasons(
    primaryReason: string,
    duplicateReasons: string[],
  ): string {
    const allReasons = [primaryReason, ...duplicateReasons].filter(Boolean);

    // Remove duplicates while preserving order
    const uniqueReasons = Array.from(new Set(allReasons));

    // Combine into a single coherent explanation
    if (uniqueReasons.length === 1) {
      return uniqueReasons[0];
    }

    return `Primary classification: ${uniqueReasons[0]}. Additional context: ${uniqueReasons.slice(1).join('; ')}`;
  }

  /**
   * Helper method: Consolidate topic information from all memories
   */
  private consolidateTopicInformation(
    primaryTopic: string | undefined,
    duplicateTopics: string[],
  ): string | undefined {
    // Always prefer primary topic if available
    if (primaryTopic && primaryTopic.trim()) {
      return primaryTopic.trim();
    }

    // If no primary topic, find most frequent topic from duplicates
    const topicCount = new Map<string, number>();
    duplicateTopics.forEach(topic => {
      if (topic && topic.trim()) {
        topicCount.set(topic.trim(), (topicCount.get(topic.trim()) || 0) + 1);
      }
    });

    const topTopic = Array.from(topicCount.entries())
      .sort((a, b) => b[1] - a[1])[0];

    return topTopic ? topTopic[0] : undefined;
  }

  /**
   * Helper method: Generate consolidated summary with intelligent merging
   */
  private generateConsolidatedSummary(
    primarySummary: string,
    duplicateSummaries: string[],
  ): string {
    if (!primarySummary && duplicateSummaries.length === 0) {
      return 'Consolidated memory summary';
    }

    if (!primarySummary) {
      return duplicateSummaries[0] || 'Consolidated memory summary';
    }

    if (duplicateSummaries.length === 0) {
      return primarySummary;
    }

    // Extract key information from duplicate summaries
    const keyDuplicateInfo = duplicateSummaries
      .slice(0, 3) // Limit to top 3 duplicates
      .map(summary => summary.split('.')[0]) // Take first sentence
      .filter(info => info.length > 10) // Filter very short info
      .join('; ');

    if (keyDuplicateInfo) {
      return `${primarySummary} (Consolidated from ${duplicateSummaries.length + 1} memories: ${keyDuplicateInfo})`;
    }

    return primarySummary;
  }

  /**
   * Generate consolidated content by merging and deduplicating information
   */
  private generateMergedContent(primaryContent: string, duplicateContents: string[]): string {
    try {
      // Input validation
      if (!primaryContent && duplicateContents.length === 0) {
        return 'No content available for consolidation';
      }

      logInfo('Starting intelligent content consolidation', {
        component: 'MemoryConsolidationService',
        primaryContentLength: primaryContent.length,
        duplicateContentsCount: duplicateContents.length,
      });

      // Fallback to primary content if no duplicates
      if (duplicateContents.length === 0) {
        return primaryContent;
      }

      // Perform sentence-level deduplication with frequency analysis
      const { topSentences, keyTopics } = this.performSentenceLevelDeduplication(
        primaryContent,
        duplicateContents,
      );

      // Extract key topics based on word frequency
      const importantTopics = this.extractKeyTopics(
        [primaryContent, ...duplicateContents],
        keyTopics,
      );

      // Generate consolidated content with intelligent length management
      const consolidatedContent = this.buildConsolidatedContent(
        topSentences,
        importantTopics,
        primaryContent,
        duplicateContents.length,
      );

      logInfo('Successfully generated consolidated content', {
        component: 'MemoryConsolidationService',
        originalLength: primaryContent.length,
        consolidatedLength: consolidatedContent.length,
        sentencesCount: topSentences.length,
        topicsCount: importantTopics.length,
      });

      return consolidatedContent;

    } catch (error) {
      logError('Failed to generate merged content, using primary content as fallback', {
        component: 'MemoryConsolidationService',
        error: error instanceof Error ? error.message : String(error),
        primaryContentLength: primaryContent?.length || 0,
        duplicateCount: duplicateContents?.length || 0,
      });
      return primaryContent || 'Content consolidation failed'; // Safe fallback
    }
  }

  /**
   * Helper method: Perform sentence-level deduplication with frequency analysis
   */
  private performSentenceLevelDeduplication(
    primaryContent: string,
    duplicateContents: string[],
  ): { topSentences: string[], keyTopics: Set<string> } {
    const sentences = new Map<string, number>();
    const words = new Set<string>();
    const allContents = [primaryContent, ...duplicateContents];

    allContents.forEach((content, index) => {
      const isPrimary = index === 0;
      const weight = isPrimary ? 2 : 1; // Primary content gets 2x weight

      // Extract words for topic analysis
      const contentWords = content.toLowerCase()
        .replace(/[^\w\s]/g, ' ') // Remove punctuation
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isStopWord(word))
        .map(word => word.toLowerCase().trim());

      contentWords.forEach(word => words.add(word));

      // Split into sentences with improved pattern
      const contentSentences = content.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 15) // Filter very short sentences
        .map(s => s.replace(/\s+/g, ' ').trim()); // Normalize whitespace

      contentSentences.forEach(sentence => {
        const cleanSentence = sentence.toLowerCase().replace(/[^\w\s]/g, ' ').trim();
        if (cleanSentence.length > 10) { // Additional length check after cleaning
          sentences.set(cleanSentence, (sentences.get(cleanSentence) || 0) + weight);
        }
      });
    });

    // Select most representative sentences (appear most frequently, with primary bias)
    const topSentences = Array.from(sentences.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12) // Slightly increased limit for better coverage
      .map(([sentence]) => {
        // Capitalize first letter of each sentence
        return sentence.charAt(0).toUpperCase() + sentence.slice(1);
      });

    return { topSentences, keyTopics: words };
  }

  /**
   * Helper method: Extract key topics based on word frequency
   */
  private extractKeyTopics(
    allContents: string[],
    keyWords: Set<string>,
  ): string[] {
    const wordFrequency = new Map<string, number>();

    allContents.forEach(content => {
      const words = content.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isStopWord(word))
        .map(word => word.toLowerCase().trim());

      words.forEach(word => {
        if (keyWords.has(word)) {
          wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
        }
      });
    });

    // Return top topics by frequency
    return Array.from(wordFrequency.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word);
  }

  /**
   * Helper method: Build consolidated content with intelligent length management
   */
  private buildConsolidatedContent(
    topSentences: string[],
    importantTopics: string[],
    primaryContent: string,
    duplicateCount: number,
  ): string {
    // Ensure we have sentences to work with
    if (topSentences.length === 0) {
      return primaryContent; // Fallback to primary content
    }

    // Start with the most important sentences
    let consolidatedContent = topSentences.slice(0, 8).join('. ') + '.';

    // Add key topics if we have meaningful content
    if (importantTopics.length > 0 && consolidatedContent.length > 50) {
      const topicsText = importantTopics.slice(0, 10).join(', ');
      consolidatedContent += ` Key topics include: ${topicsText}.`;
    }

    // Manage content length intelligently
    const maxLength = 2000; // Reasonable maximum length
    const minLength = 100;  // Minimum meaningful length

    if (consolidatedContent.length > maxLength) {
      // Truncate to maximum length while preserving sentence boundaries
      const truncated = consolidatedContent.substring(0, maxLength);
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('.'),
        truncated.lastIndexOf('!'),
        truncated.lastIndexOf('?'),
      );

      if (lastSentenceEnd > maxLength * 0.7) { // Only truncate if we're not cutting too much
        consolidatedContent = truncated.substring(0, lastSentenceEnd + 1);
      } else {
        consolidatedContent = truncated; // Keep as-is if sentence boundary is too early
      }
    }

    // Ensure minimum content length
    if (consolidatedContent.length < minLength && primaryContent) {
      // If consolidated content is too short, blend with primary content
      const primarySentences = primaryContent.split(/[.!?]+/)
        .map(s => s.trim())
        .filter(s => s.length > 15)
        .slice(0, 3);

      if (primarySentences.length > 0) {
        consolidatedContent = primarySentences.join('. ') + '. ' + consolidatedContent;
      }
    }

    // Add consolidation metadata
    if (duplicateCount > 0) {
      consolidatedContent += ` (Consolidated from ${duplicateCount + 1} source memories)`;
    }

    return consolidatedContent;
  }

  /**
   * Helper method: Check if a word is a common stop word
   */
  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
      'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did',
      'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
      'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her',
      'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which',
      'who', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
      'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
      'than', 'too', 'very', 'just', 'like', 'also', 'well', 'now', 'here', 'there',
    ]);

    return stopWords.has(word.toLowerCase());
  }

  /**
   * Get consolidation statistics for a namespace
   */
  async getConsolidationStats(): Promise<{
    totalMemories: number;
    potentialDuplicates: number;
    consolidatedMemories: number;
    consolidationRatio: number;
    lastConsolidation?: Date;
  }> {
    try {
      // Get total memories count
      const totalMemories = await this.prisma.longTermMemory.count({
        where: { namespace: this.namespace },
      });

      // Get consolidated memories (those marked as duplicates that have been processed)
      const consolidatedMemories = await this.prisma.longTermMemory.count({
        where: {
          namespace: this.namespace,
          processedData: {
            path: ['isDuplicate'],
            equals: true,
          } as Record<string, unknown>,
        },
      });

      // Get potential duplicates (memories with similar content)
      const allMemories = await this.prisma.longTermMemory.findMany({
        where: { namespace: this.namespace },
        select: { id: true, searchableContent: true, summary: true },
        take: 1000, // Limit for performance
      });

      // Calculate potential duplicates using similarity analysis
      let potentialDuplicates = 0;
      const processedIds = new Set<string>();

      for (const memory of allMemories) {
        if (processedIds.has(memory.id)) continue;

        const similarMemories = allMemories.filter((otherMemory: any) => { // eslint-disable-line @typescript-eslint/no-explicit-any
          if (otherMemory.id === memory.id || processedIds.has(otherMemory.id)) return false;

          // Simple similarity check
          const content1 = (memory.searchableContent + ' ' + memory.summary).toLowerCase();
          const content2 = (otherMemory.searchableContent + ' ' + otherMemory.summary).toLowerCase();

          const words1 = new Set(content1.split(/\s+/));
          const words2 = new Set(content2.split(/\s+/));
          const intersection = new Set([...Array.from(words1)].filter((x) => words2.has(x)));
          const union = new Set([...Array.from(words1), ...Array.from(words2)]);
          const similarity = intersection.size / union.size;

          return similarity >= 0.7; // 70% similarity threshold
        });

        if (similarMemories.length > 0) {
          potentialDuplicates += similarMemories.length;
          processedIds.add(memory.id);
          similarMemories.forEach((mem: any) => processedIds.add(mem.id)); // eslint-disable-line @typescript-eslint/no-explicit-any
        }
      }

      // Get last consolidation activity
      const lastConsolidation = await this.prisma.longTermMemory.findFirst({
        where: {
          namespace: this.namespace,
          processedData: {
            path: ['consolidationReason'],
            not: null,
          } as Record<string, unknown>,
        },
        orderBy: { extractionTimestamp: 'desc' },
        select: { extractionTimestamp: true },
      });

      const consolidationRatio = totalMemories > 0 ? (consolidatedMemories / totalMemories) * 100 : 0;

      const stats = {
        totalMemories,
        potentialDuplicates,
        consolidatedMemories,
        consolidationRatio: Math.round(consolidationRatio * 100) / 100,
        lastConsolidation: lastConsolidation?.extractionTimestamp,
      };

      logInfo(`Retrieved consolidation stats for namespace '${this.namespace}'`, {
        component: 'MemoryConsolidationService',
        namespace: this.namespace,
        ...stats,
      });

      return stats;
    } catch (error) {
      logInfo(`Error retrieving consolidation stats for namespace '${this.namespace}'`, {
        component: 'MemoryConsolidationService',
        namespace: this.namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to retrieve consolidation statistics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Clean up consolidated/duplicate memories
   */
  async cleanupConsolidatedMemories(
    olderThanDays: number = 30,
    dryRun: boolean = false,
  ): Promise<{ cleaned: number; errors: string[]; skipped: number }> {
    const errors: string[] = [];
    let cleaned = 0;
    let skipped = 0;

    try {
      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // Find consolidated memories older than the cutoff date
      const oldConsolidatedMemories = await this.prisma.longTermMemory.findMany({
        where: {
          namespace: this.namespace,
          AND: [
            {
              processedData: {
                path: ['isDuplicate'],
                equals: true,
              } as Record<string, unknown>,
            },
            {
              extractionTimestamp: {
                lt: cutoffDate,
              },
            },
          ],
        },
        select: {
          id: true,
          searchableContent: true,
          summary: true,
          extractionTimestamp: true,
          processedData: true,
        },
      });

      if (oldConsolidatedMemories.length === 0) {
        logInfo(`No consolidated memories found older than ${olderThanDays} days in namespace '${this.namespace}'`, {
          component: 'MemoryConsolidationService',
          namespace: this.namespace,
          olderThanDays,
        });
        return { cleaned: 0, errors: [], skipped: 0 };
      }

      logInfo(`Found ${oldConsolidatedMemories.length} consolidated memories older than ${olderThanDays} days in namespace '${this.namespace}'`, {
        component: 'MemoryConsolidationService',
        namespace: this.namespace,
        olderThanDays,
        memoryCount: oldConsolidatedMemories.length,
      });

      // Process each memory for cleanup
      const cleanupPromises = oldConsolidatedMemories.map(async (memory) => {
        try {
          // Check if memory is still referenced by other active memories
          const referenceCount = await this.prisma.longTermMemory.count({
            where: {
              namespace: this.namespace,
              processedData: {
                path: ['duplicateOf'],
                equals: memory.id,
              } as Record<string, unknown>,
            },
          });

          if (referenceCount > 0) {
            skipped++;
            logInfo(`Skipping cleanup of memory ${memory.id} - still referenced by ${referenceCount} other memories`, {
              component: 'MemoryConsolidationService',
              memoryId: memory.id,
              namespace: this.namespace,
              referenceCount,
            });
            return;
          }

          if (dryRun) {
            cleaned++;
            logInfo(`DRY RUN: Would remove consolidated memory ${memory.id} from ${memory.extractionTimestamp.toISOString()}`, {
              component: 'MemoryConsolidationService',
              memoryId: memory.id,
              namespace: this.namespace,
              ageInDays: olderThanDays,
            });
          } else {
            // Soft delete by updating metadata instead of hard delete
            await this.prisma.longTermMemory.update({
              where: { id: memory.id },
              data: {
                processedData: {
                  ...(memory.processedData as Record<string, unknown> || {}),
                  cleanedUp: true,
                  cleanedUpAt: new Date(),
                  cleanupReason: `Older than ${olderThanDays} days`,
                },
                // Mark as cleaned up by updating searchable content
                searchableContent: `[CLEANED] ${memory.searchableContent}`,
              },
            });

            cleaned++;
            logInfo(`Cleaned up consolidated memory ${memory.id}`, {
              component: 'MemoryConsolidationService',
              memoryId: memory.id,
              namespace: this.namespace,
              ageInDays: olderThanDays,
            });
          }
        } catch (error) {
          const errorMsg = `Failed to cleanup memory ${memory.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logInfo(errorMsg, {
            component: 'MemoryConsolidationService',
            memoryId: memory.id,
            namespace: this.namespace,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.all(cleanupPromises);

      logInfo(`Cleanup completed for namespace '${this.namespace}'`, {
        component: 'MemoryConsolidationService',
        namespace: this.namespace,
        cleaned,
        skipped,
        errors: errors.length,
        olderThanDays,
      });

      return { cleaned, errors, skipped };
    } catch (error) {
      const errorMsg = `Error during cleanup of consolidated memories: ${error instanceof Error ? error.message : String(error)}`;
      logInfo(errorMsg, {
        component: 'MemoryConsolidationService',
        namespace: this.namespace,
        olderThanDays,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(errorMsg);
    }
  }
}