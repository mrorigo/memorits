// src/integrations/openai-dropin/factory.ts
// Factory functions for different MemoriOpenAI initialization patterns
// Provides multiple initialization options as specified in the design document

import MemoriOpenAIClient from './client';
import type { Memori } from '../../core/Memori';
import { logInfo, logError } from '../../core/utils/Logger';
import type {
  MemoriOpenAI,
  MemoriOpenAIConfig,
  MemoriOpenAIEnvironment,
  DatabaseConfig,
  DatabaseType,
} from './types';

/**
 * Validates environment variables for MemoriOpenAI configuration
 */
function validateEnvironment(): MemoriOpenAIEnvironment {
  return {
    // OpenAI configuration
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
    OPENAI_ORGANIZATION: process.env.OPENAI_ORGANIZATION,
    OPENAI_PROJECT: process.env.OPENAI_PROJECT,

    // Memory configuration
    MEMORI_DATABASE_URL: process.env.MEMORI_DATABASE_URL,
    MEMORI_NAMESPACE: process.env.MEMORI_NAMESPACE,
    MEMORI_PROCESSING_MODE: (process.env.MEMORI_PROCESSING_MODE as 'auto' | 'conscious' | 'none') || 'auto',
    MEMORI_AUTO_INGEST: process.env.MEMORI_AUTO_INGEST,
    MEMORI_CONSCIOUS_INGEST: process.env.MEMORI_CONSCIOUS_INGEST,
    MEMORI_MIN_IMPORTANCE: (process.env.MEMORI_MIN_IMPORTANCE as any) || 'low',
    MEMORI_MAX_AGE: process.env.MEMORI_MAX_AGE,

    // Performance configuration
    MEMORI_BUFFER_TIMEOUT: process.env.MEMORI_BUFFER_TIMEOUT,
    MEMORI_MAX_BUFFER_SIZE: process.env.MEMORI_MAX_BUFFER_SIZE,
    MEMORI_BACKGROUND_INTERVAL: process.env.MEMORI_BACKGROUND_INTERVAL,
  };
}

/**
 * Creates database configuration from environment variables
 */
function createDatabaseConfigFromEnv(env: MemoriOpenAIEnvironment): DatabaseConfig {
  const databaseType: DatabaseType = 'sqlite'; // Default to SQLite for simplicity
  const databaseUrl = env.MEMORI_DATABASE_URL || 'sqlite:./memori-openai.db';

  return {
    type: databaseType,
    url: databaseUrl,
    namespace: env.MEMORI_NAMESPACE || 'memori-openai',
  };
}

/**
 * Creates MemoriOpenAI configuration from environment variables
 */
function createConfigFromEnv(
  apiKey?: string,
  overrides: Partial<MemoriOpenAIConfig> = {},
): MemoriOpenAIConfig {
  const env = validateEnvironment();

  const config: MemoriOpenAIConfig = {
    // Core functionality
    enableChatMemory: true,
    enableEmbeddingMemory: false,
    memoryProcessingMode: env.MEMORI_PROCESSING_MODE || 'auto',

    // Initialization
    autoInitialize: true,
    databaseConfig: createDatabaseConfigFromEnv(env),
    namespace: env.MEMORI_NAMESPACE || 'memori-openai',

    // Memory filtering
    minImportanceLevel: env.MEMORI_MIN_IMPORTANCE as any || 'low',
    maxMemoryAge: env.MEMORI_MAX_AGE ? parseInt(env.MEMORI_MAX_AGE, 10) : undefined,
    autoIngest: env.MEMORI_AUTO_INGEST === 'true',
    consciousIngest: env.MEMORI_CONSCIOUS_INGEST === 'true',

    // Performance tuning
    bufferTimeout: env.MEMORI_BUFFER_TIMEOUT ? parseInt(env.MEMORI_BUFFER_TIMEOUT, 10) : 30000,
    maxBufferSize: env.MEMORI_MAX_BUFFER_SIZE ? parseInt(env.MEMORI_MAX_BUFFER_SIZE, 10) : 50000,
    backgroundUpdateInterval: env.MEMORI_BACKGROUND_INTERVAL ? parseInt(env.MEMORI_BACKGROUND_INTERVAL, 10) : 30000,

    // OpenAI client options
    apiKey: apiKey || env.OPENAI_API_KEY || '',
    baseUrl: env.OPENAI_BASE_URL,
    organization: env.OPENAI_ORGANIZATION,
    project: env.OPENAI_PROJECT,

    // Advanced options
    debugMode: process.env.NODE_ENV === 'development',
    enableMetrics: false,

    ...overrides,
  };

  return config;
}

/**
 * Factory class for creating MemoriOpenAI instances
 * Implements multiple initialization patterns as specified in the design document
 */
