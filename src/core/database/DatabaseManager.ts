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
}