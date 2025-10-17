# Metadata Filtering in Memorits

Metadata filtering is one of Memorits' most powerful and sophisticated search capabilities, enabling AI agents to perform complex queries on memory metadata with precision and performance. This advanced feature allows for structured filtering, aggregation, and analysis of memory metadata across all memory types.

## Overview

The metadata filtering system provides:

- **Advanced Field Filtering**: Filter by any metadata field with multiple operators
- **Type-Safe Operations**: Runtime type validation and conversion
- **Nested Field Access**: Support for complex nested metadata structures
- **Aggregation Support**: Group and aggregate memories by metadata fields
- **Performance Optimization**: Caching and query optimization for fast results
- **Validation Framework**: Comprehensive validation with custom rules

## Core Components

### MetadataFilterStrategy

The `MetadataFilterStrategy` is the main component that handles all metadata-based filtering operations:

```typescript
import { MetadataFilterStrategy } from 'memorits/core/domain/search/filtering/MetadataFilterStrategy';
import { SearchStrategy } from 'memorits/core/domain/search/types';

const strategy = new MetadataFilterStrategy({
  strategyName: SearchStrategy.METADATA_FILTER,
  enabled: true,
  priority: 9,
  timeout: 5000,
  maxResults: 200,
  strategySpecific: {
    fields: {
      enableNestedAccess: true,
      maxDepth: 5,
      enableTypeValidation: true,
      enableFieldDiscovery: true,
    },
    aggregation: {
      enableAggregation: true,
      maxGroupFields: 10,
      enableComplexAggregation: true,
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
}, databaseManager);
```

## Metadata Field Filtering

### Basic Field Operations

Filter memories by any metadata field using various operators within the SearchOptions interface:

```typescript
import { Memori } from 'memorits';

const memori = new Memori();

// Basic equality filtering with SearchOptions
const results = await memori.searchMemories('configuration', {
  metadataFilters: {
    fields: [
      {
        key: 'model',
        value: 'gpt-4o-mini',
        operator: 'eq'
      }
    ]
  },
  limit: 10,
  includeMetadata: true
});

// Multiple field filtering with different operators using SearchOptions
const advancedResults = await memori.searchMemories('important data', {
  metadataFilters: {
    fields: [
      {
        key: 'importance',
        value: 0.7,
        operator: 'gte'
      },
      {
        key: 'category',
        value: ['essential', 'reference'],
        operator: 'in'
      },
      {
        key: 'hasEntities',
        value: true,
        operator: 'eq'
      }
    ]
  },
  limit: 20,
  minImportance: 'medium',
  categories: ['essential']
});
```

### Supported Operators

| Operator | Description | Example |
|----------|-------------|---------|
| `eq` | Equal to | `{ key: 'model', value: 'gpt-4', operator: 'eq' }` |
| `ne` | Not equal to | `{ key: 'status', value: 'deprecated', operator: 'ne' }` |
| `gt` | Greater than | `{ key: 'score', value: 0.8, operator: 'gt' }` |
| `gte` | Greater than or equal | `{ key: 'priority', value: 5, operator: 'gte' }` |
| `lt` | Less than | `{ key: 'age', value: 30, operator: 'lt' }` |
| `lte` | Less than or equal | `{ key: 'count', value: 100, operator: 'lte' }` |
| `contains` | String contains | `{ key: 'description', value: 'urgent', operator: 'contains' }` |
| `in` | Value in array | `{ key: 'category', value: ['a', 'b', 'c'], operator: 'in' }` |
| `exists` | Field exists | `{ key: 'optionalField', value: true, operator: 'exists' }` |
| `type` | Field type check | `{ key: 'count', value: 'number', operator: 'type' }` |

### Nested Field Access

Access nested metadata fields using dot notation:

```typescript
// Access nested properties
const nestedResults = await memori.searchMemories('nested data', {
  metadataFilters: {
    fields: [
      {
        key: 'user.preferences.theme',
        value: 'dark',
        operator: 'eq'
      },
      {
        key: 'project.settings.difficulty',
        value: 'advanced',
        operator: 'eq'
      },
      {
        key: 'metadata.confidence',
        value: 0.9,
        operator: 'gte'
      }
    ]
  }
});
```

### Automatic Field Type Inference

The system automatically infers field types from values:

```typescript
// Automatic type inference
const autoTypedResults = await memori.searchMemories('typed data', {
  metadataFilters: {
    fields: [
      { key: 'count', value: '42', operator: 'eq' },           // Inferred as number
      { key: 'active', value: 'true', operator: 'eq' },        // Inferred as boolean
      { key: 'tags', value: '["urgent", "review"]', operator: 'eq' }, // Inferred as array
      { key: 'config', value: '{"setting": "value"}', operator: 'eq' }  // Inferred as object
    ]
  }
});
```

## Metadata Aggregation

### Basic Aggregation

Group and aggregate memories by metadata fields:

```typescript
// Aggregate by model type
const modelAggregation = await memori.searchMemories('all memories', {
  metadataFilters: {
    aggregation: {
      enabled: true,
      groupBy: ['model'],
      aggregations: {
        count: true,
        distinct: ['category'],
        avg: ['importanceScore']
      }
    }
  }
});

// Result includes:
// - Grouped results by model type
// - Count of memories per model
// - Distinct categories per model
// - Average importance score per model
```

### Advanced Aggregation

```typescript
// Complex aggregation with multiple fields
const complexAggregation = await memori.searchMemories('project data', {
  metadataFilters: {
    aggregation: {
      enabled: true,
      groupBy: ['project', 'priority', 'status'],
      aggregations: {
        count: true,
        min: ['createdAt'],
        max: ['updatedAt'],
        distinct: ['assignee', 'tags']
      },
      having: [
        {
          key: 'count',
          value: 5,
          operator: 'gte'
        }
      ]
    }
  }
});
```

### Aggregation Options

```typescript
interface MetadataAggregation {
  enabled: boolean;
  groupBy?: string[];                    // Fields to group by
  aggregations?: {
    count?: boolean;                     // Count of memories
    distinct?: string[];                 // Distinct values for fields
    min?: string[];                      // Minimum values
    max?: string[];                      // Maximum values
    avg?: string[];                      // Average values
  };
  having?: MetadataField[];              // Filter aggregated results
}
```

## Metadata Validation

### Basic Validation

```typescript
// Basic metadata validation
const validatedResults = await memori.searchMemories('validated data', {
  metadataFilters: {
    validation: {
      strict: true,
      requiredFields: ['model', 'timestamp'],
      fieldTypes: {
        'model': 'string',
        'score': 'number',
        'active': 'boolean'
      }
    }
  }
});
```

### Custom Validators

```typescript
// Custom validation rules
const customValidatedResults = await memori.searchMemories('custom validated', {
  metadataFilters: {
    validation: {
      strict: false,
      customValidators: [
        {
          field: 'score',
          validator: (value: unknown) => typeof value === 'number' && value >= 0 && value <= 1,
          message: 'Score must be a number between 0 and 1'
        },
        {
          field: 'email',
          validator: (value: unknown) => typeof value === 'string' && value.includes('@'),
          message: 'Email must contain @ symbol'
        }
      ]
    }
  }
});
```

## Advanced Usage Examples

### 1. Complex Multi-Field Queries

```typescript
// Combine multiple metadata filters
const complexQuery = await memori.searchMemories('project documentation', {
  metadataFilters: {
    fields: [
      {
        key: 'project.name',
        value: 'memorits',
        operator: 'eq'
      },
      {
        key: 'metadata.importance',
        value: 0.7,
        operator: 'gte'
      },
      {
        key: 'metadata.category',
        value: ['technical', 'documentation'],
        operator: 'in'
      },
      {
        key: 'metadata.lastModified',
        value: '2024-01-01',
        operator: 'gte'
      }
    ]
  }
});
```

### 2. Performance-Optimized Queries

```typescript
// Optimized metadata queries with caching
const optimizedQuery = await memori.searchMemories('performance test', {
  metadataFilters: {
    fields: [
      {
        key: 'performance.cached',
        value: true,
        operator: 'eq'
      }
    ]
  },
  metadataOptions: {
    enableTypeChecking: true,
    enableAggregation: false,
    maxFieldDepth: 3
  }
});
```

### 3. Text Pattern-Based Metadata Discovery

```typescript
// Automatic metadata field discovery from text patterns
const patternResults = await memori.searchMemories(
  'memories with metadata.model=gpt-4 and metadata.score>0.8',
  {
    metadataFilters: {
      fields: [
        {
          key: 'model',
          value: 'gpt-4',
          operator: 'eq'
        },
        {
          key: 'score',
          value: 0.8,
          operator: 'gt'
        }
      ]
    }
  }
);
```

### 4. Aggregation with Statistical Analysis

