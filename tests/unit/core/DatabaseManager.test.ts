import { ChatHistoryData } from '../../../src/core/infrastructure/database/types';
import { DatabaseManager } from '../../../src/core/infrastructure/database/DatabaseManager';
import { MemoryClassification, MemoryImportanceLevel } from '../../../src/core/types/schemas';
import { execSync } from 'child_process';
import { unlinkSync, existsSync } from 'fs';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let dbPath: string;

  beforeEach(async () => {
    // Create unique database file for this test
    dbPath = `./test-unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;
    const databaseUrl = `file:${dbPath}`;

    // Push schema to the specific database
    execSync(`DATABASE_URL=${databaseUrl} npx prisma db push --accept-data-loss --force-reset`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    dbManager = new DatabaseManager(databaseUrl);
  });

  afterEach(async () => {
    // Clean up SearchService timers and resources first
    if (dbManager) {
      try {
        console.log('Starting cleanup process...');

        const searchService = (dbManager as any).searchService;
        if (searchService) {
          console.log('Cleaning up SearchService...');

          // Stop SearchService timers immediately using proper cleanup methods if available
          if (typeof searchService.cleanup === 'function') {
            searchService.cleanup();
            console.log('SearchService cleanup() called');
          } else {
            // Manual cleanup as fallback
            if (searchService.maintenanceTimer) {
              clearInterval(searchService.maintenanceTimer);
              searchService.maintenanceTimer = null;
              console.log('Cleared SearchService maintenanceTimer');
            }
            // Clean up SearchPerformanceMonitor timer
            if (searchService.performanceMonitor) {
              searchService.performanceMonitor.cleanup();
              console.log('Cleaned up SearchPerformanceMonitor');
            }
          }

          // Clear any pending performance alert callbacks
          if (searchService.performanceAlertCallbacks) {
            searchService.performanceAlertCallbacks.length = 0;
            console.log('Cleared performance alert callbacks');
          }
        }

        // Clean up SearchIndexManager timers using proper cleanup method
        // The SearchIndexManager is created inside SearchService, so we need to access it through SearchService
        if (searchService) {
          console.log('Cleaning up SearchIndexManager through SearchService...');
          const searchIndexManager = (searchService as any).searchIndexManager;
          console.log('SearchIndexManager found in SearchService:', !!searchIndexManager);

          if (searchIndexManager) {
            // Log current timer states
            console.log('SearchIndexManager timer states:', {
              healthCheckTimer: !!searchIndexManager.healthCheckTimer,
              optimizationTimer: !!searchIndexManager.optimizationTimer,
              backupTimer: !!searchIndexManager.backupTimer,
            });

            // Use the proper cleanup method
            if (typeof searchIndexManager.cleanup === 'function') {
              searchIndexManager.cleanup();
              console.log('SearchIndexManager cleanup() called successfully');
            } else {
              console.log('SearchIndexManager cleanup() not available, doing manual cleanup');
              // Manual cleanup as fallback
              if (searchIndexManager.healthCheckTimer) {
                clearInterval(searchIndexManager.healthCheckTimer);
                searchIndexManager.healthCheckTimer = null;
                console.log('Cleared SearchIndexManager healthCheckTimer');
              }
              if (searchIndexManager.optimizationTimer) {
                clearInterval(searchIndexManager.optimizationTimer);
                searchIndexManager.optimizationTimer = null;
                console.log('Cleared SearchIndexManager optimizationTimer');
              }
              if (searchIndexManager.backupTimer) {
                clearInterval(searchIndexManager.backupTimer);
                searchIndexManager.backupTimer = null;
                console.log('Cleared SearchIndexManager backupTimer');
              }
            }
          } else {
            console.log('SearchIndexManager not found in SearchService');
          }
        } else {
          console.log('SearchService not available for SearchIndexManager cleanup');
        }

        // Wait a bit for any pending async operations to complete
        console.log('Waiting for async operations to complete...');
        await new Promise(resolve => setTimeout(resolve, 100));

        console.log('Closing DatabaseManager...');
        await dbManager.close();
        console.log('DatabaseManager closed successfully');

        // Force cleanup of any remaining timers in DatabaseContext
        const databaseContext = (dbManager as any).databaseContext;
        if (databaseContext && typeof databaseContext.forceCleanupHealthMonitoring === 'function') {
          databaseContext.forceCleanupHealthMonitoring();
          console.log('Force cleaned up DatabaseContext health monitoring');
        }
      } catch (error) {
        // Ignore close errors in cleanup but log them with more detail
        console.warn('Cleanup error:', error);
        console.warn('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      }
    }

    // Clean up test database file
    if (existsSync(dbPath)) {
      try {
        unlinkSync(dbPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Constructor and Basic Operations', () => {
    it('should create DatabaseManager instance', () => {
      expect(dbManager).toBeDefined();
    });

    it('should store chat history successfully', async () => {
      const chatData: ChatHistoryData = {
        chatId: 'test-chat-1',
        userInput: 'Hello, how are you?',
        aiOutput: 'I am doing well, thank you for asking.',
        model: 'gpt-4o-mini',
        sessionId: 'test-session-1',
        namespace: 'test-namespace',
        metadata: { test: true },
      };

      const result = await dbManager.storeChatHistory(chatData);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle close operation safely', async () => {
      await expect(dbManager.close()).resolves.not.toThrow();
    });
  });

  describe('SQL Injection Vulnerability Fix', () => {
    beforeEach(async () => {
      // Initialize FTS support for testing
      await dbManager.getSearchService();
    });

    it('should reject invalid FTS query parameters', async () => {
      const maliciousQuery = '\'; DROP TABLE memory_fts; --';
      const options = {
        limit: -1, // Invalid limit
        namespace: 'test',
        categories: ['' as MemoryClassification], // Invalid category
      };

      // Test that the SearchService itself validates properly
      const searchService = await dbManager.getSearchService();
      const searchQuery = {
        text: maliciousQuery,
        limit: options.limit,
        offset: 0,
        includeMetadata: false,
      };

      await expect(searchService.search(searchQuery))
        .rejects.toThrow('Invalid search query');
    });

    it('should handle overly long queries safely', async () => {
      const longQuery = 'a'.repeat(2000); // Too long query
      const options = {
        limit: 10,
        namespace: 'test',
      };

      // Test that the SearchService itself validates properly
      const searchService = await dbManager.getSearchService();
      const searchQuery = {
        text: longQuery,
        limit: options.limit,
        offset: 0,
        includeMetadata: false,
      };

      await expect(searchService.search(searchQuery))
        .rejects.toThrow('Invalid search query');
    });

    it('should handle overly large limits safely', async () => {
      const options = {
        limit: 5000, // Too large limit
        namespace: 'test',
      };

      // Test that the SearchService itself validates properly
      const searchService = await dbManager.getSearchService();
      const searchQuery = {
        text: 'test query',
        limit: options.limit,
        offset: 0,
        includeMetadata: false,
      };

      await expect(searchService.search(searchQuery))
        .rejects.toThrow('Invalid search query');
    });

    it('should handle special characters in FTS queries safely', async () => {
      const specialQuery = 'test "query" with * wildcards and "quotes"';
      const options = {
        limit: 10,
        namespace: 'test',
      };

      // This should not throw an error and should return empty results (no data in test DB)
      const results = await dbManager.searchMemories(specialQuery, options);
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0); // No data in test database
    });

    it('should validate namespace parameter correctly', async () => {
      const options = {
        limit: 10,
        namespace: 'a'.repeat(200), // Too long namespace
      };

      // Test that the DatabaseManager validation works properly
      // The validation is in the searchMemoriesFTS method
      try {
        // Use reflection to access the private method for testing
        const ftsMethod = (dbManager as any).searchMemoriesFTS;
        await ftsMethod.call(dbManager, 'test', options);
        throw new Error('Expected validation error for long namespace');
      } catch (error: any) {
        // Accept either the old error message or the new validation error message
        expect(error.message).toMatch(/(Invalid FTS query|Namespace exceeds maximum length)/);
      }
    });

    it('should handle valid FTS queries without errors', async () => {
      const validQuery = 'test search query';
      const options = {
        limit: 10,
        namespace: 'test',
        minImportance: MemoryImportanceLevel.MEDIUM,
        categories: [MemoryClassification.PERSONAL],
      };

      // Should not throw an error
      const results = await dbManager.searchMemories(validQuery, options);
      expect(Array.isArray(results)).toBe(true);
    });
  });
});