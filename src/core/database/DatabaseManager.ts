import { MemoryImportanceLevel, MemoryClassification, ProcessedLongTermMemory } from '../types/schemas';
import { MemorySearchResult, SearchOptions, DatabaseStats } from '../types/models';
import { logInfo, logError } from '../utils/Logger';
import { MemoryRelationship, MemoryRelationshipType } from '../types/schemas';
import { DatabaseContext } from './DatabaseContext';
import { ChatHistoryManager } from './ChatHistoryManager';
import { MemoryManager } from './MemoryManager';
import { SearchManager } from './SearchManager';
import { RelationshipManager } from './RelationshipManager';
import { RelationshipService } from './RelationshipService';
import { StateService } from './StateService';
import { PerformanceService } from './PerformanceService';
import { DuplicateManager } from './DuplicateManager';
import { StatisticsManager } from './StatisticsManager';
import { ConsciousMemoryManager } from './ConsciousMemoryManager';
import { FTSManager } from './FTSManager';
import { StateManager } from './StateManager';
import { TransactionCoordinator } from './TransactionCoordinator';
import { ChatHistoryData, ConsciousMemoryData, ShortTermMemoryData, RelationshipQuery, DatabaseOperationMetrics, DatabasePerformanceConfig } from './types';
import { SearchService } from '../search/SearchService';
import { SearchIndexManager } from '../search/SearchIndexManager';
import { verifyFTSSchema, initializeSearchSchema } from './init-search-schema';
import { MemoryStateTransition, MemoryProcessingState } from '../memory/MemoryProcessingStateManager';
import { PerformanceMetrics } from '../types/base';
import { createHash } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { MemoryConsolidationService } from './MemoryConsolidationService';
import { RepositoryFactory } from './factories/RepositoryFactory';
import { ConsolidationService } from './interfaces/ConsolidationService';

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
  private relationshipService?: RelationshipService;
  private stateService?: StateService;
  private performanceService?: PerformanceService;
  private duplicateManager: DuplicateManager;
  private statisticsManager: StatisticsManager;
  private consciousMemoryManager: ConsciousMemoryManager;
  private ftsManager: FTSManager;
  private stateManager?: StateManager;

  // Additional properties for SearchService, SearchIndexManager, and FTS support
  private searchService?: SearchService;
  private searchIndexManager?: SearchIndexManager;
  private ftsEnabled: boolean = false;
  private initializationInProgress: boolean = false;

  // Consolidation service for memory consolidation operations
  private consolidationService: ConsolidationService;

  // Prisma client reference
  private prisma: PrismaClient;


  constructor(
    databaseUrl: string,
    consolidationService?: ConsolidationService
  ) {
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

    // Initialize FTSManager - schema will be initialized lazily when needed
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
    this.relationshipService = new RelationshipService(this.databaseContext, this.relationshipManager);
    this.stateService = new StateService(this.databaseContext, this.stateManager!);
    this.performanceService = new PerformanceService(this.databaseContext.getPerformanceMonitoringConfig());
    this.statisticsManager = new StatisticsManager(this.databaseContext);
    this.consciousMemoryManager = new ConsciousMemoryManager(
      this.databaseContext,
      this.memoryManager,
    );

    // Initialize consolidation service
    this.consolidationService = consolidationService || new MemoryConsolidationService(
      RepositoryFactory.createConsolidationRepository(this.prisma)
    );
  }

  /**
   * Get PrismaClient instance for direct database access
   */
  getPrismaClient() {
    return this.databaseContext.getPrismaClient();
  }

  /**
   * Get ConsolidationService instance for consolidation operations
   */
  getConsolidationService(): ConsolidationService {
    return this.consolidationService;
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
    return this.relationshipService!.storeMemoryRelationships(memoryId, relationships, namespace);
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
    return this.relationshipService!.getMemoriesByRelationship(query);
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
    return this.relationshipService!.getRelatedMemories(memoryId, options);
  }




  /**
   * Detect and resolve relationship conflicts
   */
  async resolveRelationshipConflicts(
    memoryId: string,
    namespace: string = 'default',
  ): Promise<{ resolved: number, conflicts: Array<{ type: string, description: string }> }> {
    return this.relationshipService!.resolveRelationshipConflicts(memoryId, namespace);
  }




  // Memory State Management Operations


  /**
   * Get memories by processing state
   */
  async getMemoriesByState(
    state: MemoryProcessingState,
    namespace: string = 'default',
    limit?: number,
  ): Promise<string[]> {
    return this.stateService!.getMemoriesByState(state, namespace, limit);
  }

  /**
   * Get memory processing state
   */
  async getMemoryState(memoryId: string): Promise<MemoryProcessingState | undefined> {
    return this.stateService!.getMemoryState(memoryId);
  }

  /**
   * Get memory state history
   */
  async getMemoryStateHistory(memoryId: string): Promise<MemoryStateTransition[]> {
    return this.stateService!.getMemoryStateHistory(memoryId);
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
    return this.stateService!.transitionMemoryState(memoryId, toState, options);
  }

  /**
   * Get processing state statistics
   */
  async getProcessingStateStats(namespace?: string): Promise<Record<MemoryProcessingState, number>> {
    return this.stateService!.getProcessingStateStats(namespace);
  }

  /**
   * Initialize memory state (for existing memories without state tracking)
   */
  async initializeExistingMemoryState(
    memoryId: string,
    initialState: MemoryProcessingState = MemoryProcessingState.PENDING,
  ): Promise<void> {
    await this.stateService!.initializeExistingMemoryState(memoryId, initialState);
  }

  /**
   * Get all memory states
   */
  async getAllMemoryStates(): Promise<Record<string, MemoryProcessingState>> {
    return this.stateService!.getAllMemoryStates();
  }

  /**
   * Check if memory can transition to specific state
   */
  async canMemoryTransitionTo(memoryId: string, toState: MemoryProcessingState): Promise<boolean> {
    return this.stateService!.canMemoryTransitionTo(memoryId, toState);
  }

  /**
   * Retry failed memory state transition
   */
  async retryMemoryStateTransition(
    memoryId: string,
    targetState: MemoryProcessingState,
    options?: { maxRetries?: number; delayMs?: number },
  ): Promise<boolean> {
    return this.stateService!.retryMemoryStateTransition(memoryId, targetState, options);
  }

  /**
   * Get processing metrics
   */
  async getProcessingMetrics(): Promise<Record<string, number>> {
    return this.stateService!.getProcessingMetrics();
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
    try {
      // Use consolidation service to detect duplicates
      const duplicateCandidates = await this.consolidationService.detectDuplicateMemories(content, threshold);

      // Convert DuplicateCandidate[] to MemorySearchResult[] for backward compatibility
      const results: MemorySearchResult[] = duplicateCandidates.map(candidate => ({
        id: candidate.id,
        content: candidate.content,
        summary: '', // Will be populated by repository if needed
        classification: 'unknown' as MemoryClassification,
        importance: 'medium' as MemoryImportanceLevel,
        topic: undefined,
        entities: [],
        keywords: [],
        confidenceScore: candidate.confidence,
        classificationReason: '',
        metadata: {
          searchScore: candidate.similarityScore,
          searchStrategy: 'duplicate_detection',
        },
      }));

      logInfo(`Found ${results.length} potential duplicates for content`, {
        component: 'DatabaseManager',
        contentLength: content.length,
        threshold,
        namespace,
        duplicatesFound: results.length,
      });

      return results;
    } catch (error) {
      logError('Error finding potential duplicates', {
        component: 'DatabaseManager',
        contentLength: content.length,
        threshold,
        namespace,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }




  /**
   * Consolidate duplicate memories by merging them into the primary memory
   */
  async consolidateDuplicateMemories(
    primaryMemoryId: string,
    duplicateIds: string[],
    namespace: string = 'default',
  ): Promise<{ consolidated: number; errors: string[] }> {
    try {
      // Use consolidation service to perform consolidation
      const result = await this.consolidationService.consolidateMemories(primaryMemoryId, duplicateIds);

      logInfo(`Consolidation completed for primary memory ${primaryMemoryId}`, {
        component: 'DatabaseManager',
        primaryMemoryId,
        consolidatedCount: result.consolidatedCount,
        namespace,
        success: result.success,
      });

      return {
        consolidated: result.consolidatedCount,
        errors: result.success ? [] : ['Consolidation failed'],
      };
    } catch (error) {
      const errorMsg = `Consolidation failed for primary memory ${primaryMemoryId}: ${error instanceof Error ? error.message : String(error)}`;

      logError(errorMsg, {
        component: 'DatabaseManager',
        primaryMemoryId,
        duplicateIds,
        namespace,
        error: error instanceof Error ? error.stack : String(error),
      });

      return {
        consolidated: 0,
        errors: [errorMsg],
      };
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
    try {
      // Use consolidation service to perform cleanup
      const result = await this.consolidationService.cleanupOldConsolidatedMemories(olderThanDays, dryRun);

      logInfo(`Cleanup completed for namespace '${namespace}'`, {
        component: 'DatabaseManager',
        namespace,
        cleaned: result.cleaned,
        skipped: result.skipped,
        errors: result.errors.length,
        olderThanDays,
        dryRun,
      });

      return {
        cleaned: result.cleaned,
        errors: result.errors,
        skipped: result.skipped,
      };
    } catch (error) {
      const errorMsg = `Error during cleanup of consolidated memories: ${error instanceof Error ? error.message : String(error)}`;

      logError(errorMsg, {
        component: 'DatabaseManager',
        namespace,
        olderThanDays,
        dryRun,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        cleaned: 0,
        errors: [errorMsg],
        skipped: 0,
      };
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
     if (this.performanceService) {
       this.performanceService.recordOperationMetrics(metrics);
     }
   }

  /**
   * Get database performance metrics
   */
  public getPerformanceMetrics(): PerformanceMetrics {
    return this.performanceService!.getPerformanceMetrics();
  }

  /**
   * Get recent database operation metrics
   */
  public getRecentOperationMetrics(limit: number = 100): DatabaseOperationMetrics[] {
    return this.performanceService!.getRecentOperationMetrics(limit);
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
    return this.performanceService!.getPerformanceAnalytics();
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
    return this.performanceService!.getDatabasePerformanceReport();
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
    return this.performanceService!.getPerformanceMonitoringStatus();
  }

  /**
   * Update database performance monitoring configuration
   */
  public updatePerformanceMonitoringConfig(config: Partial<DatabasePerformanceConfig>): void {
    this.performanceService!.updatePerformanceMonitoringConfig(config);
  }

  /**
   * Get database performance monitoring configuration
   */
  public getPerformanceMonitoringConfig(): DatabasePerformanceConfig {
    return this.performanceService!.getPerformanceMonitoringConfig();
  }

  /**
   * Clear database performance metrics
   */
  public clearPerformanceMetrics(): void {
    this.performanceService!.clearPerformanceMetrics();
  }
}