import {
  SearchStrategyConfiguration,
  ConfigurationValidationResult,
  ConfigurationManager,
  ConfigurationPersistenceManager,
  ConfigurationAuditManager,
  ConfigurationAuditEntry,
  SearchStrategy,
} from './types';
import { ILogger } from './types';

/**
 * Default configuration templates for each search strategy
 */
const DEFAULT_STRATEGY_CONFIGS: Record<SearchStrategy, SearchStrategyConfiguration> = {
  [SearchStrategy.FTS5]: {
    strategyName: SearchStrategy.FTS5,
    enabled: true,
    priority: 10,
    timeout: 10000,
    maxResults: 100,
    performance: {
      enableCaching: true,
      cacheSize: 1000,
      enableParallelExecution: false,
    },
    scoring: {
      baseWeight: 1.0,
      recencyWeight: 0.2,
      importanceWeight: 0.8,
      relationshipWeight: 0.3,
    },
    strategySpecific: {
      bm25Weights: {
        title: 2.0,
        content: 1.0,
        category: 1.5,
      },
      queryTimeout: 10000,
      resultBatchSize: 100,
    },
  },
  [SearchStrategy.LIKE]: {
    strategyName: SearchStrategy.LIKE,
    enabled: true,
    priority: 5,
    timeout: 5000,
    maxResults: 100,
    performance: {
      enableCaching: true,
      cacheSize: 500,
      enableParallelExecution: false,
    },
    scoring: {
      baseWeight: 0.8,
      recencyWeight: 0.1,
      importanceWeight: 0.6,
      relationshipWeight: 0.2,
    },
    strategySpecific: {
      wildcardSensitivity: 'medium',
      maxWildcardTerms: 10,
      enablePhraseSearch: true,
      caseSensitive: false,
      relevanceBoost: {
        exactMatch: 1.5,
        prefixMatch: 1.2,
        suffixMatch: 1.1,
        partialMatch: 1.0,
      },
    },
  },
  [SearchStrategy.RECENT]: {
    strategyName: SearchStrategy.RECENT,
    enabled: true,
    priority: 3,
    timeout: 3000,
    maxResults: 50,
    performance: {
      enableCaching: true,
      cacheSize: 200,
      enableParallelExecution: false,
    },
    scoring: {
      baseWeight: 0.9,
      recencyWeight: 1.0,
      importanceWeight: 0.4,
      relationshipWeight: 0.1,
    },
    strategySpecific: {
      timeWindows: {
        recent: 24 * 60 * 60 * 1000, // 24 hours
        today: 24 * 60 * 60 * 1000,  // 24 hours
        week: 7 * 24 * 60 * 60 * 1000, // 7 days
        month: 30 * 24 * 60 * 60 * 1000, // 30 days
      },
      maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days
    },
  },
  [SearchStrategy.SEMANTIC]: {
    strategyName: SearchStrategy.SEMANTIC,
    enabled: false,
    priority: 8,
    timeout: 15000,
    maxResults: 50,
    performance: {
      enableCaching: true,
      cacheSize: 200,
      enableParallelExecution: false,
    },
    scoring: {
      baseWeight: 0.7,
      recencyWeight: 0.3,
      importanceWeight: 0.5,
      relationshipWeight: 0.4,
    },
    strategySpecific: {
      similarityThreshold: 0.7,
      embeddingModel: 'all-MiniLM-L6-v2',
      maxTokens: 512,
      enableReranking: true,
    },
  },
  [SearchStrategy.CATEGORY_FILTER]: {
    strategyName: SearchStrategy.CATEGORY_FILTER,
    enabled: true,
    priority: 7,
    timeout: 5000,
    maxResults: 200,
    performance: {
      enableCaching: true,
      cacheSize: 300,
      enableParallelExecution: true,
    },
    scoring: {
      baseWeight: 0.6,
      recencyWeight: 0.2,
      importanceWeight: 0.3,
      relationshipWeight: 0.1,
    },
    strategySpecific: {
      hierarchy: {
        maxDepth: 5,
        enableCaching: true,
      },
      performance: {
        enableQueryOptimization: true,
        enableResultCaching: true,
        maxExecutionTime: 10000,
        batchSize: 100,
      },
    },
  },
  [SearchStrategy.TEMPORAL_FILTER]: {
    strategyName: SearchStrategy.TEMPORAL_FILTER,
    enabled: true,
    priority: 6,
    timeout: 5000,
    maxResults: 200,
    performance: {
      enableCaching: true,
      cacheSize: 300,
      enableParallelExecution: true,
    },
    scoring: {
      baseWeight: 0.6,
      recencyWeight: 0.9,
      importanceWeight: 0.3,
      relationshipWeight: 0.1,
    },
    strategySpecific: {
      naturalLanguage: {
        enableParsing: true,
        enablePatternMatching: true,
        confidenceThreshold: 0.3,
      },
      performance: {
        enableQueryOptimization: true,
        enableResultCaching: true,
        maxExecutionTime: 10000,
        batchSize: 100,
      },
    },
  },
  [SearchStrategy.METADATA_FILTER]: {
    strategyName: SearchStrategy.METADATA_FILTER,
    enabled: true,
    priority: 4,
    timeout: 5000,
    maxResults: 200,
    performance: {
      enableCaching: true,
      cacheSize: 300,
      enableParallelExecution: true,
    },
    scoring: {
      baseWeight: 0.6,
      recencyWeight: 0.2,
      importanceWeight: 0.7,
      relationshipWeight: 0.2,
    },
    strategySpecific: {
      fields: {
        enableNestedAccess: true,
        maxDepth: 5,
        enableTypeValidation: true,
        enableFieldDiscovery: true,
      },
      validation: {
        strictValidation: false,
        enableCustomValidators: true,
        failOnInvalidMetadata: false,
      },
      performance: {
        enableQueryOptimization: true,
        enableResultCaching: true,
        maxExecutionTime: 10000,
        batchSize: 100,
        cacheSize: 100,
      },
    },
  },
  [SearchStrategy.RELATIONSHIP]: {
    strategyName: SearchStrategy.RELATIONSHIP,
    enabled: true,
    priority: 9,
    timeout: 8000,
    maxResults: 100,
    performance: {
      enableCaching: true,
      cacheSize: 400,
      enableParallelExecution: false,
    },
    scoring: {
      baseWeight: 0.8,
      recencyWeight: 0.2,
      importanceWeight: 0.6,
      relationshipWeight: 1.0,
    },
    strategySpecific: {
      maxDepth: 3,
      minRelationshipStrength: 0.3,
      minRelationshipConfidence: 0.5,
      includeRelationshipPaths: true,
      traversalStrategy: 'strength_weighted',
    },
  },
};

