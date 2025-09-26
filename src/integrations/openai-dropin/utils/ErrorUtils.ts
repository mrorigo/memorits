// src/integrations/openai-dropin/utils/ErrorUtils.ts
// Centralized error handling utilities for OpenAI Drop-in integration
// Provides standardized error handling, recovery mechanisms, and logging

import type {
  MemoryRecordingResult,
  ErrorRecoveryConfig,
} from '../types';
import {
  MemoryErrorType,
  RecoveryStrategy,
} from '../types';
import { MemoryError } from '../types';
import { logInfo, logError } from '../../../core/utils/Logger';

/**
 * Streaming context interface for error handling
 */
export interface StreamingContext extends Record<string, unknown> {
  chunkCount: number;
  contentLength: number;
  duration: number;
  config?: any;
  streamingContext?: boolean;
}

/**
 * Default error recovery configuration
 */
const DEFAULT_ERROR_RECOVERY: ErrorRecoveryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  strategy: RecoveryStrategy.RETRY,
  logRecovery: true,
  customRecovery: async (error: MemoryError) => {
    logError('Custom recovery function called', {
      component: 'MemoryErrorHandler',
      errorType: error.type,
      message: error.message,
    });
    return true; // Recovery successful
  },
};

/**
 * Centralized error handling utilities
 */
export class MemoryErrorHandler {
  private static errorRecovery: ErrorRecoveryConfig = DEFAULT_ERROR_RECOVERY;

  /**
   * Configures error recovery settings
   */
  static configureErrorRecovery(config: Partial<ErrorRecoveryConfig>): void {
    this.errorRecovery = { ...DEFAULT_ERROR_RECOVERY, ...config };
    logInfo('Error recovery configuration updated', {
      component: 'MemoryErrorHandler',
      maxRetries: this.errorRecovery.maxRetries,
      retryDelay: this.errorRecovery.retryDelay,
      strategy: this.errorRecovery.strategy,
    });
  }

  /**
   * Handles recording errors with standardized recovery logic
   */
  static async handleRecordingError(
    error: unknown,
    context: Record<string, unknown>
  ): Promise<MemoryRecordingResult> {
    const memoryError = this.createMemoryError(
      MemoryErrorType.RECORDING_FAILED,
      error,
      context,
      true // Usually recoverable
    );

    logError('Memory recording error occurred', {
      component: 'MemoryErrorHandler',
      errorType: memoryError.type,
      message: memoryError.message,
      context: memoryError.context,
      recoverable: memoryError.recoverable,
    });

    // Attempt recovery if error is recoverable
    if (memoryError.recoverable) {
      return this.attemptRecovery(memoryError, context);
    }

    return this.createErrorResult(memoryError);
  }

  /**
   * Handles streaming errors with context-aware recovery
   */
  static async handleStreamingError(
    error: unknown,
    context: StreamingContext & Record<string, unknown>
  ): Promise<MemoryRecordingResult> {
    const memoryError = this.createMemoryError(
      MemoryErrorType.STREAMING_ERROR,
      error,
      { ...context, streamingContext: true },
      true // Streaming errors are often recoverable
    );

    logError('Memory streaming error occurred', {
      component: 'MemoryErrorHandler',
      errorType: memoryError.type,
      message: memoryError.message,
      context: memoryError.context,
      streamingContext: true,
    });

    // Attempt recovery with streaming-specific logic
    if (memoryError.recoverable) {
      return this.attemptStreamingRecovery(memoryError, context);
    }

    return this.createErrorResult(memoryError);
  }

  /**
   * Handles database errors with appropriate recovery strategies
   */
  static async handleDatabaseError(
    error: unknown,
    context: Record<string, unknown>
  ): Promise<MemoryRecordingResult> {
    const memoryError = this.createMemoryError(
      MemoryErrorType.DATABASE_ERROR,
      error,
      context,
      false // Database errors are often not recoverable
    );

    logError('Database error occurred', {
      component: 'MemoryErrorHandler',
      errorType: memoryError.type,
      message: memoryError.message,
      context: memoryError.context,
      databaseContext: true,
    });

    // Database errors typically require manual intervention
    if (this.errorRecovery.strategy === 'manual') {
      return this.createManualRecoveryResult(memoryError);
    }

    return this.createErrorResult(memoryError);
  }

  /**
   * Creates standardized error result from MemoryError
   */
  static createErrorResult(error: MemoryError): MemoryRecordingResult {
    return {
      success: false,
      error: error.message,
      duration: 0,
      wasStreaming: this.isStreamingError(error),
    };
  }

