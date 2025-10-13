import { ChatCompletionParams } from '../types/ChatCompletionParams';
import { ChatCompletionResponse } from '../types/ChatCompletionResponse';
import { EmbeddingParams } from '../types/EmbeddingParams';
import { EmbeddingResponse } from '../types/EmbeddingResponse';
import { logInfo, logError } from '../../config/Logger';

/**
 * Configuration for request caching
 */
export interface RequestCacheConfig {
  /** Maximum cache size in MB */
  maxSizeMB: number;
  /** Default TTL for cache entries in milliseconds */
  defaultTTL: number;
  /** Maximum TTL for cache entries in milliseconds */
  maxTTL: number;
  /** Enable compression for cached responses */
  enableCompression: boolean;
  /** Cache key prefix for namespacing */
  keyPrefix: string;
}

/**
 * Cache entry with metadata
 */
interface CacheEntry<T> {
  data: T;
  timestamp: Date;
  ttl: number;
  size: number;
  accessCount: number;
  lastAccessed: Date;
  compressed?: boolean;
}

/**
 * Intelligent caching for LLM requests to improve performance
 * Supports both chat completions and embeddings with configurable TTL
 */
export class RequestCache {
  private cache = new Map<string, CacheEntry<any>>();
  private config: RequestCacheConfig;
  private currentSize = 0;

  constructor(config: Partial<RequestCacheConfig> = {}) {
    this.config = {
      maxSizeMB: 100,
      defaultTTL: 300000, // 5 minutes
      maxTTL: 3600000, // 1 hour
      enableCompression: true,
      keyPrefix: 'llm_cache',
      ...config,
    };
  }

