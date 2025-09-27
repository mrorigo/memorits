# Temporal Filtering in Memorits

Temporal filtering is one of Memorits' most sophisticated features, enabling AI agents to search and analyze memories based on time with incredible precision. This advanced capability allows agents to understand temporal context, identify patterns over time, and provide time-aware responses.

## Overview

The temporal filtering system provides:

- **Natural Language Processing**: "yesterday", "last week", "2 hours ago"
- **Complex Time Ranges**: Specific start/end dates with millisecond precision
- **Pattern Matching**: "every Monday", "weekends", "business hours"
- **Temporal Aggregation**: Group memories by time periods
- **Trend Analysis**: Identify patterns and changes over time
- **Performance Optimization**: Efficient temporal queries with caching

## Core Components

### DateTimeNormalizer

Handles natural language time expressions and normalization:

```typescript
import { DateTimeNormalizer } from 'memorits';

// Normalize natural language expressions
const normalized = DateTimeNormalizer.normalize('yesterday at 3pm');
console.log(normalized.date); // 2024-01-15T15:00:00.000Z

const twoHoursAgo = DateTimeNormalizer.normalize('2 hours ago');
console.log(twoHoursAgo.date); // Current time minus 2 hours
```

#### Supported Expressions

```typescript
// Relative expressions
DateTimeNormalizer.normalize('5 minutes ago');
DateTimeNormalizer.normalize('3 days ago');
DateTimeNormalizer.normalize('last week');
DateTimeNormalizer.normalize('next month');

// Specific times
DateTimeNormalizer.normalize('today at 9am');
DateTimeNormalizer.normalize('tomorrow morning');
DateTimeNormalizer.normalize('this Friday at 2pm');

// Complex expressions
DateTimeNormalizer.normalize('the day before yesterday');
DateTimeNormalizer.normalize('3 weeks from now');
```

### TimeRangeProcessor

Processes complex time range queries and operations:

```typescript
import { TimeRangeProcessor, TimeRange } from 'memorits';

const processor = new TimeRangeProcessor();

// Define time ranges
const ranges: TimeRange[] = [
  {
    start: new Date('2024-01-01'),
    end: new Date('2024-01-31')
  }
];

// Process complex queries
const query = {
  ranges,
  operation: 'INTERSECTION', // UNION, INTERSECTION, DIFFERENCE
  granularity: 'day'
};
```

#### Range Operations

```typescript
// Union of multiple ranges
const unionRanges = TimeRangeProcessor.union([
  { start: date1, end: date2 },
  { start: date3, end: date4 }
]);

// Intersection of overlapping ranges
const intersectionRanges = TimeRangeProcessor.intersection([
  { start: date1, end: date4 },
  { start: date2, end: date3 }
]);

// Expand ranges by duration
const expandedRange = TimeRangeProcessor.expand(
  { start: date1, end: date2 },
  { hours: 2 } // Expand by 2 hours
);
```

### TemporalPatternMatcher

Analyzes text for temporal patterns and expressions:

```typescript
import { TemporalPatternMatcher } from 'memorits';

// Analyze text for temporal patterns
const analysis = TemporalPatternMatcher.analyzeText(
  'Show me urgent issues from yesterday and today'
);

console.log(analysis.patterns); // Array of detected patterns
console.log(analysis.overallConfidence); // 0.0 to 1.0
```

#### Pattern Recognition

```typescript
// Detect temporal indicators
const patterns = TemporalPatternMatcher.extractPatterns(
  'Meetings from last week and this morning'
);

// Result includes:
// - Time expressions found
// - Relative dates
// - Temporal relationships
// - Confidence scores
```

### TemporalAggregation

Groups and aggregates memories by time periods:

```typescript
import { TemporalAggregation, TemporalAggregationPeriod } from 'memorits';

const memories = [
  { id: '1', timestamp: new Date('2024-01-01'), score: 0.8 },
  { id: '2', timestamp: new Date('2024-01-01'), score: 0.6 },
  { id: '3', timestamp: new Date('2024-01-02'), score: 0.9 }
];

// Aggregate by day
const aggregated = TemporalAggregation.aggregateByPeriod(
  memories,
  'day',
  {
    includeTrends: true,
    maxBuckets: 30,
    representativeStrategy: 'highest_score'
  }
);
```

## Advanced Usage Examples

### 1. Natural Language Temporal Queries

```typescript
const memori = new Memori();

// Simple relative queries
const yesterdayMemories = await memori.searchMemories('urgent issues', {
  temporalFilters: {
    relativeExpressions: ['yesterday']
  }
});

// Complex natural language
const complexQuery = await memori.searchMemories('meeting notes', {
  temporalFilters: {
    relativeExpressions: ['last Friday afternoon', 'this Monday morning']
  }
});
```

### 2. Precise Time Range Queries

