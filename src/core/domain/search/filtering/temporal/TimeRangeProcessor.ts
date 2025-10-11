/**
 * TimeRangeProcessor - Handles complex time range queries and calculations
 *
 * Provides functionality for:
 * - Time range validation and normalization
 * - Time range intersection and union operations
 * - Time range expansion and contraction
 * - Time-based bucketing and grouping
 * - Performance optimization for time range queries
 */

export interface TimeRange {
  start: Date;
  end: Date;
  inclusive?: boolean;
}

export interface TimeRangeQuery {
  ranges: TimeRange[];
  operation?: 'INTERSECT' | 'UNION' | 'EXCLUDE';
  granularity?: 'second' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';
}

export interface ProcessedTimeRange {
  originalRange: TimeRange;
  normalizedRange: TimeRange;
  duration: number; // in milliseconds
  isValid: boolean;
  warnings: string[];
}

export interface TimeBucket {
  start: Date;
  end: Date;
  label: string;
  count?: number;
}

export class TimeRangeProcessor {
  private static readonly MIN_RANGE_MS = 1000; // 1 second
  private static readonly MAX_RANGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

  /**
   * Process and validate a time range query
   */
  static processTimeRangeQuery(query: TimeRangeQuery): ProcessedTimeRange[] {
    const processedRanges: ProcessedTimeRange[] = [];

    for (const range of query.ranges) {
      const processed = this.processTimeRange(range);
      processedRanges.push(processed);
    }

    return processedRanges;
  }

  /**
   * Process and validate a single time range
   */
  static processTimeRange(range: TimeRange): ProcessedTimeRange {
    const warnings: string[] = [];
    let normalizedRange = { ...range };

    try {
      // Validate input dates
      if (!(range.start instanceof Date) || !(range.end instanceof Date)) {
        throw new Error('Invalid date objects provided');
      }

      if (isNaN(range.start.getTime()) || isNaN(range.end.getTime())) {
        throw new Error('Invalid date values provided');
      }

      // Normalize dates to start/end of day if needed
      normalizedRange = this.normalizeTimeRange(normalizedRange);

      // Validate range duration
      const duration = normalizedRange.end.getTime() - normalizedRange.start.getTime();

      if (duration < this.MIN_RANGE_MS) {
        warnings.push(`Time range is very short (${duration}ms). Consider if this is intentional.`);
      }

      if (duration > this.MAX_RANGE_MS) {
        warnings.push(`Time range is very large (${duration}ms). This may impact performance.`);
      }

      // Check for logical consistency
      if (normalizedRange.start >= normalizedRange.end) {
        throw new Error('Start date must be before end date');
      }

      return {
        originalRange: range,
        normalizedRange,
        duration,
        isValid: true,
        warnings
      };

    } catch (error) {
      return {
        originalRange: range,
        normalizedRange,
        duration: 0,
        isValid: false,
        warnings: [`Time range processing failed: ${error instanceof Error ? error.message : String(error)}`]
      };
    }
  }

  /**
   * Normalize time range for consistent processing
   */
  private static normalizeTimeRange(range: TimeRange): TimeRange {
    const normalized = { ...range };

    // Ensure start is before end
    if (normalized.start > normalized.end) {
      [normalized.start, normalized.end] = [normalized.end, normalized.start];
    }

    // Normalize to start of minute for precision queries
    normalized.start = new Date(normalized.start);
    normalized.end = new Date(normalized.end);

    return normalized;
  }

  /**
   * Calculate intersection of multiple time ranges
   */
  static intersectRanges(ranges: TimeRange[]): TimeRange | null {
    if (ranges.length === 0) return null;
    if (ranges.length === 1) return ranges[0];

    let intersection = ranges[0];

    for (let i = 1; i < ranges.length; i++) {
      const nextIntersection = this.intersectTwoRanges(intersection, ranges[i]);
      if (!nextIntersection) {
        return null; // No intersection found
      }
      intersection = nextIntersection;
    }

    return intersection;
  }

  /**
   * Calculate intersection of two time ranges
   */
  private static intersectTwoRanges(range1: TimeRange, range2: TimeRange): TimeRange | null {
    const start = new Date(Math.max(range1.start.getTime(), range2.start.getTime()));
    const end = new Date(Math.min(range1.end.getTime(), range2.end.getTime()));

    if (start >= end) {
      return null; // No intersection
    }

    return { start, end };
  }

  /**
   * Calculate union of multiple time ranges
   */
  static unionRanges(ranges: TimeRange[]): TimeRange[] {
    if (ranges.length === 0) return [];
    if (ranges.length === 1) return [ranges[0]];

    // Sort ranges by start time
    const sortedRanges = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());

