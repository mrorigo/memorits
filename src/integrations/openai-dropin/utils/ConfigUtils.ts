// Consolidated configuration utilities for OpenAI Drop-in integration
// Provides centralized configuration management, validation, and defaults

import type {
  MemoriOpenAIConfig,
  MemoriOpenAIEnvironment,
  DatabaseConfig,
  DatabaseType,
  MemoryProcessingMode,
} from '../types';
import { logInfo } from '../../../core/infrastructure/config/Logger';
import type { MemoryImportanceLevel } from '../../../core/types/models';

/**
 * Consolidated default configuration values
 * Eliminates duplication across multiple files
 */
export const OPENAI_DROPIN_DEFAULTS = {
  CONFIG: {
    enableChatMemory: true,
    enableEmbeddingMemory: false,
    memoryProcessingMode: 'auto' as MemoryProcessingMode,
    autoInitialize: true,
    bufferTimeout: 30000,
    maxBufferSize: 50000,
    backgroundUpdateInterval: 30000,
    debugMode: false,
    enableMetrics: false,
    metricsInterval: 60000,
  } as const,

  STREAMING: {
    bufferTimeout: 30000,
    maxBufferSize: 50000,
    enableMemoryRecording: true,
    memoryProcessingMode: 'auto' as MemoryProcessingMode,
  } as const,

  ERROR_RECOVERY: {
    maxRetries: 3,
    retryDelay: 1000,
    strategy: 'retry' as const,
    logRecovery: true,
  } as const,
} as const;

/**
 * Environment variable validation and parsing utilities
 */
export class EnvironmentValidator {
  /**
   * Validates and parses environment variables
   */
  static validateEnvironment(): MemoriOpenAIEnvironment {
    return {
      // OpenAI configuration
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OPENAI_BASE_URL: process.env.OPENAI_BASE_URL,
      OPENAI_ORGANIZATION: process.env.OPENAI_ORGANIZATION,
      OPENAI_PROJECT: process.env.OPENAI_PROJECT,

      // Memory configuration
      MEMORI_DATABASE_URL: process.env.MEMORI_DATABASE_URL,
      MEMORI_NAMESPACE: process.env.MEMORI_NAMESPACE,
      MEMORI_PROCESSING_MODE: (process.env.MEMORI_PROCESSING_MODE as MemoryProcessingMode) || 'auto',
      MEMORI_AUTO_INGEST: process.env.MEMORI_AUTO_INGEST,
      MEMORI_CONSCIOUS_INGEST: process.env.MEMORI_CONSCIOUS_INGEST,
      MEMORI_MIN_IMPORTANCE: (process.env.MEMORI_MIN_IMPORTANCE as MemoryImportanceLevel) || ('low' as MemoryImportanceLevel),
      MEMORI_MAX_AGE: process.env.MEMORI_MAX_AGE,

      // Performance configuration
      MEMORI_BUFFER_TIMEOUT: process.env.MEMORI_BUFFER_TIMEOUT,
      MEMORI_MAX_BUFFER_SIZE: process.env.MEMORI_MAX_BUFFER_SIZE,
      MEMORI_BACKGROUND_INTERVAL: process.env.MEMORI_BACKGROUND_INTERVAL,
    };
  }

  /**
   * Validates individual environment variable values
   */
  static validateEnvironmentValue(key: string, value: string): boolean {
    switch (key) {
      case 'MEMORI_PROCESSING_MODE':
        return ['auto', 'conscious', 'none'].includes(value);
      case 'MEMORI_MIN_IMPORTANCE':
        return ['low', 'medium', 'high', 'critical'].includes(value);
      case 'MEMORI_AUTO_INGEST':
      case 'MEMORI_CONSCIOUS_INGEST':
        return ['true', 'false'].includes(value);
      default:
        return true; // Allow other values to pass through
    }
  }
}

/**
 * Database configuration builder with multiple creation patterns
 */
export class DatabaseConfigBuilder {
  /**
   * Creates database configuration from environment variables
   */
  static fromEnvironment(env: MemoriOpenAIEnvironment): DatabaseConfig {
    logInfo('Building database configuration from environment', {
      component: 'DatabaseConfigBuilder',
      databaseUrl: env.MEMORI_DATABASE_URL,
      namespace: env.MEMORI_NAMESPACE,
    });

    return {
      type: this.inferDatabaseType(env.MEMORI_DATABASE_URL || 'sqlite:./memori-openai.db'),
      url: env.MEMORI_DATABASE_URL || 'sqlite:./memori-openai.db',
      namespace: env.MEMORI_NAMESPACE || 'memori-openai',
    };
  }

