// src/core/database/DatabaseManager.ts
import { PrismaClient } from '@prisma/client';
import { MemoryImportanceLevel } from '../types/schemas';

export class DatabaseManager {
  private prisma: PrismaClient;

  constructor(databaseUrl: string) {
    this.prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
    });
  }

  async initializeSchema(): Promise<void> {
    // Schema is auto-created by Prisma on first run
    console.log('Database schema initialized');
  }

  async storeChatHistory(data: {
    chatId: string;
    userInput: string;
    aiOutput: string;
    model: string;
    sessionId: string;
    namespace: string;
    metadata?: any;
  }): Promise<string> {
    const result = await this.prisma.chatHistory.create({
      data: {
        id: data.chatId,
        userInput: data.userInput,
        aiOutput: data.aiOutput,
        model: data.model,
        sessionId: data.sessionId,
        namespace: data.namespace,
        metadata: data.metadata,
      },
    });
    return result.id;
  }

  async storeLongTermMemory(
    memoryData: any,
    chatId: string,
    namespace: string
  ): Promise<string> {
    const result = await this.prisma.longTermMemory.create({
      data: {
        originalChatId: chatId,
        processedData: memoryData,
        importanceScore: this.calculateImportanceScore(memoryData.importance),
        categoryPrimary: memoryData.classification,
        retentionType: "long_term",
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

  async searchMemories(query: string, options: {
    namespace?: string;
    limit?: number;
  }): Promise<any[]> {
    // Simple SQLite FTS implementation
    const memories = await this.prisma.longTermMemory.findMany({
      where: {
        namespace: options.namespace || 'default',
        OR: [
          { searchableContent: { contains: query } },
          { summary: { contains: query } },
          { topic: { contains: query } },
        ],
      },
      take: options.limit || 5,
      orderBy: { importanceScore: 'desc' },
    });
    return memories;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  // Conscious Memory Operations

  async getUnprocessedConsciousMemories(namespace: string = 'default'): Promise<any[]> {
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
      classification: memory.classification,
      importance: memory.memoryImportance,
      topic: memory.topic,
      entities: memory.entitiesJson as string[] || [],
      keywords: memory.keywordsJson as string[] || [],
      confidenceScore: memory.confidenceScore,
      classificationReason: memory.classificationReason || '',
    }));
  }

  async getNewConsciousMemories(since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000), namespace: string = 'default'): Promise<any[]> {
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
      classification: memory.classification,
      importance: memory.memoryImportance,
      topic: memory.topic,
      entities: memory.entitiesJson as string[] || [],
      keywords: memory.keywordsJson as string[] || [],
      confidenceScore: memory.confidenceScore,
      classificationReason: memory.classificationReason || '',
    }));
  }

  async storeConsciousMemoryInShortTerm(memoryData: any, namespace: string): Promise<string> {
    const result = await this.prisma.shortTermMemory.create({
      data: {
        chatId: memoryData.chatId || memoryData.id,
        processedData: memoryData,
        importanceScore: this.calculateImportanceScore(memoryData.importance),
        categoryPrimary: memoryData.classification,
        retentionType: 'short_term',
        namespace,
        searchableContent: memoryData.content,
        summary: memoryData.summary,
        isPermanentContext: true, // Conscious memories are permanent context
      },
    });
    return result.id;
  }

  async getConsciousMemoriesFromShortTerm(namespace: string): Promise<any[]> {
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
      classification: memory.categoryPrimary,
      importance: this.getImportanceLevel(memory.importanceScore),
      topic: (memory.processedData as any)?.topic,
      entities: (memory.processedData as any)?.entities || [],
      keywords: (memory.processedData as any)?.keywords || [],
      confidenceScore: (memory.processedData as any)?.confidenceScore || 0.8,
      classificationReason: (memory.processedData as any)?.classificationReason || '',
    }));
  }

  async markConsciousMemoryAsProcessed(memoryId: string): Promise<void> {
    await this.prisma.longTermMemory.update({
      where: { id: memoryId },
      data: { consciousProcessed: true }
    });
  }

  async markMultipleMemoriesAsProcessed(memoryIds: string[]): Promise<void> {
    await this.prisma.longTermMemory.updateMany({
      where: { id: { in: memoryIds } },
      data: { consciousProcessed: true }
    });
  }

  async getProcessedConsciousMemories(namespace: string = 'default'): Promise<any[]> {
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
      classification: memory.classification,
      importance: memory.memoryImportance,
      topic: memory.topic,
      entities: memory.entitiesJson as string[] || [],
      keywords: memory.keywordsJson as string[] || [],
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
        where: { namespace, categoryPrimary: 'conscious-info' }
      }),
      this.prisma.longTermMemory.count({
        where: { namespace, categoryPrimary: 'conscious-info', consciousProcessed: true }
      }),
      this.prisma.longTermMemory.count({
        where: { namespace, categoryPrimary: 'conscious-info', consciousProcessed: false }
      })
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