
import type OpenAI from 'openai';
import type {
  MemoryClassification,
  MemoryImportanceLevel,
  ConversationMetadata,
  RecordConversationOptions,
  MemorySearchResult,
} from '../../core/types/models';
import type { ConversationContext } from '../../core/types/schemas';

// =============================================================================
// OpenAI SDK Type Re-exports (100% Compatibility)
// =============================================================================

/**
 * Re-export core OpenAI SDK types for compatibility
 * Using OpenAI namespace types directly to avoid import issues
 */
export type ChatCompletion = OpenAI.ChatCompletion;
export type ChatCompletionChunk = OpenAI.ChatCompletionChunk;
export type ChatCompletionCreateParams = OpenAI.ChatCompletionCreateParams;
export type ChatCompletionMessage = OpenAI.ChatCompletionMessage;
export type ChatCompletionMessageParam = OpenAI.ChatCompletionMessageParam;
export type ChatCompletionRole = OpenAI.ChatCompletionRole;
export type Embedding = OpenAI.Embedding;
export type EmbeddingCreateParams = OpenAI.EmbeddingCreateParams;
export type CreateEmbeddingResponse = OpenAI.CreateEmbeddingResponse;
export type Chat = OpenAI.Chat;
export type Embeddings = OpenAI.Embeddings;

// =============================================================================
// Memory Processing Mode Types
// =============================================================================

/**
 * Memory processing modes for different ingestion strategies
 */
export type MemoryProcessingMode = 'auto' | 'conscious' | 'none';

/**
 * Memory filtering options for importance-based filtering
 */
export type MemoryImportanceFilter = MemoryImportanceLevel | 'all';

/**
 * Database configuration types
 */
export type DatabaseType = 'sqlite' | 'postgresql' | 'mysql' | 'mongodb';

export type DatabaseConfig = {
  type: DatabaseType;
  url: string;
  namespace?: string;
};

// =============================================================================
// Streaming Support Interfaces
// =============================================================================

/**
 * Metadata tracked during streaming response processing
 */
export interface StreamingMetadata {
  /** Model used for the request */
  model: string;
  /** Temperature setting used */
  temperature?: number;
  /** Maximum tokens setting */
  maxTokens?: number;
  /** Total tokens consumed */
  tokensUsed: number;
  /** Number of chunks processed */
  chunkCount: number;
  /** Total content length in characters */
  contentLength: number;
  /** Processing duration in milliseconds */
  duration: number;
  /** Whether the stream completed successfully */
  completed: boolean;
  /** Any errors encountered during streaming */
  errors?: string[];
}

/**
 * Buffered stream result containing complete response data
 */
export interface BufferedStream {
  /** All chunks from the streaming response */
  chunks: ChatCompletionChunk[];
  /** Complete concatenated content from all chunks */
  completeContent: string;
  /** Metadata about the streaming process */
  metadata: StreamingMetadata;
  /** Usage statistics from the response */
  usage?: ChatCompletion['usage'];
}

/**
 * Streaming buffer configuration options
 */
export interface StreamingBufferConfig {
  /** Maximum time to wait for stream completion (ms) */
  bufferTimeout: number;
  /** Maximum buffer size in characters */
  maxBufferSize: number;
  /** Whether to record memory for streaming responses */
  enableMemoryRecording: boolean;
  /** Memory processing mode for streaming */
  memoryProcessingMode: MemoryProcessingMode;
}

// =============================================================================
// Memory Recording Interfaces
// =============================================================================

/**
 * Memory recording metadata specific to OpenAI interactions
 */
export interface OpenAIMemoryMetadata extends Omit<ConversationMetadata, 'modelType'> {
  /** OpenAI model used */
  model: string;
  /** Model type (gpt, text-embedding, etc.) */
  modelType: 'chat' | 'embedding';
  /** API endpoint used */
  endpoint: 'chat/completions' | 'embeddings';
  /** Whether this was a streaming response */
  isStreaming: boolean;
  /** Request parameters used */
  requestParams: Record<string, unknown>;
  /** Response processing metadata */
  responseMetadata?: {
    finishReason?: string;
    contentFilterResults?: unknown[];
    systemFingerprint?: string;
  };
}

/**
 * Options for recording OpenAI chat completions
 */
