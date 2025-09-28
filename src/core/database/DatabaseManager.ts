import { PrismaClient } from '@prisma/client';
import { MemoryImportanceLevel, MemoryClassification, ProcessedLongTermMemory } from '../types/schemas';
import { MemorySearchResult, SearchOptions, DatabaseStats } from '../types/models';
import { PerformanceMetrics } from '../types/base';
import { logInfo, logError } from '../utils/Logger';
import { initializeSearchSchema, verifyFTSSchema } from './init-search-schema';
import { SearchService } from '../search/SearchService';
import { SearchIndexManager } from '../search/SearchIndexManager';
import { SearchQuery } from '../search/types';
import {
  ProcessingStateManager,
  MemoryProcessingState,
} from '../memory/MemoryProcessingStateManager';
import { MemoryRelationship, MemoryRelationshipType } from '../types/schemas';
import { createHash } from 'crypto';

// ===== DATABASE PERFORMANCE MONITORING INTERFACES =====

/**
 * Database operation performance data
 * Extends the unified performance metrics structure with database-specific fields
 */
interface DatabaseOperationMetrics {
  operationType: string;
  tableName?: string;
  recordCount?: number;
  startTime: number;
  endTime?: number;
  duration?: number;
  success: boolean;
  error?: string;
  querySize?: number;
  indexUsed?: boolean;
}

/**
 * Database performance monitoring configuration
 */
interface DatabasePerformanceConfig {
  enabled: boolean;
  slowQueryThreshold: number; // milliseconds
  trackSlowQueries: boolean;
  maxSlowQueryHistory: number;
  enableQueryAnalysis: boolean;
  collectionInterval: number; // milliseconds
}

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

// Relationship Query Interface
export interface RelationshipQuery {
  sourceMemoryId?: string;
  targetMemoryId?: string;
  relationshipType?: MemoryRelationshipType;
  minConfidence?: number;
  minStrength?: number;
  namespace?: string;
  limit?: number;
}

// Relationship Statistics Interface
export interface RelationshipStatistics {
  totalRelationships: number;
  relationshipsByType: Record<MemoryRelationshipType, number>;
  averageConfidence: number;
  averageStrength: number;
  topEntities: Array<{ entity: string; count: number }>;
  recentRelationships: number; // Last 30 days
}

export class DatabaseManager {
  private prisma: PrismaClient;
  private ftsEnabled: boolean = false;
  private initializationInProgress: boolean = false;
  private searchService?: SearchService;
  private searchIndexManager?: SearchIndexManager;
  private stateManager: ProcessingStateManager;

