import { TestDatabaseManager } from './TestDatabaseManager';

/**
 * Jest global teardown file for database cleanup
 * This runs after all tests to clean up shared databases
 */

export default async function globalTeardown() {
  console.log('🧹 Starting global test database cleanup...');

  try {
    const dbManager = globalThis.__TEST_DB_MANAGER__ as TestDatabaseManager;

    if (dbManager) {
      // Show final metrics
      const metrics = dbManager.getMetrics();
      console.log('📊 Test Database Metrics:', JSON.stringify(metrics, null, 2));

      // Cleanup all databases
      await dbManager.cleanup();
    }

    // Cleanup isolation managers
    const isolationManagers = globalThis.__TEST_ISOLATION_MANAGERS__ as Map<string, any>;
    if (isolationManagers) {
      for (const [testName, manager] of isolationManagers.entries()) {
        try {
          if (manager && typeof manager.cleanup === 'function') {
            await manager.cleanup();
          }
        } catch (error) {
          console.warn(`Failed to cleanup isolation manager for ${testName}:`, error);
        }
      }
      isolationManagers.clear();
    }

    console.log('✅ Global test database cleanup completed');

  } catch (error) {
    console.error('❌ Error during global test database cleanup:', error);
    // Don't throw - allow Jest to exit gracefully
  }
}