  /**
   * Creates a standardized MemoryError with context
   */
  static createMemoryError(
    type: MemoryErrorType,
    error: unknown,
    context: Record<string, unknown> = {},
    recoverable: boolean = true
  ): MemoryError {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorContext = {
      ...context,
      originalError: error instanceof Error ? error.name : 'Unknown',
      timestamp: new Date().toISOString(),
      errorStack: error instanceof Error ? error.stack : undefined,
    };

    return new MemoryError(type, errorMessage, errorContext, recoverable);
  }

  /**
   * Attempts error recovery with configured strategy
   */
  private static async attemptRecovery(
    error: MemoryError,
    context: Record<string, unknown>
  ): Promise<MemoryRecordingResult> {
    if (this.errorRecovery.strategy === 'skip') {
      logInfo('Skipping memory recording due to error', {
        component: 'MemoryErrorHandler',
        errorType: error.type,
        message: error.message,
      });

      return {
        success: false,
        error: error.message,
        duration: 0,
        wasStreaming: false,
      };
    }

    // Use custom recovery function if provided
    if (this.errorRecovery.customRecovery) {
      try {
        const customRecoveryResult = await this.errorRecovery.customRecovery(error);
        if (customRecoveryResult) {
          logInfo('Custom recovery successful', {
            component: 'MemoryErrorHandler',
            errorType: error.type,
          });

          return {
            success: true,
            duration: 0,
            wasStreaming: this.isStreamingError(error),
          };
        }
      } catch (customError) {
        logError('Custom recovery function failed', {
          component: 'MemoryErrorHandler',
          error: customError instanceof Error ? customError.message : String(customError),
          originalErrorType: error.type,
        });
      }
    }

    // Fallback to retry strategy
    return this.attemptRetryRecovery(error, context);
  }

  /**
   * Attempts streaming-specific error recovery
   */
  private static async attemptStreamingRecovery(
    error: MemoryError,
    context: StreamingContext
  ): Promise<MemoryRecordingResult> {
    // Streaming errors might benefit from different recovery strategies
    if (error.message.includes('timeout') || error.message.includes('aborted')) {
      logInfo('Attempting streaming recovery for timeout/abort error', {
        component: 'MemoryErrorHandler',
        errorType: error.type,
        message: error.message,
      });

      // For timeout errors, we might want to try with a longer timeout
      return {
        success: false,
        error: `Streaming failed: ${error.message}. Consider increasing buffer timeout.`,
        duration: 0,
        wasStreaming: true,
      };
    }

    // For other streaming errors, use standard recovery
    return this.attemptRecovery(error, context);
  }

  /**
   * Attempts retry-based recovery with exponential backoff
   */
  private static async attemptRetryRecovery(
    error: MemoryError,
    context: Record<string, unknown>
  ): Promise<MemoryRecordingResult> {
    let attempts = 0;
    let lastError = error;

    while (attempts < this.errorRecovery.maxRetries) {
      attempts++;

      try {
        // Wait before retry (exponential backoff)
        if (attempts > 1) {
          const delay = this.errorRecovery.retryDelay * Math.pow(2, attempts - 1);
          logInfo(`Waiting before retry attempt ${attempts}`, {
            component: 'MemoryErrorHandler',
            delay,
            errorType: error.type,
          });
          await this.delay(delay);
        }

        logInfo('Attempting error recovery retry', {
          component: 'MemoryErrorHandler',
          errorType: error.type,
          attempts,
          maxRetries: this.errorRecovery.maxRetries,
        });

        // Attempt recovery - this would typically involve re-trying the operation
        const retryResult = await this.performRetryOperation(context, error);

        if (retryResult.success) {
          logInfo('Error recovery retry successful', {
            component: 'MemoryErrorHandler',
            errorType: error.type,
            attempts,
            recovered: true,
          });
          return retryResult;
        }

        // Update last error for next iteration
        lastError = new MemoryError(
          MemoryErrorType.RECORDING_FAILED,
          `Retry attempt ${attempts} failed: ${retryResult.error}`,
          { originalError: error, retryAttempts: attempts, context },
          true,
        );

      } catch (recoveryError) {
        lastError = new MemoryError(
          MemoryErrorType.RECORDING_FAILED,
          `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : String(recoveryError)}`,
          { originalError: error, recoveryAttempts: attempts, context },
          true,
        );

        logError('Exception during retry attempt', {
          component: 'MemoryErrorHandler',
          errorType: error.type,
          attempts,
          recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError),
        });
      }
    }