export interface RecordChatCompletionOptions extends RecordConversationOptions {
  /** Whether to force memory recording regardless of configuration */
  forceRecording?: boolean;
  /** Custom metadata to include */
  additionalMetadata?: Record<string, unknown>;
  /** Whether this is a streaming completion */
  isStreaming?: boolean;
  /** Stream buffer configuration if streaming */
  streamingConfig?: StreamingBufferConfig;
}

/**
 * Options for recording OpenAI embeddings
 */
export interface RecordEmbeddingOptions {
  /** Input text that was embedded */
  input: string | string[] | number[] | number[][];
  /** Whether to record embedding memory */
  enableMemory: boolean;
  /** Custom metadata for the embedding */
  metadata?: ConversationMetadata;
  /** Importance level for the embedding memory */
  importance?: MemoryImportanceLevel;
  /** Classification for the embedding */
  classification?: MemoryClassification;
}

/**
 * Result of memory recording operation
 */
export interface MemoryRecordingResult {
  /** Whether the recording was successful */
  success: boolean;
  /** Chat ID if conversation was recorded */
  chatId?: string;
  /** Memory ID if memory was processed */
  memoryId?: string;
  /** Error message if recording failed */
  error?: string;
  /** Processing duration in milliseconds */
  duration: number;
  /** Memory classification applied */
  classification?: MemoryClassification;
  /** Memory importance level */
  importance?: MemoryImportanceLevel;
  /** Whether this was a streaming response */
  wasStreaming: boolean;
}

// =============================================================================
// Configuration Interface
// =============================================================================

/**
 * Comprehensive configuration interface for MemoriOpenAI
 * Supports all initialization patterns and configuration options
 */
export interface MemoriOpenAIConfig {
  // Core functionality
  /** Enable chat memory recording */
  enableChatMemory?: boolean;
  /** Enable embedding memory recording */
  enableEmbeddingMemory?: boolean;
  /** Memory processing mode */
  memoryProcessingMode?: MemoryProcessingMode;

  // Model configuration
  /** Model for chat completions */
  model?: string;
  /** Model for embeddings */
  embeddingModel?: string;
  /** Provider type to use */
  providerType?: 'openai' | 'ollama' | 'anthropic';

  // Initialization
  /** Auto-create Memori instance */
  autoInitialize?: boolean;
  /** Database configuration */
  databaseConfig?: DatabaseConfig;
  /** Memory namespace */
  namespace?: string;

  // Memory filtering
  /** Minimum importance level for memory storage */
  minImportanceLevel?: MemoryImportanceFilter;
  /** Maximum age of memories to keep (days) */
  maxMemoryAge?: number;
  /** Auto ingestion mode */
  autoIngest?: boolean;
  /** Conscious ingestion mode */
  consciousIngest?: boolean;

  // Performance tuning
  /** Streaming buffer timeout in milliseconds */
  bufferTimeout?: number;
  /** Maximum streaming buffer size in characters */
  maxBufferSize?: number;
  /** Background processing interval for conscious mode */
  backgroundUpdateInterval?: number;

  // OpenAI client options
  /** Override API key */
  apiKey?: string;
  /** Override base URL */
  baseUrl?: string;
  /** Organization ID */
  organization?: string;
  /** Project ID */
  project?: string;
  /** Request timeout */
  timeout?: number;
  /** Maximum number of retries */
  maxRetries?: number;
  /** Default headers */
  defaultHeaders?: Record<string, string>;

  // Advanced options
  /** Custom memory processing function */
  customMemoryProcessor?: (
    userInput: string,
    aiOutput: string,
    metadata: OpenAIMemoryMetadata
  ) => Promise<MemoryRecordingResult>;
  /** Custom error handler */
  customErrorHandler?: (error: Error, context: Record<string, unknown>) => void;
  /** Enable debug logging */
  debugMode?: boolean;
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Metrics collection interval */
  metricsInterval?: number;
}

// =============================================================================
// Factory Function Interfaces
// =============================================================================

/**
 * Factory function for creating MemoriOpenAI instances
 */
export interface MemoriOpenAIFactory {
  /**
   * Create instance with explicit Memori instance
   */
  createWithMemori(
    memori: any, // Will be typed as Memori when available
    apiKey: string,
    options?: MemoriOpenAIConfig
  ): Promise<MemoriOpenAI>;