```typescript
// Statistical analysis of memory metadata
const statisticalAnalysis = await memori.searchMemories('memory statistics', {
  metadataFilters: {
    aggregation: {
      enabled: true,
      groupBy: ['category', 'model'],
      aggregations: {
        count: true,
        avg: ['score'],
        min: ['createdAt'],
        max: ['updatedAt']
      }
    }
  }
});

// Analyze results
statisticalAnalysis.forEach(group => {
  console.log(`Category: ${group.metadata.groupKey}`);
  console.log(`Memory count: ${group.metadata.statistics.count}`);
  console.log(`Average score: ${group.metadata.statistics.averageScore}`);
});
```

## Configuration Options

### Strategy Configuration

```typescript
interface MetadataFilterStrategyConfig {
  fields: {
    enableNestedAccess: boolean;      // Enable nested field access
    maxDepth: number;                 // Maximum nesting depth
    enableTypeValidation: boolean;    // Validate field types
    enableFieldDiscovery: boolean;    // Auto-discover fields from text
  };
  aggregation?: {
    enableAggregation: boolean;       // Enable result aggregation
    maxGroupFields: number;           // Max fields to group by
    enableComplexAggregation: boolean; // Enable complex aggregations
  };
  validation: {
    strictValidation: boolean;        // Strict vs lenient validation
    enableCustomValidators: boolean;  // Enable custom validation rules
    failOnInvalidMetadata: boolean;   // Fail on invalid metadata
  };
  performance: {
    enableQueryOptimization: boolean; // Optimize queries
    enableResultCaching: boolean;     // Cache results
    maxExecutionTime: number;         // Max execution time (ms)
    batchSize: number;                // Batch size for processing
    cacheSize: number;                // Cache size limit
  };
}
```

### Query-Time Options

```typescript
interface MetadataFilterQueryOptions {
  includeNested?: boolean;           // Include nested field results
  enableTypeChecking?: boolean;      // Enable runtime type checking
  enableAggregation?: boolean;       // Enable result aggregation
  maxFieldDepth?: number;            // Maximum field access depth
}
```

## Performance Optimization

### Query Optimization

```typescript
// Optimized metadata queries
const optimizedConfig = {
  metadataFilters: {
    fields: [
      { key: 'highFrequencyField', value: 'commonValue', operator: 'eq' }
    ]
  },
  performance: {
    enableQueryOptimization: true,
    enableResultCaching: true,
    maxExecutionTime: 5000,
    batchSize: 200
  }
};
```

### Caching Strategy

```typescript
// Configure metadata caching
const cacheConfig = {
  performance: {
    enableResultCaching: true,
    cacheSize: 100,           // Cache up to 100 results
    cacheTTL: 300000,         // 5 minute cache expiry
    enableQueryOptimization: true
  }
};
```

### Index Optimization

```typescript
// Database indexes for metadata performance
const metadataIndexes = [
  'CREATE INDEX idx_metadata_model ON long_term_memory(json_extract(metadata, "$.model"))',
  'CREATE INDEX idx_metadata_category ON long_term_memory(json_extract(metadata, "$.category"))',
  'CREATE INDEX idx_metadata_importance ON long_term_memory(CAST(json_extract(metadata, "$.importanceScore") AS REAL))',
  'CREATE INDEX idx_metadata_timestamp ON long_term_memory(json_extract(metadata, "$.createdAt"))'
];
```

## Real-World Use Cases

### 1. Content Management System

```typescript
// Filter content by metadata
const publishedContent = await memori.searchMemories('published articles', {
  metadataFilters: {
    fields: [
      { key: 'status', value: 'published', operator: 'eq' },
      { key: 'publishDate', value: '2024-01-01', operator: 'gte' },
      { key: 'category', value: ['technology', 'ai'], operator: 'in' }
    ]
  }
});
```

### 2. User Behavior Analysis

```typescript
// Analyze user interaction patterns
const userAnalysis = await memori.searchMemories('user interactions', {
  metadataFilters: {
    aggregation: {
      enabled: true,
      groupBy: ['user.id', 'action.type'],
      aggregations: {
        count: true,
        distinct: ['target.type']
      }
    }
  }
});
```

### 3. Quality Assessment

```typescript
// Find high-quality memories
const qualityMemories = await memori.searchMemories('quality content', {
  metadataFilters: {
    fields: [
      { key: 'quality.score', value: 0.8, operator: 'gte' },
      { key: 'validation.passed', value: true, operator: 'eq' },
      { key: 'review.status', value: 'approved', operator: 'eq' }
    ]
  }
});
```

### 4. Temporal-Metadata Analysis