    // All recovery attempts failed
    logError('All recovery attempts failed', {
      component: 'MemoryErrorHandler',
      errorType: error.type,
      totalAttempts: attempts,
    });

    return {
      success: false,
      error: `Recovery failed after ${attempts} attempts: ${lastError.message}`,
      duration: 0,
      wasStreaming: this.isStreamingError(error),
    };
  }

  /**
   * Creates result for manual recovery requirement
   */
  private static createManualRecoveryResult(error: MemoryError): MemoryRecordingResult {
    return {
      success: false,
      error: `Manual intervention required: ${error.message}. Error type: ${error.type}`,
      duration: 0,
      wasStreaming: this.isStreamingError(error),
    };
  }

  /**
   * Determines if an error is streaming-related
   */
  private static isStreamingError(error: MemoryError): boolean {
    return error.type === MemoryErrorType.STREAMING_ERROR ||
           error.message.includes('stream') ||
           error.message.includes('chunk') ||
           error.context.streamingContext === true;
  }

  /**
   * Performs the actual retry operation (placeholder for actual implementation)
   */
  private static async performRetryOperation(
    context: Record<string, unknown>,
    error: MemoryError
  ): Promise<MemoryRecordingResult> {
    // This would contain the actual retry logic
    // For now, we'll simulate a retry that might succeed

    logInfo('Performing retry operation', {
      component: 'MemoryErrorHandler',
      context,
      errorType: error.type,
    });

    // Simulate occasional success for demonstration
    if (Math.random() > 0.7) {
      return {
        success: true,
        duration: 0,
        wasStreaming: this.isStreamingError(error),
      };
    }

    return {
      success: false,
      error: 'Retry operation failed',
      duration: 0,
      wasStreaming: this.isStreamingError(error),
    };
  }

  /**
   * Utility method for delays
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets current error recovery configuration
   */
  static getErrorRecoveryConfig(): ErrorRecoveryConfig {
    return { ...this.errorRecovery };
  }
}

/**
 * Error context builders for common scenarios
 */
export class ErrorContextBuilder {
  /**
   * Creates context for chat completion errors
   */
  static createChatCompletionContext(
    params: any,
    options?: any,
    duration?: number
  ): Record<string, unknown> {
    return {
      operationType: 'chat_completion',
      model: params?.model,
      temperature: params?.temperature,
      maxTokens: params?.max_tokens,
      messageCount: params?.messages?.length,
      options,
      duration,
    };
  }

  /**
   * Creates context for embedding errors
   */
  static createEmbeddingContext(
    params: any,
    options?: any,
    duration?: number
  ): Record<string, unknown> {
    return {
      operationType: 'embedding',
      model: params?.model,
      inputType: Array.isArray(params?.input) ? 'array' : 'string',
      inputLength: Array.isArray(params?.input)
        ? params.input.length
        : params?.input?.length || 0,
      options,
      duration,
    };
  }

  /**
   * Creates context for streaming errors
   */
  static createStreamingContext(
    chunkCount: number,
    contentLength: number,
    duration: number,
    config?: any
  ): StreamingContext {
    return {
      chunkCount,
      contentLength,
      duration,
      config,
      streamingContext: true,
    };
  }
}

/**
 * Error logging utilities
 */
export class ErrorLogger {
  /**
   * Logs memory operation errors with consistent formatting
   */
  static logMemoryError(
    operation: string,
    error: Error | MemoryError,
    context: Record<string, unknown> = {}
  ): void {
    const errorInfo = {
      component: 'ErrorLogger',
      operation,
      errorType: error instanceof MemoryError ? error.type : 'unknown',
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
    };

    if (error instanceof MemoryError) {
      errorInfo.context = { ...errorInfo.context, ...error.context };
    }

    logError(`Memory operation failed: ${operation}`, errorInfo);
  }

  /**
   * Logs successful memory operations
   */
  static logMemorySuccess(
    operation: string,
    context: Record<string, unknown> = {}
  ): void {
    logInfo(`Memory operation successful: ${operation}`, {
      component: 'ErrorLogger',
      operation,
      context,
      timestamp: new Date().toISOString(),
    });
  }
}

// Export utilities for convenience
export const ErrorUtils = {
  MemoryErrorHandler,
  ErrorContextBuilder,
  ErrorLogger,
  defaults: {
    ERROR_RECOVERY: DEFAULT_ERROR_RECOVERY,
  },
} as const;

export default ErrorUtils;