/**
 * Configuration validation utilities
 */
class ConfigurationValidator {
  /**
   * Validate a complete strategy configuration
   */
  static validateConfiguration(config: SearchStrategyConfiguration): ConfigurationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate strategy name
    if (!config.strategyName || typeof config.strategyName !== 'string') {
      errors.push('Strategy name is required and must be a string');
    }

    // Validate enabled flag
    if (typeof config.enabled !== 'boolean') {
      errors.push('Enabled flag must be a boolean');
    }

    // Validate priority
    if (typeof config.priority !== 'number' || config.priority < 0 || config.priority > 100) {
      errors.push('Priority must be a number between 0 and 100');
    }

    // Validate timeout
    if (typeof config.timeout !== 'number' || config.timeout < 1000 || config.timeout > 60000) {
      errors.push('Timeout must be a number between 1000ms and 60000ms');
    }

    // Validate maxResults
    if (typeof config.maxResults !== 'number' || config.maxResults < 1 || config.maxResults > 10000) {
      errors.push('MaxResults must be a number between 1 and 10000');
    }

    // Validate performance settings
    if (!config.performance || typeof config.performance !== 'object') {
      errors.push('Performance settings are required');
    } else {
      const perf = config.performance;
      if (typeof perf.enableCaching !== 'boolean') {
        errors.push('Performance.enableCaching must be a boolean');
      }
      if (typeof perf.cacheSize !== 'number' || perf.cacheSize < 0 || perf.cacheSize > 10000) {
        errors.push('Performance.cacheSize must be a number between 0 and 10000');
      }
      if (typeof perf.enableParallelExecution !== 'boolean') {
        errors.push('Performance.enableParallelExecution must be a boolean');
      }
    }

    // Validate scoring weights
    if (!config.scoring || typeof config.scoring !== 'object') {
      errors.push('Scoring settings are required');
    } else {
      const scoring = config.scoring;
      const weightFields = ['baseWeight', 'recencyWeight', 'importanceWeight', 'relationshipWeight'];
      for (const field of weightFields) {
        const value = (scoring as any)[field];
        if (typeof value !== 'number' || value < 0 || value > 2) {
          errors.push(`Scoring.${field} must be a number between 0 and 2`);
        }
      }
    }