    const mergedRanges: TimeRange[] = [sortedRanges[0]];

    for (let i = 1; i < sortedRanges.length; i++) {
      const current = sortedRanges[i];
      const lastMerged = mergedRanges[mergedRanges.length - 1];

      if (current.start <= lastMerged.end) {
        // Overlapping ranges - merge them
        lastMerged.end = new Date(Math.max(lastMerged.end.getTime(), current.end.getTime()));
      } else {
        // Non-overlapping - add new range
        mergedRanges.push(current);
      }
    }

    return mergedRanges;
  }

  /**
   * Create time buckets for a given range and granularity
   */
  static createTimeBuckets(range: TimeRange, granularity: TimeRangeQuery['granularity'] = 'day'): TimeBucket[] {
    const buckets: TimeBucket[] = [];
    const processedRange = this.processTimeRange(range);

    if (!processedRange.isValid) {
      return buckets;
    }

    const { start, end } = processedRange.normalizedRange;
    const bucketSize = this.getGranularityMs(granularity);

    let current = new Date(start);
    let bucketIndex = 0;

    while (current < end) {
      const bucketStart = new Date(current);
      const bucketEnd = new Date(Math.min(current.getTime() + bucketSize, end.getTime()));

      buckets.push({
        start: bucketStart,
        end: bucketEnd,
        label: this.formatBucketLabel(bucketStart, granularity, bucketIndex)
      });

      current = new Date(current.getTime() + bucketSize);
      bucketIndex++;
    }

    return buckets;
  }

  /**
   * Get granularity in milliseconds
   */
  private static getGranularityMs(granularity: TimeRangeQuery['granularity']): number {
    const granularities: Record<NonNullable<TimeRangeQuery['granularity']>, number> = {
      second: 1000,
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000, // Approximate
      year: 365 * 24 * 60 * 60 * 1000 // Approximate
    };

    return granularities[granularity || 'day'];
  }

  /**
   * Format bucket label based on granularity
   */
  private static formatBucketLabel(start: Date, granularity: TimeRangeQuery['granularity'], index: number): string {
    switch (granularity) {
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
        return `Bucket ${index}`;
    }
  }

  /**
   * Expand time range by a specified amount
   */
  static expandTimeRange(range: TimeRange, expansion: { before?: number; after?: number }): TimeRange {
    const expanded = { ...range };

    if (expansion.before) {
      expanded.start = new Date(expanded.start.getTime() - expansion.before);
    }

    if (expansion.after) {
      expanded.end = new Date(expanded.end.getTime() + expansion.after);
    }

    return expanded;
  }

  /**
   * Contract time range by a specified amount
   */
  static contractTimeRange(range: TimeRange, contraction: { before?: number; after?: number }): TimeRange {
    const contracted = { ...range };

    if (contraction.before) {
      contracted.start = new Date(contracted.start.getTime() + contraction.before);
    }

    if (contraction.after) {
      contracted.end = new Date(contracted.end.getTime() - contraction.after);
    }

    // Ensure start is still before end
    if (contracted.start >= contracted.end) {
      throw new Error('Time range contraction results in invalid range');
    }

    return contracted;
  }

  /**
   * Check if a date falls within any of the provided ranges
   */
  static dateInRanges(date: Date, ranges: TimeRange[]): boolean {
    return ranges.some(range => {
      const inRange = date >= range.start && date <= range.end;
      return range.inclusive !== false ? inRange : date >= range.start && date < range.end;
    });
  }

  /**
   * Get time range statistics
   */
  static getRangeStatistics(ranges: TimeRange[]): {
    totalDuration: number;
    averageDuration: number;
    minDuration: number;
    maxDuration: number;
    rangeCount: number;
    coverage: number; // Percentage of time covered by ranges
  } {
    if (ranges.length === 0) {
      return {
        totalDuration: 0,
        averageDuration: 0,
        minDuration: 0,
        maxDuration: 0,
        rangeCount: 0,
        coverage: 0
      };
    }

    const durations = ranges.map(r => r.end.getTime() - r.start.getTime());
    const totalDuration = durations.reduce((sum, duration) => sum + duration, 0);
    const averageDuration = totalDuration / ranges.length;
    const minDuration = Math.min(...durations);
    const maxDuration = Math.max(...durations);

    // Calculate coverage (union of all ranges)
    const unionRanges = this.unionRanges(ranges);
    const unionDuration = unionRanges.reduce((sum, range) => {
      return sum + (range.end.getTime() - range.start.getTime());
    }, 0);

    return {
      totalDuration,
      averageDuration,
      minDuration,
      maxDuration,
      rangeCount: ranges.length,
      coverage: unionDuration / totalDuration
    };
  }
}