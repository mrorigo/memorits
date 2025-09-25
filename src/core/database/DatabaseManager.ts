// src/core/database/DatabaseManager.ts
import { PrismaClient } from '@prisma/client';
import { MemoryImportanceLevel, MemoryClassification, ProcessedLongTermMemory } from '../types/schemas';
import { MemorySearchResult, SearchOptions } from '../types/models';

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
}