  /**
   * Creates database configuration from MemoriOpenAI configuration
   */
  static fromConfig(config: MemoriOpenAIConfig): DatabaseConfig {
    logInfo('Building database configuration from config', {
      component: 'DatabaseConfigBuilder',
      databaseUrl: config.databaseConfig?.url,
      namespace: config.namespace,
    });

    return {
      type: config.databaseConfig?.type || 'sqlite',
      url: config.databaseConfig?.url || 'sqlite:./memori-openai.db',
      namespace: config.namespace || 'memori-openai',
    };
  }

  /**
   * Creates database configuration from explicit URL
   */
  static fromDatabaseUrl(databaseUrl: string, namespace?: string): DatabaseConfig {
    logInfo('Building database configuration from URL', {
      component: 'DatabaseConfigBuilder',
      databaseUrl,
      namespace,
    });

    return {
      type: this.inferDatabaseType(databaseUrl),
      url: databaseUrl,
      namespace: namespace || 'memori-openai',
    };
  }

  /**
   * Infers database type from URL
   */
  private static inferDatabaseType(databaseUrl: string): DatabaseType {
    if (databaseUrl.startsWith('postgresql://') || databaseUrl.startsWith('postgres://')) {
      return 'postgresql';
    } else if (databaseUrl.includes('mysql://')) {
      return 'mysql';
    } else if (databaseUrl.includes('mongodb://')) {
      return 'mongodb';
    } else {
      return 'sqlite'; // Default fallback
    }
  }