  /**
   * Create instance from configuration object
   */
  fromConfig(
    apiKey: string,
    config: MemoriOpenAIConfig
  ): Promise<MemoriOpenAI>;

  /**
   * Create instance from environment variables
   */
  fromEnv(
    apiKey?: string,
    config?: Partial<MemoriOpenAIConfig>
  ): Promise<MemoriOpenAI>;

  /**
   * Create instance with database URL
   */
  fromDatabaseUrl(
    apiKey: string,
    databaseUrl: string,
    options?: Partial<MemoriOpenAIConfig>
  ): Promise<MemoriOpenAI>;
}

/**
 * Constructor options for MemoriOpenAI
 */
export interface MemoriOpenAIConstructorOptions extends MemoriOpenAIConfig {
  /** API key for OpenAI */
  apiKey: string;
  /** Additional OpenAI client options */
  clientOptions?: Record<string, unknown>;
}

// =============================================================================
// Memory Manager Interfaces
// =============================================================================

/**
 * Interface for managing memory recording and retrieval
 */
export interface MemoryManager {
  /** Record chat completion memory */
  recordChatCompletion(
    params: ChatCompletionCreateParams,
    response: ChatCompletion | AsyncIterable<ChatCompletionChunk>,
    options?: RecordChatCompletionOptions
  ): Promise<MemoryRecordingResult>;

  /** Record embedding memory */
  recordEmbedding(
    params: EmbeddingCreateParams,
    response: CreateEmbeddingResponse,
    options?: RecordEmbeddingOptions
  ): Promise<MemoryRecordingResult>;

  /** Search memories with query */
  searchMemories(
    query: string,
    options?: {
      limit?: number;
      minImportance?: MemoryImportanceLevel;
      namespace?: string;
    }
  ): Promise<MemorySearchResult[]>;

  /** Get memory statistics */
  getMemoryStats(): Promise<{
    totalConversations: number;
    totalMemories: number;
    shortTermMemories: number;
    longTermMemories: number;
    consciousMemories: number;
    lastActivity?: Date;
  }>;
}

/**
 * Conversation recorder interface
 */
export interface ConversationRecorder {
  /** Record a completed conversation */
  recordConversation(
    userInput: string,
    aiOutput: string,
    metadata: OpenAIMemoryMetadata
  ): Promise<string>;

  /** Record streaming conversation when stream completes */
  recordStreamingConversation(
    completeContent: string,
    metadata: StreamingMetadata,
    context: ConversationContext,
    userInput?: string
  ): Promise<string>;
}

/**
 * Streaming buffer interface
 */
export interface StreamingBuffer {
  /** Process streaming response and buffer content */
  processStream(
    stream: AsyncIterable<ChatCompletionChunk>,
    config: StreamingBufferConfig
  ): Promise<BufferedStream>;

  /** Check if buffer is ready for memory recording */
  isReadyForRecording(): boolean;

  /** Get current buffer statistics */
  getBufferStats(): {
    chunkCount: number;
    contentLength: number;
    isComplete: boolean;
    hasErrors: boolean;
  };
}

// =============================================================================
// Error Handling Types
// =============================================================================

/**
 * Memory-specific error types
 */
export enum MemoryErrorType {
  RECORDING_FAILED = 'recording_failed',
  PROCESSING_FAILED = 'processing_failed',
  STORAGE_FAILED = 'storage_failed',
  RETRIEVAL_FAILED = 'retrieval_failed',
  CONFIGURATION_ERROR = 'configuration_error',
  DATABASE_ERROR = 'database_error',
  STREAMING_ERROR = 'streaming_error',
  TIMEOUT_ERROR = 'timeout_error',
}

/**
 * Memory-specific error with context
 */
export class MemoryError extends Error {
  public readonly type: MemoryErrorType;
  public readonly context: Record<string, unknown>;
  public readonly recoverable: boolean;
  public readonly timestamp: Date;

  constructor(
    type: MemoryErrorType,
    message: string,
    context: Record<string, unknown> = {},
    recoverable: boolean = true,
  ) {
    super(message);
    this.name = 'MemoryError';
    this.type = type;
    this.context = context;
    this.recoverable = recoverable;
    this.timestamp = new Date();
  }
}

/**
 * Recovery strategies for failed operations
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  SKIP = 'skip',
  FALLBACK = 'fallback',
  MANUAL = 'manual',
}

/**
 * Error recovery configuration
 */
