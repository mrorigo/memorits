/**
 * TemporalAggregation - Aggregates results by time periods
 *
 * Provides functionality for:
 * - Time-based grouping (hourly, daily, weekly, monthly, yearly)
 * - Statistical calculations per time period
 * - Trend analysis across time periods
 * - Time series data generation
 * - Aggregation optimization for large datasets
 */

export interface TemporalAggregationPeriod {
  type: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
  count: number; // Number of periods to aggregate
  startFrom?: Date; // Custom start date for aggregation
}

export interface AggregationBucket {
  period: {
    start: Date;
    end: Date;
    label: string;
  };
  statistics: {
    count: number;
    averageScore: number;
    minScore: number;
    maxScore: number;
    totalImportance: number;
    uniqueCategories: string[];
    memoryTypes: Record<string, number>;
  };
  trend: {
    direction: 'increasing' | 'decreasing' | 'stable';
    strength: number; // 0-1
    changePercent: number;
  };
  representative: {
    memoryId: string;
    content: string;
    score: number;
  } | null;
}

export interface TemporalAggregationResult {
  buckets: AggregationBucket[];
  summary: {
    totalMemories: number;
    timeSpan: {
      start: Date;
      end: Date;
      duration: number; // in milliseconds
    };
    dominantPeriod: string;
    overallTrend: {
      direction: 'increasing' | 'decreasing' | 'stable';
      strength: number;
    };
  };
  metadata: {
    aggregationPeriod: TemporalAggregationPeriod;
    generatedAt: Date;
    processingTime: number;
  };
}