export class MemoriOpenAIFactory implements MemoriOpenAIFactory {
  /**
   * Create MemoriOpenAI instance with explicit Memori instance
   * Pattern 1: Explicit Memori Instance (Current)
   */
  async createWithMemori(
    memori: Memori,
    apiKey: string,
    options: MemoriOpenAIConfig = {},
  ): Promise<MemoriOpenAI> {
    try {
      logInfo('Creating MemoriOpenAI with explicit Memori instance', {
        component: 'MemoriOpenAIFactory',
        apiKey: apiKey ? '[REDACTED]' : undefined,
      });

      // For now, create a new client - in a future version we could reuse the Memori instance
      const client = new MemoriOpenAIClient(apiKey, options);
      return client;
    } catch (error) {
      logError('Failed to create MemoriOpenAI with explicit Memori instance', {
        component: 'MemoriOpenAIFactory',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create MemoriOpenAI instance from configuration object
   * Pattern 2: Automatic Initialization
   */
  async fromConfig(
    apiKey: string,
    config: MemoriOpenAIConfig,
  ): Promise<MemoriOpenAI> {
    try {
      logInfo('Creating MemoriOpenAI from configuration', {
        component: 'MemoriOpenAIFactory',
        apiKey: apiKey ? '[REDACTED]' : undefined,
        enableChatMemory: config.enableChatMemory,
        enableEmbeddingMemory: config.enableEmbeddingMemory,
        memoryProcessingMode: config.memoryProcessingMode,
      });

      const client = new MemoriOpenAIClient(apiKey, config);
      return client;
    } catch (error) {
      logError('Failed to create MemoriOpenAI from configuration', {
        component: 'MemoriOpenAIFactory',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create MemoriOpenAI instance from environment variables
   * Pattern 3: Environment-Based Setup
   */
  async fromEnv(
    apiKey?: string,
    config: Partial<MemoriOpenAIConfig> = {},
  ): Promise<MemoriOpenAI> {
    try {
      const envConfig = createConfigFromEnv(apiKey, config);

      logInfo('Creating MemoriOpenAI from environment', {
        component: 'MemoriOpenAIFactory',
        apiKey: envConfig.apiKey ? '[REDACTED]' : undefined,
        databaseUrl: envConfig.databaseConfig?.url,
        namespace: envConfig.namespace,
        memoryProcessingMode: envConfig.memoryProcessingMode,
      });

      const client = new MemoriOpenAIClient(envConfig.apiKey!, envConfig);
      return client;
    } catch (error) {
      logError('Failed to create MemoriOpenAI from environment', {
        component: 'MemoriOpenAIFactory',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Create MemoriOpenAI instance with database URL
   * Pattern 4: Direct Constructor Replacement
   */
  async fromDatabaseUrl(
    apiKey: string,
    databaseUrl: string,
    options: Partial<MemoriOpenAIConfig> = {},
  ): Promise<MemoriOpenAI> {
    try {
      const config: MemoriOpenAIConfig = {
        apiKey,
        databaseConfig: {
          type: 'sqlite', // Default to SQLite
          url: databaseUrl,
          namespace: options.namespace || 'memori-openai',
        },
        enableChatMemory: true,
        enableEmbeddingMemory: false,
        memoryProcessingMode: 'auto',
        autoInitialize: true,
        ...options,
      };

      logInfo('Creating MemoriOpenAI with database URL', {
        component: 'MemoriOpenAIFactory',
        apiKey: apiKey ? '[REDACTED]' : undefined,
        databaseUrl,
        namespace: config.namespace,
      });

      const client = new MemoriOpenAIClient(apiKey, config);
      return client;
    } catch (error) {
      logError('Failed to create MemoriOpenAI with database URL', {
        component: 'MemoriOpenAIFactory',
        error: error instanceof Error ? error.message : String(error),
        databaseUrl,
      });
      throw error;
    }
  }
}

// Create default factory instance
export const memoriOpenAIFactory = new MemoriOpenAIFactory();

/**
 * Legacy factory function for backward compatibility
 * This function provides a simple way to create MemoriOpenAI instances
 * for existing code that expects a function-based API
 */
export async function createMemoriOpenAI(
  memori: Memori,
  apiKey: string,
  options?: MemoriOpenAIConfig,
): Promise<MemoriOpenAI> {
  return memoriOpenAIFactory.createWithMemori(memori, apiKey, options);
}

/**
 * Create MemoriOpenAI instance from configuration (convenience function)
 * Pattern 2: Automatic Initialization
 */
export async function MemoriOpenAIFromConfig(
  apiKey: string,
  config: MemoriOpenAIConfig,
): Promise<MemoriOpenAI> {
  return memoriOpenAIFactory.fromConfig(apiKey, config);
}

/**
 * Create MemoriOpenAI instance from environment (convenience function)
 * Pattern 3: Environment-Based Setup
 */
export async function MemoriOpenAIFromEnv(
  apiKey?: string,
  config?: Partial<MemoriOpenAIConfig>,
): Promise<MemoriOpenAI> {
  return memoriOpenAIFactory.fromEnv(apiKey, config);
}

/**
 * Create MemoriOpenAI instance with database URL (convenience function)
 * Pattern 4: Direct Constructor Replacement
 */
export async function MemoriOpenAIFromDatabase(
  apiKey: string,
  databaseUrl: string,
  options?: Partial<MemoriOpenAIConfig>,
): Promise<MemoriOpenAI> {
  return memoriOpenAIFactory.fromDatabaseUrl(apiKey, databaseUrl, options);
}

// Export types for external usage
export type { MemoriOpenAI, MemoriOpenAIConfig } from './types';
export default MemoriOpenAIFactory;