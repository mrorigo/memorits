/**
 * MemoriAI configuration types and interfaces
 *
 * This file contains the configuration types for the MemoriAI class,
 * providing a clean interface that leverages sophisticated infrastructure.
 */

import { ProviderType } from '../core/infrastructure/providers/ProviderType';
import { ChatMessage } from '../core/infrastructure/providers/types/ChatCompletionParams';
import { IProviderConfig } from './infrastructure/providers/IProviderConfig';

/**
 * MemoriAI configuration interface that extends IProviderConfig
 *
 * This design provides the best of both worlds:
 * - Simple configuration for basic usage (just databaseUrl + apiKey)
 * - Full access to sophisticated features when needed via IProviderConfig
 * - Leverages existing IProviderConfig sophistication without duplication
 */
export interface MemoriAIConfig extends IProviderConfig {
  /** Database connection URL - only required field for MemoriAI */
  databaseUrl: string;
  /** Namespace for memory operations (auto-generated if not provided) */
  namespace?: string;
  /** LLM provider type (optional - auto-detected if not provided) */
  provider?: 'openai' | 'anthropic' | 'ollama';

  // Note: All IProviderConfig options are available including:
  // - apiKey, model, baseUrl, options (basic provider config)
  // - memory (legacy memory configuration)
  // - features.performance (connection pooling, caching, health monitoring)
  // - features.memory (advanced memory processing, consolidation)
}

/**
 * Simplified chat parameters for the unified API
 */
export interface ChatParams {
  /** Messages to process */
  messages: ChatMessage[];
  /** Model to use (optional, falls back to config default) */
  model?: string;
  /** Sampling temperature (0.0 to 2.0) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** Additional options */
  options?: Record<string, any>;
}

/**
 * Simplified chat response for the unified API
 */
export interface ChatResponse {
  /** Generated message */
  message: ChatMessage;
  /** Finish reason */
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter' | 'tool_calls' | 'null';
  /** Usage statistics */
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Unique identifier for the completion */
  id: string;
  /** Model used for generation */
  model: string;
  /** Creation timestamp */
  created: number;
}

/**
 * Memory search options for the unified API
 */
export interface SearchOptions {
  /** Namespace to search in (optional) */
  namespace?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Minimum importance level filter */
  minImportance?: 'low' | 'medium' | 'high' | 'critical';
  /** Categories to filter by */
  categories?: string[];
  /** Include metadata in results */
  includeMetadata?: boolean;
  /** Sort field and direction */
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  };
  /** Offset for pagination */
  offset?: number;
}

/**
 * Memory search result for the unified API
 */
export interface MemorySearchResult {
  /** Unique identifier */
  id: string;
  /** Memory content */
  content: string;
  /** Brief summary */
  summary: string;
  /** Classification category */
  classification: string;
  /** Importance level */
  importance: 'low' | 'medium' | 'high' | 'critical';
  /** Main topic */
  topic?: string;
  /** Extracted entities */
  entities: string[];
  /** Keywords for search */
  keywords: string[];
  /** Confidence score */
  confidenceScore: number;
  /** Classification explanation */
  classificationReason: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Embedding request parameters
 */
export interface EmbeddingParams {
  /** Text input to embed */
  input: string | string[];
  /** Model to use (optional) */
  model?: string;
  /** Encoding format for the embeddings */
  encodingFormat?: 'float' | 'base64';
  /** Number of dimensions for the embeddings */
  dimensions?: number;
  /** User identifier for the request */
  user?: string;
}

/**
 * Embedding response
 */
export interface EmbeddingResponse {
  /** Generated embeddings */
  embeddings: number[][];
  /** Usage statistics */
  usage?: {
    promptTokens: number;
    totalTokens: number;
  };
  /** Model used for generation */
  model: string;
  /** Unique identifier for the request */
  id: string;
  /** Creation timestamp */
  created: number;
}

/**
 * Provider detection result
 */
export interface ProviderInfo {
  /** Detected provider type */
  type: ProviderType;
  /** Provider name */
  name: string;
  /** Default model for this provider */
  defaultModel: string;
  /** Base URL for the provider */
  baseUrl?: string;
}