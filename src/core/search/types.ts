// Search Strategy Enum
export enum SearchStrategy {
  FTS5 = 'fts5',
  LIKE = 'like',
  RECENT = 'recent',
  SEMANTIC = 'semantic',
  CATEGORY_FILTER = 'category_filter',
  TEMPORAL_FILTER = 'temporal_filter',
  METADATA_FILTER = 'metadata_filter'
}

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

// Logger interface for consistent logging across strategies
export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
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

// Strategy configuration interface for type-safe configuration
export interface StrategyConfiguration {
  enabled: boolean;
  priority: number;
  timeout: number;
  maxResults: number;
  minScore: number;
  options?: Record<string, unknown>;
}

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

// Search Service Interface
export interface ISearchService {
  search(query: SearchQuery): Promise<SearchResult[]>;
  searchWithStrategy(query: SearchQuery, strategy: SearchStrategy): Promise<SearchResult[]>;
  getAvailableStrategies(): SearchStrategy[];
  getStrategy(name: string): ISearchStrategy | null;
}

// Custom error class that extends the imported SearchError
export class StrategyNotFoundError extends Error {
  constructor(strategy: SearchStrategy) {
    super(`Search strategy '${strategy}' not found`);
    this.name = 'StrategyNotFoundError';
  }
}