  /**
   * Validates database configuration
   */
  static validateDatabaseConfig(config: DatabaseConfig): ValidationResult {
    const errors: string[] = [];

    if (!config.url || config.url.trim().length === 0) {
      errors.push('Database URL is required');
    }

    if (!config.namespace || config.namespace.trim().length === 0) {
      errors.push('Database namespace is required');
    }

    const validTypes: DatabaseType[] = ['sqlite', 'postgresql', 'mysql', 'mongodb'];
    if (!validTypes.includes(config.type)) {
      errors.push(`Invalid database type: ${config.type}. Must be one of: ${validTypes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Configuration creation utilities
 */
export class ConfigBuilder {
  /**
   * Creates MemoriOpenAI configuration from environment variables
   */
  static fromEnvironment(
    apiKey?: string,
    overrides: Partial<MemoriOpenAIConfig> = {},
  ): MemoriOpenAIConfig {
    const env = EnvironmentValidator.validateEnvironment();

    const config: MemoriOpenAIConfig = {
      ...OPENAI_DROPIN_DEFAULTS.CONFIG,
      apiKey: apiKey || env.OPENAI_API_KEY || '',

      // Environment-based configuration
      memoryProcessingMode: env.MEMORI_PROCESSING_MODE,
      databaseConfig: DatabaseConfigBuilder.fromEnvironment(env),
      namespace: env.MEMORI_NAMESPACE || 'memori-openai',
      minImportanceLevel: env.MEMORI_MIN_IMPORTANCE,
      maxMemoryAge: env.MEMORI_MAX_AGE ? parseInt(env.MEMORI_MAX_AGE, 10) : undefined,
      autoIngest: env.MEMORI_AUTO_INGEST === 'true',
      consciousIngest: env.MEMORI_CONSCIOUS_INGEST === 'true',
      bufferTimeout: env.MEMORI_BUFFER_TIMEOUT ? parseInt(env.MEMORI_BUFFER_TIMEOUT, 10) : OPENAI_DROPIN_DEFAULTS.CONFIG.bufferTimeout,
      maxBufferSize: env.MEMORI_MAX_BUFFER_SIZE ? parseInt(env.MEMORI_MAX_BUFFER_SIZE, 10) : OPENAI_DROPIN_DEFAULTS.CONFIG.maxBufferSize,
      backgroundUpdateInterval: env.MEMORI_BACKGROUND_INTERVAL ? parseInt(env.MEMORI_BACKGROUND_INTERVAL, 10) : OPENAI_DROPIN_DEFAULTS.CONFIG.backgroundUpdateInterval,

      // OpenAI client options from environment
      baseUrl: env.OPENAI_BASE_URL,
      organization: env.OPENAI_ORGANIZATION,
      project: env.OPENAI_PROJECT,

      // Development settings
      debugMode: process.env.NODE_ENV === 'development',

      ...overrides,
    };

    return config;
  }

  /**
   * Merges configuration with defaults and validates
   */
  static mergeWithDefaults(
    apiKey: string,
    config: Partial<MemoriOpenAIConfig> = {},
  ): MemoriOpenAIConfig {
    const mergedConfig: MemoriOpenAIConfig = {
      ...OPENAI_DROPIN_DEFAULTS.CONFIG,
      ...config,
      apiKey,
    };

    return mergedConfig;
  }
}

/**
 * Comprehensive configuration validation
 */
export class MemoriOpenAIConfigValidator {
  /**
   * Validates complete MemoriOpenAI configuration
   */
  static validate(config: MemoriOpenAIConfig): ValidationResult {
    const errors: string[] = [];

    // Validate required fields
    if (!config.apiKey || config.apiKey.trim().length === 0) {
      errors.push('API key is required');
    }

    // Validate buffer settings
    if (config.bufferTimeout !== undefined && config.bufferTimeout < 1000) {
      errors.push('Buffer timeout must be at least 1000ms');
    }

    if (config.maxBufferSize !== undefined && config.maxBufferSize < 1000) {
      errors.push('Max buffer size must be at least 1000 characters');
    }

    // Validate memory settings
    if (config.memoryProcessingMode && !['auto', 'conscious', 'none'].includes(config.memoryProcessingMode)) {
      errors.push('Invalid memory processing mode');
    }

    if (config.minImportanceLevel && !['low', 'medium', 'high', 'critical'].includes(config.minImportanceLevel)) {
      errors.push('Invalid minimum importance level');
    }

    // Validate database configuration if provided (but don't validate namespace here
    // as it will be properly merged from the main config namespace)
    if (config.databaseConfig) {
      const dbValidation = DatabaseConfigBuilder.validateDatabaseConfig({
        ...config.databaseConfig,
        namespace: config.namespace || 'memori-openai', // Use main config namespace for validation
      });
      if (!dbValidation.isValid) {
        errors.push(...dbValidation.errors);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validates partial configuration updates
   */
  static validatePartial(config: Partial<MemoriOpenAIConfig>): ValidationResult {
    const errors: string[] = [];

    // Only validate fields that are present
    if (config.bufferTimeout !== undefined && config.bufferTimeout < 1000) {
      errors.push('Buffer timeout must be at least 1000ms');
    }

    if (config.maxBufferSize !== undefined && config.maxBufferSize < 1000) {
      errors.push('Max buffer size must be at least 1000 characters');
    }

    if (config.memoryProcessingMode && !['auto', 'conscious', 'none'].includes(config.memoryProcessingMode)) {
      errors.push('Invalid memory processing mode');
    }

    if (config.minImportanceLevel && !['low', 'medium', 'high', 'critical'].includes(config.minImportanceLevel)) {
      errors.push('Invalid minimum importance level');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Configuration factory functions for common patterns
 */
export class ConfigFactory {
  /**
   * Creates configuration for development environment
   */
  static createDevelopmentConfig(apiKey: string, overrides: Partial<MemoriOpenAIConfig> = {}): MemoriOpenAIConfig {
    return ConfigBuilder.fromEnvironment(apiKey, {
      debugMode: true,
      enableMetrics: true,
      ...overrides,
    });
  }

  /**
   * Creates configuration for production environment
   */
  static createProductionConfig(apiKey: string, overrides: Partial<MemoriOpenAIConfig> = {}): MemoriOpenAIConfig {
    return ConfigBuilder.fromEnvironment(apiKey, {
      debugMode: false,
      enableMetrics: false,
      ...overrides,
    });
  }

  /**
   * Creates configuration with streaming optimization
   */
  static createStreamingConfig(apiKey: string, overrides: Partial<MemoriOpenAIConfig> = {}): MemoriOpenAIConfig {
    return ConfigBuilder.fromEnvironment(apiKey, {
      bufferTimeout: 60000, // Longer timeout for streaming
      maxBufferSize: 100000, // Larger buffer for streaming
      enableChatMemory: true,
      memoryProcessingMode: 'auto',
      ...overrides,
    });
  }
}

// Export default utilities for convenience
export const ConfigUtils = {
  EnvironmentValidator,
  DatabaseConfigBuilder,
  ConfigBuilder,
  MemoriOpenAIConfigValidator,
  ConfigFactory,
  defaults: OPENAI_DROPIN_DEFAULTS,
} as const;

export default ConfigUtils;