    // Validate strategy-specific settings
    if (config.strategySpecific) {
      const strategySpecificValidation = this.validateStrategySpecificSettings(config.strategyName, config.strategySpecific);
      errors.push(...strategySpecificValidation.errors);
      warnings.push(...strategySpecificValidation.warnings);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      validatedConfig: errors.length === 0 ? config : undefined,
    };
  }

  /**
   * Validate strategy-specific configuration settings
   */
  private static validateStrategySpecificSettings(strategyName: string, settings: Record<string, unknown>): ConfigurationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    switch (strategyName) {
    case SearchStrategy.FTS5:
      this.validateFTS5Settings(settings, errors, warnings);
      break;
    case SearchStrategy.LIKE:
      this.validateLikeSettings(settings, errors, warnings);
      break;
    case SearchStrategy.RECENT:
      this.validateRecentSettings(settings, errors, warnings);
      break;
    case SearchStrategy.SEMANTIC:
      this.validateSemanticSettings(settings, errors, warnings);
      break;
    case SearchStrategy.CATEGORY_FILTER:
      this.validateCategoryFilterSettings(settings, errors, warnings);
      break;
    case SearchStrategy.TEMPORAL_FILTER:
      this.validateTemporalFilterSettings(settings, errors, warnings);
      break;
    case SearchStrategy.METADATA_FILTER:
      this.validateMetadataFilterSettings(settings, errors, warnings);
      break;
    case SearchStrategy.RELATIONSHIP:
      this.validateRelationshipSettings(settings, errors, warnings);
      break;
    default:
      warnings.push(`Unknown strategy: ${strategyName}`);
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private static validateFTS5Settings(settings: Record<string, unknown>, errors: string[], _warnings: string[]): void {
    const bm25Weights = settings.bm25Weights as any;
    if (bm25Weights) {
      if (typeof bm25Weights.title !== 'number' || bm25Weights.title < 0 || bm25Weights.title > 10) {
        errors.push('FTS5 bm25Weights.title must be a number between 0 and 10');
      }
      if (typeof bm25Weights.content !== 'number' || bm25Weights.content < 0 || bm25Weights.content > 10) {
        errors.push('FTS5 bm25Weights.content must be a number between 0 and 10');
      }
      if (typeof bm25Weights.category !== 'number' || bm25Weights.category < 0 || bm25Weights.category > 10) {
        errors.push('FTS5 bm25Weights.category must be a number between 0 and 10');
      }
    }

    if (settings.queryTimeout && (typeof settings.queryTimeout !== 'number' || settings.queryTimeout < 1000 || settings.queryTimeout > 30000)) {
      errors.push('FTS5 queryTimeout must be a number between 1000 and 30000');
    }
  }

  private static validateLikeSettings(settings: Record<string, unknown>, errors: string[], _warnings: string[]): void {
    if (settings.wildcardSensitivity && !['low', 'medium', 'high'].includes(settings.wildcardSensitivity as string)) {
      errors.push('LIKE wildcardSensitivity must be one of: low, medium, high');
    }

    if (settings.maxWildcardTerms && (typeof settings.maxWildcardTerms !== 'number' || settings.maxWildcardTerms < 1 || settings.maxWildcardTerms > 50)) {
      errors.push('LIKE maxWildcardTerms must be a number between 1 and 50');
    }

    if (settings.relevanceBoost) {
      // @eslint-disable-next-line @typescript-eslint/no-explicit-any
      const boost = settings.relevanceBoost as any;
      const boostFields = ['exactMatch', 'prefixMatch', 'suffixMatch', 'partialMatch'];
      for (const field of boostFields) {
        if (boost[field] !== undefined && (typeof boost[field] !== 'number' || boost[field] < 0.1 || boost[field] > 5)) {
          errors.push(`LIKE relevanceBoost.${field} must be a number between 0.1 and 5`);
        }
      }
    }
  }

  private static validateRecentSettings(settings: Record<string, unknown>, errors: string[], _warnings: string[]): void {
    if (settings.maxAge && (typeof settings.maxAge !== 'number' || settings.maxAge < 60000)) {
      errors.push('Recent maxAge must be a number greater than 60000ms (1 minute)');
    }

    if (settings.timeWindows) {
      const windows = settings.timeWindows as any;
      if (windows.recent && (typeof windows.recent !== 'number' || windows.recent < 1000)) {
        errors.push('Recent timeWindows.recent must be a number greater than 1000ms');
      }
    }
  }

  private static validateSemanticSettings(settings: Record<string, unknown>, errors: string[], _warnings: string[]): void {
    if (settings.similarityThreshold && (typeof settings.similarityThreshold !== 'number' || settings.similarityThreshold < 0 || settings.similarityThreshold > 1)) {
      errors.push('Semantic similarityThreshold must be a number between 0 and 1');
    }

    if (settings.maxTokens && (typeof settings.maxTokens !== 'number' || settings.maxTokens < 64 || settings.maxTokens > 2048)) {
      errors.push('Semantic maxTokens must be a number between 64 and 2048');
    }
  }

  private static validateCategoryFilterSettings(settings: Record<string, unknown>, errors: string[], _warnings: string[]): void {
    const hierarchy = settings.hierarchy as any;
    if (hierarchy?.maxDepth && (typeof hierarchy.maxDepth !== 'number' || hierarchy.maxDepth < 1 || hierarchy.maxDepth > 10)) {
      errors.push('CategoryFilter hierarchy.maxDepth must be a number between 1 and 10');
    }
  }

  private static validateTemporalFilterSettings(settings: Record<string, unknown>, errors: string[], _warnings: string[]): void {
    const naturalLanguage = settings.naturalLanguage as any;
    if (naturalLanguage?.confidenceThreshold && (typeof naturalLanguage.confidenceThreshold !== 'number' || naturalLanguage.confidenceThreshold < 0 || naturalLanguage.confidenceThreshold > 1)) {
      errors.push('TemporalFilter naturalLanguage.confidenceThreshold must be a number between 0 and 1');
    }
  }

  private static validateMetadataFilterSettings(settings: Record<string, unknown>, errors: string[], _warnings: string[]): void {
    const fields = settings.fields as any;
    if (fields?.maxDepth && (typeof fields.maxDepth !== 'number' || fields.maxDepth < 1 || fields.maxDepth > 20)) {
      errors.push('MetadataFilter fields.maxDepth must be a number between 1 and 20');
    }
  }

  private static validateRelationshipSettings(settings: Record<string, unknown>, errors: string[], _warnings: string[]): void {
    if (settings.maxDepth && (typeof settings.maxDepth !== 'number' || settings.maxDepth < 1 || settings.maxDepth > 10)) {
      errors.push('Relationship maxDepth must be a number between 1 and 10');
    }

    if (settings.minRelationshipStrength && (typeof settings.minRelationshipStrength !== 'number' || settings.minRelationshipStrength < 0 || settings.minRelationshipStrength > 1)) {
      errors.push('Relationship minRelationshipStrength must be a number between 0 and 1');
    }
  }
}

