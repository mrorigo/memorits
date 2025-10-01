import { MemoryImportanceLevel, MemoryClassification, ProcessedLongTermMemory } from '../types/schemas';
import { MemorySearchResult, SearchOptions, DatabaseStats } from '../types/models';
import { logInfo, logError } from '../utils/Logger';
import { MemoryRelationship, MemoryRelationshipType } from '../types/schemas';
import { DatabaseContext } from './DatabaseContext';
import { ChatHistoryManager } from './ChatHistoryManager';
import { MemoryManager } from './MemoryManager';
import { SearchManager } from './SearchManager';
import { RelationshipManager } from './RelationshipManager';
import { DuplicateManager } from './DuplicateManager';
import { StatisticsManager } from './StatisticsManager';
import { ConsciousMemoryManager } from './ConsciousMemoryManager';
import { PerformanceMonitor } from './PerformanceMonitor';
import { FTSManager } from './FTSManager';
import { StateManager } from './StateManager';
import { TransactionCoordinator } from './TransactionCoordinator';
import { ChatHistoryData, ConsciousMemoryData, ShortTermMemoryData, RelationshipQuery, DatabaseOperationMetrics, DatabasePerformanceConfig } from './types';
import { SearchService } from '../search/SearchService';
import { SearchIndexManager } from '../search/SearchIndexManager';
import { verifyFTSSchema, initializeSearchSchema } from './init-search-schema';
import { MemoryStateTransition, MemoryProcessingState } from '../memory/MemoryProcessingStateManager';
import { PerformanceMetrics, PerformanceTrend } from '../types/base';
import { createHash } from 'crypto';
import { PrismaClient, Prisma } from '@prisma/client';

// Type definitions for database records and operations
type LongTermMemoryRecord = {
 id: string;
 namespace: string;
 searchableContent: string;
 summary: string;
 classification: string;
 memoryImportance: string;
 topic?: string;
 entitiesJson?: unknown;
 keywordsJson?: unknown;
 confidenceScore: number;
 classificationReason?: string;
 extractionTimestamp: Date;
 createdAt: Date;
 updatedAt: Date;
 relatedMemoriesJson?: MemoryRelationship[];
 supersedesJson?: MemoryRelationship[];
 processedData?: unknown;
 consciousProcessed?: boolean;
 categoryPrimary: string;
 retentionType: string;
 importanceScore: number;
 isPermanentContext: boolean;
};

type ShortTermMemoryRecord = {
 id: string;
 namespace: string;
 searchableContent: string;
 summary: string;
 processedData: unknown;
 importanceScore: number;
 categoryPrimary: string;
 retentionType: string;
 createdAt: Date;
 updatedAt: Date;
 chatId: string;
 isPermanentContext: boolean;
};

type ChatHistoryRecord = {
 id: string;
 chatId: string;
 userInput: string;
 aiOutput: string;
 model: string;
 sessionId: string;
 namespace: string;
 createdAt: Date;
 metadata?: unknown;
};

type DatabaseRecord = LongTermMemoryRecord | ShortTermMemoryRecord | ChatHistoryRecord;

// Type for processedData field in database records
type ProcessedDataRecord = {
  isDuplicate?: boolean;
  duplicateOf?: string;
  consolidationReason?: string;
  markedAsDuplicateAt?: Date;
  consolidatedAt?: Date;
  consolidatedFrom?: string[];
  consolidationHistory?: Array<{
    timestamp: Date;
    consolidatedFrom: string[];
    consolidationReason: string;
    originalImportance: string;
    originalClassification: string;
    duplicateCount: number;
    dataIntegrityHash: string;
  }>;
  originalImportance?: string;
  originalClassification?: string;
  duplicateCount?: number;
  lastConsolidationActivity?: Date;
  conflictResolutionCount?: number;
  lastConflictResolution?: Date;
  relationshipCleanupCount?: number;
  lastRelationshipCleanup?: Date;
  cleanedUp?: boolean;
  cleanedUpAt?: Date;
  cleanupReason?: string;
  rollbackTimestamp?: Date;
  rollbackReason?: string;
  isConsolidated?: boolean;
  consolidatedInto?: string;
  originalDataHash?: string;
  consolidationMetadata?: {
    consolidationMethod: string;
    primaryMemoryClassification: string;
    primaryMemoryImportance: string;
    dataMerged: boolean;
  };
  [key: string]: unknown;
};

