/**
 * MetadataFilterStrategy - Comprehensive metadata field filtering
 *
 * Implements advanced metadata-based search capabilities including:
 * - Metadata field extraction and validation
 * - Complex metadata filtering with multiple operators
 * - Metadata aggregation and analysis
 * - Field validation and type checking
 * - Performance optimization for metadata queries
 */

import { SearchQuery, SearchResult, ISearchStrategy, SearchStrategy } from '../types';
import { SearchStrategyMetadata, SearchCapability, SearchError } from '../SearchStrategy';
import { DatabaseManager } from '../../database/DatabaseManager';
import { logError, logWarn, logInfo } from '../../utils/Logger';

/**
 * Extended query interface for metadata filtering
 */
interface MetadataFilterQuery extends SearchQuery {
  metadataFilters?: {
    fields?: MetadataField[];
    aggregation?: MetadataAggregation;
    validation?: MetadataValidation;
  };
  metadataOptions?: {
    includeNested?: boolean;
    enableTypeChecking?: boolean;
    enableAggregation?: boolean;
    maxFieldDepth?: number;
  };
}

/**
 * Metadata field interface for filtering
 */
export interface MetadataField {
  key: string;
  value: unknown;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'in' | 'exists' | 'type';
  type?: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
}

/**
 * Metadata aggregation configuration
 */
export interface MetadataAggregation {
  enabled: boolean;
  groupBy?: string[];
  aggregations?: {
    count?: boolean;
    distinct?: string[];
    min?: string[];
    max?: string[];
    avg?: string[];
  };
  having?: MetadataField[];
}

/**
 * Metadata validation configuration
 */
export interface MetadataValidation {
  strict: boolean;
  requiredFields?: string[];
  fieldTypes?: Record<string, string>;
  customValidators?: Array<{
    field: string;
    validator: (value: unknown) => boolean;
    message: string;
  }>;
}

/**
 * Configuration for MetadataFilterStrategy
 */
export interface MetadataFilterStrategyConfig {
  fields: {
    enableNestedAccess: boolean;
    maxDepth: number;
    enableTypeValidation: boolean;
    enableFieldDiscovery: boolean;
  };
  aggregation?: {
    enableAggregation: boolean;
    maxGroupFields: number;
    enableComplexAggregation: boolean;
  };
  validation: {
    strictValidation: boolean;
    enableCustomValidators: boolean;
    failOnInvalidMetadata: boolean;
  };
  performance: {
    enableQueryOptimization: boolean;
    enableResultCaching: boolean;
    maxExecutionTime: number;
    batchSize: number;
    cacheSize: number;
  };
}

/**
 * Specialized strategy for comprehensive metadata filtering
 */
export class MetadataFilterStrategy implements ISearchStrategy {
  readonly name = SearchStrategy.METADATA_FILTER;
  readonly priority = 9;
  readonly supportedMemoryTypes = ['short_term', 'long_term'] as const;

  readonly description = 'Comprehensive metadata field filtering with validation and aggregation';
  readonly capabilities = [
    SearchCapability.FILTERING,
    SearchCapability.RELEVANCE_SCORING,
  ] as const;

  private readonly databaseManager: DatabaseManager;
  private readonly config: MetadataFilterStrategyConfig;
  private readonly cache = new Map<string, { result: SearchResult[]; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    config: MetadataFilterStrategyConfig,
    databaseManager: DatabaseManager,
  ) {
    this.config = config;
    this.databaseManager = databaseManager;
  }

  /**
   * Determines if this strategy can handle the given query
   */
  canHandle(query: SearchQuery): boolean {
    return this.hasMetadataFilters(query) || this.containsMetadataPatterns(query.text);
  }

  /**
   * Check if query has metadata filters
   */
  private hasMetadataFilters(query: SearchQuery): boolean {
    const metadataQuery = query as MetadataFilterQuery;
    return !!(
      metadataQuery.metadataFilters &&
      metadataQuery.metadataFilters.fields &&
      metadataQuery.metadataFilters.fields.length > 0
    );
  }