  // Database performance monitoring
  private performanceMetrics: PerformanceMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    averageOperationTime: 0,
    lastOperationTime: new Date(),
    errorRate: 0,
    memoryUsage: 0,
    peakMemoryUsage: 0,
    operationBreakdown: new Map<string, number>(),
    errorBreakdown: new Map<string, number>(),
    trends: [],
    metadata: {
      component: 'DatabaseManager',
      databaseType: 'sqlite',
      connectionCount: 0,
      queryLatency: 0,
      slowQueries: [],
    },
  };

  private operationMetrics: DatabaseOperationMetrics[] = [];
  private maxOperationHistory = 1000;

  private performanceConfig: DatabasePerformanceConfig = {
    enabled: true,
    slowQueryThreshold: 1000, // 1 second
    trackSlowQueries: true,
    maxSlowQueryHistory: 100,
    enableQueryAnalysis: true,
    collectionInterval: 60000, // 1 minute
  };

  constructor(databaseUrl: string) {
    // Configure Prisma to use system SQLite with FTS5 support
    this.prisma = new PrismaClient({
      datasourceUrl: databaseUrl,
      // Note: FTS5 is available in system SQLite, will be verified at runtime
    });
    // Initialize state manager for memory processing state tracking
    this.stateManager = new ProcessingStateManager({
      enableHistoryTracking: true,
      enableMetrics: true,
      maxHistoryEntries: 100,
    });
    // Don't initialize FTS support in constructor to avoid schema conflicts
    // It will be initialized lazily when first needed
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

   /**
    * Initialize or get the SearchIndexManager instance
    */
   public getSearchIndexManager(): SearchIndexManager {
     if (!this.searchIndexManager) {
       this.searchIndexManager = new SearchIndexManager(this);
     }
     return this.searchIndexManager;
   }

  private async ensureFTSSupport(): Promise<void> {
    if (this.ftsEnabled || this.initializationInProgress) {
      return;
    }

    this.initializationInProgress = true;
    try {
      // Initialize the FTS5 schema (creates virtual table)
      const schemaInitialized = await initializeSearchSchema(this.prisma);

      if (!schemaInitialized) {
        throw new Error('Failed to initialize FTS5 schema');
      }

      // Now create the triggers after the main tables exist
      await this.createFTSTriggers();

      // Verify the FTS table and triggers were created successfully
      const verification = await verifyFTSSchema(this.prisma);
      if (!verification.isValid) {
        throw new Error(`FTS5 verification failed: ${verification.issues.join(', ')}`);
      }

      this.ftsEnabled = true;
      logInfo('FTS5 search support initialized successfully', {
        component: 'DatabaseManager',
        tables: verification.stats.tables,
        triggers: verification.stats.triggers,
        indexes: verification.stats.indexes,
      });
    } catch (error) {
      logError('Failed to initialize FTS5 search support, falling back to basic search', {
        component: 'DatabaseManager',
        error: error instanceof Error ? error.message : String(error),
      });
      this.ftsEnabled = false;
    } finally {
      this.initializationInProgress = false;
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

    // Initialize state tracking for the new memory
    try {
      await this.stateManager.initializeMemoryState(
        result.id,
        MemoryProcessingState.PROCESSED,
      );

      // Track the creation in state history
      await this.stateManager.transitionToState(
        result.id,
        MemoryProcessingState.PROCESSED,
        {
          reason: 'Memory created and stored in long-term storage',
          agentId: 'DatabaseManager',
          metadata: {
            chatId,
            namespace,
            classification: memoryData.classification,
            importance: memoryData.importance,
          },
        },
      );
    } catch (error) {
      logError('Failed to initialize state tracking for new memory', {
        component: 'DatabaseManager',
        memoryId: result.id,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't throw here - state tracking failure shouldn't prevent memory storage
    }

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
    const startTime = Date.now();
    const operationType = query.trim() ? 'search_with_query' : 'search_empty';

    const metrics: DatabaseOperationMetrics = {
      operationType,
      startTime,
      success: false,
      querySize: query.length,
    };

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
      const results = searchResults.map(result => ({
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

      metrics.success = true;
      metrics.recordCount = results.length;
      this.recordOperationMetrics(metrics);

      return results;
    } catch (error) {
      metrics.success = false;
      metrics.error = error instanceof Error ? error.message : String(error);

      logError('Enhanced search failed, falling back to legacy search', {
        component: 'DatabaseManager',
        error: error instanceof Error ? error.message : String(error),
      });

      this.recordOperationMetrics(metrics);

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
      // Ensure FTS support is initialized before using it
      await this.ensureFTSSupport();
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
    // Cleanup search index manager
    if (this.searchIndexManager) {
      this.searchIndexManager.cleanup();
    }

    await this.prisma.$disconnect();
  }

  // Memory Relationship Operations

  /**
   * Store memory relationships for a given memory
   * Updates the relatedMemoriesJson and supersedesJson fields with extracted relationships
   */
  async storeMemoryRelationships(
    memoryId: string,
    relationships: MemoryRelationship[],
    namespace: string = 'default',
  ): Promise<{ stored: number; errors: string[] }> {
    const errors: string[] = [];
    let stored = 0;

    try {
      logInfo(`Storing ${relationships.length} relationships for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        relationshipCount: relationships.length,
        namespace,
      });

      // Separate relationships by type for storage
      const generalRelationships = relationships.filter(r => r.type !== MemoryRelationshipType.SUPERSEDES);
      const supersedingRelationships = relationships.filter(r => r.type === MemoryRelationshipType.SUPERSEDES);

      // Store general relationships
      if (generalRelationships.length > 0) {
        try {
          // Get existing relationships to merge with new ones
          const existingMemory = await this.prisma.longTermMemory.findUnique({
            where: { id: memoryId },
            select: { relatedMemoriesJson: true, processedData: true },
          });

          const existingRelationships = existingMemory?.relatedMemoriesJson ?
            (existingMemory.relatedMemoriesJson as MemoryRelationship[]) : [];

          // Merge relationships, avoiding duplicates
          const mergedRelationships = this.mergeRelationships(existingRelationships, generalRelationships);

          await this.prisma.longTermMemory.update({
            where: { id: memoryId },
            data: {
              relatedMemoriesJson: mergedRelationships as any,
              processedData: {
                ...(existingMemory?.processedData as any),
                relationshipCount: mergedRelationships.length,
                lastRelationshipUpdate: new Date(),
              } as any,
            },
          });

          stored += generalRelationships.length;
          logInfo(`Stored ${generalRelationships.length} general relationships for memory ${memoryId}`, {
            component: 'DatabaseManager',
            memoryId,
            relationshipCount: generalRelationships.length,
          });
        } catch (error) {
          const errorMsg = `Failed to store general relationships: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logError(errorMsg, {
            component: 'DatabaseManager',
            memoryId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Store superseding relationships separately
      if (supersedingRelationships.length > 0) {
        try {
          // Get existing superseding relationships to merge
          const existingMemory = await this.prisma.longTermMemory.findUnique({
            where: { id: memoryId },
            select: { supersedesJson: true, processedData: true },
          });

          const existingSuperseding = existingMemory?.supersedesJson ?
            (existingMemory.supersedesJson as MemoryRelationship[]) : [];

          // Merge superseding relationships
          const mergedSuperseding = this.mergeRelationships(existingSuperseding, supersedingRelationships);

          await this.prisma.longTermMemory.update({
            where: { id: memoryId },
            data: {
              supersedesJson: mergedSuperseding as any,
              processedData: {
                ...(existingMemory?.processedData as any),
                supersedingCount: mergedSuperseding.length,
                lastSupersedingUpdate: new Date(),
              } as any,
            },
          });

          stored += supersedingRelationships.length;
          logInfo(`Stored ${supersedingRelationships.length} superseding relationships for memory ${memoryId}`, {
            component: 'DatabaseManager',
            memoryId,
            supersedingCount: supersedingRelationships.length,
          });
        } catch (error) {
          const errorMsg = `Failed to store superseding relationships: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logError(errorMsg, {
            component: 'DatabaseManager',
            memoryId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Update state tracking for relationship processing
      try {
        await this.stateManager.transitionToState(
          memoryId,
          MemoryProcessingState.PROCESSED,
          {
            reason: 'Memory relationships stored successfully',
            agentId: 'DatabaseManager',
            metadata: {
              relationshipsStored: stored,
              errors: errors.length,
            },
          },
        );
      } catch (stateError) {
        logError('Failed to update state tracking for relationship storage', {
          component: 'DatabaseManager',
          memoryId,
          error: stateError instanceof Error ? stateError.message : String(stateError),
        });
      }

      logInfo(`Successfully stored relationships for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        totalStored: stored,
        errors: errors.length,
      });

      return { stored, errors };
    } catch (error) {
      const errorMsg = `Failed to store relationships for memory ${memoryId}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      logError(errorMsg, {
        component: 'DatabaseManager',
        memoryId,
        relationshipCount: relationships.length,
        namespace,
        error: error instanceof Error ? error.stack : String(error),
      });
      return { stored, errors };
    }
  }

  /**
   * Query memories by relationship type
   * Returns memories that have relationships of the specified type
   */
  async getMemoriesByRelationship(
    query: RelationshipQuery,
  ): Promise<Array<{
    memory: any;
    relationships: MemoryRelationship[];
    matchReason: string;
  }>> {
    try {
      const namespace = query.namespace || 'default';
      const limit = query.limit || 50;

      logInfo('Querying memories by relationship', {
        component: 'DatabaseManager',
        relationshipType: query.relationshipType,
        namespace,
        limit,
        filters: {
          sourceMemoryId: query.sourceMemoryId,
          targetMemoryId: query.targetMemoryId,
          minConfidence: query.minConfidence,
          minStrength: query.minStrength,
        },
      });

      // Get memories that have relationships based on query criteria
      const whereClause: any = { namespace };

      const memories = await this.prisma.longTermMemory.findMany({
        where: whereClause,
        take: limit * 2, // Get more to account for filtering
        orderBy: { createdAt: 'desc' },
      });

      const results: Array<{
        memory: any;
        relationships: MemoryRelationship[];
        matchReason: string;
      }> = [];

      for (const memory of memories) {
        const allRelationships: MemoryRelationship[] = [];

        // Get relationships from relatedMemoriesJson
        if (memory.relatedMemoriesJson) {
          const relatedMemories = memory.relatedMemoriesJson as MemoryRelationship[];
          allRelationships.push(...relatedMemories);
        }

        // Get relationships from supersedesJson
        if (memory.supersedesJson) {
          const supersedingMemories = memory.supersedesJson as MemoryRelationship[];
          allRelationships.push(...supersedingMemories);
        }

        // Filter relationships based on query criteria
        const filteredRelationships = allRelationships.filter(relationship => {
          // Filter by relationship type if specified
          if (query.relationshipType && relationship.type !== query.relationshipType) {
            return false;
          }

          // Filter by source memory ID if specified
          if (query.sourceMemoryId && relationship.targetMemoryId !== query.sourceMemoryId) {
            return false;
          }

          // Filter by target memory ID if specified
          if (query.targetMemoryId && relationship.targetMemoryId !== query.targetMemoryId) {
            return false;
          }

          // Filter by minimum confidence if specified
          if (query.minConfidence && relationship.confidence < query.minConfidence) {
            return false;
          }

          // Filter by minimum strength if specified
          if (query.minStrength && relationship.strength < query.minStrength) {
            return false;
          }

          return true;
        });

        if (filteredRelationships.length > 0) {
          results.push({
            memory,
            relationships: filteredRelationships,
            matchReason: `Found ${filteredRelationships.length} matching relationship(s)`,
          });

          // Limit results
          if (results.length >= limit) {
            break;
          }
        }
      }

      logInfo(`Retrieved ${results.length} memories with matching relationships`, {
        component: 'DatabaseManager',
        query: {
          relationshipType: query.relationshipType,
          namespace,
          minConfidence: query.minConfidence,
          minStrength: query.minStrength,
        },
        resultCount: results.length,
      });

      return results;
    } catch (error) {
      const errorMsg = `Failed to query memories by relationship: ${error instanceof Error ? error.message : String(error)}`;
      logError(errorMsg, {
        component: 'DatabaseManager',
        query,
        error: error instanceof Error ? error.stack : String(error),
      });
      throw new Error(errorMsg);
    }
  }

  /**
   * Get memories related to a specific memory through relationships
   */
  async getRelatedMemories(
    memoryId: string,
    options: {
      relationshipType?: MemoryRelationshipType;
      minConfidence?: number;
      minStrength?: number;
      namespace?: string;
      limit?: number;
    } = {},
  ): Promise<Array<{
    memory: any;
    relationship: MemoryRelationship;
    direction: 'incoming' | 'outgoing';
  }>> {
    try {
      const namespace = options.namespace || 'default';
      const limit = options.limit || 20;

      logInfo(`Getting related memories for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        namespace,
        relationshipType: options.relationshipType,
        minConfidence: options.minConfidence,
        minStrength: options.minStrength,
        limit,
      });

      // First, get the source memory to understand its relationships
      const sourceMemory = await this.prisma.longTermMemory.findUnique({
        where: { id: memoryId },
        select: {
          id: true,
          relatedMemoriesJson: true,
          supersedesJson: true,
          namespace: true,
        },
      });

      if (!sourceMemory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      if (sourceMemory.namespace !== namespace) {
        logInfo(`Memory ${memoryId} is not in namespace ${namespace}`, {
          component: 'DatabaseManager',
          memoryId,
          memoryNamespace: sourceMemory.namespace,
          requestedNamespace: namespace,
        });
        return [];
      }

      const results: Array<{
        memory: any;
        relationship: MemoryRelationship;
        direction: 'incoming' | 'outgoing';
      }> = [];

      // Get outgoing relationships (memories this memory references)
      const outgoingRelationships: MemoryRelationship[] = [];

      if (sourceMemory.relatedMemoriesJson) {
        const related = sourceMemory.relatedMemoriesJson as MemoryRelationship[];
        outgoingRelationships.push(...related);
      }

      if (sourceMemory.supersedesJson) {
        const superseding = sourceMemory.supersedesJson as MemoryRelationship[];
        outgoingRelationships.push(...superseding);
      }

      // Filter outgoing relationships based on criteria
      const filteredOutgoing = outgoingRelationships.filter(rel => {
        if (options.relationshipType && rel.type !== options.relationshipType) return false;
        if (options.minConfidence && rel.confidence < options.minConfidence) return false;
        if (options.minStrength && rel.strength < options.minStrength) return false;
        return true;
      });

      // Get target memories for outgoing relationships
      for (const relationship of filteredOutgoing) {
        if (!relationship.targetMemoryId) continue;

        try {
          const targetMemory = await this.prisma.longTermMemory.findUnique({
            where: { id: relationship.targetMemoryId },
          });

          if (targetMemory) {
            results.push({
              memory: targetMemory,
              relationship,
              direction: 'outgoing',
            });
          }
        } catch (error) {
          logError(`Failed to retrieve target memory ${relationship.targetMemoryId}`, {
            component: 'DatabaseManager',
            targetMemoryId: relationship.targetMemoryId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Get incoming relationships (memories that reference this memory)
      const incomingMemories = await this.prisma.longTermMemory.findMany({
        where: {
          namespace,
          OR: [
            {
              relatedMemoriesJson: {
                path: ['targetMemoryId'],
                equals: memoryId,
              } as any,
            },
            {
              supersedesJson: {
                path: ['targetMemoryId'],
                equals: memoryId,
              } as any,
            },
          ],
        },
        take: limit,
        select: {
          id: true,
          relatedMemoriesJson: true,
          supersedesJson: true,
        },
      });

      // Process incoming relationships
      for (const incomingMemory of incomingMemories) {
        const allRelationships: MemoryRelationship[] = [];

        if (incomingMemory.relatedMemoriesJson) {
          const related = incomingMemory.relatedMemoriesJson as MemoryRelationship[];
          allRelationships.push(...related);
        }

        if (incomingMemory.supersedesJson) {
          const superseding = incomingMemory.supersedesJson as MemoryRelationship[];
          allRelationships.push(...superseding);
        }

        // Find the specific relationship that targets our memory
        const targetRelationship = allRelationships.find(rel => rel.targetMemoryId === memoryId);

        if (targetRelationship) {
          // Filter by criteria
          if (options.relationshipType && targetRelationship.type !== options.relationshipType) continue;
          if (options.minConfidence && targetRelationship.confidence < options.minConfidence) continue;
          if (options.minStrength && targetRelationship.strength < options.minStrength) continue;

          try {
            const fullMemory = await this.prisma.longTermMemory.findUnique({
              where: { id: incomingMemory.id },
            });

            if (fullMemory) {
              results.push({
                memory: fullMemory,
                relationship: targetRelationship,
                direction: 'incoming',
              });
            }
          } catch (error) {
            logError(`Failed to retrieve incoming memory ${incomingMemory.id}`, {
              component: 'DatabaseManager',
              incomingMemoryId: incomingMemory.id,
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      // Sort by relationship strength and confidence
      results.sort((a, b) => {
        const scoreA = (a.relationship.strength + a.relationship.confidence) / 2;
        const scoreB = (b.relationship.strength + b.relationship.confidence) / 2;
        return scoreB - scoreA;
      });

      // Apply limit
      const limitedResults = results.slice(0, limit);

      logInfo(`Retrieved ${limitedResults.length} related memories for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        namespace,
        resultsCount: limitedResults.length,
        outgoingCount: limitedResults.filter(r => r.direction === 'outgoing').length,
        incomingCount: limitedResults.filter(r => r.direction === 'incoming').length,
      });

      return limitedResults;
    } catch (error) {
      const errorMsg = `Failed to get related memories for ${memoryId}: ${error instanceof Error ? error.message : String(error)}`;
      logError(errorMsg, {
        component: 'DatabaseManager',
        memoryId,
        options,
        error: error instanceof Error ? error.stack : String(error),
      });
      throw new Error(errorMsg);
    }
  }

  /**
   * Update relationships for an existing memory
   * Allows adding, updating, or removing specific relationships
   */
  async updateMemoryRelationships(
    memoryId: string,
    updates: Array<{
      relationship: MemoryRelationship;
      operation: 'add' | 'update' | 'remove';
    }>,
    namespace: string = 'default',
  ): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    try {
      logInfo(`Updating ${updates.length} relationships for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        updateCount: updates.length,
        namespace,
      });

      // Get the current memory with its relationships
      const existingMemory = await this.prisma.longTermMemory.findUnique({
        where: { id: memoryId },
        select: {
          id: true,
          namespace: true,
          relatedMemoriesJson: true,
          supersedesJson: true,
          processedData: true,
        },
      });

      if (!existingMemory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      if (existingMemory.namespace !== namespace) {
        throw new Error(`Memory ${memoryId} is not in namespace ${namespace}`);
      }

      // Get existing relationships
      const existingGeneralRelationships = (existingMemory.relatedMemoriesJson as MemoryRelationship[]) || [];
      const existingSupersedingRelationships = (existingMemory.supersedesJson as MemoryRelationship[]) || [];

      // Process updates
      for (const update of updates) {
        try {
          const { relationship, operation } = update;
          const isSuperseding = relationship.type === MemoryRelationshipType.SUPERSEDES;

          let targetRelationships = isSuperseding ? existingSupersedingRelationships : existingGeneralRelationships;

          switch (operation) {
          case 'add': {
            // Check if relationship already exists
            const existingIndex = targetRelationships.findIndex(
              r => r.type === relationship.type &&
                   r.targetMemoryId === relationship.targetMemoryId,
            );

            if (existingIndex >= 0) {
              // Update existing relationship
              targetRelationships[existingIndex] = {
                ...relationship,
                // Preserve higher confidence/strength
                confidence: Math.max(targetRelationships[existingIndex].confidence, relationship.confidence),
                strength: Math.max(targetRelationships[existingIndex].strength, relationship.strength),
              };
            } else {
              // Add new relationship
              targetRelationships.push(relationship);
            }
            break;
          }

          case 'update': {
            // Find and update existing relationship
            const updateIndex = targetRelationships.findIndex(
              r => r.type === relationship.type &&
                   r.targetMemoryId === relationship.targetMemoryId,
            );

            if (updateIndex >= 0) {
              targetRelationships[updateIndex] = relationship;
            } else {
              errors.push(`Relationship not found for update: ${relationship.type} -> ${relationship.targetMemoryId}`);
              continue;
            }
            break;
          }

          case 'remove': {
            // Remove relationship if it exists
            const removeIndex = targetRelationships.findIndex(
              r => r.type === relationship.type &&
                   r.targetMemoryId === relationship.targetMemoryId,
            );

            if (removeIndex >= 0) {
              targetRelationships.splice(removeIndex, 1);
            } else {
              logInfo(`Relationship not found for removal: ${relationship.type} -> ${relationship.targetMemoryId}`, {
                component: 'DatabaseManager',
                memoryId,
                relationshipType: relationship.type,
                targetMemoryId: relationship.targetMemoryId,
              });
            }
            break;
          }

          default:
            errors.push(`Unknown operation: ${operation}`);
            continue;
          }

          updated++;
        } catch (error) {
          const errorMsg = `Failed to ${update.operation} relationship ${update.relationship.type} -> ${update.relationship.targetMemoryId}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logError(errorMsg, {
            component: 'DatabaseManager',
            memoryId,
            relationship: update.relationship,
            operation: update.operation,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Save updated relationships back to database
      await this.prisma.longTermMemory.update({
        where: { id: memoryId },
        data: {
          relatedMemoriesJson: existingGeneralRelationships as any,
          supersedesJson: existingSupersedingRelationships as any,
          processedData: {
            ...(existingMemory.processedData as any),
            relationshipUpdateCount: (existingMemory.processedData as any)?.relationshipUpdateCount || 0 + 1,
            lastRelationshipUpdate: new Date(),
          } as any,
        },
      });

      // Update state tracking
      try {
        await this.stateManager.transitionToState(
          memoryId,
          MemoryProcessingState.PROCESSED,
          {
            reason: 'Memory relationships updated',
            agentId: 'DatabaseManager',
            metadata: {
              relationshipsUpdated: updated,
              errors: errors.length,
            },
          },
        );
      } catch (stateError) {
        logError('Failed to update state tracking for relationship update', {
          component: 'DatabaseManager',
          memoryId,
          error: stateError instanceof Error ? stateError.message : String(stateError),
        });
      }

      logInfo(`Successfully updated relationships for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        totalUpdated: updated,
        errors: errors.length,
      });

      return { updated, errors };
    } catch (error) {
      const errorMsg = `Failed to update relationships for memory ${memoryId}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      logError(errorMsg, {
        component: 'DatabaseManager',
        memoryId,
        updates: updates.length,
        namespace,
        error: error instanceof Error ? error.stack : String(error),
      });
      return { updated, errors };
    }
  }

  /**
   * Generate comprehensive relationship statistics and analytics
   */
  async getRelationshipStatistics(namespace: string = 'default'): Promise<RelationshipStatistics> {
    try {
      logInfo(`Generating relationship statistics for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
      });

      // Get all memories with relationships
      const memories = await this.prisma.longTermMemory.findMany({
        where: { namespace },
        select: {
          id: true,
          relatedMemoriesJson: true,
          supersedesJson: true,
          createdAt: true,
        },
      });

      let totalRelationships = 0;
      const relationshipsByType = {
        [MemoryRelationshipType.CONTINUATION]: 0,
        [MemoryRelationshipType.REFERENCE]: 0,
        [MemoryRelationshipType.RELATED]: 0,
        [MemoryRelationshipType.SUPERSEDES]: 0,
        [MemoryRelationshipType.CONTRADICTION]: 0,
      };

      let totalConfidence = 0;
      let totalStrength = 0;
      let relationshipCount = 0;
      const entityFrequency = new Map<string, number>();
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      let recentRelationships = 0;

      for (const memory of memories) {
        const allRelationships: MemoryRelationship[] = [];

        // Collect all relationships from this memory
        if (memory.relatedMemoriesJson) {
          const related = memory.relatedMemoriesJson as MemoryRelationship[];
          allRelationships.push(...related);
        }

        if (memory.supersedesJson) {
          const superseding = memory.supersedesJson as MemoryRelationship[];
          allRelationships.push(...superseding);
        }

        // Process each relationship
        for (const relationship of allRelationships) {
          totalRelationships++;
          relationshipsByType[relationship.type]++;
          totalConfidence += relationship.confidence;
          totalStrength += relationship.strength;
          relationshipCount++;

          // Track entity frequency
          for (const entity of relationship.entities || []) {
            entityFrequency.set(entity, (entityFrequency.get(entity) || 0) + 1);
          }

          // Count recent relationships
          if (memory.createdAt >= thirtyDaysAgo) {
            recentRelationships++;
          }
        }
      }

      // Calculate averages
      const averageConfidence = relationshipCount > 0 ? totalConfidence / relationshipCount : 0;
      const averageStrength = relationshipCount > 0 ? totalStrength / relationshipCount : 0;

      // Get top entities
      const topEntities = Array.from(entityFrequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([entity, count]) => ({ entity, count }));

      const statistics: RelationshipStatistics = {
        totalRelationships,
        relationshipsByType,
        averageConfidence: Math.round(averageConfidence * 100) / 100,
        averageStrength: Math.round(averageStrength * 100) / 100,
        topEntities,
        recentRelationships,
      };

      logInfo('Generated relationship statistics', {
        component: 'DatabaseManager',
        namespace,
        ...statistics,
      });

      return statistics;
    } catch (error) {
      const errorMsg = `Failed to generate relationship statistics: ${error instanceof Error ? error.message : String(error)}`;
      logError(errorMsg, {
        component: 'DatabaseManager',
        namespace,
        error: error instanceof Error ? error.stack : String(error),
      });
      throw new Error(errorMsg);
    }
  }

  /**
   * Validate relationships for consistency and quality
   */
  validateRelationships(relationships: MemoryRelationship[]): { valid: MemoryRelationship[], invalid: Array<{ relationship: MemoryRelationship, reason: string }> } {
    const valid: MemoryRelationship[] = [];
    const invalid: Array<{ relationship: MemoryRelationship, reason: string }> = [];

    for (const relationship of relationships) {
      const validation = this.validateSingleRelationship(relationship);
      if (validation.isValid) {
        valid.push(relationship);
      } else {
        invalid.push({ relationship, reason: validation.reason || 'Unknown validation error' });
      }
    }

    return { valid, invalid };
  }

  /**
   * Validate a single relationship
   */
  private validateSingleRelationship(relationship: MemoryRelationship): { isValid: boolean, reason?: string } {
    // Check required fields
    if (!relationship.type) {
      return { isValid: false, reason: 'Missing relationship type' };
    }

    if (!relationship.reason || relationship.reason.trim().length < 10) {
      return { isValid: false, reason: 'Insufficient reasoning provided' };
    }

    if (!relationship.context || relationship.context.trim().length < 5) {
      return { isValid: false, reason: 'Insufficient context provided' };
    }

    // Validate confidence and strength scores
    if (relationship.confidence < 0 || relationship.confidence > 1) {
      return { isValid: false, reason: 'Confidence must be between 0 and 1' };
    }

    if (relationship.strength < 0 || relationship.strength > 1) {
      return { isValid: false, reason: 'Strength must be between 0 and 1' };
    }

    // Validate relationship type
    const validTypes = Object.values(MemoryRelationshipType);
    if (!validTypes.includes(relationship.type)) {
      return { isValid: false, reason: `Invalid relationship type: ${relationship.type}` };
    }

    // Validate entities if provided
    if (relationship.entities && relationship.entities.length > 0) {
      const validEntities = relationship.entities.filter(entity =>
        entity && typeof entity === 'string' && entity.trim().length > 0,
      );

      if (validEntities.length !== relationship.entities.length) {
        return { isValid: false, reason: 'Invalid entities in relationship' };
      }
    }

    // Check for reasonable confidence/strength ratio
    if (relationship.strength > relationship.confidence + 0.3) {
      return { isValid: false, reason: 'Strength cannot significantly exceed confidence' };
    }

    return { isValid: true };
  }

  /**
   * Detect and resolve relationship conflicts
   */
  async resolveRelationshipConflicts(
    memoryId: string,
    namespace: string = 'default',
  ): Promise<{ resolved: number, conflicts: Array<{ type: string, description: string }> }> {
    const conflicts: Array<{ type: string, description: string }> = [];
    let resolved = 0;

    try {
      logInfo(`Resolving relationship conflicts for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        namespace,
      });

      // Get the memory and its relationships
      const memory = await this.prisma.longTermMemory.findUnique({
        where: { id: memoryId },
        select: {
          id: true,
          relatedMemoriesJson: true,
          supersedesJson: true,
          processedData: true,
        },
      });

      if (!memory) {
        throw new Error(`Memory ${memoryId} not found`);
      }

      const allRelationships: MemoryRelationship[] = [];

      if (memory.relatedMemoriesJson) {
        const related = memory.relatedMemoriesJson as MemoryRelationship[];
        allRelationships.push(...related);
      }

      if (memory.supersedesJson) {
        const superseding = memory.supersedesJson as MemoryRelationship[];
        allRelationships.push(...superseding);
      }

      // Detect conflicts
      const conflictsDetected = this.detectRelationshipConflicts(allRelationships);

      if (conflictsDetected.length > 0) {
        // Resolve conflicts by keeping the highest quality relationships
        const resolvedRelationships = this.resolveConflictsByQuality(allRelationships);

        // Update the memory with resolved relationships
        const generalRelationships = resolvedRelationships.filter(r => r.type !== MemoryRelationshipType.SUPERSEDES);
        const supersedingRelationships = resolvedRelationships.filter(r => r.type === MemoryRelationshipType.SUPERSEDES);

        await this.prisma.longTermMemory.update({
          where: { id: memoryId },
          data: {
            relatedMemoriesJson: generalRelationships as any,
            supersedesJson: supersedingRelationships as any,
            processedData: {
              ...(memory.processedData as any),
              conflictResolutionCount: (memory.processedData as any)?.conflictResolutionCount || 0 + 1,
              lastConflictResolution: new Date(),
            } as any,
          },
        });

        resolved = conflictsDetected.length;
        conflicts.push(...conflictsDetected);
      }

      logInfo(`Resolved ${resolved} relationship conflicts for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        resolved,
        conflictCount: conflictsDetected.length,
      });

      return { resolved, conflicts };
    } catch (error) {
      logError(`Failed to resolve relationship conflicts for memory ${memoryId}`, {
        component: 'DatabaseManager',
        memoryId,
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Failed to resolve relationship conflicts: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Detect conflicts in a set of relationships
   */
  private detectRelationshipConflicts(relationships: MemoryRelationship[]): Array<{ type: string, description: string }> {
    const conflicts: Array<{ type: string, description: string }> = [];

    // Group relationships by target memory
    const relationshipsByTarget = new Map<string, MemoryRelationship[]>();
    for (const relationship of relationships) {
      if (relationship.targetMemoryId) {
        const key = relationship.targetMemoryId;
        if (!relationshipsByTarget.has(key)) {
          relationshipsByTarget.set(key, []);
        }
        relationshipsByTarget.get(key)!.push(relationship);
      }
    }

    // Check for conflicts within each target group
    for (const [targetId, rels] of relationshipsByTarget.entries()) {
      if (rels.length > 1) {
        // Check for contradictory relationship types
        const types = rels.map(r => r.type);
        if (types.includes(MemoryRelationshipType.CONTRADICTION) && types.includes(MemoryRelationshipType.CONTINUATION)) {
          conflicts.push({
            type: 'contradictory_types',
            description: `Memory has both CONTRADICTION and CONTINUATION relationships with ${targetId}`,
          });
        }

        // Check for superseding conflicts
        const supersedingRels = rels.filter(r => r.type === MemoryRelationshipType.SUPERSEDES);
        if (supersedingRels.length > 1) {
          conflicts.push({
            type: 'multiple_superseding',
            description: `Memory has multiple SUPERSEDES relationships with ${targetId}`,
          });
        }

        // Check for significant confidence/strength variance
        const confidences = rels.map(r => r.confidence);
        const maxConfidence = Math.max(...confidences);
        const minConfidence = Math.min(...confidences);
        if (maxConfidence - minConfidence > 0.5) {
          conflicts.push({
            type: 'confidence_variance',
            description: `High confidence variance (${minConfidence.toFixed(2)}-${maxConfidence.toFixed(2)}) for relationships with ${targetId}`,
          });
        }
      }
    }

    return conflicts;
  }

  /**
   * Resolve conflicts by selecting highest quality relationships
   */
  private resolveConflictsByQuality(relationships: MemoryRelationship[]): MemoryRelationship[] {
    // Group by target memory
    const relationshipsByTarget = new Map<string, MemoryRelationship[]>();
    for (const relationship of relationships) {
      if (relationship.targetMemoryId) {
        const key = relationship.targetMemoryId;
        if (!relationshipsByTarget.has(key)) {
          relationshipsByTarget.set(key, []);
        }
        relationshipsByTarget.get(key)!.push(relationship);
      }
    }

    const resolved: MemoryRelationship[] = [];

    // For each target, keep the highest quality relationship(s)
    for (const [, rels] of relationshipsByTarget.entries()) {
      if (rels.length === 1) {
        resolved.push(...rels);
      } else {
        // Sort by quality score (weighted combination of confidence and strength)
        rels.sort((a, b) => {
          const scoreA = (a.confidence * 0.6) + (a.strength * 0.4);
          const scoreB = (b.confidence * 0.6) + (b.strength * 0.4);
          return scoreB - scoreA;
        });

        // Keep top 2 relationships for each target to preserve multiple perspectives
        resolved.push(...rels.slice(0, 2));
      }
    }

    return resolved;
  }

  /**
   * Clean up invalid or outdated relationships
   */
  async cleanupInvalidRelationships(
    namespace: string = 'default',
    options: {
      minConfidence?: number;
      maxAgeDays?: number;
      dryRun?: boolean;
    } = {},
  ): Promise<{ cleaned: number, errors: string[], skipped: number }> {
    const errors: string[] = [];
    let cleaned = 0;
    let skipped = 0;

    try {
      const minConfidence = options.minConfidence || 0.2;
      const maxAgeDays = options.maxAgeDays || 90;
      const cutoffDate = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

      logInfo(`Cleaning up invalid relationships in namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        minConfidence,
        maxAgeDays,
        dryRun: options.dryRun,
      });

      // Get memories with potentially invalid relationships
      const memories = await this.prisma.longTermMemory.findMany({
        where: {
          namespace,
          createdAt: { lt: cutoffDate },
        },
        select: {
          id: true,
          relatedMemoriesJson: true,
          supersedesJson: true,
          processedData: true,
          createdAt: true,
        },
      });

      for (const memory of memories) {
        try {
          const allRelationships: MemoryRelationship[] = [];

          if (memory.relatedMemoriesJson) {
            const related = memory.relatedMemoriesJson as MemoryRelationship[];
            allRelationships.push(...related);
          }

          if (memory.supersedesJson) {
            const superseding = memory.supersedesJson as MemoryRelationship[];
            allRelationships.push(...superseding);
          }

          // Filter out invalid relationships
          const { valid, invalid } = this.validateRelationships(allRelationships);

          // Also filter by age and confidence
          const filteredValid = valid.filter(r =>
            r.confidence >= minConfidence &&
            (!options.maxAgeDays || memory.createdAt >= cutoffDate),
          );

          if (filteredValid.length !== allRelationships.length) {
            if (options.dryRun) {
              cleaned += (allRelationships.length - filteredValid.length);
              logInfo(`DRY RUN: Would clean ${allRelationships.length - filteredValid.length} invalid relationships from memory ${memory.id}`, {
                component: 'DatabaseManager',
                memoryId: memory.id,
                invalidCount: invalid.length,
                lowConfidenceCount: valid.length - filteredValid.length,
              });
            } else {
              // Update memory with cleaned relationships
              const generalRelationships = filteredValid.filter(r => r.type !== MemoryRelationshipType.SUPERSEDES);
              const supersedingRelationships = filteredValid.filter(r => r.type === MemoryRelationshipType.SUPERSEDES);

              await this.prisma.longTermMemory.update({
                where: { id: memory.id },
                data: {
                  relatedMemoriesJson: generalRelationships as any,
                  supersedesJson: supersedingRelationships as any,
                  processedData: {
                    ...(memory.processedData as any),
                    relationshipCleanupCount: (memory.processedData as any)?.relationshipCleanupCount || 0 + 1,
                    lastRelationshipCleanup: new Date(),
                  } as any,
                },
              });

              cleaned += (allRelationships.length - filteredValid.length);
              logInfo(`Cleaned ${allRelationships.length - filteredValid.length} invalid relationships from memory ${memory.id}`, {
                component: 'DatabaseManager',
                memoryId: memory.id,
                invalidCount: invalid.length,
                lowConfidenceCount: valid.length - filteredValid.length,
              });
            }
          } else {
            skipped++;
          }
        } catch (error) {
          const errorMsg = `Failed to cleanup relationships for memory ${memory.id}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          logError(errorMsg, {
            component: 'DatabaseManager',
            memoryId: memory.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      logInfo(`Relationship cleanup completed for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        cleaned,
        skipped,
        errors: errors.length,
      });

      return { cleaned, errors, skipped };
    } catch (error) {
      const errorMsg = `Failed to cleanup invalid relationships: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);
      logError(errorMsg, {
        component: 'DatabaseManager',
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      return { cleaned, errors, skipped };
    }
  }

  // Memory State Management Operations

  /**
   * Get the state manager instance for direct access
   */
  getStateManager(): ProcessingStateManager {
    return this.stateManager;
  }

  /**
   * Get memories by processing state
   */
  async getMemoriesByState(
    state: MemoryProcessingState,
    namespace: string = 'default',
    limit?: number,
  ): Promise<string[]> {
    const memoryIds = this.stateManager.getMemoriesByState(state);
    // Filter by namespace if needed
    if (namespace !== 'default') {
      const filteredIds: string[] = [];
      for (const memoryId of memoryIds) {
        const memory = await this.prisma.longTermMemory.findUnique({
          where: { id: memoryId },
          select: { namespace: true },
        });
        if (memory?.namespace === namespace) {
          filteredIds.push(memoryId);
        }
      }
      return limit ? filteredIds.slice(0, limit) : filteredIds;
    }
    return limit ? memoryIds.slice(0, limit) : memoryIds;
  }

  /**
   * Get memory processing state
   */
  async getMemoryState(memoryId: string): Promise<MemoryProcessingState | undefined> {
    return this.stateManager.getCurrentState(memoryId);
  }

  /**
   * Get memory state history
   */
  async getMemoryStateHistory(memoryId: string): Promise<import('../memory/MemoryProcessingStateManager').MemoryStateTransition[]> {
    return this.stateManager.getStateHistory(memoryId);
  }

  /**
   * Transition memory to new state
   */
  async transitionMemoryState(
    memoryId: string,
    toState: MemoryProcessingState,
    options?: {
      reason?: string;
      metadata?: Record<string, unknown>;
      userId?: string;
      agentId?: string;
      errorMessage?: string;
      force?: boolean;
    },
  ): Promise<boolean> {
    return this.stateManager.transitionToState(memoryId, toState, options);
  }

  /**
   * Get processing state statistics
   */
  async getProcessingStateStats(namespace?: string): Promise<Record<MemoryProcessingState, number>> {
    const stats = this.stateManager.getStateStatistics();

    // If namespace filter is provided, we need to count only memories in that namespace
    if (namespace && namespace !== 'default') {
      const filteredStats: Record<MemoryProcessingState, number> = {} as Record<MemoryProcessingState, number>;
      Object.values(MemoryProcessingState).forEach(state => {
        filteredStats[state] = 0;
      });

      // Get all memory IDs for each state and filter by namespace
      for (const state of Object.values(MemoryProcessingState)) {
        const memoryIds = this.stateManager.getMemoriesByState(state);
        for (const memoryId of memoryIds) {
          try {
            const memory = await this.prisma.longTermMemory.findUnique({
              where: { id: memoryId },
              select: { namespace: true },
            });
            if (memory?.namespace === namespace) {
              filteredStats[state]++;
            }
          } catch {
            // Skip memories that can't be found
          }
        }
      }

      return filteredStats;
    }

    return stats;
  }

  /**
   * Initialize memory state (for existing memories without state tracking)
   */
  async initializeExistingMemoryState(
    memoryId: string,
    initialState: MemoryProcessingState = MemoryProcessingState.PENDING,
  ): Promise<void> {
    await this.stateManager.initializeMemoryState(memoryId, initialState);
  }

  /**
   * Get all memory states
   */
  async getAllMemoryStates(): Promise<Record<string, MemoryProcessingState>> {
    return this.stateManager.getAllMemoryStates();
  }

  /**
   * Check if memory can transition to specific state
   */
  async canMemoryTransitionTo(memoryId: string, toState: MemoryProcessingState): Promise<boolean> {
    return this.stateManager.canTransitionTo(memoryId, toState);
  }

  /**
   * Retry failed memory state transition
   */
  async retryMemoryStateTransition(
    memoryId: string,
    targetState: MemoryProcessingState,
    options?: { maxRetries?: number; delayMs?: number },
  ): Promise<boolean> {
    return this.stateManager.retryTransition(memoryId, targetState, options);
  }

  /**
   * Get processing metrics
   */
  async getProcessingMetrics(): Promise<Record<string, number>> {
    return this.stateManager.getMetrics();
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
      // Ensure FTS support is initialized before checking status
      await this.ensureFTSSupport();
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
    * Create FTS triggers after main tables exist
    */
  private async createFTSTriggers(): Promise<void> {
    try {
      logInfo('Creating FTS triggers after main tables exist...', { component: 'DatabaseManager' });

      // Create triggers for synchronization with long_term_memory
      await this.prisma.$executeRaw`
        CREATE TRIGGER IF NOT EXISTS memory_fts_insert_long_term
        AFTER INSERT ON long_term_memory
        BEGIN
          INSERT INTO memory_fts(rowid, content, metadata)
          VALUES (new.id, new.searchableContent, json_object(
            'memory_type', new.retentionType,
            'category_primary', new.categoryPrimary,
            'importance_score', new.importanceScore,
            'classification', new.classification,
            'created_at', new.extractionTimestamp,
            'namespace', new.namespace
          ));
        END;
      `;

      await this.prisma.$executeRaw`
        CREATE TRIGGER IF NOT EXISTS memory_fts_delete_long_term
        AFTER DELETE ON long_term_memory
        BEGIN
          DELETE FROM memory_fts WHERE rowid = old.id;
        END;
      `;

      await this.prisma.$executeRaw`
        CREATE TRIGGER IF NOT EXISTS memory_fts_update_long_term
        AFTER UPDATE ON long_term_memory
        BEGIN
          DELETE FROM memory_fts WHERE rowid = old.id;
          INSERT INTO memory_fts(rowid, content, metadata)
          VALUES (new.id, new.searchableContent, json_object(
            'memory_type', new.retentionType,
            'category_primary', new.categoryPrimary,
            'importance_score', new.importanceScore,
            'classification', new.classification,
            'created_at', new.extractionTimestamp,
            'namespace', new.namespace
          ));
        END;
      `;

      // Create triggers for synchronization with short_term_memory
      await this.prisma.$executeRaw`
        CREATE TRIGGER IF NOT EXISTS memory_fts_insert_short_term
        AFTER INSERT ON short_term_memory
        BEGIN
          INSERT INTO memory_fts(rowid, content, metadata)
          VALUES (new.id, new.searchableContent, json_object(
            'memory_type', new.retentionType,
            'category_primary', new.categoryPrimary,
            'importance_score', new.importanceScore,
            'created_at', new.createdAt,
            'namespace', new.namespace
          ));
        END;
      `;

      await this.prisma.$executeRaw`
        CREATE TRIGGER IF NOT EXISTS memory_fts_delete_short_term
        AFTER DELETE ON short_term_memory
        BEGIN
          DELETE FROM memory_fts WHERE rowid = old.id;
        END;
      `;

      await this.prisma.$executeRaw`
        CREATE TRIGGER IF NOT EXISTS memory_fts_update_short_term
        AFTER UPDATE ON short_term_memory
        BEGIN
          DELETE FROM memory_fts WHERE rowid = old.id;
          INSERT INTO memory_fts(rowid, content, metadata)
          VALUES (new.id, new.searchableContent, json_object(
            'memory_type', new.retentionType,
            'category_primary', new.categoryPrimary,
            'importance_score', new.importanceScore,
            'created_at', new.createdAt,
            'namespace', new.namespace
          ));
        END;
      `;

      logInfo('FTS triggers created successfully', { component: 'DatabaseManager' });

    } catch (error) {
      logError('Failed to create FTS triggers', {
        component: 'DatabaseManager',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
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
   * Consolidate duplicate memories by merging them into the primary memory with enhanced validation and rollback
   */
  async consolidateDuplicateMemories(
    primaryMemoryId: string,
    duplicateIds: string[],
    namespace: string = 'default',
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
    const validationResult = await this.performPreConsolidationValidation(primaryMemoryId, duplicateIds, namespace);
    if (!validationResult.isValid) {
      errors.push(...validationResult.errors);
      return { consolidated: 0, errors };
    }

    // Store original data for potential rollback
    const originalData = await this.backupMemoryData([primaryMemoryId, ...duplicateIds], namespace);

    try {
      logInfo(`Starting enhanced consolidation of ${duplicateIds.length} duplicates into primary memory ${primaryMemoryId}`, {
        component: 'DatabaseManager',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace,
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
            namespace,
          },
        });

        if (duplicateMemories.length !== duplicateIds.length) {
          const foundIds = duplicateMemories.map(m => m.id);
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
              ...(primaryMemory.processedData as any),
              consolidatedAt: consolidationTimestamp,
              consolidatedFrom: duplicateIds,
              consolidationReason: 'duplicate_consolidation',
              consolidationHistory: [
                ...(primaryMemory.processedData as any)?.consolidationHistory || [],
                {
                  timestamp: consolidationTimestamp,
                  consolidatedFrom: duplicateIds,
                  consolidationReason: 'duplicate_consolidation',
                  originalImportance: primaryMemory.memoryImportance,
                  originalClassification: primaryMemory.classification,
                  duplicateCount: duplicateIds.length,
                  dataIntegrityHash: this.generateDataIntegrityHash(mergedData),
                },
              ],
              originalImportance: primaryMemory.memoryImportance,
              originalClassification: primaryMemory.classification,
              duplicateCount: duplicateIds.length,
              lastConsolidationActivity: consolidationTimestamp,
            } as any,
          },
        });

        // Mark all duplicates as consolidated with enhanced tracking
        for (const duplicateId of duplicateIds) {
          const duplicateMemory = duplicateMemories.find(m => m.id === duplicateId);
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
              } as any,
              // Mark in searchable content for easy identification
              searchableContent: `[CONSOLIDATED:${consolidationTimestamp.toISOString()}] ${duplicateMemory?.searchableContent}`,
            },
          });
        }

        // Update state tracking for successful consolidation
        try {
          await this.stateManager.transitionToState(
            primaryMemoryId,
            MemoryProcessingState.PROCESSED,
            {
              reason: 'Memory consolidation completed successfully',
              agentId: 'DatabaseManager',
              metadata: {
                consolidationSuccess: true,
                consolidatedCount: duplicateIds.length,
                consolidationTimestamp,
                namespace,
              },
            },
          );
        } catch (stateError) {
          logError('Failed to update state tracking for consolidated memory', {
            component: 'DatabaseManager',
            memoryId: primaryMemoryId,
            error: stateError instanceof Error ? stateError.message : String(stateError),
          });
        }

        return { consolidated: duplicateIds.length, duplicateMemories };
      }, {
        timeout: 60000, // 60 second timeout for large consolidations
      });

      consolidatedCount = result.consolidated;

      logInfo(`Successfully completed enhanced consolidation of ${consolidatedCount} duplicates into primary memory ${primaryMemoryId}`, {
        component: 'DatabaseManager',
        primaryMemoryId,
        consolidatedCount,
        namespace,
        consolidationTimestamp: new Date().toISOString(),
        backupAvailable: true,
      });

      return { consolidated: consolidatedCount, errors };

    } catch (error) {
      const errorMsg = `Enhanced consolidation failed for primary memory ${primaryMemoryId}: ${error instanceof Error ? error.message : String(error)}`;
      errors.push(errorMsg);

      logError(errorMsg, {
        component: 'DatabaseManager',
        primaryMemoryId,
        duplicateIds,
        namespace,
        error: error instanceof Error ? error.stack : String(error),
      });

      // Attempt rollback if backup data is available
      if (originalData.size > 0) {
        try {
          await this.rollbackConsolidation(primaryMemoryId, duplicateIds, originalData, namespace);
          logInfo(`Successfully rolled back consolidation for memory ${primaryMemoryId}`, {
            component: 'DatabaseManager',
            primaryMemoryId,
            namespace,
          });
        } catch (rollbackError) {
          logError(`Rollback failed for memory ${primaryMemoryId}`, {
            component: 'DatabaseManager',
            primaryMemoryId,
            namespace,
            rollbackError: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
          });
        }
      }

      return { consolidated: consolidatedCount, errors };
    }
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
    namespace: string,
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

      if (primaryMemory.namespace !== namespace) {
        errors.push(`Primary memory ${primaryMemoryId} is not in namespace ${namespace}`);
        return { isValid: false, errors };
      }

      // Check if primary memory is already consolidated
      const processedData = primaryMemory.processedData as any;
      if (processedData?.consolidatedAt) {
        const lastConsolidation = new Date(processedData.consolidatedAt);
        const hoursSinceLastConsolidation = (Date.now() - lastConsolidation.getTime()) / (1000 * 60 * 60);

        if (hoursSinceLastConsolidation < 1) {
          errors.push(`Primary memory ${primaryMemoryId} was consolidated recently (${hoursSinceLastConsolidation.toFixed(1)} hours ago)`);
        }
      }

      // Validate all duplicate memories exist and are in correct namespace
      const duplicateMemories = await this.prisma.longTermMemory.findMany({
        where: {
          id: { in: duplicateIds },
          namespace,
        },
        select: { id: true, namespace: true, processedData: true },
      });

      if (duplicateMemories.length !== duplicateIds.length) {
        const foundIds = duplicateMemories.map(m => m.id);
        const missingIds = duplicateIds.filter(id => !foundIds.includes(id));
        errors.push(`Some duplicate memories not found in namespace ${namespace}: ${missingIds.join(', ')}`);
      }

      // Check for circular consolidation references
      for (const duplicate of duplicateMemories) {
        const duplicateData = duplicate.processedData as any;
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
        component: 'DatabaseManager',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace,
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
  private async backupMemoryData(memoryIds: string[], namespace: string): Promise<Map<string, any>> {
    const backupData = new Map<string, any>();

    try {
      const memories = await this.prisma.longTermMemory.findMany({
        where: {
          id: { in: memoryIds },
          namespace,
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
        component: 'DatabaseManager',
        memoryIds: memoryIds,
        namespace,
        backupSize: backupData.size,
      });

      return backupData;
    } catch (error) {
      logError('Failed to backup memory data', {
        component: 'DatabaseManager',
        memoryIds,
        namespace,
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
    originalData: Map<string, any>,
    namespace: string,
  ): Promise<void> {
    try {
      logInfo(`Attempting rollback for failed consolidation of memory ${primaryMemoryId}`, {
        component: 'DatabaseManager',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace,
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
            } as any,
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
              } as any,
            },
          });
        }
      }

      logInfo(`Successfully rolled back consolidation for memory ${primaryMemoryId}`, {
        component: 'DatabaseManager',
        primaryMemoryId,
        duplicateCount: duplicateIds.length,
        namespace,
      });
    } catch (error) {
      logError(`Rollback failed for memory ${primaryMemoryId}`, {
        component: 'DatabaseManager',
        primaryMemoryId,
        duplicateIds,
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(`Rollback failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Generate data integrity hash for validation
   */
  private generateDataIntegrityHash(data: any): string {
    const content = JSON.stringify(data, Object.keys(data).sort());
    return createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Enhanced data merging with conflict resolution and quality scoring
   */
  private async mergeDuplicateDataEnhanced(
    primaryMemory: any,
    duplicateMemories: any[],
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
        component: 'DatabaseManager',
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
        component: 'DatabaseManager',
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
        component: 'DatabaseManager',
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
    primaryMemory: any,
    duplicateMemories: any[],
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
        component: 'DatabaseManager',
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
        component: 'DatabaseManager',
        originalLength: primaryContent.length,
        consolidatedLength: consolidatedContent.length,
        sentencesCount: topSentences.length,
        topicsCount: importantTopics.length,
      });

      return consolidatedContent;

    } catch (error) {
      logError('Failed to generate merged content, using primary content as fallback', {
        component: 'DatabaseManager',
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

  // ===== DATABASE PERFORMANCE MONITORING METHODS =====

  /**
   * Record database operation performance metrics
   */
  private recordOperationMetrics(metrics: DatabaseOperationMetrics): void {
    const endTime = Date.now();
    metrics.endTime = endTime;
    metrics.duration = endTime - metrics.startTime;

    // Update aggregate metrics
    this.performanceMetrics.totalOperations++;
    if (metrics.success) {
      this.performanceMetrics.successfulOperations++;
    } else {
      this.performanceMetrics.failedOperations++;
    }
    this.performanceMetrics.lastOperationTime = new Date(endTime);

    // Update operation type counts
    const currentCount = this.performanceMetrics.operationBreakdown.get(metrics.operationType) || 0;
    this.performanceMetrics.operationBreakdown.set(metrics.operationType, currentCount + 1);

    // Update average operation time
    this.performanceMetrics.averageOperationTime =
      (this.performanceMetrics.averageOperationTime * (this.performanceMetrics.totalOperations - 1) + metrics.duration!) /
      this.performanceMetrics.totalOperations;

    // Track slow queries
    if (this.performanceConfig.trackSlowQueries && metrics.duration! > this.performanceConfig.slowQueryThreshold) {
      this.trackSlowQuery({
        query: `${metrics.operationType}${metrics.tableName ? `_${metrics.tableName}` : ''}`,
        duration: metrics.duration!,
        timestamp: endTime,
      });
    }

    // Update query latency (exponential moving average)
    const currentLatency = this.performanceMetrics.metadata?.queryLatency as number || 0;
    const newLatency = (currentLatency * 0.9) + (metrics.duration! * 0.1);
    this.performanceMetrics.metadata = {
      ...this.performanceMetrics.metadata,
      queryLatency: newLatency,
    };

    // Update memory usage
    const currentMemory = process.memoryUsage();
    this.performanceMetrics.memoryUsage = currentMemory.heapUsed;

    // Track errors
    if (!metrics.success && metrics.error) {
      const currentErrorCount = this.performanceMetrics.errorBreakdown.get(metrics.error) || 0;
      this.performanceMetrics.errorBreakdown.set(metrics.error, currentErrorCount + 1);
    }

    // Store operation history
    this.operationMetrics.unshift(metrics);
    if (this.operationMetrics.length > this.maxOperationHistory) {
      this.operationMetrics = this.operationMetrics.slice(0, this.maxOperationHistory);
    }
  }

  /**
   * Track slow queries for performance analysis
   */
  private trackSlowQuery(slowQuery: { query: string; duration: number; timestamp: number }): void {
    const slowQueries = this.performanceMetrics.metadata?.slowQueries as Array<{ query: string; duration: number; timestamp: number }> || [];
    slowQueries.unshift(slowQuery);
    if (slowQueries.length > this.performanceConfig.maxSlowQueryHistory) {
      slowQueries.splice(this.performanceConfig.maxSlowQueryHistory);
    }
    this.performanceMetrics.metadata = {
      ...this.performanceMetrics.metadata,
      slowQueries,
    };
  }

  /**
   * Get database performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get recent database operation metrics
   */
  public getRecentOperationMetrics(limit: number = 100): DatabaseOperationMetrics[] {
    return this.operationMetrics.slice(0, limit);
  }

  /**
   * Get database performance analytics
   */
  public getPerformanceAnalytics(): {
    averageLatency: number;
    errorRate: number;
    slowQueryCount: number;
    operationBreakdown: Record<string, number>;
    topErrors: Array<{ error: string; count: number }>;
    slowQueries: Array<{ query: string; duration: number; timestamp: number }>;
    memoryUsage: number;
    connectionStatus: string;
  } {
    const totalOps = this.performanceMetrics.totalOperations;
    const errorRate = totalOps > 0 ?
      Array.from(this.performanceMetrics.errorBreakdown.values()).reduce((sum: number, count: number) => sum + count, 0) / totalOps : 0;

    // Generate operation breakdown
    const operationBreakdown: Record<string, number> = {};
    for (const [opType, count] of this.performanceMetrics.operationBreakdown) {
      operationBreakdown[opType] = (count / totalOps) * 100;
    }

    // Get top errors
    const topErrors = Array.from(this.performanceMetrics.errorBreakdown.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([error, count]) => ({ error, count }));

    const slowQueries = this.performanceMetrics.metadata?.slowQueries as Array<{ query: string; duration: number; timestamp: number }> || [];

    return {
      averageLatency: this.performanceMetrics.averageOperationTime,
      errorRate,
      slowQueryCount: slowQueries.length,
      operationBreakdown,
      topErrors,
      slowQueries: [...slowQueries],
      memoryUsage: this.performanceMetrics.memoryUsage,
      connectionStatus: this.isConnected() ? 'connected' : 'disconnected',
    };
  }

  /**
   * Get database performance report
   */
  public getDatabasePerformanceReport(): {
    summary: {
      totalOperations: number;
      averageLatency: number;
      errorRate: number;
      memoryUsage: number;
      connectionCount: number;
    };
    performanceByOperation: Record<string, { count: number; averageLatency: number; errorRate: number }>;
    slowQueries: Array<{ query: string; duration: number; timestamp: number }>;
    recommendations: string[];
    timestamp: Date;
  } {
    const analytics = this.getPerformanceAnalytics();
    const performanceByOperation: Record<string, { count: number; averageLatency: number; errorRate: number }> = {};

    // Calculate performance by operation type
    for (const [opType, count] of this.performanceMetrics.operationBreakdown) {
      const opMetrics = this.operationMetrics.filter(m => m.operationType === opType);
      const errorCount = opMetrics.filter(m => !m.success).length;
      const avgLatency = opMetrics.length > 0 ?
        opMetrics.reduce((sum, m) => sum + (m.duration || 0), 0) / opMetrics.length : 0;

      performanceByOperation[opType] = {
        count,
        averageLatency: avgLatency,
        errorRate: count > 0 ? errorCount / count : 0,
      };
    }

    // Generate recommendations
    const recommendations = this.generateDatabasePerformanceRecommendations(analytics);

    const connectionCount = this.performanceMetrics.metadata?.connectionCount as number || 0;

    return {
      summary: {
        totalOperations: this.performanceMetrics.totalOperations,
        averageLatency: analytics.averageLatency,
        errorRate: analytics.errorRate,
        memoryUsage: analytics.memoryUsage,
        connectionCount,
      },
      performanceByOperation,
      slowQueries: analytics.slowQueries,
      recommendations,
      timestamp: new Date(),
    };
  }

  /**
   * Generate database performance recommendations
   */
  private generateDatabasePerformanceRecommendations(analytics: ReturnType<typeof this.getPerformanceAnalytics>): string[] {
    const recommendations: string[] = [];

    // High latency recommendations
    if (analytics.averageLatency > 1000) {
      recommendations.push('Database operations are slow - consider query optimization');
      recommendations.push('Check database indexes and table fragmentation');
      recommendations.push('Monitor system resource usage (CPU, disk I/O)');
    }

    // High error rate recommendations
    if (analytics.errorRate > 0.05) {
      recommendations.push('High error rate detected - check database connectivity');
      const topError = analytics.topErrors[0];
      if (topError) {
        recommendations.push(`Most common error: ${topError.error} - investigate database logs`);
      }
    }

    // Slow queries recommendations
    if (analytics.slowQueryCount > 10) {
      recommendations.push('Multiple slow queries detected - review query patterns');
      recommendations.push('Consider adding database indexes for frequently queried fields');
      recommendations.push('Check for missing indexes on search and filter operations');
    }

    // Memory usage recommendations
    const memoryUsageMB = analytics.memoryUsage / 1024 / 1024;
    if (memoryUsageMB > 200) {
      recommendations.push('High memory usage detected - monitor for memory leaks');
      recommendations.push('Consider optimizing large result set handling');
    }

    // Connection issues
    if (analytics.connectionStatus !== 'connected') {
      recommendations.push('Database connection issues detected - check connection configuration');
      recommendations.push('Verify database server availability and credentials');
    }

    return recommendations;
  }


  /**
   * Get database performance monitoring status
   */
  public getPerformanceMonitoringStatus(): {
    enabled: boolean;
    totalOperations: number;
    averageLatency: number;
    errorRate: number;
    slowQueryCount: number;
    memoryUsage: number;
    lastOperationTime: number;
  } {
    return {
      enabled: this.performanceConfig.enabled,
      totalOperations: this.performanceMetrics.totalOperations,
      averageLatency: this.performanceMetrics.averageOperationTime,
      errorRate: this.performanceMetrics.totalOperations > 0 ?
        Array.from(this.performanceMetrics.errorBreakdown.values()).reduce((sum: number, count: number) => sum + count, 0) / this.performanceMetrics.totalOperations : 0,
      slowQueryCount: (this.performanceMetrics.metadata?.slowQueries as Array<any> || []).length,
      memoryUsage: this.performanceMetrics.memoryUsage,
      lastOperationTime: this.performanceMetrics.lastOperationTime.getTime(),
    };
  }

  /**
   * Update database performance monitoring configuration
   */
  public updatePerformanceMonitoringConfig(config: Partial<DatabasePerformanceConfig>): void {
    this.performanceConfig = { ...this.performanceConfig, ...config };
  }

  /**
   * Get database performance monitoring configuration
   */
  public getPerformanceMonitoringConfig(): DatabasePerformanceConfig {
    return { ...this.performanceConfig };
  }

  /**
   * Clear database performance metrics
   */
  public clearPerformanceMetrics(): void {
    this.performanceMetrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      averageOperationTime: 0,
      lastOperationTime: new Date(),
      errorRate: 0,
      memoryUsage: 0,
      peakMemoryUsage: 0,
      operationBreakdown: new Map<string, number>(),
      errorBreakdown: new Map<string, number>(),
      trends: [],
      metadata: {
        component: 'DatabaseManager',
        databaseType: 'sqlite',
        connectionCount: 0,
        queryLatency: 0,
        slowQueries: [],
      },
    };
    this.operationMetrics = [];
  }

  /**
   * Check if database is connected (for performance monitoring)
   */
  private isConnected(): boolean {
    try {
      // Simple check - try to execute a simple query
      return true; // Placeholder - would need actual connection check
    } catch {
      return false;
    }
  }
}