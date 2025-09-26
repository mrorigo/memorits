// Search Strategy Enum
export enum SearchStrategy {
  FTS5 = 'fts5',
  LIKE = 'like',
  RECENT = 'recent',
  SEMANTIC = 'semantic'
}

// Filter Types
export interface SearchFilter {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'contains' | 'like';
  value: any;
}

export interface SortCriteria {
  field: string;
  direction: 'asc' | 'desc';
}

// Search Query Model
export interface SearchQuery {
  text: string;
  filters?: SearchFilter[];
  limit?: number;
  offset?: number;
  sortBy?: SortCriteria;
  includeMetadata?: boolean;
}

// Search Result Model
export interface SearchResult {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  score: number;
  strategy: string;
  timestamp: Date;
}

// Search Strategy Interface - Updated to match new architecture
export interface ISearchStrategy {
  readonly name: SearchStrategy;
  readonly priority: number;
  readonly supportedMemoryTypes: readonly ('short_term' | 'long_term')[];

  canHandle(query: SearchQuery): boolean;
  execute(query: SearchQuery, dbManager: any): Promise<SearchResult[]>;
  getMetadata(): import('./SearchStrategy').SearchStrategyMetadata;
  validateConfiguration(): Promise<boolean>;
}

// Import new interfaces from SearchStrategy
export type {
  SearchCapability,
  SearchResult as EnhancedSearchResult,
  SearchStrategyMetadata,
  SearchStrategyConfig,
  ValidationResult
} from './SearchStrategy';

// Search Service Interface
export interface ISearchService {
  search(query: SearchQuery): Promise<SearchResult[]>;
  searchWithStrategy(query: SearchQuery, strategy: SearchStrategy): Promise<SearchResult[]>;
  getAvailableStrategies(): SearchStrategy[];
  getStrategy(name: string): ISearchStrategy | null;
}

// Error Types
export class SearchError extends Error {
  constructor(
    message: string,
    public readonly strategy?: SearchStrategy,
    public readonly query?: SearchQuery,
    public readonly cause?: Error,
  ) {
    super(message);
    this.name = 'SearchError';
  }
}

export class StrategyNotFoundError extends SearchError {
  constructor(strategy: SearchStrategy) {
    super(`Search strategy '${strategy}' not found`, strategy);
    this.name = 'StrategyNotFoundError';
  }
}

export class SearchTimeoutError extends SearchError {
  constructor(strategy: SearchStrategy, timeout: number) {
    super(`Search strategy '${strategy}' timed out after ${timeout}ms`, strategy);
    this.name = 'SearchTimeoutError';
  }
}