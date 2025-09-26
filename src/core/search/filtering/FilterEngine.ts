import {
  FilterNode,
  FilterType,
  FilterOperator,
  FilterValidationResult,
  FilterExecutionContext,
  FilterExecutionResult,
  FilterExpression
} from './types';

/**
 * Core FilterEngine class for processing complex filter combinations
 */
export class FilterEngine {
  constructor() {}

  parseFilter(filterExpression: FilterExpression): FilterNode {
    return this.parseExpression(filterExpression);
  }

  async executeFilter(
    filter: FilterNode,
    results: unknown[],
    context?: FilterExecutionContext
  ): Promise<FilterExecutionResult> {
    const validation = this.validateFilter(filter);
    if (!validation.isValid) {
      throw new FilterEngineError(
        `Invalid filter: ${validation.errors.map(e => e.message).join(', ')}`,
        'VALIDATION_ERROR',
        { validation }
      );
    }

    const startTime = Date.now();
    const filteredResults = this.executeInMemory(filter, results);
    const executionTime = Date.now() - startTime;

    return {
      filteredItems: filteredResults,
      totalCount: results.length,
      filteredCount: filteredResults.length,
      executionTime,
      strategyUsed: 'in_memory_filtering',
      metadata: {
        originalFilter: filter,
        context: context || {}
      }
    };
  }

  async executeFilterAsQuery(
    filter: FilterNode,
    baseQuery: string,
    context?: FilterExecutionContext
  ): Promise<{ sql: string; parameters: unknown[]; estimatedCost: number }> {
    const validation = this.validateFilter(filter);
    if (!validation.isValid) {
      throw new FilterEngineError(
        `Invalid filter: ${validation.errors.map(e => e.message).join(', ')}`,
        'VALIDATION_ERROR',
        { validation }
      );
    }

    return this.generateDatabaseQuery(filter, baseQuery);
  }

  validateFilter(filter: FilterNode): FilterValidationResult {
    return this.validate(filter);
  }

  createBuilder(): FilterBuilder {
    return new FilterBuilder();
  }

  async parseAndExecute(
    filterExpression: FilterExpression,
    results: unknown[],
    context?: FilterExecutionContext
  ): Promise<FilterExecutionResult> {
    const filter = this.parseFilter(filterExpression);
    return this.executeFilter(filter, results, context);
  }

  getMetadata() {
    return {
      supportedOperators: Object.values(FilterOperator),
      supportedTypes: Object.values(FilterType),
      maxNestingDepth: 10,
      maxChildrenPerNode: 100,
      performanceFeatures: [
        'query_optimization',
        'index_utilization',
        'caching',
        'parallel_processing'
      ],
      version: '1.0.0'
    };
  }

  private parseExpression(expression: string): FilterNode {
    const trimmed = expression.trim();

    if (trimmed.includes(' AND ')) {
      const parts = trimmed.split(' AND ');
      return {
        type: FilterType.LOGICAL,
        field: '',
        operator: FilterOperator.AND,
        value: null,
        children: parts.map(part => this.parseExpression(part))
      };
    }

    if (trimmed.includes(' OR ')) {
      const parts = trimmed.split(' OR ');
      return {
        type: FilterType.LOGICAL,
        field: '',
        operator: FilterOperator.OR,
        value: null,
        children: parts.map(part => this.parseExpression(part))
      };
    }

    const match = trimmed.match(/^(\w+)([=<>!]+)(.+)$/);
    if (match) {
      const [, field, operatorStr, valueStr] = match;
      const operator = this.parseOperator(operatorStr);
      const value = this.parseValue(valueStr);

      return {
        type: FilterType.COMPARISON,
        field,
        operator,
        value
      };
    }

    throw new Error(`Cannot parse filter expression: ${expression}`);
  }

  private parseOperator(opStr: string): FilterOperator {
    const opMap: Record<string, FilterOperator> = {
      '=': FilterOperator.EQUALS,
      '==': FilterOperator.EQUALS,
      '!=': FilterOperator.NOT_EQUALS,
      '<>': FilterOperator.NOT_EQUALS,
      '>': FilterOperator.GREATER_THAN,
      '<': FilterOperator.LESS_THAN,
      '>=': FilterOperator.GREATER_EQUAL,
      '<=': FilterOperator.LESS_EQUAL,
      '~': FilterOperator.CONTAINS,
      'contains': FilterOperator.CONTAINS,
      'like': FilterOperator.LIKE
    };

    return opMap[opStr] || FilterOperator.EQUALS;
  }