export class TemporalAggregation {
  private static readonly PERIOD_MULTIPLIERS = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000, // Approximate
    year: 365 * 24 * 60 * 60 * 1000 // Approximate
  };

  /**
   * Aggregate search results by time periods
   */
  static aggregateByPeriod(
    results: Array<{
      id: string;
      content: string;
      score: number;
      timestamp: Date;
      metadata: Record<string, any>;
    }>,
    period: TemporalAggregationPeriod,
    options: {
      includeTrends?: boolean;
      maxBuckets?: number;
      representativeStrategy?: 'highest_score' | 'most_recent' | 'random';
    } = {}
  ): TemporalAggregationResult {
    const startTime = Date.now();
    const {
      includeTrends = true,
      maxBuckets = 100,
      representativeStrategy = 'highest_score'
    } = options;

    // Sort results by timestamp
    const sortedResults = [...results].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    // Generate time buckets
    const buckets = this.generateTimeBuckets(period, sortedResults, maxBuckets);

    // Populate buckets with data
    const populatedBuckets = this.populateBuckets(sortedResults, buckets, representativeStrategy);

    // Calculate trends if requested
    if (includeTrends) {
      this.calculateTrends(populatedBuckets);
    }

    // Generate summary
    const summary = this.generateSummary(populatedBuckets, period);

    return {
      buckets: populatedBuckets,
      summary,
      metadata: {
        aggregationPeriod: period,
        generatedAt: new Date(),
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
    * Generate time buckets for aggregation
    */
   private static generateTimeBuckets(
     period: TemporalAggregationPeriod,
     results: Array<{ timestamp: Date }>,
     maxBuckets: number
   ): Array<{ start: Date; end: Date; label: string }> {
     if (results.length === 0) {
       return [];
     }

     const periodMs = this.PERIOD_MULTIPLIERS[period.type];
     const sortedResults = [...results].sort(
       (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
     );

     const earliestTime = sortedResults[0].timestamp;
     const latestTime = sortedResults[sortedResults.length - 1].timestamp;

     // Create buckets that ensure all results are covered
     const buckets: Array<{ start: Date; end: Date; label: string }> = [];
     const customStart = period.startFrom || earliestTime;

     // Calculate the total number of periods needed
     const totalTimeSpan = latestTime.getTime() - customStart.getTime();
     const totalPeriods = Math.ceil(totalTimeSpan / periodMs) + 1; // Add 1 to ensure coverage
     const actualBuckets = Math.min(maxBuckets, Math.max(1, totalPeriods));

     // Create buckets based on the period type and custom start
     for (let i = 0; i < actualBuckets; i++) {
       const start = new Date(customStart.getTime() + (i * periodMs));
       const end = new Date(start.getTime() + periodMs);

       buckets.push({
         start,
         end,
         label: this.formatBucketLabel(start, period.type, i)
       });
     }

     return buckets;
   }

  /**
   * Populate buckets with result data
   */
  private static populateBuckets(
    results: Array<{
      id: string;
      content: string;
      score: number;
      timestamp: Date;
      metadata: Record<string, any>;
    }>,
    buckets: Array<{ start: Date; end: Date; label: string }>,
    representativeStrategy: 'highest_score' | 'most_recent' | 'random'
  ): AggregationBucket[] {
    const populatedBuckets: AggregationBucket[] = buckets.map(bucket => ({
      period: bucket,
      statistics: {
        count: 0,
        averageScore: 0,
        minScore: 1,
        maxScore: 0,
        totalImportance: 0,
        uniqueCategories: [],
        memoryTypes: {}
      },
      trend: {
        direction: 'stable',
        strength: 0,
        changePercent: 0
      },
      representative: null
    }));

    // Group results into buckets
    for (const result of results) {
      const bucketIndex = buckets.findIndex(
        bucket => result.timestamp >= bucket.start && result.timestamp < bucket.end
      );

      if (bucketIndex !== -1) {
        const bucket = populatedBuckets[bucketIndex];
        const category = result.metadata.category || 'uncategorized';
        const memoryType = result.metadata.memoryType || 'unknown';

        // Update statistics
        bucket.statistics.count++;
        bucket.statistics.averageScore =
          (bucket.statistics.averageScore * (bucket.statistics.count - 1) + result.score) /
          bucket.statistics.count;
        bucket.statistics.minScore = Math.min(bucket.statistics.minScore, result.score);
        bucket.statistics.maxScore = Math.max(bucket.statistics.maxScore, result.score);
        bucket.statistics.totalImportance += result.metadata.importanceScore || 0.5;

        // Track categories
        if (!bucket.statistics.uniqueCategories.includes(category)) {
          bucket.statistics.uniqueCategories.push(category);
        }

        // Track memory types
        bucket.statistics.memoryTypes[memoryType] =
          (bucket.statistics.memoryTypes[memoryType] || 0) + 1;

        // Update representative memory
        if (!bucket.representative ||
            this.shouldReplaceRepresentative(bucket.representative, result, representativeStrategy)) {
          bucket.representative = {
            memoryId: result.id,
            content: result.content,
            score: result.score
          };
        }
      }
    }

    return populatedBuckets;
  }

  /**
   * Determine if a result should replace the current representative
   */
  private static shouldReplaceRepresentative(
    current: { score: number },
    candidate: { score: number },
    strategy: 'highest_score' | 'most_recent' | 'random'
  ): boolean {
    switch (strategy) {
      case 'highest_score':
        return candidate.score > current.score;
      case 'most_recent':
        // Since we're processing in order, later items are more recent
        return true;
      case 'random':
        return Math.random() > 0.5;
      default:
        return false;
    }
  }

  /**
   * Calculate trends between buckets
   */
  private static calculateTrends(buckets: AggregationBucket[]): void {
    for (let i = 1; i < buckets.length; i++) {
      const current = buckets[i];
      const previous = buckets[i - 1];

      const change = current.statistics.averageScore - previous.statistics.averageScore;
      const changePercent = previous.statistics.averageScore !== 0
        ? (change / previous.statistics.averageScore) * 100
        : 0;

      let direction: 'increasing' | 'decreasing' | 'stable' = 'stable';
      let strength = 0;

      if (Math.abs(changePercent) > 5) {
        direction = changePercent > 0 ? 'increasing' : 'decreasing';
        strength = Math.min(Math.abs(changePercent) / 50, 1); // Cap at 1
      }

      current.trend = {
        direction,
        strength,
        changePercent
      };
    }
  }

  /**
   * Generate summary statistics
   */
  private static generateSummary(
    buckets: AggregationBucket[],
    period: TemporalAggregationPeriod
  ) {
    const nonEmptyBuckets = buckets.filter(b => b.statistics.count > 0);

    if (nonEmptyBuckets.length === 0) {
      return {
        totalMemories: 0,
        timeSpan: { start: new Date(), end: new Date(), duration: 0 },
        dominantPeriod: 'none',
        overallTrend: { direction: 'stable' as const, strength: 0 }
      };
    }

    const allScores = nonEmptyBuckets.map(b => b.statistics.averageScore);
    const totalMemories = nonEmptyBuckets.reduce((sum, b) => sum + b.statistics.count, 0);
    const firstBucket = nonEmptyBuckets[0];
    const lastBucket = nonEmptyBuckets[nonEmptyBuckets.length - 1];

    // Calculate overall trend
    const firstScore = allScores[0];
    const lastScore = allScores[allScores.length - 1];
    const overallChange = lastScore - firstScore;
    const overallChangePercent = firstScore !== 0 ? (overallChange / firstScore) * 100 : 0;

    let overallDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (Math.abs(overallChangePercent) > 10) {
      overallDirection = overallChangePercent > 0 ? 'increasing' : 'decreasing';
    }

    // Find dominant period (bucket with highest activity)
    const dominantBucket = nonEmptyBuckets.reduce((dominant, current) =>
      current.statistics.count > dominant.statistics.count ? current : dominant
    );

    return {
      totalMemories,
      timeSpan: {
        start: firstBucket.period.start,
        end: lastBucket.period.end,
        duration: lastBucket.period.end.getTime() - firstBucket.period.start.getTime()
      },
      dominantPeriod: dominantBucket.period.label,
      overallTrend: {
        direction: overallDirection,
        strength: Math.min(Math.abs(overallChangePercent) / 25, 1)
      }
    };
  }

  /**
   * Format bucket label based on period type
   */
  private static formatBucketLabel(start: Date, periodType: string, index: number): string {
    switch (periodType) {
      case 'second':
        return start.toISOString().split('T')[1].split('.')[0];
      case 'minute':
        return start.toISOString().slice(0, 16).replace('T', ' ');
      case 'hour':
        return start.toISOString().slice(0, 13).replace('T', ' ');
      case 'day':
        return start.toISOString().split('T')[0];
      case 'week':
        const weekStart = new Date(start);
        weekStart.setDate(start.getDate() - start.getDay());
        return `Week of ${weekStart.toISOString().split('T')[0]}`;
      case 'month':
        return `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}`;
      case 'year':
        return String(start.getFullYear());
      default:
        return `Period ${index + 1}`;
    }
  }

  /**
   * Get optimal aggregation period for a dataset
   */
  static getOptimalPeriod(
    results: Array<{ timestamp: Date }>,
    preferredMaxBuckets: number = 50
  ): TemporalAggregationPeriod {
    if (results.length === 0) {
      return { type: 'day', count: 1 };
    }

    const sortedResults = [...results].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    const timeSpan = sortedResults[sortedResults.length - 1].timestamp.getTime() -
                     sortedResults[0].timestamp.getTime();

    // Determine optimal period based on time span - choose largest period first
    const periods: Array<{ type: TemporalAggregationPeriod['type']; maxSpan: number }> = [
      { type: 'year', maxSpan: Infinity },
      { type: 'month', maxSpan: 20 * 365 * 24 * 60 * 60 * 1000 }, // 20 years
      { type: 'week', maxSpan: 5 * 365 * 24 * 60 * 60 * 1000 }, // 5 years
      { type: 'day', maxSpan: 365 * 24 * 60 * 60 * 1000 }, // 1 year
      { type: 'hour', maxSpan: 30 * 24 * 60 * 60 * 1000 }, // 30 days
      { type: 'minute', maxSpan: 24 * 60 * 60 * 1000 }, // 1 day
      { type: 'second', maxSpan: 60 * 60 * 1000 } // 1 hour
    ];

    // For very long time spans, prefer larger periods even if they create more buckets
    if (timeSpan > 365 * 24 * 60 * 60 * 1000) { // More than 1 year
      const years = timeSpan / this.PERIOD_MULTIPLIERS.year;
      if (years <= preferredMaxBuckets) {
        return { type: 'year', count: Math.ceil(years) };
      }
    }

    // Find the largest period that would create reasonable buckets
    let optimalPeriod = periods[periods.length - 1]; // Default to smallest

    for (let i = 0; i < periods.length; i++) {
      const period = periods[i];
      const estimatedBuckets = timeSpan / this.PERIOD_MULTIPLIERS[period.type];

      // If this period would create too many buckets, use the previous (larger) period
      if (estimatedBuckets > preferredMaxBuckets) {
        if (i > 0) {
          optimalPeriod = periods[i - 1];
        }
        break;
      } else {
        // This period works, keep checking if there's a larger one that also works
        optimalPeriod = period;
      }
    }

    const count = Math.ceil(timeSpan / this.PERIOD_MULTIPLIERS[optimalPeriod.type]);

    return {
      type: optimalPeriod.type,
      count: Math.min(count, preferredMaxBuckets)
    };
  }

  /**
   * Merge aggregation results from multiple queries
   */
  static mergeAggregationResults(
    results: TemporalAggregationResult[]
  ): TemporalAggregationResult | null {
    if (results.length === 0) return null;
    if (results.length === 1) return results[0];

    // Group buckets by time period across all results
    const bucketMap = new Map<string, AggregationBucket[]>();

    for (const result of results) {
      for (const bucket of result.buckets) {
        const key = bucket.period.label;
        if (!bucketMap.has(key)) {
          bucketMap.set(key, []);
        }
        bucketMap.get(key)!.push(bucket);
      }
    }

    // Merge buckets with the same time period
    const mergedBuckets: AggregationBucket[] = [];

    for (const [label, buckets] of bucketMap.entries()) {
      const mergedBucket = this.mergeBuckets(buckets);
      mergedBucket.period.label = label;
      mergedBuckets.push(mergedBucket);
    }

    // Sort merged buckets by time
    mergedBuckets.sort((a, b) =>
      a.period.start.getTime() - b.period.start.getTime()
    );

    // Recalculate trends for merged data
    this.calculateTrends(mergedBuckets);

    // Generate new summary
    const summary = this.generateSummary(mergedBuckets, results[0].metadata.aggregationPeriod);

    return {
      buckets: mergedBuckets,
      summary,
      metadata: {
        aggregationPeriod: results[0].metadata.aggregationPeriod,
        generatedAt: new Date(),
        processingTime: results.reduce((sum, r) => sum + r.metadata.processingTime, 0)
      }
    };
  }

  /**
   * Merge multiple buckets for the same time period
   */
  private static mergeBuckets(buckets: AggregationBucket[]): AggregationBucket {
    if (buckets.length === 1) return buckets[0];

    const merged: AggregationBucket = {
      period: {
        start: buckets[0].period.start,
        end: buckets[buckets.length - 1].period.end,
        label: 'Merged'
      },
      statistics: {
        count: buckets.reduce((sum, b) => sum + b.statistics.count, 0),
        averageScore: buckets.reduce((sum, b) => sum + (b.statistics.averageScore * b.statistics.count), 0) /
                     buckets.reduce((sum, b) => sum + b.statistics.count, 0),
        minScore: Math.min(...buckets.map(b => b.statistics.minScore)),
        maxScore: Math.max(...buckets.map(b => b.statistics.maxScore)),
        totalImportance: buckets.reduce((sum, b) => sum + b.statistics.totalImportance, 0),
        uniqueCategories: [...new Set(buckets.flatMap(b => b.statistics.uniqueCategories))],
        memoryTypes: buckets.reduce((acc, b) => {
          for (const [type, count] of Object.entries(b.statistics.memoryTypes)) {
            acc[type] = (acc[type] || 0) + count;
          }
          return acc;
        }, {} as Record<string, number>)
      },
      trend: {
        direction: 'stable',
        strength: 0,
        changePercent: 0
      },
      representative: buckets.find(b => b.representative)?.representative || null
    };

    return merged;
  }

  /**
   * Export aggregation data for visualization
   */
  static exportForVisualization(result: TemporalAggregationResult): {
    timeSeries: Array<{
      timestamp: Date;
      value: number;
      count: number;
      label: string;
    }>;
    summary: {
      totalDataPoints: number;
      timeRange: { start: string; end: string };
      averageValue: number;
    };
  } {
    const timeSeries = result.buckets.map(bucket => ({
      timestamp: bucket.period.start,
      value: bucket.statistics.averageScore,
      count: bucket.statistics.count,
      label: bucket.period.label
    }));

    const summary = {
      totalDataPoints: result.buckets.length,
      timeRange: {
        start: result.summary.timeSpan.start.toISOString(),
        end: result.summary.timeSpan.end.toISOString()
      },
      averageValue: result.buckets.reduce((sum, b) => sum + b.statistics.averageScore, 0) /
                   Math.max(result.buckets.length, 1)
    };

    return { timeSeries, summary };
  }
}