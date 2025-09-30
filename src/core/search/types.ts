// Search Strategy Enum
export enum SearchStrategy {
  FTS5 = 'fts5',
  LIKE = 'like',
  RECENT = 'recent',
  SEMANTIC = 'semantic',
  CATEGORY_FILTER = 'category_filter',
  TEMPORAL_FILTER = 'temporal_filter',
  METADATA_FILTER = 'metadata_filter',
  RELATIONSHIP = 'relationship'
}

// Import relationship types from schemas
import { MemoryRelationshipType } from '../types/schemas';
import type { MemoryRelationship } from '../types/schemas';
import { SearchStrategyConfig as BaseSearchStrategyConfig } from '../types/base';

// Import and re-export interfaces from SearchStrategy
import type {
  SearchQuery,
  SearchResult,
  ISearchStrategy,
  SearchCapability,
  SearchStrategyMetadata,
  SearchStrategyConfig,
  ValidationResult,
  SearchError,
  SearchStrategyError,
  SearchValidationError,
  SearchTimeoutError,
  SearchConfigurationError,
  SearchDatabaseError,
  SearchParseError,
  SearchErrorContext,
  SearchErrorCategory,
} from './SearchStrategy';


export type {
  SearchQuery,
  SearchResult,
  ISearchStrategy,
  SearchCapability,
  SearchStrategyMetadata,
  SearchStrategyConfig,
  ValidationResult,
  SearchError,
  SearchStrategyError,
  SearchValidationError,
  SearchTimeoutError,
  SearchConfigurationError,
  SearchDatabaseError,
  SearchParseError,
  SearchErrorContext,
  SearchErrorCategory,
};

// Logger functionality is handled directly through Logger utility imports

// Backup metadata interface for tracking backup information
export interface BackupMetadata {
  id: string;
  strategyName: string;
  createdAt: Date;
  fileSize: number;
  strategyCount: number;
  checksum?: string;
}

// Database query result interface for type-safe database operations
export interface DatabaseQueryResult {
  memory_id: string;
  searchable_content: string;
  summary?: string;
  metadata: string;
  memory_type: string;
  category_primary: string;
  importance_score: number;
  created_at: string;
  search_score?: number;
  search_strategy?: string;
}

// Note: StrategyConfiguration removed - use SearchStrategyConfiguration instead

// Query parameters interface for type-safe query building
export interface QueryParameters {
  text?: string;
  limit?: number;
  offset?: number;
  filters?: Record<string, unknown>;
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  includeMetadata?: boolean;
  context?: Record<string, unknown>;
  categories?: string[];
  categoryHierarchy?: string[];
  categoryOperator?: 'AND' | 'OR' | 'HIERARCHY';
  enableRelevanceBoost?: boolean;
  enableAggregation?: boolean;
  minCategoryRelevance?: number;
  maxCategories?: number;
  createdAfter?: string;
  createdBefore?: string;
  minImportance?: number;
  maxImportance?: number;
  memoryType?: string;
  metadataFilters?: Record<string, unknown>;
}

// Search metadata interface for structured metadata handling
export interface SearchMetadata {
  strategy: string;
  success: boolean;
  createdAt: Date;
  error?: boolean;
  summary?: string;
  category?: string;
  importanceScore?: number;
  memoryType?: string;
  rawBM25Score?: number;
  searchScore?: number;
  searchStrategy?: string;
  modelUsed?: string;
  originalChatId?: string;
  extractionTimestamp?: Date;
  isDuplicate?: boolean;
  duplicateOf?: string;
  consolidationReason?: string;
  cleanedUp?: boolean;
  cleanedUpAt?: Date;
  cleanupReason?: string;
}

// Filter Types - keeping these as they're specific to types.ts
export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'like';
  value: string | number | boolean | string[] | number[] | Date;
}

export interface SortCriteria {
  field: string;
  direction: 'asc' | 'desc';
}

