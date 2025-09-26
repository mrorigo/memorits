// src/core/database/DatabaseManager.ts
import { PrismaClient } from '@prisma/client';
import { MemoryImportanceLevel, MemoryClassification, ProcessedLongTermMemory } from '../types/schemas';
import { MemorySearchResult, SearchOptions, DatabaseStats } from '../types/models';
import { logInfo } from '../utils/Logger';

// Type definitions for database operations
export interface ChatHistoryData {
  chatId: string;
  userInput: string;
  aiOutput: string;
  model: string;
  sessionId: string;
  namespace: string;
  metadata?: unknown;
}


export interface ConsciousMemoryData {
  id: string;
  chatId?: string;
  content: string;
  summary: string;
  classification: MemoryClassification;
  importance: MemoryImportanceLevel;
  topic?: string;
  entities: string[];
  keywords: string[];
  confidenceScore: number;
  classificationReason: string;
  processedAt?: Date;
  isConsciousContext?: boolean;
}

export interface ShortTermMemoryData {
  chatId: string;
  processedData: unknown;
  importanceScore: number;
  categoryPrimary: string;
  retentionType: string;
  namespace: string;
  searchableContent: string;
  summary: string;
  isPermanentContext: boolean;
}

export interface DatabaseWhereClause {
  namespace: string;
  OR?: Array<{
    searchableContent?: { contains: string };
    summary?: { contains: string };
    topic?: { contains: string };
  }>;
  importanceScore?: { gte: number };
  classification?: { in: MemoryClassification[] };
  categoryPrimary?: string;
  consciousProcessed?: boolean;
  createdAt?: { gte: Date };
  isPermanentContext?: boolean;
}

export class DatabaseManager {
  private prisma: PrismaClient;