/**
 * File-based configuration persistence manager
 */
class FileConfigurationPersistenceManager implements ConfigurationPersistenceManager {
  private readonly configDir: string;
  private readonly fs: any; // File system abstraction

  constructor(configDir: string = './config/search') {
    this.configDir = configDir;
    // In a real implementation, this would use the actual file system
    this.fs = {
      readFile: async (_path: string) => {
        // Placeholder - would implement actual file reading
        throw new Error('File system not implemented');
      },
      writeFile: async (_path: string, _data: string) => {
        // Placeholder - would implement actual file writing
        throw new Error('File system not implemented');
      },
      exists: async (_path: string) => {
        // Placeholder - would implement actual file existence check
        return false;
      },
      listDir: async (_path: string) => {
        // Placeholder - would implement actual directory listing
        return [];
      },
    };
  }

  async save(config: SearchStrategyConfiguration): Promise<void> {
    const filename = `${config.strategyName}.json`;
    const filepath = `${this.configDir}/${filename}`;
    const data = JSON.stringify(config, null, 2);

    try {
      await this.fs.writeFile(filepath, data);
    } catch (error) {
      throw new Error(`Failed to save configuration for ${config.strategyName}: ${error}`);
    }
  }

  async load(strategyName: string): Promise<SearchStrategyConfiguration | null> {
    const filename = `${strategyName}.json`;
    const filepath = `${this.configDir}/${filename}`;

    try {
      const exists = await this.fs.exists(filepath);
      if (!exists) {
        return null;
      }

      const data = await this.fs.readFile(filepath);
      return JSON.parse(data);
    } catch (error) {
      throw new Error(`Failed to load configuration for ${strategyName}: ${error}`);
    }
  }