```typescript
// Specific date ranges
const dateRangeQuery = await memori.searchMemories('project updates', {
  temporalFilters: {
    timeRanges: [{
      start: new Date('2024-01-01T09:00:00Z'),
      end: new Date('2024-01-31T17:00:00Z')
    }]
  }
});

// Multiple time ranges
const multiRangeQuery = await memori.searchMemories('decisions', {
  temporalFilters: {
    timeRanges: [
      { start: sprint1Start, end: sprint1End },
      { start: sprint2Start, end: sprint2End }
    ],
    operation: 'UNION'
  }
});
```

### 3. Temporal Pattern Analysis

```typescript
// Analyze patterns in memory creation
const patternAnalysis = await memori.searchMemories('', {
  temporalFilters: {
    patterns: ['daily standup', 'weekly review', 'monthly planning']
  },
  aggregation: {
    enabled: true,
    period: 'week',
    includeTrends: true
  }
});
```

### 4. Time-Based Memory Aggregation

```typescript
// Aggregate memories by time periods
const aggregatedMemories = await memori.searchMemories('progress updates', {
  aggregation: {
    enabled: true,
    period: 'week', // second, minute, hour, day, week, month, year
    includeTrends: true
  }
});

// Result includes:
// - Time buckets with memory counts
// - Trend analysis (increasing, decreasing, stable)
// - Representative memories for each period
// - Statistical summaries
```

## Strategy-Specific Configuration

### TemporalFilterStrategy Configuration

```typescript
const temporalConfig = {
  naturalLanguage: {
    enableParsing: true,
    enablePatternMatching: true,
    confidenceThreshold: 0.3
  },
  aggregation: {
    enableAggregation: true,
    defaultPeriod: 'hour',
    maxBuckets: 100,
    enableTrends: true
  },
  performance: {
    enableQueryOptimization: true,
    enableResultCaching: true,
    maxExecutionTime: 10000,
    batchSize: 100
  }
};
```

### Advanced Configuration Options

```typescript
interface TemporalFilterConfig {
  // Natural language processing
  enableFuzzyMatching?: boolean;
  customPatterns?: string[];
  timezone?: string;

  // Performance tuning
  cacheTTL?: number;
  maxConcurrentQueries?: number;
  enableQueryBatching?: boolean;

  // Result processing
  maxResultsPerRange?: number;
  enableResultRanking?: boolean;
  customScoring?: (memory: Memory, range: TimeRange) => number;
}
```

## Performance Optimization

### Query Optimization Strategies

```typescript
// Optimize temporal queries
const optimizedQuery = {
  text: 'urgent',
  temporalFilters: {
    timeRanges: [recentRange],
    relativeExpressions: ['today']
  },
  performance: {
    enableCaching: true,
    timeout: 5000,
    maxResults: 50
  }
};
```

### Caching Configuration

```typescript
// Configure temporal caching
const cacheConfig = {
  enableResultCaching: true,
  cacheSize: 100,
  cacheTTL: 300000, // 5 minutes
  enableQueryOptimization: true,

  // Cache invalidation strategies
  invalidateOnNewMemory: true,
  invalidateOnTimeBoundary: true,
  maxCacheAge: 3600000 // 1 hour
};
```

### Database Indexing for Performance

```typescript
// Temporal indexes for optimal performance
const temporalIndexes = [
  'CREATE INDEX idx_memory_created_at ON long_term_memory(created_at)',
  'CREATE INDEX idx_memory_timestamp_range ON long_term_memory(created_at, extraction_timestamp)',
  'CREATE INDEX idx_memory_temporal_search ON long_term_memory(created_at, importance_score, category_primary)'
];
```

## Real-World Use Cases

### 1. Meeting Assistant

```typescript
// Find relevant context for upcoming meetings
const meetingContext = await memori.searchMemories('project decisions', {
  temporalFilters: {
    relativeExpressions: ['this week', 'last week'],
    timeRanges: [upcomingMeetingWindow]
  },
  categories: ['essential', 'contextual'],
  minImportance: 'high'
});
```

### 2. Progress Tracking

```typescript
// Analyze progress over time periods
const progressAnalysis = await memori.searchMemories('progress updates', {
  aggregation: {
    enabled: true,
    period: 'week',
    includeTrends: true
  },
  categories: ['essential'],
  includeMetadata: true
});

// Identify trends and patterns
progressAnalysis.forEach(bucket => {
  console.log(`Week of ${bucket.period.start}: ${bucket.statistics.count} updates`);
  console.log(`Trend: ${bucket.trend.direction} (${bucket.trend.confidence})`);
});
```

### 3. Time-Sensitive Retrieval

```typescript
// Get most recent information about a topic
const recentInfo = await memori.searchMemories('API documentation', {
  temporalFilters: {
    relativeExpressions: ['last 30 days']
  },
  aggregation: {
    enabled: true,
    period: 'day'
  }
});

// Prioritize most recent and relevant information
recentInfo.sort((a, b) => {
  const timeWeight = 0.3;
  const scoreWeight = 0.7;
  return (b.metadata.temporalRelevanceScore * timeWeight) +
         (b.score * scoreWeight) -
         (a.metadata.temporalRelevanceScore * timeWeight) -
         (a.score * scoreWeight);
});
```

### 4. Historical Analysis

