/**
 * Integration examples for the advanced filtering engine
 * Demonstrates how to use the filtering engine with existing search strategies
 */

import { FilterEngine, FilterBuilder } from './FilterEngine';
import { FilterOperator, FilterType } from './types';
import { SearchQuery } from '../types';
import { logInfo, logError } from '../../utils/Logger';

/**
 * Example: Enhanced SearchService with filtering integration
 */
export class EnhancedSearchService {
  private filterEngine: FilterEngine;

  constructor() {
    this.filterEngine = new FilterEngine();
  }

  /**
   * Search with advanced filtering
   */
  async searchWithFiltering(
    query: SearchQuery,
    filterExpression?: string
  ): Promise<any[]> {
    // Get base search results
    const baseResults = await this.performBaseSearch(query);

    // Apply filters if provided
    if (filterExpression) {
      const filter = this.filterEngine.parseFilter(filterExpression);
      const filterResult = await this.filterEngine.executeFilter(filter, baseResults);

      return filterResult.filteredItems;
    }

    return baseResults;
  }

  /**
   * Search using fluent API filter builder
   */
  async searchWithFluentFilter(
    query: SearchQuery,
    filterBuilder: FilterBuilder
  ): Promise<any[]> {
    const baseResults = await this.performBaseSearch(query);
    const filter = filterBuilder.build();

    if (filter) {
      const filterResult = await this.filterEngine.executeFilter(filter, baseResults);
      return filterResult.filteredItems;
    }

    return baseResults;
  }

  /**
   * Database query with advanced filtering
   */
  async searchWithDatabaseFilter(
    baseQuery: string,
    filterExpression: string
  ): Promise<{ sql: string; parameters: unknown[] }> {
    const filter = this.filterEngine.parseFilter(filterExpression);
    return await this.filterEngine.executeFilterAsQuery(filter, baseQuery);
  }

  /**
   * Example filter expressions
   */
  static getExampleFilters() {
    return {
      // Simple comparison
      simple: 'category = "important"',

      // Logical combination
      logical: 'category = "important" AND created_at > "2024-01-01"',

      // Complex nested
      complex: '(category = "important" OR priority >= 8) AND age < 30',

      // String operations
      stringOps: 'content contains "urgent" AND title starts_with "RE:"',

      // Array operations
      arrayOps: 'tags in ["urgent", "review"] AND status != "completed"',

      // Numeric ranges
      numeric: 'score >= 0.8 AND importance between [0.7, 1.0]'
    };
  }

  /**
   * Example fluent filter construction
   */
  static createExampleFluentFilter(): FilterBuilder {
    return new FilterBuilder()
      .where('category', FilterOperator.EQUALS, 'important')
      .and(
        new FilterBuilder()
          .where('priority', FilterOperator.GREATER_EQUAL, 8)
      )
      .and(
        new FilterBuilder()
          .where('status', FilterOperator.NOT_EQUALS, 'archived')
      );
  }

  /**
   * Perform base search (placeholder for actual search implementation)
   */
  private async performBaseSearch(query: SearchQuery): Promise<any[]> {
    // This would integrate with the existing SearchService
    // For now, return mock data
    return [
      {
        id: '1',
        content: 'Important meeting tomorrow',
        category: 'important',
        priority: 9,
        status: 'pending',
        created_at: '2024-01-15',
        score: 0.95
      },
      {
        id: '2',
        content: 'Review project proposal',
        category: 'work',
        priority: 7,
        status: 'in_progress',
        created_at: '2024-01-14',
        score: 0.82
      },
      {
        id: '3',
        content: 'Archived old documents',
        category: 'misc',
        priority: 2,
        status: 'archived',
        created_at: '2024-01-10',
        score: 0.45
      }
    ];
  }
}

/**
 * Usage examples for the filtering engine
 */
export class FilteringExamples {
  private filterEngine: FilterEngine;

  constructor() {
    this.filterEngine = new FilterEngine();
  }

  /**
   * Example 1: Parse and execute filter expression
   */
  async example1() {
    const data = [
      { name: 'Alice', age: 25, city: 'New York' },
      { name: 'Bob', age: 30, city: 'San Francisco' },
      { name: 'Charlie', age: 35, city: 'New York' }
    ];

    const filterExpression = 'city = "New York" AND age >= 25';
    const result = await this.filterEngine.parseAndExecute(filterExpression, data);

    logInfo('Filter execution completed', {
      component: 'FilteringExamples',
      operation: 'example1',
      resultCount: result.filteredItems.length
    });
  }

  /**
   * Example 2: Using fluent API
   */
  async example2() {
    const data = [
      { product: 'Laptop', price: 1000, category: 'electronics' },
      { product: 'Book', price: 20, category: 'education' },
      { product: 'Phone', price: 800, category: 'electronics' }
    ];

    const filter = this.filterEngine.createBuilder()
      .where('category', FilterOperator.EQUALS, 'electronics')
      .and(
        this.filterEngine.createBuilder()
          .where('price', FilterOperator.LESS_THAN, 1500)
      )
      .build();

    if (filter) {
      const result = await this.filterEngine.executeFilter(filter, data);
      logInfo('Filter execution completed', {
        component: 'FilteringExamples',
        operation: 'example2',
        resultCount: result.filteredItems.length
      });
    }
  }

  /**
   * Example 3: Database query generation
   */
  async example3() {
    const baseQuery = 'SELECT * FROM memories';
    const filterExpression = 'category = "important" AND created_at > "2024-01-01"';

    const queryResult = await this.filterEngine.executeFilterAsQuery(
      this.filterEngine.parseFilter(filterExpression),
      baseQuery
    );

    logInfo('Database query generation completed', {
      component: 'FilteringExamples',
      operation: 'example3',
      sql: queryResult.sql,
      parameterCount: queryResult.parameters.length
    });
  }

  /**
   * Example 4: Filter validation
   */
  async example4() {
    const filterExpression = 'invalid_field = "value"';

    try {
      const filter = this.filterEngine.parseFilter(filterExpression);
      const validation = this.filterEngine.validateFilter(filter);

      if (!validation.isValid) {
        logInfo('Filter validation completed with errors', {
          component: 'FilteringExamples',
          operation: 'example4',
          errorCount: validation.errors.length
        });
      }
    } catch (error) {
      logError('Filter parsing failed', {
        component: 'FilteringExamples',
        operation: 'example4',
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
}