  async delete(strategyName: string): Promise<void> {
    const filename = `${strategyName}.json`;
    const filepath = `${this.configDir}/${filename}`;

    try {
      const exists = await this.fs.exists(filepath);
      if (!exists) {
        return;
      }

      // In a real implementation, would delete the file
      console.log(`Would delete configuration file: ${filepath}`);
    } catch (error) {
      throw new Error(`Failed to delete configuration for ${strategyName}: ${error}`);
    }
  }

  async list(): Promise<string[]> {
    try {
      const files = await this.fs.listDir(this.configDir);
      return files
        .filter((file: string) => file.endsWith('.json'))
        .map((file: string) => file.replace('.json', ''));
    } catch (error) {
      throw new Error(`Failed to list configurations: ${error}`);
    }
  }

  async backup(name: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupId = `${name}-${timestamp}`;

    try {
      const config = await this.load(name);
      if (!config) {
        throw new Error(`Configuration ${name} not found`);
      }

      const backupFilename = `${backupId}.json`;
      const backupFilepath = `${this.configDir}/backups/${backupFilename}`;
      const data = JSON.stringify(config, null, 2);

      await this.fs.writeFile(backupFilepath, data);
      return backupId;
    } catch (error) {
      throw new Error(`Failed to backup configuration ${name}: ${error}`);
    }
  }

  async restore(name: string, backupId: string): Promise<SearchStrategyConfiguration> {
    const backupFilename = `${backupId}.json`;
    const backupFilepath = `${this.configDir}/backups/${backupFilename}`;

    try {
      const data = await this.fs.readFile(backupFilepath);
      const config = JSON.parse(data);

      // Validate the restored configuration
      const validation = ConfigurationValidator.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Invalid backup configuration: ${validation.errors.join(', ')}`);
      }

      return config;
    } catch (error) {
      throw new Error(`Failed to restore configuration ${name} from backup ${backupId}: ${error}`);
    }
  }

  async export(): Promise<Record<string, SearchStrategyConfiguration>> {
    try {
      const strategyNames = await this.list();
      const configs: Record<string, SearchStrategyConfiguration> = {};

      for (const name of strategyNames) {
        const config = await this.load(name);
        if (config) {
          configs[name] = config;
        }
      }

      return configs;
    } catch (error) {
      throw new Error(`Failed to export configurations: ${error}`);
    }
  }

  async import(configs: Record<string, SearchStrategyConfiguration>): Promise<void> {
    try {
      for (const [name, config] of Object.entries(configs)) {
        const validation = ConfigurationValidator.validateConfiguration(config);
        if (!validation.isValid) {
          throw new Error(`Invalid configuration for ${name}: ${validation.errors.join(', ')}`);
        }

        await this.save(config);
      }
    } catch (error) {
      throw new Error(`Failed to import configurations: ${error}`);
    }
  }
}

/**
 * In-memory configuration audit manager
 */
class MemoryConfigurationAuditManager implements ConfigurationAuditManager {
  private auditLog: ConfigurationAuditEntry[] = [];
  private readonly maxLogSize = 10000;

  async log(entry: ConfigurationAuditEntry): Promise<void> {
    this.auditLog.unshift(entry);

    // Maintain log size limit
    if (this.auditLog.length > this.maxLogSize) {
      this.auditLog = this.auditLog.slice(0, this.maxLogSize);
    }
  }

  async getHistory(strategyName?: string, limit?: number): Promise<ConfigurationAuditEntry[]> {
    let filteredLog = strategyName
      ? this.auditLog.filter(entry => entry.strategyName === strategyName)
      : this.auditLog;

    if (limit) {
      filteredLog = filteredLog.slice(0, limit);
    }

    return filteredLog;
  }

  async getChanges(strategyName: string, fromTimestamp: Date, toTimestamp: Date): Promise<ConfigurationAuditEntry[]> {
    return this.auditLog.filter(entry =>
      entry.strategyName === strategyName &&
      entry.timestamp >= fromTimestamp &&
      entry.timestamp <= toTimestamp &&
      entry.changes,
    );
  }
}

/**
 * Main configuration manager implementation
 */
export class SearchStrategyConfigManager implements ConfigurationManager {
  private persistenceManager: ConfigurationPersistenceManager;
  private auditManager: ConfigurationAuditManager;
  private logger: ILogger;
  private configurations: Map<string, SearchStrategyConfiguration> = new Map();

  constructor(
    persistenceManager?: ConfigurationPersistenceManager,
    auditManager?: ConfigurationAuditManager,
    logger?: ILogger,
  ) {
    this.persistenceManager = persistenceManager || new FileConfigurationPersistenceManager();
    this.auditManager = auditManager || new MemoryConfigurationAuditManager();
    this.logger = logger || console;
  }

  async loadConfiguration(name: string): Promise<SearchStrategyConfiguration | null> {
    try {
      // Check memory cache first
      if (this.configurations.has(name)) {
        await this.auditManager.log({
          timestamp: new Date(),
          action: 'load',
          strategyName: name,
          success: true,
          metadata: { source: 'memory' },
        });
        return this.configurations.get(name)!;
      }

      // Load from persistence
      const config = await this.persistenceManager.load(name);

      if (config) {
        // Cache the loaded configuration
        this.configurations.set(name, config);

        await this.auditManager.log({
          timestamp: new Date(),
          action: 'load',
          strategyName: name,
          success: true,
          metadata: { source: 'disk' },
        });
      } else {
        await this.auditManager.log({
          timestamp: new Date(),
          action: 'load',
          strategyName: name,
          success: false,
          error: 'Configuration not found',
        });
      }

      return config;
    } catch (error) {
      await this.auditManager.log({
        timestamp: new Date(),
        action: 'load',
        strategyName: name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.error(`Failed to load configuration for ${name}:`, { error: error instanceof Error ? error.message : String(error) });
      return null;
    }
  }

  async saveConfiguration(name: string, config: SearchStrategyConfiguration): Promise<void> {
    try {
      // Validate configuration
      const validation = ConfigurationValidator.validateConfiguration(config);
      if (!validation.isValid) {
        throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`);
      }