  constructor(databaseUrl: string) {
    this.prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
    });
  }


  async storeChatHistory(data: ChatHistoryData): Promise<string> {
    const result = await this.prisma.chatHistory.create({
      data: {
        id: data.chatId,
        userInput: data.userInput,
        aiOutput: data.aiOutput,
        model: data.model,
        sessionId: data.sessionId,
        namespace: data.namespace,
        metadata: data.metadata as any,
      },
    });
    return result.id;
  }

  async storeLongTermMemory(
    memoryData: ProcessedLongTermMemory,
    chatId: string,
    namespace: string,
  ): Promise<string> {
    const result = await this.prisma.longTermMemory.create({
      data: {
        originalChatId: chatId,
        processedData: memoryData,
        importanceScore: this.calculateImportanceScore(memoryData.importance),
        categoryPrimary: memoryData.classification,
        retentionType: 'long_term',
        namespace,
        searchableContent: memoryData.content,
        summary: memoryData.summary,
        classification: memoryData.classification,
        memoryImportance: memoryData.importance,
        topic: memoryData.topic,
        entitiesJson: memoryData.entities,
        keywordsJson: memoryData.keywords,
        confidenceScore: memoryData.confidenceScore,
        extractionTimestamp: new Date(),
        classificationReason: memoryData.classificationReason,
        consciousProcessed: false, // Default to unprocessed
      },
    });
    return result.id;
  }

  private calculateImportanceScore(level: string): number {
    const scores = {
      [MemoryImportanceLevel.CRITICAL]: 0.9,
      [MemoryImportanceLevel.HIGH]: 0.7,
      [MemoryImportanceLevel.MEDIUM]: 0.5,
      [MemoryImportanceLevel.LOW]: 0.3,
    };
    return scores[level as MemoryImportanceLevel] || 0.5;
  }

  async searchMemories(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
    // Simple SQLite FTS implementation with enhanced filtering
    const whereClause: DatabaseWhereClause = {
      namespace: options.namespace || 'default',
      OR: [
        { searchableContent: { contains: query } },
        { summary: { contains: query } },
        { topic: { contains: query } },
      ],
    };

    // Add importance filtering if specified
    if (options.minImportance) {
      whereClause.importanceScore = {
        gte: this.calculateImportanceScore(options.minImportance),
      };
    }

    // Add category filtering if specified
    if (options.categories && options.categories.length > 0) {
      whereClause.classification = {
        in: options.categories,
      };
    }

    const memories = await this.prisma.longTermMemory.findMany({
      where: whereClause,
      take: options.limit || 5,
      orderBy: { importanceScore: 'desc' },
    });

    // Transform the raw Prisma results to match the MemorySearchResult interface
    return memories.map((memory: any) => ({
      id: memory.id,
      content: memory.searchableContent,
      summary: memory.summary,
      classification: memory.classification as unknown as MemoryClassification,
      importance: memory.memoryImportance as unknown as MemoryImportanceLevel,
      topic: memory.topic || undefined,
      entities: (memory.entitiesJson as string[]) || [],
      keywords: (memory.keywordsJson as string[]) || [],
      confidenceScore: memory.confidenceScore,
      classificationReason: memory.classificationReason || '',
      metadata: options.includeMetadata ? {
        modelUsed: 'unknown',
        category: memory.categoryPrimary,
        originalChatId: memory.originalChatId,
        extractionTimestamp: memory.extractionTimestamp,
      } : undefined,
    }));
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // Conscious Memory Operations

  async getUnprocessedConsciousMemories(namespace: string = 'default'): Promise<ConsciousMemoryData[]> {
    // Get long-term memories with "conscious-info" classification
    // that haven't been processed yet
    const memories = await this.prisma.longTermMemory.findMany({
      where: {
        namespace,
        categoryPrimary: 'conscious-info',
        consciousProcessed: false,
      },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to prevent overwhelming the system
    });

    return memories.map((memory: any) => ({
      id: memory.id,
      content: memory.searchableContent,
      summary: memory.summary,
      classification: memory.classification as unknown as MemoryClassification,
      importance: memory.memoryImportance as unknown as MemoryImportanceLevel,
      topic: memory.topic,
      entities: (memory.entitiesJson as unknown[]) as string[] || [],
      keywords: (memory.keywordsJson as unknown[]) as string[] || [],
      confidenceScore: memory.confidenceScore,
      classificationReason: memory.classificationReason || '',
    }));
  }

  async getNewConsciousMemories(since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000), namespace: string = 'default'): Promise<ConsciousMemoryData[]> {
    // Get conscious memories created since the specified time that haven't been processed
    const memories = await this.prisma.longTermMemory.findMany({
      where: {
        namespace,
        categoryPrimary: 'conscious-info',
        createdAt: {
          gte: since,
        },
        consciousProcessed: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    return memories.map((memory: any) => ({
      id: memory.id,
      content: memory.searchableContent,
      summary: memory.summary,
      classification: memory.classification as unknown as MemoryClassification,
      importance: memory.memoryImportance as unknown as MemoryImportanceLevel,
      topic: memory.topic,
      entities: (memory.entitiesJson as unknown[]) as string[] || [],
      keywords: (memory.keywordsJson as unknown[]) as string[] || [],
      confidenceScore: memory.confidenceScore,
      classificationReason: memory.classificationReason || '',
    }));
  }

  async storeConsciousMemoryInShortTerm(memoryData: ShortTermMemoryData, namespace: string): Promise<string> {
    const result = await this.prisma.shortTermMemory.create({
      data: {
        chatId: memoryData.chatId,
        processedData: memoryData.processedData as any,
        importanceScore: memoryData.importanceScore,
        categoryPrimary: memoryData.categoryPrimary,
        retentionType: memoryData.retentionType,
        namespace,
        searchableContent: memoryData.searchableContent,
        summary: memoryData.summary,
        isPermanentContext: memoryData.isPermanentContext,
      },
    });
    return result.id;
  }

  async getConsciousMemoriesFromShortTerm(namespace: string): Promise<ConsciousMemoryData[]> {
    const memories = await this.prisma.shortTermMemory.findMany({
      where: {
        namespace,
        isPermanentContext: true, // Only get conscious/permanent memories
      },
      orderBy: { createdAt: 'desc' },
    });

    return memories.map((memory: any) => ({
      id: memory.id,
      content: memory.searchableContent,
      summary: memory.summary,
      classification: memory.categoryPrimary as unknown as MemoryClassification,
      importance: this.getImportanceLevel(memory.importanceScore) as unknown as MemoryImportanceLevel,
      topic: (memory.processedData as Record<string, unknown>)?.topic as string,
      entities: (memory.processedData as Record<string, unknown>)?.entities as string[] || [],
      keywords: (memory.processedData as Record<string, unknown>)?.keywords as string[] || [],
      confidenceScore: (memory.processedData as Record<string, unknown>)?.confidenceScore as number || 0.8,
      classificationReason: (memory.processedData as Record<string, unknown>)?.classificationReason as string || '',
    }));
  }

  async markConsciousMemoryAsProcessed(memoryId: string): Promise<void> {
    await this.prisma.longTermMemory.update({
      where: { id: memoryId },
      data: { consciousProcessed: true },
    });
  }

  async markMultipleMemoriesAsProcessed(memoryIds: string[]): Promise<void> {
    await this.prisma.longTermMemory.updateMany({
      where: { id: { in: memoryIds } },
      data: { consciousProcessed: true },
    });
  }

  async getProcessedConsciousMemories(namespace: string = 'default'): Promise<ConsciousMemoryData[]> {
    const memories = await this.prisma.longTermMemory.findMany({
      where: {
        namespace,
        categoryPrimary: 'conscious-info',
        consciousProcessed: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return memories.map((memory: any) => ({
      id: memory.id,
      content: memory.searchableContent,
      summary: memory.summary,
      classification: memory.classification as unknown as MemoryClassification,
      importance: memory.memoryImportance as unknown as MemoryImportanceLevel,
      topic: memory.topic,
      entities: (memory.entitiesJson as unknown[]) as string[] || [],
      keywords: (memory.keywordsJson as unknown[]) as string[] || [],
      confidenceScore: memory.confidenceScore,
      classificationReason: memory.classificationReason || '',
      processedAt: memory.extractionTimestamp,
    }));
  }

  async getConsciousProcessingStats(namespace: string = 'default'): Promise<{
    total: number;
    processed: number;
    unprocessed: number;
  }> {
    const [total, processed, unprocessed] = await Promise.all([
      this.prisma.longTermMemory.count({
        where: { namespace, categoryPrimary: 'conscious-info' },
      }),
      this.prisma.longTermMemory.count({
        where: { namespace, categoryPrimary: 'conscious-info', consciousProcessed: true },
      }),
      this.prisma.longTermMemory.count({
        where: { namespace, categoryPrimary: 'conscious-info', consciousProcessed: false },
      }),
    ]);

    return { total, processed, unprocessed };
  }

  private getImportanceLevel(score: number): string {
    if (score >= 0.8) return 'critical';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  // Duplicate Consolidation Operations

  /**
   * Find potential duplicate memories based on content similarity
   */
  async findPotentialDuplicates(
    content: string,
    namespace: string = 'default',
    threshold: number = 0.7,
  ): Promise<MemorySearchResult[]> {
    // Simple similarity check using text search
    // In a real implementation, you might use vector similarity or more sophisticated algorithms
    const similarMemories = await this.searchMemories(content, {
      namespace,
      limit: 20,
      includeMetadata: true,
    });

    // Filter by similarity threshold (basic implementation)
    return similarMemories.filter(memory => {
      // Simple content overlap check
      const contentWords = new Set(content.toLowerCase().split(/\s+/));
      const memoryWords = new Set(memory.content.toLowerCase().split(/\s+/));
      const intersection = new Set([...contentWords].filter(x => memoryWords.has(x)));
      const union = new Set([...contentWords, ...memoryWords]);
      const similarity = intersection.size / union.size;

      return similarity >= threshold;
    });
  }

  /**
   * Get all memories that are marked as duplicates of others
   */
  async getDuplicateMemories(_namespace: string = 'default'): Promise<MemorySearchResult[]> {
    // Note: This is a placeholder - actual implementation would depend on schema
    // For now, return empty array as we don't have duplicate tracking fields
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
    // Note: This is a placeholder - actual implementation would update duplicate tracking fields
    // For now, just log the action
    logInfo(`Would mark memory ${duplicateId} as duplicate of ${originalId} with reason: ${consolidationReason}`, {
      component: 'DatabaseManager',
      duplicateId,
      originalId,
      consolidationReason,
    });
  }

  /**
   * Consolidate duplicate memories by merging them into the primary memory
   */
  async consolidateDuplicateMemories(
    primaryMemoryId: string,
    duplicateIds: string[],
    _namespace: string = 'default',
  ): Promise<{ consolidated: number; errors: string[] }> {
    const consolidatedCount = 0;
    const errors: string[] = [];

    // Note: This is a placeholder implementation
    // In a real implementation, this would:
    // 1. Merge metadata from duplicates into the primary memory
    // 2. Update any references to point to the primary memory
    // 3. Mark duplicates as consolidated/removed
    // 4. Update search indexes

    logInfo(`Would consolidate ${duplicateIds.length} duplicates into primary memory ${primaryMemoryId}`, {
      component: 'DatabaseManager',
      primaryMemoryId,
      duplicateCount: duplicateIds.length,
    });

    return { consolidated: consolidatedCount, errors };
  }

  /**
   * Get consolidation statistics for a namespace
   */
  async getConsolidationStats(namespace: string = 'default'): Promise<{
    totalMemories: number;
    potentialDuplicates: number;
    consolidatedMemories: number;
  }> {
    // Note: This is a placeholder - actual implementation would query consolidation tracking
    const totalMemories = await this.prisma.longTermMemory.count({
      where: { namespace },
    });

    return {
      totalMemories,
      potentialDuplicates: 0,
      consolidatedMemories: 0,
    };
  }

  /**
   * Clean up consolidated/duplicate memories
   */
  async cleanupConsolidatedMemories(
    olderThanDays: number = 30,
    namespace: string = 'default',
  ): Promise<{ cleaned: number; errors: string[] }> {
    // Note: This is a placeholder implementation
    // In a real implementation, this would remove or archive old consolidated memories
    logInfo(`Would cleanup consolidated memories older than ${olderThanDays} days in namespace ${namespace}`, {
      component: 'DatabaseManager',
      olderThanDays,
      namespace,
    });

    return { cleaned: 0, errors: [] };
  }

  // Database Statistics Operations

  /**
   * Get comprehensive database statistics
   */
  async getDatabaseStats(namespace: string = 'default'): Promise<DatabaseStats> {
    try {
      // Get counts from all tables in parallel for better performance
      const [
        totalConversations,
        totalLongTermMemories,
        totalShortTermMemories,
        totalConsciousMemories,
        lastChatActivity,
        lastLongTermActivity,
        lastShortTermActivity,
      ] = await Promise.all([
        this.prisma.chatHistory.count({
          where: { namespace },
        }),
        this.prisma.longTermMemory.count({
          where: { namespace },
        }),
        this.prisma.shortTermMemory.count({
          where: { namespace },
        }),
        this.prisma.longTermMemory.count({
          where: {
            namespace,
            categoryPrimary: 'conscious-info',
          },
        }),
        this.prisma.chatHistory.findFirst({
          where: { namespace },
          orderBy: { timestamp: 'desc' },
          select: { timestamp: true },
        }),
        this.prisma.longTermMemory.findFirst({
          where: { namespace },
          orderBy: { extractionTimestamp: 'desc' },
          select: { extractionTimestamp: true },
        }),
        this.prisma.shortTermMemory.findFirst({
          where: { namespace },
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      // Calculate total memories
      const totalMemories = totalLongTermMemories + totalShortTermMemories;

      // Find the most recent activity across all tables
      const activityDates = [
        lastChatActivity?.timestamp,
        lastLongTermActivity?.extractionTimestamp,
        lastShortTermActivity?.createdAt,
      ].filter(Boolean);

      const lastActivity = activityDates.length > 0
        ? new Date(Math.max(...activityDates.map(date => date!.getTime())))
        : undefined;

      const stats: DatabaseStats = {
        totalConversations,
        totalMemories,
        shortTermMemories: totalShortTermMemories,
        longTermMemories: totalLongTermMemories,
        consciousMemories: totalConsciousMemories,
        lastActivity,
      };

      logInfo(`Retrieved database stats for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        ...stats,
      });

      return stats;

    } catch (error) {
      logInfo(`Error retrieving database stats for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to retrieve database statistics: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}