// Configuration Management Interfaces
export interface SearchStrategyConfiguration {
  strategyName: string;
  enabled: boolean;
  priority: number;
  timeout: number;
  maxResults: number;
  performance: {
    enableMetrics: boolean;
    enableCaching: boolean;
    cacheSize: number;
    enableParallelExecution: boolean;
  };
  scoring: {
    baseWeight: number;
    recencyWeight: number;
    importanceWeight: number;
    relationshipWeight: number;
  };
  strategySpecific?: Record<string, unknown>;
}

export interface ConfigurationSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required: string[];
  additionalProperties?: boolean;
}

export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  validatedConfig?: SearchStrategyConfiguration;
}

export interface ConfigurationManager {
  loadConfiguration(name: string): Promise<SearchStrategyConfiguration | null>;
  saveConfiguration(name: string, config: SearchStrategyConfiguration): Promise<void>;
  getConfigurationNames(): Promise<string[]>;
  deleteConfiguration(name: string): Promise<void>;
  validateConfiguration(config: SearchStrategyConfiguration): Promise<ConfigurationValidationResult>;
  getDefaultConfiguration(strategyName: string): SearchStrategyConfiguration;
  mergeConfigurations(base: SearchStrategyConfiguration, override: Partial<SearchStrategyConfiguration>): SearchStrategyConfiguration;
}

export interface ConfigurationPersistenceManager {
  save(config: SearchStrategyConfiguration): Promise<void>;
  load(strategyName: string): Promise<SearchStrategyConfiguration | null>;
  delete(strategyName: string): Promise<void>;
  list(): Promise<string[]>;
  backup(name: string): Promise<BackupMetadata>;
  restore(name: string, backupId: string): Promise<SearchStrategyConfiguration>;
  restoreWithValidation(name: string, backupId: string): Promise<SearchStrategyConfiguration>;
  listStrategyBackups(strategyName: string): Promise<BackupMetadata[]>;
  cleanupOldBackups(strategyName: string, maxBackups: number): Promise<void>;
  validateBackupIntegrity(backupId: string): Promise<boolean>;
  export(): Promise<Record<string, SearchStrategyConfiguration>>;
  import(configs: Record<string, SearchStrategyConfiguration>): Promise<void>;
}

export interface ConfigurationAuditEntry {
  timestamp: Date;
  action: 'create' | 'update' | 'delete' | 'load' | 'validate' | 'save' | 'import';
  strategyName: string;
  configurationName?: string;
  userId?: string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  success: boolean;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ConfigurationAuditManager {
  log(entry: ConfigurationAuditEntry): Promise<void>;
  getHistory(strategyName?: string, limit?: number): Promise<ConfigurationAuditEntry[]>;
  getChanges(strategyName: string, fromTimestamp: Date, toTimestamp: Date): Promise<ConfigurationAuditEntry[]>;
}

// Search Service Interface
export interface ISearchService {
  search(query: SearchQuery): Promise<SearchResult[]>;
  searchWithStrategy(query: SearchQuery, strategy: SearchStrategy): Promise<SearchResult[]>;
  getAvailableStrategies(): SearchStrategy[];
  getStrategy(name: string): ISearchStrategy | null;
}

// Relationship-based search interfaces
export interface RelationshipSearchQuery {
  startMemoryId?: string;
  maxDepth?: number;
  relationshipTypes?: MemoryRelationshipType[];
  minRelationshipStrength?: number;
  minRelationshipConfidence?: number;
  includeRelationshipPaths?: boolean;
  traversalStrategy?: 'breadth_first' | 'depth_first' | 'strength_weighted';
  targetMemoryId?: string;
  namespace?: string;
}

export interface RelationshipPath {
  memoryId: string;
  relationship: MemoryRelationship;
  path: string[];
  depth: number;
  cumulativeStrength: number;
  cumulativeConfidence: number;
}

export interface RelationshipSearchResult extends SearchResult {
  relationshipContext?: {
    paths: RelationshipPath[];
    distance: number;
    connectionStrength: number;
    relatedEntities: string[];
    relationshipTypes: MemoryRelationshipType[];
  };
}

// Custom error class that extends the imported SearchError
export class StrategyNotFoundError extends Error {
  constructor(strategy: SearchStrategy) {
    super(`Search strategy '${strategy}' not found`);
    this.name = 'StrategyNotFoundError';
  }
}