export interface ErrorRecoveryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Delay between retries in milliseconds */
  retryDelay: number;
  /** Recovery strategy to use */
  strategy: RecoveryStrategy;
  /** Whether to log recovery attempts */
  logRecovery: boolean;
  /** Custom recovery function */
  customRecovery?: (error: MemoryError) => Promise<boolean>;
}

// =============================================================================
// Metrics and Monitoring Types
// =============================================================================

/**
 * Metrics collected during operation
 */
export interface OpenAIMetrics {
  /** Total requests processed */
  totalRequests: number;
  /** Memory recording successes */
  memoryRecordingSuccess: number;
  /** Memory recording failures */
  memoryRecordingFailures: number;
  /** Average response time */
  averageResponseTime: number;
  /** Memory processing time */
  averageMemoryProcessingTime: number;
  /** Cache hit rate */
  cacheHitRate: number;
  /** Error rate */
  errorRate: number;
  /** Streaming vs non-streaming ratio */
  streamingRatio: number;
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceMonitorConfig {
  /** Whether to enable performance monitoring */
  enabled: boolean;
  /** Metrics collection interval in milliseconds */
  collectionInterval: number;
  /** Metrics retention period in days */
  retentionPeriod: number;
  /** Whether to export metrics */
  enableExport: boolean;
  /** Metrics export format */
  exportFormat: 'json' | 'prometheus' | 'custom';
}

// =============================================================================
// Main Client Interface
// =============================================================================

/**
 * Main MemoriOpenAI client interface
 * Implements the complete OpenAI SDK interface while adding memory functionality
 */
export interface MemoriOpenAI {
  // OpenAI SDK compatibility - exact same interface
  readonly chat: OpenAI.Chat;
  readonly embeddings: OpenAI.Embeddings;

  // Memory-specific functionality
  readonly memory: MemoryManager;

  // Configuration and control
  readonly config: MemoriOpenAIConfig;
  readonly isEnabled: boolean;
  readonly sessionId: string;

  // Lifecycle management
  enable(): Promise<void>;
  disable(): Promise<void>;
  close(): Promise<void>;

  // Utility methods
  getMetrics(): Promise<OpenAIMetrics>;
  resetMetrics(): Promise<void>;
  updateConfig(config: Partial<MemoriOpenAIConfig>): Promise<void>;
}

/**
 * ChatProxy interface for memory-enabled chat completions
 */
export interface ChatProxyInterface {
  /**
   * Create chat completion with memory recording
   */
  create(
    params: ChatCompletionCreateParams,
    options?: OpenAI.RequestOptions,
  ): Promise<OpenAI.ChatCompletion | AsyncIterable<OpenAI.ChatCompletionChunk>>;

  /**
   * Enable or disable memory recording
   */
  setEnabled(enabled: boolean): void;

  /**
   * Check if memory recording is enabled
   */
  isEnabled(): boolean;

  /**
   * Get the underlying OpenAI chat client
   */
  getOpenAIChat(): OpenAI.Chat;

  /**
   * Get the memory manager instance
   */
  getMemoryManager(): MemoryManager;
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Deep partial type for flexible configuration updates
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Optional configuration keys
 */
export type OptionalConfigKeys = 'autoInitialize' | 'debugMode' | 'enableMetrics';

/**
 * Required configuration keys
 */
export type RequiredConfigKeys = 'apiKey';

/**
 * Environment variables interface for configuration
 */
export interface MemoriOpenAIEnvironment {
  // OpenAI configuration
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
  OPENAI_ORGANIZATION?: string;
  OPENAI_PROJECT?: string;

  // Memory configuration
  MEMORI_DATABASE_URL?: string;
  MEMORI_NAMESPACE?: string;
  MEMORI_PROCESSING_MODE?: MemoryProcessingMode;
  MEMORI_AUTO_INGEST?: string;
  MEMORI_CONSCIOUS_INGEST?: string;
  MEMORI_MIN_IMPORTANCE?: MemoryImportanceLevel;
  MEMORI_MAX_AGE?: string;

  // Performance configuration
  MEMORI_BUFFER_TIMEOUT?: string;
  MEMORI_MAX_BUFFER_SIZE?: string;
  MEMORI_BACKGROUND_INTERVAL?: string;
}

export default MemoriOpenAI;