// Type for Prisma transaction context




/**
 * DatabaseManager Facade - Coordinates all database operations
 *
 * This facade maintains backward compatibility while delegating operations
 * to specialized managers for better separation of concerns and maintainability.
 */
export class DatabaseManager {
  private databaseContext: DatabaseContext;
  private chatHistoryManager: ChatHistoryManager;
  private memoryManager: MemoryManager;
  private searchManager: SearchManager;
  private relationshipManager: RelationshipManager;
  private duplicateManager: DuplicateManager;
  private statisticsManager: StatisticsManager;
  private consciousMemoryManager: ConsciousMemoryManager;
  private performanceMonitor: PerformanceMonitor;
  private ftsManager: FTSManager;
  private stateManager?: StateManager;

  // Additional properties for SearchService, SearchIndexManager, and FTS support
  private searchService?: SearchService;
  private searchIndexManager?: SearchIndexManager;
  private ftsEnabled: boolean = false;
  private initializationInProgress: boolean = false;

  // Prisma client reference
  private prisma: PrismaClient;

  // Performance monitoring properties
  private performanceMetrics: {
    totalOperations: number;
    successfulOperations: number;
    failedOperations: number;
    averageOperationTime: number;
    lastOperationTime: Date;
    errorRate: number;
    memoryUsage: number;
    peakMemoryUsage: number;
    operationBreakdown: Map<string, number>;
    errorBreakdown: Map<string, number>;
    trends: PerformanceTrend[];
    metadata: {
      component: string;
      databaseType: string;
      connectionCount: number;
      queryLatency: number;
      slowQueries: Array<{ query: string; duration: number; timestamp: number }>;
    };
  } = {
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

  private performanceConfig: DatabasePerformanceConfig = {
    enabled: true,
    slowQueryThreshold: 1000,
    trackSlowQueries: true,
    maxSlowQueryHistory: 100,
    enableQueryAnalysis: true,
    collectionInterval: 60000,
  };

  private operationMetrics: DatabaseOperationMetrics[] = [];
  private maxOperationHistory: number = 1000;

  constructor(databaseUrl: string) {
    // Initialize DatabaseContext with shared database infrastructure
    this.databaseContext = new DatabaseContext({
      databaseUrl,
      enablePerformanceMonitoring: true,
      enableFTS: true,
      performanceConfig: {
        enabled: true,
        slowQueryThreshold: 1000,
        trackSlowQueries: true,
        maxSlowQueryHistory: 100,
        enableQueryAnalysis: true,
        collectionInterval: 60000,
      },
      stateManagerConfig: {
        enableHistoryTracking: true,
        enableMetrics: true,
        maxHistoryEntries: 100,
      },
    });

    // Initialize all specialized managers with proper dependency injection
    this.chatHistoryManager = new ChatHistoryManager(this.databaseContext);

    // MemoryManager needs StateManager, so create it first
    this.stateManager = new StateManager(this.databaseContext, {
      enableHistoryTracking: true,
      enableMetrics: true,
      maxHistoryEntries: 100,
    });

    this.memoryManager = new MemoryManager(this.databaseContext, {
      enableStateTracking: true,
      enableValidation: true,
      maxContentLength: 10000,
      defaultNamespace: 'default',
    });

    // Initialize Prisma client first
    this.prisma = this.databaseContext.getPrismaClient();

    // Initialize FTS schema before creating any managers that depend on it
    this.initializeFTSSchema();

    // Initialize FTSManager after FTS schema is ready
    this.ftsManager = new FTSManager(this.prisma);

    this.searchManager = new SearchManager(this.ftsManager);

    // Initialize managers with complex dependencies
    const transactionCoordinator = new TransactionCoordinator(this.databaseContext);

    this.duplicateManager = new DuplicateManager(
      this.databaseContext,
      this.memoryManager,
      transactionCoordinator,
      this.searchManager,
      this.stateManager,
    );

    this.relationshipManager = new RelationshipManager(this.databaseContext);
    this.statisticsManager = new StatisticsManager(this.databaseContext);
    this.consciousMemoryManager = new ConsciousMemoryManager(
      this.databaseContext,
      this.memoryManager,
    );
    this.performanceMonitor = new PerformanceMonitor({
      enabled: true,
      slowQueryThreshold: 1000,
      trackSlowQueries: true,
      maxSlowQueryHistory: 100,
      enableQueryAnalysis: true,
      collectionInterval: 60000,
    });
  }

  /**
   * Get PrismaClient instance for direct database access
   */
  getPrismaClient() {
    return this.databaseContext.getPrismaClient();
  }

  /**
     * Initialize or get the SearchService instance
     */
  public async getSearchService(): Promise<SearchService> {
    if (!this.searchService) {
      this.searchService = new SearchService(this);
      // Ensure async initialization is completed
      await this.searchService.initializeAsync();
    }
    return this.searchService;
  }

  /**
   * Initialize or get the SearchIndexManager instance
   */
  public getSearchIndexManager(): SearchIndexManager {
    if (!this.searchIndexManager) {
      // Ensure FTS is ready before creating SearchIndexManager
      if (!this.ftsEnabled) {
        this.initializeFTSSchema();
      }
      this.searchIndexManager = new SearchIndexManager(this);
    }
    return this.searchIndexManager;
  }



  async storeChatHistory(data: ChatHistoryData): Promise<string> {
    return this.chatHistoryManager.storeChatHistory(data);
  }

  async storeLongTermMemory(
    memoryData: ProcessedLongTermMemory,
    chatId: string,
    namespace: string,
  ): Promise<string> {
    return this.memoryManager.storeLongTermMemory(memoryData, chatId, namespace);
  }

  async searchMemories(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
    return this.searchManager.searchMemories(query, options);
  }

  /**
   * Direct FTS search method for testing purposes (bypasses SearchManager logic)
   */
  public async searchMemoriesFTS(query: string, options: SearchOptions): Promise<MemorySearchResult[]> {
    try {
      // Validate inputs first before any database operations
      if (options.namespace && options.namespace.length > 100) {
        throw new Error('Namespace exceeds maximum length');
      }

      // Ensure FTS support is initialized before using it
      await this.ensureFTSSupport();
      const limit = Math.min(options.limit || 10, 1000); // Cap limit for security

      // Enhanced sanitization for query and options
      const sanitizedQuery = query.trim();
      const sanitizedNamespace = options.namespace || 'default';

      // Build FTS query with proper escaping and phrase handling
      const ftsQuery = this.buildFTSQuery(sanitizedQuery);

      // Build metadata filters with parameterized values
      const metadataFilters: string[] = [];
      const queryParams: any[] = [];

      // Always add namespace filter first
      metadataFilters.push('namespace = $1');
      queryParams.push(sanitizedNamespace);

      if (options.minImportance) {
        const minScore = this.calculateImportanceScore(options.minImportance);
        metadataFilters.push(`json_extract(metadata, '$.importance_score') >= $${metadataFilters.length + 1}`);
        queryParams.push(minScore);
      }

      if (options.categories && options.categories.length > 0) {
        // Validate categories
        const validCategories = options.categories.filter(cat =>
          cat && typeof cat === 'string' && cat.trim().length > 0,
        );

        if (validCategories.length > 0) {
          const placeholders = validCategories.map((_, index) => `$${metadataFilters.length + index + 1}`).join(',');
          metadataFilters.push(`json_extract(metadata, '$.category_primary') IN (${placeholders})`);
          queryParams.push(...validCategories);
        }
      }

      // Add the FTS query parameter
      queryParams.push(ftsQuery);

      // Add the limit parameter
      queryParams.push(limit);

      const whereClause = metadataFilters.length > 0 ? `WHERE ${metadataFilters.join(' AND ')}` : '';

      // Use parameterized query to prevent SQL injection
      const queryString = `
        SELECT
          fts.rowid as memory_id,
          fts.content as searchable_content,
          fts.metadata,
          bm25(memory_fts, 1.0, 1.0, 1.0) as search_score,
          'fts5' as search_strategy
        FROM memory_fts fts
        ${whereClause}
        AND memory_fts MATCH $${queryParams.length}
        ORDER BY bm25(memory_fts, 1.0, 1.0, 1.0) DESC
        LIMIT $${queryParams.length + 1}
      `;

      const rawResults = await this.prisma.$queryRawUnsafe(queryString, ...queryParams, limit);

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
      logError('FTS search failed', {
        component: 'DatabaseManager',
        query,
        options,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
   * Get memory data by ID and type (helper for FTS search)
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

  private calculateImportanceScore(level: string): number {
    const scores = {
      [MemoryImportanceLevel.CRITICAL]: 0.9,
      [MemoryImportanceLevel.HIGH]: 0.7,
      [MemoryImportanceLevel.MEDIUM]: 0.5,
      [MemoryImportanceLevel.LOW]: 0.3,
    };
    return scores[level as MemoryImportanceLevel] || 0.5;
  }

  private validateRelationships(relationships: MemoryRelationship[]): { valid: MemoryRelationship[], invalid: Array<{ relationship: MemoryRelationship, reason: string }> } {
    const valid: MemoryRelationship[] = [];
    const invalid: Array<{ relationship: MemoryRelationship, reason: string }> = [];

    for (const relationship of relationships) {
      if (relationship.type && relationship.reason && relationship.context) {
        valid.push(relationship);
      } else {
        invalid.push({ relationship, reason: 'Missing required fields' });
      }
    }

    return { valid, invalid };
  }


  async close(): Promise<void> {
    // Cleanup search index manager
    if (this.searchIndexManager) {
      this.searchIndexManager.cleanup();
    }

    // Cleanup database context to stop health monitoring and other resources
    if (this.databaseContext) {
      await this.databaseContext.cleanup();
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
    return this.relationshipManager.storeMemoryRelationships(memoryId, relationships, namespace);
  }

  /**
   * Query memories by relationship type
   * Returns memories that have relationships of the specified type
   */
  async getMemoriesByRelationship(
    query: RelationshipQuery,
  ): Promise<Array<{
    memory: DatabaseRecord;
    relationships: MemoryRelationship[];
    matchReason: string;
  }>> {
    return this.relationshipManager.getMemoriesByRelationship(query);
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
    memory: DatabaseRecord;
    relationship: MemoryRelationship;
    direction: 'incoming' | 'outgoing';
  }>> {
    return this.relationshipManager.getRelatedMemories(memoryId, options);
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
            relatedMemoriesJson: generalRelationships,
            supersedesJson: supersedingRelationships,
            processedData: {
              ...(memory.processedData as ProcessedDataRecord),
              conflictResolutionCount: (memory.processedData as ProcessedDataRecord)?.conflictResolutionCount || 0 + 1,
              lastConflictResolution: new Date(),
            },
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
                  relatedMemoriesJson: generalRelationships,
                  supersedesJson: supersedingRelationships,
                  processedData: {
                    ...(memory.processedData as ProcessedDataRecord),
                    relationshipCleanupCount: (memory.processedData as ProcessedDataRecord)?.relationshipCleanupCount || 0 + 1,
                    lastRelationshipCleanup: new Date(),
                  } as Prisma.InputJsonValue,
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
  getStateManager(): StateManager {
    return this.stateManager!;
  }

  /**
   * Get memories by processing state
   */
  async getMemoriesByState(
    state: MemoryProcessingState,
    namespace: string = 'default',
    limit?: number,
  ): Promise<string[]> {
    const memoryIds = await this.stateManager!.getMemoriesByState(state);
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
    return this.stateManager!.getMemoryState(memoryId);
  }

  /**
   * Get memory state history
   */
  async getMemoryStateHistory(memoryId: string): Promise<MemoryStateTransition[]> {
    return this.stateManager!.getMemoryStateHistory(memoryId);
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
    return this.stateManager!.transitionMemoryState(memoryId, toState, options);
  }

  /**
   * Get processing state statistics
   */
  async getProcessingStateStats(namespace?: string): Promise<Record<MemoryProcessingState, number>> {
    // If namespace filter is provided, we need to count only memories in that namespace
    if (namespace && namespace !== 'default') {
      const filteredStats: Record<MemoryProcessingState, number> = {} as Record<MemoryProcessingState, number>;
      Object.values(MemoryProcessingState).forEach(state => {
        filteredStats[state] = 0;
      });

      // Get all memory IDs for each state and filter by namespace
      for (const state of Object.values(MemoryProcessingState)) {
        const memoryIds = await this.stateManager!.getMemoriesByState(state);
        for (const memoryId of memoryIds) {
          try {
            const memory = await this.prisma.longTermMemory.findUnique({
              where: { id: memoryId },
              select: { namespace: true },
            }) as { namespace: string } | null;
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

    // Use the StateManager's built-in namespace support
    return this.stateManager!.getProcessingStateStats(namespace);
  }

  /**
   * Initialize memory state (for existing memories without state tracking)
   */
  async initializeExistingMemoryState(
    memoryId: string,
    initialState: MemoryProcessingState = MemoryProcessingState.PENDING,
  ): Promise<void> {
    await this.stateManager!.initializeExistingMemoryState(memoryId, initialState);
  }

  /**
   * Get all memory states
   */
  async getAllMemoryStates(): Promise<Record<string, MemoryProcessingState>> {
    return this.stateManager!.getAllMemoryStates();
  }

  /**
   * Check if memory can transition to specific state
   */
  async canMemoryTransitionTo(memoryId: string, toState: MemoryProcessingState): Promise<boolean> {
    return this.stateManager!.canMemoryTransitionTo(memoryId, toState);
  }

  /**
   * Retry failed memory state transition
   */
  async retryMemoryStateTransition(
    memoryId: string,
    targetState: MemoryProcessingState,
    options?: { maxRetries?: number; delayMs?: number },
  ): Promise<boolean> {
    return this.stateManager!.retryMemoryStateTransition(memoryId, targetState, options);
  }

  /**
   * Get processing metrics
   */
  async getProcessingMetrics(): Promise<Record<string, number>> {
    return this.stateManager!.getProcessingMetrics();
  }

  /**
   * Check if FTS5 search is enabled
   */
  isFTSEnabled(): boolean {
    return this.ftsEnabled;
  }

  /**
   * Initialize FTS schema during DatabaseManager construction
   */
  private async initializeFTSSchema(): Promise<void> {
    try {
      logInfo('Initializing FTS schema during DatabaseManager startup...', {
        component: 'DatabaseManager',
      });

      // First try to initialize the schema
      const initialized = await initializeSearchSchema(this.prisma);

      if (initialized) {
        logInfo('FTS schema initialized successfully', {
          component: 'DatabaseManager',
        });
        this.ftsEnabled = true;
      } else {
        logError('FTS schema initialization returned false - may need manual intervention', {
          component: 'DatabaseManager',
        });
        this.ftsEnabled = false;
      }

    } catch (error) {
      logError('Failed to initialize FTS schema during startup', {
        component: 'DatabaseManager',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      this.ftsEnabled = false;
      // Don't throw here - let the system continue even if FTS fails
    }
  }

  /**
   * Ensure FTS support is properly initialized (only when needed)
   */
  private async ensureFTSSupport(): Promise<void> {
    if (this.ftsEnabled) return;

    try {
      // Only verify if we haven't already initialized successfully
      if (!this.ftsEnabled) {
        const verification = await verifyFTSSchema(this.prisma);
        this.ftsEnabled = verification.isValid;

        if (!this.ftsEnabled) {
          logError('FTS support verification failed', {
            component: 'DatabaseManager',
            issues: verification.issues,
          });
        } else {
          logInfo('FTS support verified and enabled', {
            component: 'DatabaseManager',
            stats: verification.stats,
          });
        }
      }
    } catch (error) {
      logError('Failed to verify FTS support', {
        component: 'DatabaseManager',
        error: error instanceof Error ? error.message : String(error),
      });
      this.ftsEnabled = false;
    }
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
    return this.consciousMemoryManager.getUnprocessedConsciousMemories(namespace);
  }

  async getNewConsciousMemories(since: Date = new Date(Date.now() - 24 * 60 * 60 * 1000), namespace: string = 'default'): Promise<ConsciousMemoryData[]> {
    return this.consciousMemoryManager.getNewConsciousMemories(since, namespace);
  }

  async storeConsciousMemoryInShortTerm(memoryData: ShortTermMemoryData, namespace: string): Promise<string> {
    return this.consciousMemoryManager.storeConsciousMemoryInShortTerm(memoryData, namespace);
  }

  async getConsciousMemoriesFromShortTerm(namespace: string): Promise<ConsciousMemoryData[]> {
    return this.consciousMemoryManager.getConsciousMemoriesFromShortTerm(namespace);
  }


  async markConsciousMemoryAsProcessed(memoryId: string): Promise<void> {
    return this.consciousMemoryManager.markConsciousMemoryAsProcessed(memoryId);
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

    return memories.map((memory) => ({
      id: memory.id,
      content: memory.searchableContent,
      summary: memory.summary,
      classification: memory.classification as unknown as MemoryClassification,
      importance: memory.memoryImportance as unknown as MemoryImportanceLevel,
      topic: memory.topic ?? undefined,
      entities: (memory.entitiesJson as unknown[]) as string[] || [],
      keywords: (memory.keywordsJson as unknown[]) as string[] || [],
      confidenceScore: memory.confidenceScore,
      classificationReason: memory.classificationReason ?? '',
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


  // Duplicate Consolidation Operations

  /**
   * Find potential duplicate memories based on content similarity
   */
  async findPotentialDuplicates(
    content: string,
    namespace: string = 'default',
    threshold: number = 0.7,
  ): Promise<MemorySearchResult[]> {
    return this.duplicateManager.findPotentialDuplicates(content, namespace, threshold);
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
          } as Prisma.InputJsonValue,
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
      const updatePromises = updates.map(async (update: { memoryId: string; isDuplicate?: boolean; duplicateOf?: string; consolidationReason?: string; markedAsDuplicateAt?: Date }) => {
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
                ...(existingMemory.processedData as Record<string, unknown> || {}),
                ...update,
                updatedAt: new Date(),
              } as Prisma.InputJsonValue,
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
                ...(primaryMemory.processedData as Record<string, unknown>)?.consolidationHistory as unknown[] || [],
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
            } as Prisma.InputJsonValue,
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
              } as Prisma.InputJsonValue,
              // Mark in searchable content for easy identification
              searchableContent: `[CONSOLIDATED:${consolidationTimestamp.toISOString()}] ${duplicateMemory?.searchableContent}`,
            },
          });
        }

        // Update state tracking for successful consolidation
        try {
          await this.stateManager!.transitionMemoryState(
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
          namespace,
        },
        select: { id: true, namespace: true, processedData: true },
      });

      if (duplicateMemories.length !== duplicateIds.length) {
        const foundIds = duplicateMemories.map((m) => m.id);
        const missingIds = duplicateIds.filter(id => !foundIds.includes(id));
        errors.push(`Some duplicate memories not found in namespace ${namespace}: ${missingIds.join(', ')}`);
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
            } as Prisma.InputJsonValue,
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
              } as Prisma.InputJsonValue,
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
          } as Record<string, unknown>,
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

        const similarMemories = allMemories.filter((otherMemory: any) => {
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
          similarMemories.forEach((mem: any) => processedIds.add(mem.id));
        }
      }

      // Get last consolidation activity
      const lastConsolidation = await this.prisma.longTermMemory.findFirst({
        where: {
          namespace,
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
              } as Record<string, unknown>,
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
                  ...(memory.processedData as Record<string, unknown> || {}),
                  cleanedUp: true,
                  cleanedUpAt: new Date(),
                  cleanupReason: `Older than ${olderThanDays} days`,
                } as Prisma.InputJsonValue,
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
    return this.statisticsManager.getDatabaseStats(namespace);
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
    // Simple check - try to execute a simple query
    return true; // Placeholder - would need actual connection check
  }
}