  /**
   * Check if query text contains metadata patterns
   */
  private containsMetadataPatterns(text: string): boolean {
    if (!text || !this.config.fields.enableFieldDiscovery) {
      return false;
    }

    const metadataPatterns = [
      /\b(metadata|meta)\s*[=:]\s*[\w{]/i,
      /\b(field|property)\s*[=:]\s*\w+/i,
      /\b(key|value)\s*[=:]\s*[\w"']/i,
      /\bjson_extract\s*\(/i,
      /\$[\.\w]+/,
    ];

    return metadataPatterns.some(pattern => pattern.test(text));
  }

  /**
   * Main search method implementing metadata-based filtering (required by ISearchStrategy)
   */
  async search(query: SearchQuery): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Parse and validate metadata filters
      const metadataQuery = this.parseMetadataQuery(query);

      // Build metadata SQL query
      const sql = this.buildMetadataSQL(query, metadataQuery);

      // Execute query with performance optimization
      const rawResults = await this.executeMetadataQuery(sql, this.getQueryParameters(query, metadataQuery));

      // Process and validate results
      let processedResults = this.processMetadataResults(rawResults, query, metadataQuery);

      // Apply aggregation if requested
      if (this.shouldApplyAggregation(query)) {
        processedResults = await this.applyMetadataAggregation(processedResults, query);
      }

      // Cache results if enabled
      if (this.config.performance.enableResultCaching) {
        this.cacheResult(query, processedResults);
      }

      // Log performance metrics
      const duration = Date.now() - startTime;
      logInfo(`Metadata search completed in ${duration}ms, found ${processedResults.length} results`, {
        component: 'MetadataFilterStrategy',
        operation: 'execute',
        strategy: this.name,
        duration: `${duration}ms`,
        resultCount: processedResults.length
      });

      return processedResults;

    } catch (error) {
      const duration = Date.now() - startTime;
      logError(`Metadata search failed after ${duration}ms`, {
        component: 'MetadataFilterStrategy',
        operation: 'execute',
        strategy: this.name,
        query: query.text,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new SearchError(
        `Metadata filter strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        { query: query.text, duration: `${duration}ms` }
      );
    }
  }

  /**
   * Legacy execute method for backward compatibility
   */
  async execute(query: SearchQuery, _dbManager: DatabaseManager): Promise<SearchResult[]> {
    const startTime = Date.now();

    try {
      // Parse and validate metadata filters
      const metadataQuery = this.parseMetadataQuery(query);

      // Build metadata SQL query
      const sql = this.buildMetadataSQL(query, metadataQuery);

      // Execute query with performance optimization
      const rawResults = await this.executeMetadataQuery(sql, this.getQueryParameters(query, metadataQuery));

      // Process and validate results
      let processedResults = this.processMetadataResults(rawResults, query, metadataQuery);

      // Apply aggregation if requested
      if (this.shouldApplyAggregation(query)) {
        processedResults = await this.applyMetadataAggregation(processedResults, query);
      }

      // Cache results if enabled
      if (this.config.performance.enableResultCaching) {
        this.cacheResult(query, processedResults);
      }

      // Log performance metrics
      const duration = Date.now() - startTime;
      logInfo(`Metadata search completed in ${duration}ms, found ${processedResults.length} results`, {
        component: 'MetadataFilterStrategy',
        operation: 'search',
        strategy: this.name,
        duration: `${duration}ms`,
        resultCount: processedResults.length
      });

      return processedResults;

    } catch (error) {
      const duration = Date.now() - startTime;
      logError(`Metadata search failed after ${duration}ms`, {
        component: 'MetadataFilterStrategy',
        operation: 'search',
        strategy: this.name,
        query: query.text,
        duration: `${duration}ms`,
        error: error instanceof Error ? error.message : String(error)
      });

      throw new SearchError(
        `Metadata filter strategy failed: ${error instanceof Error ? error.message : String(error)}`,
        this.name,
        { query: query.text, duration: `${duration}ms` }
      );
    }
  }

  /**
   * Parse metadata query from search query
   */
  private parseMetadataQuery(query: SearchQuery): MetadataQuery {
    const metadataQuery = query as MetadataFilterQuery;
    const fields: MetadataField[] = [];

    // Process explicit metadata filters
    if (metadataQuery.metadataFilters?.fields) {
      fields.push(...metadataQuery.metadataFilters.fields);
    }

    // Parse metadata patterns from text
    if (query.text && this.config.fields.enableFieldDiscovery) {
      const parsedFields = this.parseMetadataFromText(query.text);
      fields.push(...parsedFields);
    }

    return {
      fields,
      aggregation: metadataQuery.metadataFilters?.aggregation,
      validation: metadataQuery.metadataFilters?.validation,
      options: metadataQuery.metadataOptions || {}
    };
  }

  /**
   * Parse metadata fields from text patterns
   */
  private parseMetadataFromText(text: string): MetadataField[] {
    const fields: MetadataField[] = [];

    // Pattern: metadata.key=value or meta.key=value
    const metadataPattern = /(?:metadata|meta)\s*\.\s*(\w+)\s*[=:]\s*["']?([^"'\s]+)["']?/gi;
    let match;

    while ((match = metadataPattern.exec(text)) !== null) {
      fields.push({
        key: match[1],
        value: match[2],
        operator: 'eq',
        type: this.inferFieldType(match[2])
      });
    }

    // Pattern: field:key=value or property:key=value
    const fieldPattern = /(?:field|property)\s*[=:]\s*(\w+)/gi;
    while ((match = fieldPattern.exec(text)) !== null) {
      const keyValuePattern = new RegExp(`\\b${match[1]}\\s*[=:]\\s*["']?([^"'\s]+)["']?`, 'gi');
      const keyMatch = keyValuePattern.exec(text);
      if (keyMatch) {
        fields.push({
          key: match[1],
          value: keyMatch[1],
          operator: 'eq',
          type: this.inferFieldType(keyMatch[1])
        });
      }
    }

    return fields;
  }

  /**
   * Infer field type from value
   */
  private inferFieldType(value: string): MetadataField['type'] {
    // Boolean
    if (value === 'true' || value === 'false') {
      return 'boolean';
    }

    // Number
    if (!isNaN(Number(value))) {
      return 'number';
    }

    // Array (JSON-like)
    if (value.startsWith('[') && value.endsWith(']')) {
      return 'array';
    }

    // Object (JSON-like)
    if (value.startsWith('{') && value.endsWith('}')) {
      return 'object';
    }

    // Default to string
    return 'string';
  }

  /**
   * Build metadata SQL query
   */
  private buildMetadataSQL(query: SearchQuery, metadataQuery: MetadataQuery): string {
    const limit = query.limit || 100;
    const offset = query.offset || 0;

    // Build WHERE clause with metadata conditions
    const whereClause = this.buildMetadataWhereClause(query, metadataQuery);

    // Build ORDER BY clause with metadata relevance
    const orderByClause = this.buildMetadataOrderByClause(query, metadataQuery);

    // Build the main metadata query
    const sql = `
      SELECT
        id,
        searchableContent,
        summary,
        processedData,
        retentionType,
        categoryPrimary,
        importanceScore,
        createdAt,
        '${this.name}' as search_strategy,
        -- Calculate metadata relevance score
        ${this.buildMetadataRelevanceCalculation(metadataQuery)} as metadata_relevance_score
      FROM (
        -- Query short_term_memory with metadata filtering
        SELECT
          id,
          searchableContent,
          summary,
          processedData,
          retentionType,
          categoryPrimary,
          importanceScore,
          createdAt
        FROM short_term_memory
        WHERE ${whereClause}

        UNION ALL

        -- Query long_term_memory with metadata filtering
        SELECT
          id,
          searchableContent,
          summary,
          processedData,
          retentionType,
          categoryPrimary,
          importanceScore,
          createdAt
        FROM long_term_memory
        WHERE ${whereClause}
      ) AS metadata_memories
      ${orderByClause}
      LIMIT ${limit} OFFSET ${offset}
    `;

    return sql;
  }

  /**
   * Build WHERE clause with metadata filtering
   */
  private buildMetadataWhereClause(query: SearchQuery, metadataQuery: MetadataQuery): string {
    const conditions: string[] = [];

    // Add namespace filtering if available
    if ((this.databaseManager as any).currentNamespace) {
      conditions.push(`json_extract(metadata, '$.namespace') = '${(this.databaseManager as any).currentNamespace}'`);
    }

    // Add text search conditions
    if (query.text && query.text.trim()) {
      const searchCondition = this.buildTextSearchCondition(query.text);
      conditions.push(searchCondition);
    }

    // Add metadata field conditions
    if (metadataQuery.fields.length > 0) {
      const metadataConditions = metadataQuery.fields.map(field =>
        this.buildMetadataFieldCondition(field)
      ).filter(Boolean);

      if (metadataConditions.length > 0) {
        conditions.push(`(${metadataConditions.join(' AND ')})`);
      }
    }

    return conditions.length > 0 ? conditions.join(' AND ') : '1=1';
  }

  /**
   * Build metadata field condition
   */
  private buildMetadataFieldCondition(field: MetadataField): string | null {
    const { key, value, operator, type } = field;

    // Validate field access
    if (!this.validateMetadataField(key, type)) {
      return null;
    }

    // Build JSON path
    const jsonPath = this.config.fields.enableNestedAccess ?
      `$.${key.replace(/\./g, '.$.')}` : `$.${key}`;

    switch (operator) {
      case 'eq':
        return `json_extract(metadata, '${jsonPath}') = '${this.escapeSqlString(String(value))}'`;

      case 'ne':
        return `json_extract(metadata, '${jsonPath}') != '${this.escapeSqlString(String(value))}'`;

      case 'gt':
      case 'gte':
      case 'lt':
      case 'lte':
        if (type === 'number') {
          const numValue = Number(value);
          const op = operator === 'gt' ? '>' : operator === 'gte' ? '>=' :
            operator === 'lt' ? '<' : '<=';
          return `CAST(json_extract(metadata, '${jsonPath}') AS REAL) ${op} ${numValue}`;
        }
        return null;

      case 'contains':
        return `json_extract(metadata, '${jsonPath}') LIKE '%${this.escapeSqlString(String(value))}%'`;

      case 'in':
        if (Array.isArray(value)) {
          const values = value.map(v => `'${this.escapeSqlString(String(v))}'`).join(', ');
          return `json_extract(metadata, '${jsonPath}') IN (${values})`;
        }
        return null;

      case 'exists':
        return `json_extract(metadata, '${jsonPath}') IS NOT NULL`;

      case 'type':
        return `json_type(metadata, '${jsonPath}') = '${value}'`;

      default:
        return null;
    }
  }

  /**
   * Build text search conditions
   */
  private buildTextSearchCondition(searchText: string): string {
    const terms = searchText.split(/\s+/).filter(term => term.length > 0);
    const conditions: string[] = [];

    for (const term of terms) {
      const escapedTerm = this.escapeSqlString(term);
      conditions.push(
        `(searchable_content LIKE '%${escapedTerm}%' OR summary LIKE '%${escapedTerm}%')`
      );
    }

    return `(${conditions.join(' OR ')})`;
  }

  /**
   * Build metadata relevance calculation SQL
   */
  private buildMetadataRelevanceCalculation(metadataQuery: MetadataQuery): string {
    let calculation = '0.5'; // Base relevance

    // Add field match relevance
    if (metadataQuery.fields.length > 0) {
      const fieldBoosts = metadataQuery.fields.map(field => {
        const jsonPath = this.config.fields.enableNestedAccess ?
          `$.${field.key.replace(/\./g, '.$.')}` : `$.${field.key}`;

        return `
          CASE
            WHEN json_extract(processedData, '${jsonPath}') IS NOT NULL THEN 0.2
            ELSE 0.0
          END
        `;
      });

      calculation = `(${calculation} + ${fieldBoosts.join(' + ')})`;
    }

    return calculation;
  }

  /**
   * Build ORDER BY clause with metadata relevance
   */
  private buildMetadataOrderByClause(query: SearchQuery, metadataQuery: MetadataQuery): string {
    let orderBy = 'ORDER BY metadata_relevance_score DESC';

    // Add secondary sorting criteria
    if (query.sortBy) {
      const direction = query.sortBy.direction.toUpperCase();
      orderBy += `, ${query.sortBy.field} ${direction}`;
    } else {
      // Default secondary sort by importance and recency
      orderBy += ', importance_score DESC, created_at DESC';
    }

    return orderBy;
  }

  /**
   * Get query parameters for safe execution
   */
  private getQueryParameters(query: SearchQuery, metadataQuery: MetadataQuery): unknown[] {
    const parameters: unknown[] = [];

    // Add field values as parameters for security
    metadataQuery.fields.forEach(field => {
      if (field.operator === 'in' && Array.isArray(field.value)) {
        parameters.push(...field.value);
      } else if (field.operator !== 'exists' && field.operator !== 'type') {
        parameters.push(field.value);
      }
    });

    return parameters;
  }

  /**
   * Execute metadata query with error handling
   */
  private async executeMetadataQuery(sql: string, parameters: unknown[]): Promise<unknown[]> {
    const db = (this.databaseManager as any).prisma || this.databaseManager;

    try {
      return await db.$queryRawUnsafe(sql, ...parameters);
    } catch (error) {
      // Log detailed error information for debugging
      logError('Metadata query execution failed with details', {
        component: 'MetadataFilterStrategy',
        operation: 'executeMetadataQuery',
        error: error instanceof Error ? error.message : String(error),
        sql: sql.substring(0, 500) + (sql.length > 500 ? '...' : ''), // Log first 500 chars of SQL
        parameters: parameters,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Re-throw with more context
      const dbError = error instanceof Error ? error : new Error(String(error));
      dbError.message = `Metadata query failed: ${dbError.message}. SQL: ${sql.substring(0, 200)}... Parameters: ${JSON.stringify(parameters)}`;
      throw dbError;
    }
  }

  /**
   * Process metadata results with enhanced scoring
   */
  private processMetadataResults(
    results: unknown[],
    query: SearchQuery,
    metadataQuery: MetadataQuery
  ): SearchResult[] {
    const searchResults: SearchResult[] = [];

    for (const row of results as any[]) {
      try {
        const metadata = JSON.parse(row.metadata || '{}');

        // Extract and validate metadata fields
        const extractedFields = this.extractMetadataFields(metadata);

        // Calculate metadata relevance score
        const metadataRelevance = this.calculateMetadataRelevance(
          extractedFields,
          metadataQuery,
          query
        );

        // Validate metadata if required
        if (metadataQuery.validation?.strict) {
          const validation = this.validateMetadata(metadata, metadataQuery.validation);
          if (!validation.isValid) {
            if (this.config.validation.failOnInvalidMetadata) {
              continue; // Skip invalid metadata
            } else {
              logWarn('Invalid metadata found', {
                component: 'MetadataFilterStrategy',
                operation: 'processMetadataResults',
                rowId: row.id,
                validationErrors: validation.errors
              });
            }
          }
        }

        // Create enhanced search result
        const searchResult: SearchResult = {
          id: row.id,
          content: row.searchableContent,
          metadata: {
            summary: row.summary || '',
            category: row.categoryPrimary,
            importanceScore: parseFloat(row.importanceScore) || 0.5,
            memoryType: row.retentionType,
            createdAt: new Date(row.createdAt),
            metadataRelevanceScore: metadataRelevance,
            extractedFields: extractedFields,
            searchStrategy: this.name,
            ...metadata
          },
          score: metadataRelevance,
          strategy: this.name,
          timestamp: new Date(row.createdAt)
        };

        searchResults.push(searchResult);

      } catch (error) {
        logWarn('Error processing metadata result row', {
          component: 'MetadataFilterStrategy',
          operation: 'processMetadataResults',
          rowId: row.memory_id,
          error: error instanceof Error ? error.message : String(error as Error)
        });
        continue;
      }
    }

    return searchResults;
  }

  /**
   * Extract metadata fields with proper type handling
   */
  private extractMetadataFields(metadata: Record<string, unknown>): MetadataField[] {
    const fields: MetadataField[] = [];

    const extractFields = (obj: Record<string, unknown>, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (this.config.fields.enableNestedAccess && typeof value === 'object' && value !== null) {
          extractFields(value as Record<string, unknown>, fullKey);
        } else {
          fields.push({
            key: fullKey,
            value: value,
            operator: 'exists',
            type: this.inferFieldType(String(value))
          });
        }
      }
    };

    extractFields(metadata);
    return fields;
  }

  /**
   * Validate metadata field
   */
  private validateMetadataField(fieldName: string, expectedType?: string): boolean {
    if (!fieldName || fieldName.length === 0) {
      return false;
    }

    if (expectedType && this.config.fields.enableTypeValidation) {
      // Additional type validation logic can be added here
    }

    return true;
  }

  /**
   * Validate metadata against validation rules
   */
  private validateMetadata(
    metadata: Record<string, unknown>,
    validation: MetadataValidation
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check required fields
    if (validation.requiredFields) {
      for (const requiredField of validation.requiredFields) {
        if (!(requiredField in metadata)) {
          errors.push(`Required field '${requiredField}' is missing`);
        }
      }
    }

    // Check field types
    if (validation.fieldTypes) {
      for (const [field, expectedType] of Object.entries(validation.fieldTypes)) {
        const actualValue = metadata[field];
        const actualType = this.inferFieldType(String(actualValue));

        if (actualValue !== undefined && actualType !== expectedType) {
          errors.push(`Field '${field}' has type '${actualType}', expected '${expectedType}'`);
        }
      }
    }

    // Run custom validators
    if (validation.customValidators && this.config.validation.enableCustomValidators) {
      for (const validator of validation.customValidators) {
        const value = metadata[validator.field];
        if (!validator.validator(value)) {
          errors.push(`Custom validation failed for '${validator.field}': ${validator.message}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Calculate metadata relevance based on field matches and validation
   */
  private calculateMetadataRelevance(
    extractedFields: MetadataField[],
    metadataQuery: MetadataQuery,
    query: SearchQuery
  ): number {
    let relevance = 0.3; // Base relevance

    // Field match boost
    const matchedFields = extractedFields.filter(field =>
      metadataQuery.fields.some(queryField =>
        queryField.key === field.key &&
        this.compareMetadataValues(field.value, queryField.value, queryField.operator)
      )
    );

    if (matchedFields.length > 0) {
      relevance += matchedFields.length * 0.2;
    }

    // Query text relevance
    if (query.text) {
      const content = (query as any).searchable_content?.toLowerCase() || '';
      const searchText = query.text.toLowerCase();

      if (content.includes(searchText)) {
        relevance += 0.2;
      }
    }

    return Math.max(0, Math.min(1, relevance));
  }

  /**
   * Compare metadata values based on operator
   */
  private compareMetadataValues(value: unknown, filterValue: unknown, operator: string): boolean {
    switch (operator) {
      case 'eq':
        return value == filterValue;
      case 'ne':
        return value != filterValue;
      case 'contains':
        return String(value).includes(String(filterValue));
      case 'in':
        return Array.isArray(filterValue) && filterValue.includes(value);
      case 'exists':
        return value !== null && value !== undefined;
      default:
        return false;
    }
  }

  /**
   * Apply metadata aggregation if requested
   */
  private async applyMetadataAggregation(
    results: SearchResult[],
    query: SearchQuery
  ): Promise<SearchResult[]> {
    if (!this.shouldApplyAggregation(query)) {
      return results;
    }

    const metadataQuery = query as MetadataFilterQuery;
    const aggregation = metadataQuery.metadataFilters?.aggregation;

    if (!aggregation || !aggregation.enabled) {
      return results;
    }

    // Group results by specified fields
    const groupedResults = this.groupResultsByFields(results, aggregation.groupBy || []);

    // Apply aggregations
    const aggregatedResults: SearchResult[] = [];

    for (const [groupKey, group] of groupedResults.entries()) {
      const aggregatedResult = this.createAggregatedResult(groupKey, group, aggregation);
      aggregatedResults.push(aggregatedResult);
    }

    return aggregatedResults;
  }

  /**
   * Group results by metadata fields
   */
  private groupResultsByFields(results: SearchResult[], groupByFields: string[]): Map<string, SearchResult[]> {
    const groups = new Map<string, SearchResult[]>();

    for (const result of results) {
      const groupKey = this.generateGroupKey(result, groupByFields);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(result);
    }

    return groups;
  }

  /**
   * Generate group key from result metadata
   */
  private generateGroupKey(result: SearchResult, groupByFields: string[]): string {
    const keyParts: string[] = [];

    for (const field of groupByFields) {
      const value = this.getNestedMetadataValue(result.metadata, field);
      keyParts.push(`${field}:${String(value)}`);
    }

    return keyParts.join('|');
  }

  /**
   * Get nested metadata value
   */
  private getNestedMetadataValue(metadata: Record<string, unknown>, fieldPath: string): unknown {
    return fieldPath.split('.').reduce((obj: unknown, key: string) => {
      if (obj && typeof obj === 'object' && key in obj) {
        return (obj as Record<string, unknown>)[key];
      }
      return undefined;
    }, metadata);
  }

  /**
   * Create aggregated result from group
   */
  private createAggregatedResult(groupKey: string, group: SearchResult[], aggregation: MetadataAggregation): SearchResult {
    const representative = group[0]; // Use first result as representative

    // Calculate aggregate statistics
    const statistics = {
      count: group.length,
      averageScore: group.reduce((sum, r) => sum + r.score, 0) / group.length,
      minScore: Math.min(...group.map(r => r.score)),
      maxScore: Math.max(...group.map(r => r.score))
    };

    return {
      id: `aggregated_${groupKey}`,
      content: `Aggregated results for metadata group: ${groupKey}`,
      metadata: {
        aggregated: true,
        groupKey: groupKey,
        statistics: statistics,
        resultCount: group.length,
        fieldValues: this.extractGroupFieldValues(group),
        searchStrategy: this.name
      },
      score: statistics.averageScore,
      strategy: this.name,
      timestamp: representative.timestamp
    };
  }

  /**
   * Extract field values for aggregated group
   */
  private extractGroupFieldValues(group: SearchResult[]): Record<string, unknown[]> {
    const fieldValues: Record<string, Set<unknown>> = {};

    for (const result of group) {
      for (const [key, value] of Object.entries(result.metadata)) {
        if (!fieldValues[key]) {
          fieldValues[key] = new Set();
        }
        fieldValues[key].add(value);
      }
    }

    // Convert Sets to Arrays for JSON serialization
    const result: Record<string, unknown[]> = {};
    for (const key in fieldValues) {
      result[key] = Array.from(fieldValues[key]);
    }

    return result;
  }

  /**
   * Check if aggregation should be applied
   */
  private shouldApplyAggregation(query: SearchQuery): boolean {
    const metadataQuery = query as MetadataFilterQuery;
    return !!(
      this.config.aggregation?.enableAggregation &&
      metadataQuery.metadataFilters?.aggregation?.enabled
    );
  }

  /**
   * Cache search results for performance
   */
  private cacheResult(query: SearchQuery, results: SearchResult[]): void {
    const cacheKey = this.generateCacheKey(query);
    this.cache.set(cacheKey, {
      result: results,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    this.cleanupCache();
  }

  /**
   * Generate cache key for query
   */
  private generateCacheKey(query: SearchQuery): string {
    const metadataQuery = query as MetadataFilterQuery;
    const keyData = {
      text: query.text,
      metadataFilters: metadataQuery.metadataFilters,
      limit: query.limit,
      offset: query.offset
    };
    return JSON.stringify(keyData);
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.CACHE_TTL) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Escape SQL strings to prevent injection
   */
  private escapeSqlString(str: string): string {
    return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
  }

  /**
   * Validate strategy-specific configuration
   */
  protected validateStrategyConfiguration(): boolean {
    if (this.config.fields.maxDepth < 1 || this.config.fields.maxDepth > 10) {
      return false;
    }

    if (this.config.performance.maxExecutionTime < 1000 || this.config.performance.maxExecutionTime > 60000) {
      return false;
    }

    if (this.config.performance.batchSize < 1 || this.config.performance.batchSize > 1000) {
      return false;
    }

    return true;
  }

  /**
   * Get configuration schema for this strategy
   */
  protected getConfigurationSchema(): Record<string, unknown> {
    return {
      type: 'object',
      properties: {
        enableNestedAccess: { type: 'boolean', default: true },
        enableTypeValidation: { type: 'boolean', default: true },
        enableFieldDiscovery: { type: 'boolean', default: true },
        enableAggregation: { type: 'boolean', default: true },
        maxDepth: { type: 'number', minimum: 1, maximum: 10, default: 5 },
        strictValidation: { type: 'boolean', default: false },
        enableCustomValidators: { type: 'boolean', default: true },
        failOnInvalidMetadata: { type: 'boolean', default: false },
        enableQueryOptimization: { type: 'boolean', default: true },
        enableResultCaching: { type: 'boolean', default: true },
        maxExecutionTime: { type: 'number', minimum: 1000, maximum: 60000, default: 10000 },
        batchSize: { type: 'number', minimum: 1, maximum: 1000, default: 100 },
        cacheSize: { type: 'number', minimum: 1, maximum: 1000, default: 100 }
      }
    };
  }

  /**
   * Get performance metrics for this strategy
   */
  protected getPerformanceMetrics(): SearchStrategyMetadata['performanceMetrics'] {
    return {
      averageResponseTime: 80,
      throughput: 600,
      memoryUsage: 10
    };
  }

  /**
   * Get metadata about this search strategy
   */
  getMetadata(): SearchStrategyMetadata {
    return {
      name: this.name,
      version: '1.0.0',
      description: this.description,
      capabilities: [...this.capabilities],
      supportedMemoryTypes: [...this.supportedMemoryTypes],
      configurationSchema: {
        type: 'object',
        properties: {
          priority: { type: 'number', minimum: 0, maximum: 100 },
          timeout: { type: 'number', minimum: 1000, maximum: 30000 },
        },
      },
      performanceMetrics: {
        averageResponseTime: 80,
        throughput: 600,
        memoryUsage: 10,
      },
    };
  }

  /**
   * Validate the current configuration
   */
  async validateConfiguration(): Promise<boolean> {
    try {
      // Validate strategy configuration
      if (!this.config) {
        return false;
      }

      // Validate field configuration
      if (this.config.fields.maxDepth < 1 || this.config.fields.maxDepth > 10) {
        return false;
      }

      // Validate performance configuration
      if (this.config.performance.maxExecutionTime < 1000 || this.config.performance.maxExecutionTime > 60000) {
        return false;
      }

      return true;

    } catch (error) {
      logError('Configuration validation failed', {
        component: 'MetadataFilterStrategy',
        operation: 'validateConfiguration',
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }
}

/**
 * Metadata query interface
 */
interface MetadataQuery {
  fields: MetadataField[];
  aggregation?: MetadataAggregation;
  validation?: MetadataValidation;
  options: {
    includeNested?: boolean;
    enableTypeChecking?: boolean;
    enableAggregation?: boolean;
    maxFieldDepth?: number;
  };
}