```typescript
// Analyze how a topic evolved over time
const historicalAnalysis = await memori.searchMemories('architecture decisions', {
  temporalFilters: {
    timeRanges: [{
      start: new Date('2024-01-01'),
      end: new Date('2024-12-31')
    }]
  },
  aggregation: {
    enabled: true,
    period: 'month',
    includeTrends: true
  }
});

// Track decision patterns and evolution
historicalAnalysis.forEach(month => {
  console.log(`Month: ${month.period.label}`);
  console.log(`Decision count: ${month.statistics.count}`);
  console.log(`Average importance: ${month.statistics.averageScore}`);
});
```

## Error Handling and Edge Cases

### Common Temporal Query Issues

```typescript
try {
  const results = await memori.searchMemories('urgent issues', {
    temporalFilters: {
      relativeExpressions: ['invalid date expression']
    }
  });
} catch (error) {
  if (error instanceof TemporalParsingError) {
    // Handle invalid temporal expressions
    console.error('Invalid time expression:', error.expression);
  } else if (error instanceof TemporalRangeError) {
    // Handle invalid time ranges
    console.error('Invalid time range:', error.range);
  }
}
```

### Timezone Handling

```typescript
// Specify timezone for temporal queries
const timezoneQuery = await memori.searchMemories('meetings', {
  temporalFilters: {
    relativeExpressions: ['today'],
    timezone: 'America/New_York'
  }
});
```

### Boundary Conditions

```typescript
// Handle daylight saving time transitions
const dstQuery = await memori.searchMemories('events', {
  temporalFilters: {
    timeRanges: [{
      start: new Date('2024-03-10'), // DST transition date
      end: new Date('2024-03-11')
    }]
  }
});
```

## Performance Monitoring

### Temporal Query Metrics

```typescript
interface TemporalMetrics {
  averageResponseTime: number;
  queriesPerSecond: number;
  cacheHitRate: number;
  patternMatchAccuracy: number;
  aggregationEfficiency: number;
}
```

### Monitoring Implementation

```typescript
// Monitor temporal query performance
const metrics = await temporalStrategy.getPerformanceMetrics();
console.log(`Average response time: ${metrics.averageResponseTime}ms`);
console.log(`Cache hit rate: ${metrics.cacheHitRate}%`);

// Track pattern matching accuracy
const patternAccuracy = await TemporalPatternMatcher.getAccuracyStats();
console.log(`Pattern recognition accuracy: ${patternAccuracy.overall}%`);
```

## Best Practices

### 1. Use Appropriate Time Windows

```typescript
// Choose time windows based on use case
const timeWindows = {
  // For recent context (chat sessions)
  recent: { hours: 24 },

  // For daily patterns (daily standups, reviews)
  daily: { days: 30 },

  // For weekly patterns (sprint retrospectives)
  weekly: { weeks: 12 },

  // For monthly patterns (project planning)
  monthly: { months: 6 },

  // For yearly patterns (annual reviews)
  yearly: { years: 3 }
};
```

### 2. Optimize Aggregation Periods

```typescript
// Choose aggregation periods based on data volume and analysis needs
const aggregationStrategy = {
  highVolume: 'hour',      // Many memories per hour
  mediumVolume: 'day',     // Moderate daily volume
  lowVolume: 'week',       // Lower weekly volume
  longTerm: 'month'        // Historical analysis
};
```

### 3. Balance Precision vs Performance

```typescript
// High precision (slower)
const preciseQuery = {
  temporalFilters: {
    timeRanges: [{ start: exactTime, end: exactTime }],
    enableFuzzyMatching: false
  }
};

// Balanced approach (recommended)
const balancedQuery = {
  temporalFilters: {
    relativeExpressions: ['approximately 2 hours ago'],
    enableFuzzyMatching: true,
    confidenceThreshold: 0.7
  }
};
```

### 4. Use Caching Effectively

```typescript
// Cache frequently used temporal queries
const cachedQuery = {
  text: 'urgent',
  temporalFilters: {
    relativeExpressions: ['today', 'yesterday']
  },
  performance: {
    enableCaching: true,
    cacheTTL: 300000 // 5 minutes
  }
};
```

## Integration with Other Features

### Combining with Category Filtering

```typescript
// Multi-dimensional queries
const complexQuery = await memori.searchMemories('urgent decisions', {
  categories: ['essential', 'contextual'],
  minImportance: 'high',
  temporalFilters: {
    relativeExpressions: ['this week'],
    timeRanges: [currentSprint]
  }
});
```

### Combining with Metadata Filtering

```typescript
// Advanced filtering with metadata
const advancedQuery = await memori.searchMemories('configuration changes', {
  metadataFilters: {
    author: 'senior_developer',
    modelUsed: 'gpt-4o-mini'
  },
  temporalFilters: {
    relativeExpressions: ['last 2 weeks']
  }
});
```

This sophisticated temporal filtering system enables AI agents to have a deep understanding of time-based context, making them capable of providing highly relevant and time-aware responses that understand not just what happened, but when and in what sequence events occurred.