      // Get existing configuration for change tracking
      const existingConfig = await this.loadConfiguration(name);

      // Save to persistence
      await this.persistenceManager.save(config);

      // Update memory cache
      this.configurations.set(name, config);

      // Log the action
      const changes = existingConfig
        ? this.calculateChanges(existingConfig, config)
        : undefined;

      await this.auditManager.log({
        timestamp: new Date(),
        action: existingConfig ? 'update' : 'create',
        strategyName: name,
        success: true,
        changes,
      });

      this.logger.info(`Configuration saved for ${name}`);
    } catch (error) {
      await this.auditManager.log({
        timestamp: new Date(),
        action: 'save',
        strategyName: name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.error(`Failed to save configuration for ${name}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async getConfigurationNames(): Promise<string[]> {
    try {
      return await this.persistenceManager.list();
    } catch (error) {
      this.logger.error('Failed to get configuration names:', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }

  async deleteConfiguration(name: string): Promise<void> {
    try {
      await this.persistenceManager.delete(name);
      this.configurations.delete(name);

      await this.auditManager.log({
        timestamp: new Date(),
        action: 'delete',
        strategyName: name,
        success: true,
      });

      this.logger.info(`Configuration deleted for ${name}`);
    } catch (error) {
      await this.auditManager.log({
        timestamp: new Date(),
        action: 'delete',
        strategyName: name,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.error(`Failed to delete configuration for ${name}:`, { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  async validateConfiguration(config: SearchStrategyConfiguration): Promise<ConfigurationValidationResult> {
    try {
      const result = ConfigurationValidator.validateConfiguration(config);

      await this.auditManager.log({
        timestamp: new Date(),
        action: 'validate',
        strategyName: config.strategyName,
        success: result.isValid,
        error: result.isValid ? undefined : result.errors.join(', '),
        metadata: {
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
        },
      });

      return result;
    } catch (error) {
      await this.auditManager.log({
        timestamp: new Date(),
        action: 'validate',
        strategyName: config.strategyName,
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        isValid: false,
        errors: [error instanceof Error ? error.message : String(error)],
        warnings: [],
      };
    }
  }

  getDefaultConfiguration(strategyName: string): SearchStrategyConfiguration {
    const defaultConfig = DEFAULT_STRATEGY_CONFIGS[strategyName as SearchStrategy];
    if (!defaultConfig) {
      throw new Error(`No default configuration available for strategy: ${strategyName}`);
    }

    return JSON.parse(JSON.stringify(defaultConfig)); // Deep clone
  }

  mergeConfigurations(base: SearchStrategyConfiguration, override: Partial<SearchStrategyConfiguration>): SearchStrategyConfiguration {
    const merged = { ...base };

    if (override.enabled !== undefined) merged.enabled = override.enabled;
    if (override.priority !== undefined) merged.priority = override.priority;
    if (override.timeout !== undefined) merged.timeout = override.timeout;
    if (override.maxResults !== undefined) merged.maxResults = override.maxResults;

    if (override.performance) {
      merged.performance = { ...merged.performance, ...override.performance };
    }

    if (override.scoring) {
      merged.scoring = { ...merged.scoring, ...override.scoring };
    }

    if (override.strategySpecific) {
      merged.strategySpecific = { ...merged.strategySpecific, ...override.strategySpecific };
    }

    return merged;
  }

  /**
   * Get all current cached configurations
   */
  getCachedConfigurations(): Map<string, SearchStrategyConfiguration> {
    return new Map(this.configurations);
  }

  /**
   * Clear configuration cache
   */
  clearCache(): void {
    this.configurations.clear();
  }

  /**
   * Calculate changes between two configurations
   */
  private calculateChanges(oldConfig: SearchStrategyConfiguration, newConfig: SearchStrategyConfiguration): Record<string, { from: unknown; to: unknown }> {
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    // Check top-level properties
    const fields = ['enabled', 'priority', 'timeout', 'maxResults'];
    for (const field of fields) {
      const oldValue = (oldConfig as any)[field];
      const newValue = (newConfig as any)[field];
      if (oldValue !== newValue) {
        changes[field] = { from: oldValue, to: newValue };
      }
    }

    // Check performance settings
    if (oldConfig.performance && newConfig.performance) {
      const perfFields = ['enableCaching', 'cacheSize', 'enableParallelExecution'];
      for (const field of perfFields) {
        const oldValue = oldConfig.performance[field as keyof typeof oldConfig.performance];
        const newValue = newConfig.performance[field as keyof typeof newConfig.performance];
        if (oldValue !== newValue) {
          changes[`performance.${field}`] = { from: oldValue, to: newValue };
        }
      }
    }

    // Check scoring settings
    if (oldConfig.scoring && newConfig.scoring) {
      const scoringFields = ['baseWeight', 'recencyWeight', 'importanceWeight', 'relationshipWeight'];
      for (const field of scoringFields) {
        const oldValue = oldConfig.scoring[field as keyof typeof oldConfig.scoring];
        const newValue = newConfig.scoring[field as keyof typeof newConfig.scoring];
        if (oldValue !== newValue) {
          changes[`scoring.${field}`] = { from: oldValue, to: newValue };
        }
      }
    }

    return changes;
  }

  /**
   * Export all configurations for backup or migration
   */
  async exportConfigurations(): Promise<Record<string, SearchStrategyConfiguration>> {
    try {
      return await this.persistenceManager.export();
    } catch (error) {
      this.logger.error('Failed to export configurations:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Import configurations from backup or migration
   */
  async importConfigurations(configs: Record<string, SearchStrategyConfiguration>): Promise<void> {
    try {
      await this.persistenceManager.import(configs);

      // Update cache
      for (const [name, config] of Object.entries(configs)) {
        this.configurations.set(name, config);
      }

      await this.auditManager.log({
        timestamp: new Date(),
        action: 'import',
        strategyName: 'system',
        success: true,
        metadata: {
          importedCount: Object.keys(configs).length,
        },
      });

      this.logger.info(`Imported ${Object.keys(configs).length} configurations`);
    } catch (error) {
      await this.auditManager.log({
        timestamp: new Date(),
        action: 'import',
        strategyName: 'system',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });

      this.logger.error('Failed to import configurations:', { error: error instanceof Error ? error.message : String(error) });
      throw error;
    }
  }

  /**
   * Get configuration audit history
   */
  async getAuditHistory(strategyName?: string, limit?: number): Promise<ConfigurationAuditEntry[]> {
    try {
      return await this.auditManager.getHistory(strategyName, limit);
    } catch (error) {
      this.logger.error('Failed to get audit history:', { error: error instanceof Error ? error.message : String(error) });
      return [];
    }
  }
}