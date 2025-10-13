// src/index.ts
// Core exports (backward compatibility)
export { Memori } from './core/Memori';
export { ConfigManager } from './core/infrastructure/config/ConfigManager';
export { createMemoriOpenAI } from './integrations/openai';
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