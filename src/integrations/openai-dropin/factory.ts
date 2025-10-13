import MemoriOpenAIClient from './client';
import type { Memori } from '../../core/Memori';
import { logInfo, logError } from '../../core/infrastructure/config/Logger';
import { ConfigUtils } from './utils/ConfigUtils';
import type {
  MemoriOpenAI,
  MemoriOpenAIConfig,
} from './types';

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
      const envConfig = ConfigUtils.ConfigBuilder.fromEnvironment(apiKey, config);

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
        databaseConfig: ConfigUtils.DatabaseConfigBuilder.fromDatabaseUrl(
          databaseUrl,
          options.namespace || 'memori-openai'
        ),
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
 * Convenience factory function for creating MemoriOpenAI instances
 * Provides a simple function-based API for users who prefer functional patterns
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