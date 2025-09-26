import { PrismaClient } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { MemoryImportanceLevel, MemoryClassification, ProcessedLongTermMemory } from '../types/schemas';
import { MemorySearchResult, SearchOptions, DatabaseStats } from '../types/models';
import { logInfo, logError } from '../utils/Logger';
import { initializeSearchSchema, verifyFTSSchema } from './init-search-schema';
import { SearchService } from '../search/SearchService';
import { SearchQuery } from '../search/types';

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
  private ftsEnabled: boolean = false;
  private searchService?: SearchService;

  constructor(databaseUrl: string) {
    // Configure Prisma to use system SQLite with FTS5 support
    this.prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
      // Note: FTS5 is available in system SQLite, will be verified at runtime
    });
    this.initializeFTSSupport();
  }

  getPrismaClient(): PrismaClient {
    return this.prisma;
  }

  /**
   * Initialize or get the SearchService instance
   */
  public getSearchService(): SearchService {
    if (!this.searchService) {
      this.searchService = new SearchService(this);
    }
    return this.searchService;
  }

  private async initializeFTSSupport(): Promise<void> {
    try {
      await initializeSearchSchema(this.prisma);
      this.ftsEnabled = true;
      logInfo('FTS5 search support initialized successfully', { component: 'DatabaseManager' });
    } catch (error) {
      logError('Failed to initialize FTS5 search support, falling back to basic search', {
        component: 'DatabaseManager',
        error: error instanceof Error ? error.message : String(error),
      });
      this.ftsEnabled = false;
    }
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
    try {
      // Use the new SearchService for enhanced search capabilities
      const searchService = this.getSearchService();

      // Convert SearchOptions to SearchQuery
      const searchQuery: SearchQuery = {
        text: query,
        limit: options.limit,
        offset: 0, // Not directly supported in SearchOptions, default to 0
        includeMetadata: options.includeMetadata,
      };

      // Execute search using the new SearchService
      const searchResults = await searchService.search(searchQuery);

      // Transform SearchResult[] to MemorySearchResult[]
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
      logError('Enhanced search failed, falling back to legacy search', {
        component: 'DatabaseManager',
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback to legacy search methods
      return this.searchMemoriesLegacy(query, options);
    }
  }

  /**
   * Legacy search method for fallback
   */
  private async searchMemoriesLegacy(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
    // Use FTS5 search if available and query is not empty, otherwise fall back to basic search
    if (this.ftsEnabled && query && query.trim()) {
      try {
        return await this.searchMemoriesFTS(query, options);
      } catch (error) {
        logError('FTS5 search failed, falling back to basic search', {
          component: 'DatabaseManager',
          error: error instanceof Error ? error.message : String(error),
        });
        return this.searchMemoriesBasic(query, options);
      }
    } else {
      return this.searchMemoriesBasic(query, options);
    }
  }

  /**
   * Advanced FTS5 search with BM25 ranking
   */
  private async searchMemoriesFTS(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
    try {
      const limit = options.limit || 10;
      const namespace = options.namespace || 'default';

      // Build FTS query with proper escaping and phrase handling
      const ftsQuery = this.buildFTSQuery(query);

      // Build metadata filters
      const metadataFilters: string[] = [`namespace = '${namespace}'`];

      if (options.minImportance) {
        const minScore = this.calculateImportanceScore(options.minImportance);
        metadataFilters.push(`json_extract(metadata, '$.importance_score') >= ${minScore}`);
      }

      if (options.categories && options.categories.length > 0) {
        const categories = options.categories.map(cat => `'${cat}'`).join(',');
        metadataFilters.push(`json_extract(metadata, '$.category_primary') IN (${categories})`);
      }

      const whereClause = metadataFilters.length > 0 ? `WHERE ${metadataFilters.join(' AND ')}` : '';

      const rawResults = await this.prisma.$queryRaw`
        SELECT
          fts.rowid as memory_id,
          fts.content as searchable_content,
          fts.metadata,
          bm25(memory_fts, 1.0, 1.0, 1.0) as search_score,
          'fts5' as search_strategy
        FROM memory_fts fts
        ${whereClause}
          AND memory_fts MATCH ${ftsQuery}
        ORDER BY bm25(memory_fts, 1.0, 1.0, 1.0) DESC
        LIMIT ${limit}
      `;

      // Transform results to MemorySearchResult format
      const results: MemorySearchResult[] = [];

      for (const row of rawResults as any[]) {
        const metadata = JSON.parse(row.metadata);

        // Get the actual memory data from the main tables
        const memoryData = await this.getMemoryDataById(row.memory_id, metadata.memory_type);
        if (memoryData) {
          results.push({
            id: row.memory_id,
            content: row.searchable_content,
            summary: memoryData.summary,
            classification: metadata.classification as MemoryClassification,
            importance: metadata.memory_importance as MemoryImportanceLevel,
            topic: memoryData.topic,
            entities: memoryData.entities,
            keywords: memoryData.keywords,
            confidenceScore: metadata.confidence_score || 0.5,
            classificationReason: memoryData.classification_reason || '',
            metadata: options.includeMetadata ? {
              searchScore: row.search_score,
              searchStrategy: row.search_strategy,
              memoryType: metadata.memory_type,
              category: metadata.category_primary,
              importanceScore: metadata.importance_score,
            } : undefined,
          });
        }
      }

      return results;

    } catch (error) {
      logError('FTS5 search failed', {
        component: 'DatabaseManager',
        query,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Basic search implementation (fallback)
   */
  private async searchMemoriesBasic(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
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

  /**
   * Build FTS5 query with proper escaping and phrase handling
   */
  private buildFTSQuery(query: string): string {
    // Clean and escape the query for FTS5
    const cleanQuery = query.replace(/"/g, '""').replace(/\*/g, '').trim();

    if (!cleanQuery) {
      return '*'; // Match all if empty query
    }

    const terms = cleanQuery.split(/\s+/);

    // Use phrase search for exact matches, OR for multiple terms
    if (terms.length === 1) {
      return `"${cleanQuery}"`;
    } else {
      return terms.map(term => `"${term}"`).join(' OR ');
    }
  }

  /**
   * Get memory data by ID and type
   */
  private async getMemoryDataById(memoryId: string, memoryType: string): Promise<any> {
    if (memoryType === 'long_term') {
      return await this.prisma.longTermMemory.findUnique({
        where: { id: memoryId },
        select: {
          summary: true,
          topic: true,
          entitiesJson: true,
          keywordsJson: true,
          classificationReason: true,
        },
      });
    } else if (memoryType === 'short_term') {
      return await this.prisma.shortTermMemory.findUnique({
        where: { id: memoryId },
        select: {
          summary: true,
          processedData: true,
        },
      });
    }
    return null;
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }

  /**
   * Check if FTS5 search is enabled
   */
  isFTSEnabled(): boolean {
    return this.ftsEnabled;
  }

  /**
   * Get FTS schema verification status
   */
  async getFTSStatus(): Promise<{
    enabled: boolean;
    isValid: boolean;
    issues: string[];
    stats: { tables: number; triggers: number; indexes: number };
  }> {
    try {
      const verification = await verifyFTSSchema(this.prisma);
      return {
        enabled: this.ftsEnabled,
        isValid: verification.isValid,
        issues: verification.issues,
        stats: verification.stats,
      };
    } catch (error) {
      return {
        enabled: false,
        isValid: false,
        issues: [`FTS verification failed: ${error instanceof Error ? error.message : String(error)}`],
        stats: { tables: 0, triggers: 0, indexes: 0 },
      };
    }
  }

  /**
   * Enhanced error handling for FTS operations
   */
  private handleFTSError(operation: string, error: unknown, context?: Record<string, unknown>): Error {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const enhancedError = new Error(`FTS operation '${operation}' failed: ${errorMessage}`);

    logError('FTS operation failed', {
      component: 'DatabaseManager',
      operation,
      error: errorMessage,
      context: context || {},
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Provide specific guidance based on error type
    if (errorMessage.includes('no such table: memory_fts')) {
      enhancedError.message += ' - FTS5 table not found. Run database migration to initialize FTS schema.';
    } else if (errorMessage.includes('no such function: bm25')) {
      enhancedError.message += ' - BM25 function not available. Ensure SQLite is compiled with FTS5 support.';
    } else if (errorMessage.includes('disk I/O error') || errorMessage.includes('database or disk is full')) {
      enhancedError.message += ' - Database storage error. Check available disk space.';
    }

    return enhancedError;
  }

  /**
   * Safely execute FTS query with comprehensive error handling
   */
  private async safeFTSQuery<T>(
    operation: string,
    queryFn: () => Promise<T>,
    context?: Record<string, unknown>,
  ): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      throw this.handleFTSError(operation, error, context);
    }
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
    return similarMemories.filter((memory) => {
      // Simple content overlap check
      const contentWords = new Set(content.toLowerCase().split(/\s+/));
      const memoryWords = new Set(memory.content.toLowerCase().split(/\s+/));
      const intersection = new Set([...Array.from(contentWords)].filter((x) => memoryWords.has(x)));
      const union = new Set([...Array.from(contentWords), ...Array.from(memoryWords)]);
      const similarity = intersection.size / union.size;

      return similarity >= threshold;
    });
  }

  /**
   * Get all memories that are marked as duplicates of others
   */
  async getDuplicateMemories(namespace: string = 'default'): Promise<MemorySearchResult[]> {
    try {
      // Look for memories that have duplicate tracking information in metadata
      // Since we don't have dedicated duplicate tracking fields, we search for
      // memories that reference other memories as duplicates
      const memories = await this.prisma.longTermMemory.findMany({
        where: {
          namespace,
          // Look for memories that have metadata indicating they're duplicates
          processedData: {
            path: ['isDuplicate'],
            equals: true,
          } as any,
        },
        orderBy: { createdAt: 'desc' },
      });

      // Also search for memories with duplicate tracking in searchableContent
      const duplicateContentMemories = await this.prisma.longTermMemory.findMany({
        where: {
          namespace,
          searchableContent: {
            contains: 'DUPLICATE_OF:',
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Combine and deduplicate results
      const allMemories = [...memories, ...duplicateContentMemories];
      const uniqueMemories = allMemories.filter((memory, index, self) =>
        index === self.findIndex((m) => m.id === memory.id),
      );

      const result: MemorySearchResult[] = uniqueMemories.map((memory: any) => ({
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
        metadata: {
          modelUsed: 'unknown',
          category: memory.categoryPrimary,
          originalChatId: memory.originalChatId,
          extractionTimestamp: memory.extractionTimestamp,
          isDuplicate: (memory.processedData as any)?.isDuplicate || false,
          duplicateOf: (memory.processedData as any)?.duplicateOf || undefined,
        },
      }));

      logInfo(`Retrieved ${result.length} duplicate memories for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        duplicateCount: result.length,
      });

      return result;
    } catch (error) {
      logInfo(`Error retrieving duplicate memories for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to retrieve duplicate memories: ${error instanceof Error ? error.message : String(error)}`);
    }
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
          } as any,
        },
      });

      logInfo(`Marked memory ${duplicateId} as duplicate of ${originalId}`, {
        component: 'DatabaseManager',
        duplicateId,
        originalId,
        consolidationReason,
      });
    } catch (error) {
      logInfo(`Error marking memory ${duplicateId} as duplicate of ${originalId}`, {
        component: 'DatabaseManager',
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
    namespace: string = 'default',
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
              namespace,
            },
          });

          if (!existingMemory) {
            errors.push(`Memory ${update.memoryId} not found in namespace ${namespace}`);
            return;
          }

          // Update the memory with new duplicate tracking information
          await this.prisma.longTermMemory.update({
            where: { id: update.memoryId },
            data: {
              processedData: {
                ...(existingMemory.processedData as any),
                ...update,
                updatedAt: new Date(),
              } as any,
            },
          });

          updated++;
        } catch (error) {
          const errorMsg = `Failed to update duplicate tracking for memory ${update.memoryId}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logInfo(errorMsg, {
            component: 'DatabaseManager',
            memoryId: update.memoryId,
            namespace,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.all(updatePromises);

      logInfo(`Updated duplicate tracking for ${updated} memories in namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        updated,
        errors: errors.length,
      });

      return { updated, errors };
    } catch (error) {
      const errorMsg = `Error updating duplicate tracking: ${error instanceof Error ? error.message : String(error)}`;
      logInfo(errorMsg, {
        component: 'DatabaseManager',
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(errorMsg);
    }
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
    consolidationRatio: number;
    lastConsolidation?: Date;
  }> {
    try {
      // Get total memories count
      const totalMemories = await this.prisma.longTermMemory.count({
        where: { namespace },
      });

      // Get consolidated memories (those marked as duplicates that have been processed)
      const consolidatedMemories = await this.prisma.longTermMemory.count({
        where: {
          namespace,
          processedData: {
            path: ['isDuplicate'],
            equals: true,
          } as any,
        },
      });

      // Get potential duplicates (memories with similar content)
      const allMemories = await this.prisma.longTermMemory.findMany({
        where: { namespace },
        select: { id: true, searchableContent: true, summary: true },
        take: 1000, // Limit for performance
      });

      // Calculate potential duplicates using similarity analysis
      let potentialDuplicates = 0;
      const processedIds = new Set<string>();

      for (const memory of allMemories) {
        if (processedIds.has(memory.id)) continue;

        const similarMemories = allMemories.filter(otherMemory => {
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
          similarMemories.forEach(mem => processedIds.add(mem.id));
        }
      }

      // Get last consolidation activity
      const lastConsolidation = await this.prisma.longTermMemory.findFirst({
        where: {
          namespace,
          processedData: {
            path: ['consolidationReason'],
            not: null,
          } as any,
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

      logInfo(`Retrieved consolidation stats for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        ...stats,
      });

      return stats;
    } catch (error) {
      logInfo(`Error retrieving consolidation stats for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
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
    namespace: string = 'default',
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
          namespace,
          AND: [
            {
              processedData: {
                path: ['isDuplicate'],
                equals: true,
              } as any,
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
        logInfo(`No consolidated memories found older than ${olderThanDays} days in namespace '${namespace}'`, {
          component: 'DatabaseManager',
          namespace,
          olderThanDays,
        });
        return { cleaned: 0, errors: [], skipped: 0 };
      }

      logInfo(`Found ${oldConsolidatedMemories.length} consolidated memories older than ${olderThanDays} days in namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        olderThanDays,
        memoryCount: oldConsolidatedMemories.length,
      });

      // Process each memory for cleanup
      const cleanupPromises = oldConsolidatedMemories.map(async (memory) => {
        try {
          // Check if memory is still referenced by other active memories
          const referenceCount = await this.prisma.longTermMemory.count({
            where: {
              namespace,
              processedData: {
                path: ['duplicateOf'],
                equals: memory.id,
              } as any,
            },
          });

          if (referenceCount > 0) {
            skipped++;
            logInfo(`Skipping cleanup of memory ${memory.id} - still referenced by ${referenceCount} other memories`, {
              component: 'DatabaseManager',
              memoryId: memory.id,
              namespace,
              referenceCount,
            });
            return;
          }

          if (dryRun) {
            cleaned++;
            logInfo(`DRY RUN: Would remove consolidated memory ${memory.id} from ${memory.extractionTimestamp.toISOString()}`, {
              component: 'DatabaseManager',
              memoryId: memory.id,
              namespace,
              ageInDays: olderThanDays,
            });
          } else {
            // Soft delete by updating metadata instead of hard delete
            await this.prisma.longTermMemory.update({
              where: { id: memory.id },
              data: {
                processedData: {
                  ...(memory.processedData as any),
                  cleanedUp: true,
                  cleanedUpAt: new Date(),
                  cleanupReason: `Older than ${olderThanDays} days`,
                } as any,
                // Mark as cleaned up by updating searchable content
                searchableContent: `[CLEANED] ${memory.searchableContent}`,
              },
            });

            cleaned++;
            logInfo(`Cleaned up consolidated memory ${memory.id}`, {
              component: 'DatabaseManager',
              memoryId: memory.id,
              namespace,
              ageInDays: olderThanDays,
            });
          }
        } catch (error) {
          const errorMsg = `Failed to cleanup memory ${memory.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logInfo(errorMsg, {
            component: 'DatabaseManager',
            memoryId: memory.id,
            namespace,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.all(cleanupPromises);

      logInfo(`Cleanup completed for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        cleaned,
        skipped,
        errors: errors.length,
        olderThanDays,
      });

      return { cleaned, errors, skipped };
    } catch (error) {
      const errorMsg = `Error during cleanup of consolidated memories: ${error instanceof Error ? error.message : String(error)}`;
      logInfo(errorMsg, {
        component: 'DatabaseManager',
        namespace,
        olderThanDays,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(errorMsg);
    }
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