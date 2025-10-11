import { logInfo, logError } from '../utils/Logger';
import { DatabaseContext } from './DatabaseContext';
import { StateManager } from './StateManager';
import { MemoryStateTransition, MemoryProcessingState } from '../memory/MemoryProcessingStateManager';
import { PrismaClient } from '@prisma/client';

/**
 * StateService - Dedicated service for memory state management operations
 *
 * This service handles all state-related operations for memories including
 * state transitions, state tracking, and state statistics. It provides
 * a clean separation of concerns for state management functionality.
 */
export class StateService {
  private databaseContext: DatabaseContext;
  private stateManager: StateManager;
  private prisma: PrismaClient;

  constructor(databaseContext: DatabaseContext, stateManager: StateManager) {
    this.databaseContext = databaseContext;
    this.stateManager = stateManager;
    this.prisma = databaseContext.getPrismaClient();
  }

  /**
   * Get the state manager instance for direct access
   */
  getStateManager(): StateManager {
    return this.stateManager;
  }

  /**
   * Get memories by processing state
   */
  async getMemoriesByState(
    state: MemoryProcessingState,
    namespace: string = 'default',
    limit?: number,
  ): Promise<string[]> {
    const memoryIds = await this.stateManager.getMemoriesByState(state);
    // Filter by namespace if needed
    if (namespace !== 'default') {
      const filteredIds: string[] = [];
      for (const memoryId of memoryIds) {
        const memory = await this.prisma.longTermMemory.findUnique({
          where: { id: memoryId },
          select: { namespace: true },
        });
        if (memory?.namespace === namespace) {
          filteredIds.push(memoryId);
        }
      }
      return limit ? filteredIds.slice(0, limit) : filteredIds;
    }
    return limit ? memoryIds.slice(0, limit) : memoryIds;
  }

  /**
   * Get memory processing state
   */
  async getMemoryState(memoryId: string): Promise<MemoryProcessingState | undefined> {
    return this.stateManager.getMemoryState(memoryId);
  }

  /**
   * Get memory state history
   */
  async getMemoryStateHistory(memoryId: string): Promise<MemoryStateTransition[]> {
    return this.stateManager.getMemoryStateHistory(memoryId);
  }

  /**
   * Transition memory to new state
   */
  async transitionMemoryState(
    memoryId: string,
    toState: MemoryProcessingState,
    options?: {
      reason?: string;
      metadata?: Record<string, unknown>;
      userId?: string;
      agentId?: string;
      errorMessage?: string;
      force?: boolean;
    },
  ): Promise<boolean> {
    return this.stateManager.transitionMemoryState(memoryId, toState, options);
  }

  /**
   * Get processing state statistics
   */
  async getProcessingStateStats(namespace?: string): Promise<Record<MemoryProcessingState, number>> {
    // If namespace filter is provided, we need to count only memories in that namespace
    if (namespace && namespace !== 'default') {
      const filteredStats: Record<MemoryProcessingState, number> = {} as Record<MemoryProcessingState, number>;
      Object.values(MemoryProcessingState).forEach(state => {
        filteredStats[state] = 0;
      });

      // Get all memory IDs for each state and filter by namespace
      for (const state of Object.values(MemoryProcessingState)) {
        const memoryIds = await this.stateManager.getMemoriesByState(state);
        for (const memoryId of memoryIds) {
          try {
            const memory = await this.prisma.longTermMemory.findUnique({
              where: { id: memoryId },
              select: { namespace: true },
            }) as { namespace: string } | null;
            if (memory?.namespace === namespace) {
              filteredStats[state]++;
            }
          } catch {
            // Skip memories that can't be found
          }
        }
      }

      return filteredStats;
    }

    // Use the StateManager's built-in namespace support
    return this.stateManager.getProcessingStateStats(namespace);
  }

  /**
   * Initialize memory state (for existing memories without state tracking)
   */
  async initializeExistingMemoryState(
    memoryId: string,
    initialState: MemoryProcessingState = MemoryProcessingState.PENDING,
  ): Promise<void> {
    await this.stateManager.initializeExistingMemoryState(memoryId, initialState);
  }

  /**
   * Get all memory states
   */
  async getAllMemoryStates(): Promise<Record<string, MemoryProcessingState>> {
    return this.stateManager.getAllMemoryStates();
  }

  /**
   * Check if memory can transition to specific state
   */
  async canMemoryTransitionTo(memoryId: string, toState: MemoryProcessingState): Promise<boolean> {
    return this.stateManager.canMemoryTransitionTo(memoryId, toState);
  }

  /**
   * Retry failed memory state transition
   */
  async retryMemoryStateTransition(
    memoryId: string,
    targetState: MemoryProcessingState,
    options?: { maxRetries?: number; delayMs?: number },
  ): Promise<boolean> {
    return this.stateManager.retryMemoryStateTransition(memoryId, targetState, options);
  }

  /**
   * Get processing metrics
   */
  async getProcessingMetrics(): Promise<Record<string, number>> {
    return this.stateManager.getProcessingMetrics();
  }
}