  /**
   * Get a chat completion response from cache
   */
  getChatCompletion(params: ChatCompletionParams): ChatCompletionResponse | null {
    const key = this.generateChatKey(params);

    try {
      const entry = this.cache.get(key);
      if (!entry) {
        logInfo('Chat completion cache miss', {
          component: 'RequestCache',
          key: key.substring(0, 50) + '...',
        });
        return null;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.currentSize -= entry.size;
        logInfo('Chat completion cache entry expired', {
          component: 'RequestCache',
          key: key.substring(0, 50) + '...',
        });
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = new Date();

      logInfo('Chat completion cache hit', {
        component: 'RequestCache',
        key: key.substring(0, 50) + '...',
        accessCount: entry.accessCount,
        age: Date.now() - entry.timestamp.getTime(),
      });

      return entry.data;
    } catch (error) {
      logError('Error retrieving from chat completion cache', {
        component: 'RequestCache',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache a chat completion response
   */
  setChatCompletion(
    params: ChatCompletionParams,
    response: ChatCompletionResponse,
    ttl?: number
  ): void {
    const key = this.generateChatKey(params);
    const size = this.estimateSize(response);
    const entryTTL = Math.min(ttl || this.config.defaultTTL, this.config.maxTTL);

    // Check if adding this entry would exceed size limit
    if (this.currentSize + size > this.config.maxSizeMB * 1024 * 1024) {
      this.evictEntries(size);
    }

    const entry: CacheEntry<ChatCompletionResponse> = {
      data: response,
      timestamp: new Date(),
      ttl: entryTTL,
      size,
      accessCount: 0,
      lastAccessed: new Date(),
    };

    this.cache.set(key, entry);
    this.currentSize += size;

    logInfo('Chat completion cached', {
      component: 'RequestCache',
      key: key.substring(0, 50) + '...',
      size,
      ttl: entryTTL,
    });
  }

  /**
   * Get an embedding response from cache
   */
  getEmbedding(params: EmbeddingParams): EmbeddingResponse | null {
    const key = this.generateEmbeddingKey(params);

    try {
      const entry = this.cache.get(key);
      if (!entry) {
        logInfo('Embedding cache miss', {
          component: 'RequestCache',
          key: key.substring(0, 50) + '...',
        });
        return null;
      }

      if (this.isExpired(entry)) {
        this.cache.delete(key);
        this.currentSize -= entry.size;
        logInfo('Embedding cache entry expired', {
          component: 'RequestCache',
          key: key.substring(0, 50) + '...',
        });
        return null;
      }

      // Update access statistics
      entry.accessCount++;
      entry.lastAccessed = new Date();

      logInfo('Embedding cache hit', {
        component: 'RequestCache',
        key: key.substring(0, 50) + '...',
        accessCount: entry.accessCount,
        age: Date.now() - entry.timestamp.getTime(),
      });

      return entry.data;
    } catch (error) {
      logError('Error retrieving from embedding cache', {
        component: 'RequestCache',
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Cache an embedding response
   */
  setEmbedding(
    params: EmbeddingParams,
    response: EmbeddingResponse,
    ttl?: number
  ): void {
    const key = this.generateEmbeddingKey(params);
    const size = this.estimateSize(response);
    const entryTTL = Math.min(ttl || this.config.defaultTTL, this.config.maxTTL);

    // Check if adding this entry would exceed size limit
    if (this.currentSize + size > this.config.maxSizeMB * 1024 * 1024) {
      this.evictEntries(size);
    }

    const entry: CacheEntry<EmbeddingResponse> = {
      data: response,
      timestamp: new Date(),
      ttl: entryTTL,
      size,
      accessCount: 0,
      lastAccessed: new Date(),
    };

    this.cache.set(key, entry);
    this.currentSize += size;

    logInfo('Embedding cached', {
      component: 'RequestCache',
      key: key.substring(0, 50) + '...',
      size,
      ttl: entryTTL,
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    logInfo('Request cache cleared', {
      component: 'RequestCache',
    });
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    entryCount: number;
    totalSizeMB: number;
    hitRate: number;
    averageAccessCount: number;
    oldestEntryAge: number;
    newestEntryAge: number;
  } {
    const now = Date.now();
    const entries = Array.from(this.cache.values());

    if (entries.length === 0) {
      return {
        entryCount: 0,
        totalSizeMB: 0,
        hitRate: 0,
        averageAccessCount: 0,
        oldestEntryAge: 0,
        newestEntryAge: 0,
      };
    }

    const totalAccessCount = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const ages = entries.map(entry => now - entry.timestamp.getTime());

    return {
      entryCount: entries.length,
      totalSizeMB: this.currentSize / (1024 * 1024),
      hitRate: totalAccessCount / (totalAccessCount + entries.length), // Rough estimate
      averageAccessCount: totalAccessCount / entries.length,
      oldestEntryAge: Math.max(...ages),
      newestEntryAge: Math.min(...ages),
    };
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    let removedCount = 0;
    let freedSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (this.isExpired(entry)) {
        this.cache.delete(key);
        freedSize += entry.size;
        removedCount++;
      }
    }

    this.currentSize -= freedSize;

    if (removedCount > 0) {
      logInfo('Cache cleanup completed', {
        component: 'RequestCache',
        removedCount,
        freedSizeMB: freedSize / (1024 * 1024),
      });
    }
  }

  private generateChatKey(params: ChatCompletionParams): string {
    // Create a deterministic key from the request parameters
    const keyData = {
      messages: params.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      model: params.model,
      temperature: params.temperature,
      maxTokens: params.max_tokens,
      topP: params.top_p,
    };

    // Simple hash for the key
    const keyString = JSON.stringify(keyData);
    let hash = 0;
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `${this.config.keyPrefix}:chat:${Math.abs(hash).toString(36)}`;
  }

  private generateEmbeddingKey(params: EmbeddingParams): string {
    // Create a deterministic key from the request parameters
    const keyData = {
      input: Array.isArray(params.input) ? params.input.join('|') : params.input,
      model: params.model,
      encodingFormat: params.encoding_format,
      dimensions: params.dimensions,
    };

    // Simple hash for the key
    const keyString = JSON.stringify(keyData);
    let hash = 0;
    for (let i = 0; i < keyString.length; i++) {
      const char = keyString.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return `${this.config.keyPrefix}:embedding:${Math.abs(hash).toString(36)}`;
  }

  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp.getTime() > entry.ttl;
  }

  private estimateSize(obj: any): number {
    // Rough estimation of object size in bytes
    return new Blob([JSON.stringify(obj)]).size;
  }

  private evictEntries(requiredSpace: number): void {
    // Simple LRU eviction - remove least recently accessed entries first
    const entries = Array.from(this.cache.entries()).sort((a, b) => {
      return a[1].lastAccessed.getTime() - b[1].lastAccessed.getTime();
    });

    let freedSpace = 0;
    for (const [key, entry] of entries) {
      if (freedSpace >= requiredSpace) break;

      this.cache.delete(key);
      freedSpace += entry.size;
    }

    this.currentSize -= freedSpace;

    logInfo('Cache eviction completed', {
      component: 'RequestCache',
      freedSpaceMB: freedSpace / (1024 * 1024),
      requiredSpaceMB: requiredSpace / (1024 * 1024),
    });
  }
}

// Global request cache instance
export const globalRequestCache = new RequestCache();