```typescript
// Combine temporal and metadata filtering
const temporalMetadataQuery = await memori.searchMemories('recent changes', {
  metadataFilters: {
    fields: [
      { key: 'change.type', value: 'major', operator: 'eq' },
      { key: 'impact.level', value: 'high', operator: 'eq' }
    ]
  },
  temporalFilters: {
    relativeExpressions: ['last 7 days']
  }
});
```

## Error Handling and Debugging

### Common Error Patterns

```typescript
try {
  const results = await memori.searchMemories('metadata query', {
    metadataFilters: {
      fields: [
        { key: 'invalid.nested.field', value: 'test', operator: 'eq' }
      ]
    }
  });
} catch (error) {
  if (error instanceof MetadataValidationError) {
    console.error('Metadata validation failed:', error.field, error.message);
  } else if (error instanceof MetadataAccessError) {
    console.error('Metadata access failed:', error.path, error.message);
  }
}
```

### Debug Information

```typescript
// Enable debug logging for metadata operations
const debugResults = await memori.searchMemories('debug query', {
  metadataFilters: {
    fields: [
      { key: 'debug.mode', value: true, operator: 'eq' }
    ]
  },
  debug: {
    enableFieldDiscovery: true,
    logQueryExecution: true,
    logResultProcessing: true
  }
});
```

## Integration with Other Features

### Combining with Text Search

```typescript
// Text search with metadata filtering
const combinedQuery = await memori.searchMemories('urgent project', {
  // Text search will be combined with metadata filters
  minImportance: 'high',
  categories: ['essential'],
  metadataFilters: {
    fields: [
      { key: 'project.status', value: 'active', operator: 'eq' }
    ]
  }
});
```

### Combining with Temporal Filtering

```typescript
// Metadata and temporal filtering together
const timeMetadataQuery = await memori.searchMemories('recent configurations', {
  temporalFilters: {
    relativeExpressions: ['last week']
  },
  metadataFilters: {
    fields: [
      { key: 'type', value: 'configuration', operator: 'eq' },
      { key: 'environment', value: 'production', operator: 'eq' }
    ]
  }
});
```

## Best Practices

### 1. Use Appropriate Operators

```typescript
// Choose operators based on data types and use cases
const bestPractices = {
  // Use 'in' for categorical data
  categories: { key: 'category', value: ['tech', 'docs'], operator: 'in' },

  // Use 'gte'/'lte' for numerical ranges
  scores: { key: 'score', value: 0.7, operator: 'gte' },

  // Use 'contains' for partial text matching
  descriptions: { key: 'description', value: 'important', operator: 'contains' },

  // Use 'exists' to check field presence
  optional: { key: 'optionalField', value: true, operator: 'exists' }
};
```

### 2. Optimize for Performance

```typescript
// Performance-optimized metadata queries
const performanceOptimized = {
  metadataFilters: {
    fields: [
      // Use exact matches for better performance
      { key: 'indexedField', value: 'exactValue', operator: 'eq' }
    ]
  },
  performance: {
    enableQueryOptimization: true,
    enableResultCaching: true,
    maxExecutionTime: 3000
  }
};
```

### 3. Handle Large Result Sets

```typescript
// Handle large datasets with aggregation
const largeDatasetQuery = await memori.searchMemories('large dataset', {
  metadataFilters: {
    aggregation: {
      enabled: true,
      groupBy: ['category'],
      aggregations: {
        count: true,
        avg: ['score']
      }
    }
  }
});
```

### 4. Validate Metadata Quality

```typescript
// Ensure metadata quality with validation
const qualityQuery = await memori.searchMemories('quality memories', {
  metadataFilters: {
    validation: {
      strict: true,
      requiredFields: ['createdAt', 'category'],
      fieldTypes: {
        'score': 'number',
        'category': 'string'
      }
    }
  }
});
```

## Advanced Configuration

### Custom Field Types

```typescript
// Define custom field types for validation
const customTypes = {
  'custom.score': 'number',
  'custom.priority': 'string',
  'custom.tags': 'array',
  'custom.metadata': 'object'
};
```

### Performance Tuning

```typescript
// Fine-tune performance settings
const tunedConfig = {
  performance: {
    enableQueryOptimization: true,
    enableResultCaching: true,
    maxExecutionTime: 5000,     // Faster timeout for interactive queries
    batchSize: 50,              // Smaller batches for memory efficiency
    cacheSize: 200              // Larger cache for frequently accessed data
  }
};
```

This comprehensive metadata filtering system enables AI agents to perform sophisticated queries on structured memory data, supporting everything from simple field lookups to complex multi-dimensional analysis with aggregation and validation.
