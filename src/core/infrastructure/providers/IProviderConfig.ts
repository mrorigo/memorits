/**
 * Base configuration interface for LLM providers
 * Extended with memory configuration options for unified configuration management
 */
export interface IProviderConfig {
  /** API key for the provider */
  apiKey: string;
  /** Model to use for completions */
  model?: string;
  /** Base URL for the provider API (optional, for custom endpoints) */
  baseUrl?: string;
  /** Provider-specific configuration options */
  options?: Record<string, any>;
  /** Memory configuration options */
  memory?: {
    /** Whether to enable chat memory recording */
    enableChatMemory?: boolean;
    /** Whether to enable embedding memory recording */
    enableEmbeddingMemory?: boolean;
    /** Memory processing mode */
    memoryProcessingMode?: 'auto' | 'conscious' | 'none';
    /** Minimum importance level for memory storage */
    minImportanceLevel?: 'low' | 'medium' | 'high' | 'critical' | 'all';
    /** Session ID for tracking memory operations */
    sessionId?: string;
  };
}