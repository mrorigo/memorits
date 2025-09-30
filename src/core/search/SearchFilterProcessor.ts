import { SearchResult } from './types';

/**
 * Advanced filter processing module for search operations
 * Extracted from SearchService to improve maintainability and separation of concerns
 */

// ===== FILTER PROCESSING INTERFACES =====

/**
 * Filter validation result
 */
export interface FilterValidationResult {
  isValid: boolean;
  filterNode?: any;
  error?: string;
}

/**
 * Pre-filtering result
 */
export interface PreFilteringResult {
  filteredResults: SearchResult[];
  earlyTermination: boolean;
  optimizationsApplied: string[];
}

/**
 * Post-filtering result
 */
export interface PostFilteringResult {
  refinedResults: SearchResult[];
  metrics?: any;
}

/**
 * Filter template interface
 */
export interface FilterTemplate {
  name: string;
  description: string;
  filterExpression: string;
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
  }>;
  metadata?: {
    performanceHints?: string[];
    estimatedCost?: number;
  };
}

/**
 * Filter processor class for handling advanced filtering operations
 */
export class SearchFilterProcessor {
  private filterTemplates: Map<string, FilterTemplate> = new Map();

  constructor() {
    this.initializeDefaultTemplates();
  }

  /**
   * Initialize default filter templates
   */
  private initializeDefaultTemplates(): void {
    this.registerTemplate('recent_important', {
      name: 'recent_important',
      description: 'Recent memories with high importance score',
      filterExpression: 'importance_score >= 0.7 AND created_at > {days_ago}',
      parameters: [
        { name: 'days_ago', type: 'string', required: true },
      ],
    });

    this.registerTemplate('category_recent', {
      name: 'category_recent',
      description: 'Recent memories in specific category',
      filterExpression: 'category = {category_name} AND created_at > {days_ago}',
      parameters: [
        { name: 'category_name', type: 'string', required: true },
        { name: 'days_ago', type: 'string', required: true },
      ],
    });

    this.registerTemplate('high_confidence', {
      name: 'high_confidence',
      description: 'Memories with high confidence scores',
      filterExpression: 'confidence >= {min_confidence}',
      parameters: [
        { name: 'min_confidence', type: 'number', required: true },
      ],
    });

    this.registerTemplate('date_range', {
      name: 'date_range',
      description: 'Memories within specific date range',
      filterExpression: 'created_at >= {start_date} AND created_at <= {end_date}',
      parameters: [
        { name: 'start_date', type: 'string', required: true },
        { name: 'end_date', type: 'string', required: true },
      ],
    });

    this.registerTemplate('type_and_category', {
      name: 'type_and_category',
      description: 'Memories of specific type in specific category',
      filterExpression: 'memory_type = {memory_type} AND category = {category}',
      parameters: [
        { name: 'memory_type', type: 'string', required: true },
        { name: 'category', type: 'string', required: true },
      ],
    });

    this.registerTemplate('multi_category', {
      name: 'multi_category',
      description: 'Memories matching multiple categories (OR logic)',
      filterExpression: 'category = {category1} OR category = {category2} OR category = {category3}',
      parameters: [
        { name: 'category1', type: 'string', required: true },
        { name: 'category2', type: 'string', required: true },
        { name: 'category3', type: 'string', required: false },
      ],
    });

    this.registerTemplate('important_content_recent', {
      name: 'important_content_recent',
      description: 'Important recent memories containing specific content',
      filterExpression: 'importance_score >= {min_importance} AND created_at > {days_ago} AND content ~ {content_pattern}',
      parameters: [
        { name: 'min_importance', type: 'number', required: true },
        { name: 'days_ago', type: 'string', required: true },
        { name: 'content_pattern', type: 'string', required: true },
      ],
    });

    this.registerTemplate('metadata_complex', {
      name: 'metadata_complex',
      description: 'Complex filter using metadata fields',
      filterExpression: '(metadata.tags CONTAINS {tag1} OR metadata.tags CONTAINS {tag2}) AND metadata.source = {source}',
      parameters: [
        { name: 'tag1', type: 'string', required: true },
        { name: 'tag2', type: 'string', required: false },
        { name: 'source', type: 'string', required: true },
      ],
    });

    this.registerTemplate('temporal_pattern', {
      name: 'temporal_pattern',
      description: 'Memories matching temporal patterns (e.g., recent activity spikes)',
      filterExpression: 'created_at > {reference_date} AND (category = {primary_category} OR importance_score >= {min_importance})',
      parameters: [
        { name: 'reference_date', type: 'string', required: true },
        { name: 'primary_category', type: 'string', required: true },
        { name: 'min_importance', type: 'number', required: false },
      ],
    });

    this.registerTemplate('fast_category_lookup', {
      name: 'fast_category_lookup',
      description: 'Optimized category lookup with early termination',
      filterExpression: 'category = {category_name}',
      parameters: [
        { name: 'category_name', type: 'string', required: true },
      ],
      metadata: {
        performanceHints: ['early_termination', 'index_optimized'],
        estimatedCost: 1,
      },
    });

    this.registerTemplate('recent_with_limit', {
      name: 'recent_with_limit',
      description: 'Recent memories with built-in result limiting for performance',
      filterExpression: 'created_at > {cutoff_date} ORDER BY created_at DESC LIMIT {max_results}',
      parameters: [
        { name: 'cutoff_date', type: 'string', required: true },
        { name: 'max_results', type: 'number', required: false },
      ],
      metadata: {
        performanceHints: ['result_limiting', 'order_optimization'],
        estimatedCost: 2,
      },
    });

    this.registerTemplate('batch_optimized', {
      name: 'batch_optimized',
      description: 'Filter optimized for batch processing scenarios',
      filterExpression: 'memory_type = {memory_type} AND created_at >= {batch_start_date}',
      parameters: [
        { name: 'memory_type', type: 'string', required: true },
        { name: 'batch_start_date', type: 'string', required: true },
      ],
      metadata: {
        performanceHints: ['batch_processing', 'parallel_execution'],
        estimatedCost: 3,
      },
    });
  }