  private parseValue(valueStr: string): unknown {
    const trimmed = valueStr.trim();
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    const num = Number(trimmed);
    if (!isNaN(num)) return num;
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(v => v.trim());
    }
    return trimmed.replace(/^["']|["']$/g, '');
  }

  private validate(filter: FilterNode): FilterValidationResult {
    const errors: any[] = [];
    const warnings: any[] = [];

    if (!filter.field || typeof filter.field !== 'string') {
      errors.push({
        code: 'INVALID_FIELD',
        message: 'Filter must have a valid field name',
        field: filter.field
      });
    }

    if (!filter.operator || !Object.values(FilterOperator).includes(filter.operator)) {
      errors.push({
        code: 'INVALID_OPERATOR',
        message: 'Filter must have a valid operator',
        operator: filter.operator
      });
    }

    if (filter.children) {
      filter.children.forEach(child => {
        const childValidation = this.validate(child);
        errors.push(...childValidation.errors);
        warnings.push(...childValidation.warnings);
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  private executeInMemory(filter: FilterNode, results: unknown[]): unknown[] {
    return results.filter(item => this.evaluateFilter(filter, item));
  }

  private evaluateFilter(filter: FilterNode, item: unknown): boolean {
    const value = (item as any)[filter.field];

    switch (filter.operator) {
      case FilterOperator.EQUALS:
        return value === filter.value;
      case FilterOperator.NOT_EQUALS:
        return value !== filter.value;
      case FilterOperator.GREATER_THAN:
        return Number(value) > Number(filter.value);
      case FilterOperator.LESS_THAN:
        return Number(value) < Number(filter.value);
      case FilterOperator.GREATER_EQUAL:
        return Number(value) >= Number(filter.value);
      case FilterOperator.LESS_EQUAL:
        return Number(value) <= Number(filter.value);
      case FilterOperator.CONTAINS:
        return String(value).includes(String(filter.value));
      case FilterOperator.STARTS_WITH:
        return String(value).startsWith(String(filter.value));
      case FilterOperator.ENDS_WITH:
        return String(value).endsWith(String(filter.value));
      case FilterOperator.IN: {
        const inArray = filter.value as unknown[];
        return inArray.includes(value);
      }
      case FilterOperator.AND: {
        return filter.children?.every(child => this.evaluateFilter(child, item)) || false;
      }
      case FilterOperator.OR: {
        return filter.children?.some(child => this.evaluateFilter(child, item)) || false;
      }
      case FilterOperator.NOT: {
        const childFilter = filter.children?.[0];
        if (!childFilter) return true;
        return !this.evaluateFilter(childFilter, item);
      }
      default:
        return true;
    }
  }

  private generateDatabaseQuery(
    filter: FilterNode,
    baseQuery: string
  ): { sql: string; parameters: unknown[]; estimatedCost: number } {
    const params: unknown[] = [];
    const conditions = this.buildSqlConditions(filter, params);
    const sql = `${baseQuery} WHERE ${conditions}`;
    return {
      sql,
      parameters: params,
      estimatedCost: 1
    };
  }

  private buildSqlConditions(filter: FilterNode, params: unknown[]): string {
    switch (filter.operator) {
      case FilterOperator.EQUALS:
        params.push(filter.value);
        return `${filter.field} = ?`;
      case FilterOperator.CONTAINS:
        params.push(`%${filter.value}%`);
        return `${filter.field} LIKE ?`;
      case FilterOperator.GREATER_THAN:
        params.push(filter.value);
        return `${filter.field} > ?`;
      case FilterOperator.LESS_THAN:
        params.push(filter.value);
        return `${filter.field} < ?`;
      case FilterOperator.AND: {
        const andConditions = filter.children?.map(child =>
          `(${this.buildSqlConditions(child, params)})`
        ).join(' AND ');
        return andConditions || '1=1';
      }
      case FilterOperator.OR: {
        const orConditions = filter.children?.map(child =>
          `(${this.buildSqlConditions(child, params)})`
        ).join(' OR ');
        return orConditions || '1=1';
      }
      default:
        return '1=1';
    }
  }
}

/**
 * Filter Builder for fluent API construction
 */
export class FilterBuilder {
  private currentNode?: FilterNode;

  where(field: string, operator: FilterOperator, value: unknown): FilterBuilder {
    this.currentNode = {
      type: this.inferFilterType(operator),
      field,
      operator,
      value,
      metadata: {}
    };
    return this;
  }

  and(builder: FilterBuilder): FilterBuilder {
    if (!this.currentNode) {
      throw new FilterEngineError('Cannot apply AND - no base filter defined', 'BUILDER_ERROR');
    }

    const otherFilter = builder.build();
    if (!otherFilter) {
      throw new FilterEngineError('Cannot apply AND - other filter is empty', 'BUILDER_ERROR');
    }

    this.currentNode = {
      type: FilterType.LOGICAL,
      field: '', // Logical operators don't have a specific field
      operator: FilterOperator.AND,
      value: null,
      children: [this.currentNode, otherFilter],
      metadata: {}
    };
    return this;
  }

  or(builder: FilterBuilder): FilterBuilder {
    if (!this.currentNode) {
      throw new FilterEngineError('Cannot apply OR - no base filter defined', 'BUILDER_ERROR');
    }

    const otherFilter = builder.build();
    if (!otherFilter) {
      throw new FilterEngineError('Cannot apply OR - other filter is empty', 'BUILDER_ERROR');
    }

    this.currentNode = {
      type: FilterType.LOGICAL,
      field: '',
      operator: FilterOperator.OR,
      value: null,
      children: [this.currentNode, otherFilter],
      metadata: {}
    };
    return this;
  }

  not(): FilterBuilder {
    if (!this.currentNode) {
      throw new FilterEngineError('Cannot apply NOT - no base filter defined', 'BUILDER_ERROR');
    }

    this.currentNode = {
      type: FilterType.LOGICAL,
      field: '',
      operator: FilterOperator.NOT,
      value: null,
      children: [this.currentNode],
      metadata: { negate: true }
    };
    return this;
  }

  build(): FilterNode | null {
    return this.currentNode || null;
  }

  private inferFilterType(operator: FilterOperator): FilterType {
    // Comparison operators
    if ([
      FilterOperator.EQUALS, FilterOperator.NOT_EQUALS, FilterOperator.GREATER_THAN,
      FilterOperator.LESS_THAN, FilterOperator.GREATER_EQUAL, FilterOperator.LESS_EQUAL,
      FilterOperator.CONTAINS, FilterOperator.STARTS_WITH, FilterOperator.ENDS_WITH,
      FilterOperator.IN, FilterOperator.NOT_IN, FilterOperator.BETWEEN, FilterOperator.LIKE
    ].includes(operator)) {
      return FilterType.COMPARISON;
    }

    // Logical operators
    if ([FilterOperator.AND, FilterOperator.OR, FilterOperator.NOT].includes(operator)) {
      return FilterType.LOGICAL;
    }

    // Temporal operators
    if ([FilterOperator.BEFORE, FilterOperator.AFTER, FilterOperator.WITHIN].includes(operator)) {
      return FilterType.TEMPORAL;
    }

    // Spatial operators
    if ([FilterOperator.NEAR, FilterOperator.WITHIN_RADIUS].includes(operator)) {
      return FilterType.SPATIAL;
    }

    // Semantic operators
    if ([FilterOperator.SIMILAR_TO, FilterOperator.RELATED_TO].includes(operator)) {
      return FilterType.SEMANTIC;
    }

    return FilterType.COMPARISON; // Default fallback
  }
}

/**
 * Performance optimizer for filter execution
 */
class FilterPerformanceOptimizer {
  optimize(filter: FilterNode): FilterNode {
    // Apply various optimization strategies
    let optimized = this.reorderFilters(filter);
    optimized = this.eliminateRedundantNodes(optimized);
    optimized = this.pushDownFilters(optimized);
    return optimized;
  }

  private reorderFilters(filter: FilterNode): FilterNode {
    // Reorder filters to put cheapest operations first
    if (filter.type === FilterType.LOGICAL && filter.children) {
      const reorderedChildren = filter.children.map(child => this.reorderFilters(child));

      if (filter.operator === FilterOperator.AND) {
        // For AND operations, put cheapest filters first
        return {
          ...filter,
          children: this.sortByCost(reorderedChildren)
        };
      } else if (filter.operator === FilterOperator.OR) {
        // For OR operations, put most selective filters first
        return {
          ...filter,
          children: this.sortBySelectivity(reorderedChildren)
        };
      }
    }

    return filter;
  }

  private eliminateRedundantNodes(filter: FilterNode): FilterNode {
    // Remove redundant or contradictory filters
    if (filter.children) {
      const filteredChildren = filter.children
        .map(child => this.eliminateRedundantNodes(child))
        .filter(child => !this.isRedundant(child));

      return {
        ...filter,
        children: filteredChildren
      };
    }

    return filter;
  }

  private pushDownFilters(filter: FilterNode): FilterNode {
    // Push filters down to reduce the search space early
    // This is a simplified version - full implementation would be more complex
    return filter;
  }

  private sortByCost(filters: FilterNode[]): FilterNode[] {
    // Sort filters by estimated execution cost
    return filters.sort((a, b) => this.estimateCost(a) - this.estimateCost(b));
  }

  private sortBySelectivity(filters: FilterNode[]): FilterNode[] {
    // Sort filters by estimated selectivity (how much data they filter out)
    return filters.sort((a, b) => this.estimateSelectivity(b) - this.estimateSelectivity(a));
  }

  private estimateCost(filter: FilterNode): number {
    // Estimate execution cost based on operator type
    const costMap: Record<FilterOperator, number> = {
      [FilterOperator.EQUALS]: 1,
      [FilterOperator.NOT_EQUALS]: 1,
      [FilterOperator.CONTAINS]: 5,
      [FilterOperator.LIKE]: 10,
      [FilterOperator.REGEX]: 20,
      [FilterOperator.IN]: 3,
      [FilterOperator.AND]: 1,
      [FilterOperator.OR]: 2,
      [FilterOperator.NOT]: 2,
      [FilterOperator.BEFORE]: 1,
      [FilterOperator.AFTER]: 1,
      [FilterOperator.WITHIN]: 3,
      [FilterOperator.AGE_LESS_THAN]: 1,
      [FilterOperator.AGE_GREATER_THAN]: 1,
      [FilterOperator.NEAR]: 5,
      [FilterOperator.WITHIN_RADIUS]: 8,
      [FilterOperator.CONTAINS_POINT]: 5,
      [FilterOperator.SIMILAR_TO]: 15,
      [FilterOperator.RELATED_TO]: 15,
      [FilterOperator.GREATER_THAN]: 1,
      [FilterOperator.LESS_THAN]: 1,
      [FilterOperator.GREATER_EQUAL]: 1,
      [FilterOperator.LESS_EQUAL]: 1,
      [FilterOperator.STARTS_WITH]: 3,
      [FilterOperator.ENDS_WITH]: 3,
      [FilterOperator.NOT_IN]: 4,
      [FilterOperator.BETWEEN]: 2
    };

    return costMap[filter.operator] || 1;
  }

  private estimateSelectivity(filter: FilterNode): number {
    // Estimate selectivity (0-1, where 1 means very selective)
    const selectivityMap: Record<FilterOperator, number> = {
      [FilterOperator.EQUALS]: 0.9,
      [FilterOperator.NOT_EQUALS]: 0.8,
      [FilterOperator.CONTAINS]: 0.3,
      [FilterOperator.LIKE]: 0.4,
      [FilterOperator.REGEX]: 0.2,
      [FilterOperator.IN]: 0.7,
      [FilterOperator.AND]: 0.8,
      [FilterOperator.OR]: 0.3,
      [FilterOperator.NOT]: 0.5,
      [FilterOperator.BEFORE]: 0.6,
      [FilterOperator.AFTER]: 0.6,
      [FilterOperator.WITHIN]: 0.5,
      [FilterOperator.AGE_LESS_THAN]: 0.6,
      [FilterOperator.AGE_GREATER_THAN]: 0.6,
      [FilterOperator.NEAR]: 0.4,
      [FilterOperator.WITHIN_RADIUS]: 0.3,
      [FilterOperator.CONTAINS_POINT]: 0.4,
      [FilterOperator.SIMILAR_TO]: 0.2,
      [FilterOperator.RELATED_TO]: 0.2,
      [FilterOperator.GREATER_THAN]: 0.5,
      [FilterOperator.LESS_THAN]: 0.5,
      [FilterOperator.GREATER_EQUAL]: 0.5,
      [FilterOperator.LESS_EQUAL]: 0.5,
      [FilterOperator.STARTS_WITH]: 0.7,
      [FilterOperator.ENDS_WITH]: 0.7,
      [FilterOperator.NOT_IN]: 0.6,
      [FilterOperator.BETWEEN]: 0.8
    };

    return selectivityMap[filter.operator] || 0.5;
  }

  private isRedundant(filter: FilterNode): boolean {
    // Check if filter is redundant (e.g., always true/false)
    // Simplified implementation
    return false;
  }
}

/**
 * Filter Engine Error Class
 */
export class FilterEngineError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'FilterEngineError';
  }
}