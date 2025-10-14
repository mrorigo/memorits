// src/index.ts
// Core exports (backward compatibility)
export { Memori } from './core/Memori';
export { ConfigManager } from './core/infrastructure/config/ConfigManager';

// Search Strategy enum and types for public API access
export { SearchStrategy } from './core/domain/search/types';

// Core type exports for enhanced API access
export type {
  MemorySearchResult,
  RecordConversationOptions,
  SearchOptions,
  TemporalFilterOptions,
  DatabaseStats,
  TimeRange,
  SortOption,
  MetadataFilterOptions,
  MemoriConfig,
} from './core/types/models';

// Performance monitoring exports for enterprise monitoring
export { PerformanceDashboardService } from './core/performance/PerformanceDashboard';
export { PerformanceAnalyticsService } from './core/performance/PerformanceAnalyticsService';

// createMemoriOpenAI from old integration - DEPRECATED: Use MemoriOpenAIClient factory functions instead
export { ProcessedLongTermMemorySchema } from './core/types/schemas';

// Search Strategy exports (new architecture)
export {
  ISearchStrategy,
  BaseSearchStrategy,
  SearchResultBuilder,
  SearchError,
  SearchStrategyError,
  SearchValidationError,
  SearchTimeoutError,
  SearchConfigurationError,
  StrategyValidator,
  SearchCapability,
  SearchQuery,
  SearchResult,
  SearchStrategyMetadata,
  SearchStrategyConfig,
  ValidationResult
} from './core/domain/search/SearchStrategy';

// OpenAI Drop-in Replacement exports
// Main client and types
export { default as MemoriOpenAIClient, MemoriOpenAI, MemoriOpenAIConfig } from './integrations/openai-dropin/client';

// Factory functions and classes
export { MemoriOpenAIFactory, memoriOpenAIFactory } from './integrations/openai-dropin/factory';
export {
  createMemoriOpenAI as createMemoriOpenAIFactory,
  MemoriOpenAIFromConfig,
  MemoriOpenAIFromEnv,
  MemoriOpenAIFromDatabase,
} from './integrations/openai-dropin/factory';

// Type re-exports for type safety
export type {
  // OpenAI SDK compatibility types
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  ChatCompletionMessage,
  ChatCompletionMessageParam,
  ChatCompletionRole,
  Embedding,
  EmbeddingCreateParams,
  CreateEmbeddingResponse,
  Chat,
  Embeddings,

  // Memory processing types
  MemoryProcessingMode,
  MemoryImportanceFilter,
  DatabaseType,
  DatabaseConfig,

  // Streaming types
  StreamingMetadata,
  BufferedStream,
  StreamingBufferConfig,

  // Memory recording types
  OpenAIMemoryMetadata,
  RecordChatCompletionOptions,
  RecordEmbeddingOptions,
  MemoryRecordingResult,

  // Factory and configuration types
  MemoriOpenAIConstructorOptions,
  MemoriOpenAIEnvironment,

  // Memory manager types
  MemoryManager,
  ConversationRecorder,
  StreamingBuffer,

  // Error handling types
  MemoryErrorType,
  MemoryError,
  RecoveryStrategy,
  ErrorRecoveryConfig,

  // Metrics and monitoring types
  OpenAIMetrics,
  PerformanceMonitorConfig,

  // Main interfaces
  ChatProxyInterface,

  // Utility types
  DeepPartial,
  OptionalConfigKeys,
  RequiredConfigKeys,

} from './integrations/openai-dropin/types';