  /**
   * Register a filter template
   */
  registerTemplate(name: string, template: FilterTemplate): void {
    this.filterTemplates.set(name, template);
  }

  /**
   * Get a filter template by name
   */
  getTemplate(name: string): FilterTemplate | undefined {
    return this.filterTemplates.get(name);
  }

  /**
   * List all available template names
   */
  listAvailableTemplates(): string[] {
    return Array.from(this.filterTemplates.keys());
  }

  /**
   * Validate filter expression
   */
  validateFilterExpression(expression: string): FilterValidationResult {
    if (!expression.trim()) {
      return { isValid: false, error: 'Filter expression cannot be empty' };
    }

    try {
      // Basic validation - check for balanced parentheses
      const openParens = (expression.match(/\(/g) || []).length;
      const closeParens = (expression.match(/\)/g) || []).length;

      if (openParens !== closeParens) {
        return { isValid: false, error: 'Unbalanced parentheses in filter expression' };
      }

      // Check for valid operators
      const validOperators = ['=', '!=', '>', '<', '>=', '<=', '~', 'CONTAINS', 'AND', 'OR', 'NOT'];
      const operators = expression.match(/[=<>!~]+|CONTAINS|AND|OR|NOT/g) || [];

      for (const op of operators) {
        if (!validOperators.includes(op.toUpperCase())) {
          return { isValid: false, error: `Invalid operator: ${op}` };
        }
      }

      return { isValid: true };
    } catch (error) {
      return {
        isValid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Apply advanced filter with pre and post processing
   */
  async applyAdvancedFilter(
    results: SearchResult[],
    filterExpression: string,
    query?: any,
  ): Promise<SearchResult[]> {
    if (!filterExpression.trim()) {
      return results;
    }

    try {
      // Validate the filter expression
      const validation = this.validateFilterExpression(filterExpression);
      if (!validation.isValid) {
        throw new Error(`Invalid filter expression: ${validation.error}`);
      }

      // Pre-filtering optimization
      const preFilterResult = await this.performPreFiltering(results, filterExpression, query);

      // Main filter execution (simplified for this example)
      const filteredResults = this.executeFilter(preFilterResult.filteredResults, filterExpression);

      // Post-filtering refinement
      const postFilteredResults = await this.performPostFiltering(
        filteredResults,
        filterExpression,
        query,
      );

      return postFilteredResults.refinedResults;

    } catch (error) {
      console.error('Advanced filter execution failed:', error);
      throw new Error(`Filter execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Perform pre-filtering optimization
   */
  private async performPreFiltering(
    results: SearchResult[],
    filterExpression: string,
    query?: any,
  ): Promise<PreFilteringResult> {
    const optimizations: string[] = [];
    let filteredResults = [...results];
    let earlyTermination = false;

    try {
      // Apply simple field-based pre-filtering for common cases
      if (this.canApplyEarlyTermination(filterExpression)) {
        filteredResults = this.applyFieldBasedPreFiltering(filteredResults, filterExpression);
        optimizations.push('field_based_pre_filtering');

        if (filteredResults.length === 0) {
          earlyTermination = true;
          optimizations.push('early_termination_empty_results');
        } else if (this.shouldTerminateEarly(filteredResults, filterExpression)) {
          earlyTermination = true;
          optimizations.push('early_termination_selectivity');
        }
      }

      // Apply index-based filtering if available
      const indexFiltered = await this.applyIndexBasedPreFiltering(filteredResults, filterExpression);
      if (indexFiltered.length < filteredResults.length) {
        filteredResults = indexFiltered;
        optimizations.push('index_based_pre_filtering');
      }

    } catch (error) {
      console.warn('Pre-filtering optimization failed, continuing with full dataset:', error);
      optimizations.push('pre_filtering_failed');
    }

    return {
      filteredResults,
      earlyTermination,
      optimizationsApplied: optimizations,
    };
  }

  /**
   * Perform post-filtering refinement
   */
  private async performPostFiltering(
    results: SearchResult[],
    filterExpression: string,
    query?: any,
  ): Promise<PostFilteringResult> {
    let refinedResults = [...results];

    try {
      // Apply filter-specific post-processing
      refinedResults = this.applyFilterSpecificPostProcessing(refinedResults, filterExpression);

      // Apply filter-based ranking
      refinedResults = this.applyFilterBasedRanking(refinedResults, filterExpression, query);

    } catch (error) {
      console.warn('Post-filtering refinement failed, returning original results:', error);
    }

    return {
      refinedResults,
    };
  }

  /**
   * Execute filter on results
   */
  private executeFilter(results: SearchResult[], filterExpression: string): SearchResult[] {
    // Simplified filter execution - in a real implementation, this would parse
    // and execute the filter expression against the results

    if (filterExpression.includes('category =')) {
      const categoryMatch = filterExpression.match(/category\s*=\s*['"]([^'"]+)['"]/);
      if (categoryMatch) {
        const targetCategory = categoryMatch[1];
        return results.filter(result => result.metadata?.category === targetCategory);
      }
    }

    if (filterExpression.includes('importance_score >=')) {
      const scoreMatch = filterExpression.match(/importance_score\s*>=\s*(\d+\.?\d*)/);
      if (scoreMatch) {
        const minScore = parseFloat(scoreMatch[1]);
        return results.filter(result => Number(result.metadata?.importanceScore || 0) >= minScore);
      }
    }

    // If no specific filters match, return all results
    return results;
  }

  /**
   * Apply field-based pre-filtering for simple filter expressions
   */
  private applyFieldBasedPreFiltering(results: SearchResult[], filterExpression: string): SearchResult[] {
    const simpleFilters = this.extractSimpleFilters(filterExpression);

    if (simpleFilters.length === 0) {
      return results;
    }

    return results.filter(result => {
      return simpleFilters.every(filter => this.evaluateSimpleFilter(result, filter));
    });
  }

  /**
   * Apply index-based pre-filtering (placeholder)
   */
  private async applyIndexBasedPreFiltering(results: SearchResult[], filterExpression: string): Promise<SearchResult[]> {
    // This would integrate with search indexes for pre-filtering
    return results;
  }

  /**
   * Apply filter-specific post-processing
   */
  private applyFilterSpecificPostProcessing(results: SearchResult[], filterExpression: string): SearchResult[] {
    let processedResults = [...results];

    // Boost scores for results that match multiple filter criteria
    if (this.isMultiCriteriaFilter(filterExpression)) {
      processedResults = this.boostMultiCriteriaResults(processedResults, filterExpression);
    }

    // Apply temporal relevance adjustments
    if (this.containsTemporalFilters(filterExpression)) {
      processedResults = this.adjustTemporalRelevance(processedResults, filterExpression);
    }

    return processedResults;
  }

  /**
   * Apply filter-based ranking
   */
  private applyFilterBasedRanking(results: SearchResult[], filterExpression: string, query?: any): SearchResult[] {
    const rankedResults = results.map(result => {
      const filterScore = this.calculateFilterScore(result, filterExpression, query);
      return {
        ...result,
        score: (result.score * 0.7) + (filterScore * 0.3),
      };
    });

    rankedResults.sort((a, b) => b.score - a.score);

    return rankedResults;
  }

  /**
   * Extract simple field-based filters
   */
  private extractSimpleFilters(filterExpression: string): Array<{ field: string; operator: string; value: any }> {
    const simpleFilters: Array<{ field: string; operator: string; value: any }> = [];

    const simplePattern = /(\w+)\s*([<>=!~]+)\s*['"]?([^'"&\s]+)['"]?/g;
    let match;

    while ((match = simplePattern.exec(filterExpression)) !== null) {
      const [, field, operator, value] = match;
      simpleFilters.push({
        field: field.trim(),
        operator: operator.trim(),
        value: value.trim().replace(/['"]/g, ''),
      });
    }

    return simpleFilters;
  }

  /**
   * Evaluate a simple filter against a search result
   */
  private evaluateSimpleFilter(result: SearchResult, filter: { field: string; operator: string; value: any }): boolean {
    const { field, operator, value } = filter;

    const fieldValue = this.getFieldValue(result, field);

    if (fieldValue === undefined || fieldValue === null) {
      return operator === '!=';
    }

    switch (operator) {
      case '=':
        return fieldValue == value;
      case '!=':
        return fieldValue != value;
      case '>':
        return Number(fieldValue) > Number(value);
      case '<':
        return Number(fieldValue) < Number(value);
      case '>=':
        return Number(fieldValue) >= Number(value);
      case '<=':
        return Number(fieldValue) <= Number(value);
      case '~':
        return String(fieldValue).toLowerCase().includes(String(value).toLowerCase());
      default:
        return false;
    }
  }

  /**
   * Get field value from search result metadata
   */
  private getFieldValue(result: SearchResult, field: string): any {
    if (field.includes('.')) {
      const parts = field.split('.');
      let value: any = result;

      for (const part of parts) {
        value = value?.[part];
        if (value === undefined) break;
      }

      return value;
    }

    return result.metadata?.[field] || result[field as keyof SearchResult];
  }

  /**
   * Check if filter supports early termination
   */
  private canApplyEarlyTermination(filterExpression: string): boolean {
    const selectiveOperators = ['=', '>', '<', '>=', '<='];
    return selectiveOperators.some(op => filterExpression.includes(op));
  }

  /**
   * Determine if early termination should be applied
   */
  private shouldTerminateEarly(results: SearchResult[], filterExpression: string): boolean {
    const hasEqualityFilter = filterExpression.includes('=');
    const hasRangeFilter = /[<>=]/.test(filterExpression);

    if (results.length <= 10 && (hasEqualityFilter || hasRangeFilter)) {
      return true;
    }

    return false;
  }

  /**
   * Check if filter contains multiple criteria
   */
  private isMultiCriteriaFilter(filterExpression: string): boolean {
    const andCount = (filterExpression.match(/\bAND\b/gi) || []).length;
    const orCount = (filterExpression.match(/\bOR\b/gi) || []).length;
    return andCount > 0 || orCount > 1;
  }

  /**
   * Boost scores for results matching multiple filter criteria
   */
  private boostMultiCriteriaResults(results: SearchResult[], filterExpression: string): SearchResult[] {
    const criteriaCount = (filterExpression.match(/\b(AND|OR)\b/gi) || []).length + 1;

    return results.map(result => ({
      ...result,
      score: result.score * (1 + (criteriaCount * 0.1)),
    }));
  }

  /**
   * Check if filter contains temporal components
   */
  private containsTemporalFilters(filterExpression: string): boolean {
    const temporalKeywords = ['created_at', 'updated_at', 'timestamp', 'date', 'time'];
    return temporalKeywords.some(keyword => filterExpression.toLowerCase().includes(keyword));
  }

  /**
   * Adjust temporal relevance based on filter criteria
   */
  private adjustTemporalRelevance(results: SearchResult[], filterExpression: string): SearchResult[] {
    const hasRecentFilter = /\b(created_at|timestamp)\s*>\s*['"]?[^'"&\s]+['"]?/i.test(filterExpression);

    if (hasRecentFilter) {
      return results.map(result => ({
        ...result,
        score: result.score * 1.1,
      }));
    }

    return results;
  }

  /**
   * Calculate filter-specific score for ranking
   */
  private calculateFilterScore(result: SearchResult, filterExpression: string, query?: any): number {
    let score = 0;

    const simpleFilters = this.extractSimpleFilters(filterExpression);
    const matchingFilters = simpleFilters.filter(filter => this.evaluateSimpleFilter(result, filter));
    score += matchingFilters.length * 0.1;

    if (matchingFilters.some(f => f.field === 'category' && f.operator === '=')) {
      score += 0.2;
    }

    if (matchingFilters.some(f => f.field === 'importance_score' && f.operator === '>=')) {
      score += 0.15;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Get available filter templates
   */
  getAvailableFilterTemplates(): Array<{ name: string; description: string; parameters: any[] }> {
    return Array.from(this.filterTemplates.entries()).map(([name, template]) => ({
      name,
      description: template.description,
      parameters: template.parameters,
    }));
  }

  /**
   * Validate filter template
   */
  validateFilterTemplate(templateName: string): { isValid: boolean; errors: string[]; warnings: string[] } {
    const template = this.filterTemplates.get(templateName);

    if (!template) {
      return {
        isValid: false,
        errors: [`Template '${templateName}' not found`],
        warnings: [],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate template structure
    if (!template.filterExpression) {
      errors.push('Template must have a filter expression');
    }

    if (!template.parameters || !Array.isArray(template.parameters)) {
      errors.push('Template must have a parameters array');
    }

    // Check for unmatched parameters in expression
    const paramMatches = template.filterExpression.match(/{(\w+)}/g) || [];
    const paramNames = paramMatches.map(match => match.replace(/[{}]/g, ''));

    for (const paramName of paramNames) {
      const parameter = template.parameters.find(p => p.name === paramName);
      if (!parameter) {
        errors.push(`Parameter '${paramName}' used in expression but not defined`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }
}