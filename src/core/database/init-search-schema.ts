import { PrismaClient } from '@prisma/client';
import { logInfo, logError } from '../utils/Logger';

/**
 * Initialize the FTS5 search schema with triggers and BM25 support
 * This implements the database schema updates specified in PARITY_1.md section 2.1
 */
export async function initializeSearchSchema(prisma: PrismaClient): Promise<boolean> {
  try {
    logInfo('Initializing FTS5 search schema...', { component: 'DatabaseInit' });

    // Check if FTS5 is available first
    try {
      await prisma.$executeRaw`
        CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts
        USING fts5(
          content,        -- Full text content
          metadata,       -- JSON metadata for filtering
          tokenize = 'porter ascii',  -- Tokenization with stemming
          content_rowid = 'memory_id' -- Reference to main table
        );
      `;
      logInfo('Created FTS5 virtual table', { component: 'DatabaseInit' });
    } catch (error) {
      logError('FTS5 not available in this SQLite build', {
        component: 'DatabaseInit',
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }

    // Check if database tables exist before creating triggers
    const longTermExists = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='long_term_memory';`;
    const shortTermExists = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='short_term_memory';`;

    if (!longTermExists || (longTermExists as any[]).length === 0) {
      logInfo('Database tables not yet created, skipping trigger creation for now', { component: 'DatabaseInit' });
      return true; // FTS5 is available, just need tables to be created first
    }

    // Create triggers for synchronization with long_term_memory
    await prisma.$executeRaw`
      CREATE TRIGGER IF NOT EXISTS memory_fts_insert_long_term
      AFTER INSERT ON long_term_memory
      BEGIN
        INSERT INTO memory_fts(rowid, content, metadata)
        VALUES (new.id, new.searchableContent, json_object(
          'memory_type', new.memoryType,
          'category_primary', new.categoryPrimary,
          'importance_score', new.importanceScore,
          'classification', new.classification,
          'created_at', new.createdAt,
          'namespace', new.namespace
        ));
      END;
    `;

    await prisma.$executeRaw`
      CREATE TRIGGER IF NOT EXISTS memory_fts_delete_long_term
      AFTER DELETE ON long_term_memory
      BEGIN
        DELETE FROM memory_fts WHERE rowid = old.id;
      END;
    `;

    await prisma.$executeRaw`
      CREATE TRIGGER IF NOT EXISTS memory_fts_update_long_term
      AFTER UPDATE ON long_term_memory
      BEGIN
        DELETE FROM memory_fts WHERE rowid = old.id;
        INSERT INTO memory_fts(rowid, content, metadata)
        VALUES (new.id, new.searchableContent, json_object(
          'memory_type', new.memoryType,
          'category_primary', new.categoryPrimary,
          'importance_score', new.importanceScore,
          'classification', new.classification,
          'created_at', new.createdAt,
          'namespace', new.namespace
        ));
      END;
    `;

    logInfo('Created long-term memory FTS triggers', { component: 'DatabaseInit' });

    // Create triggers for synchronization with short_term_memory
    await prisma.$executeRaw`
      CREATE TRIGGER IF NOT EXISTS memory_fts_insert_short_term
      AFTER INSERT ON short_term_memory
      BEGIN
        INSERT INTO memory_fts(rowid, content, metadata)
        VALUES (new.id, new.searchableContent, json_object(
          'memory_type', new.retentionType,
          'category_primary', new.categoryPrimary,
          'importance_score', new.importanceScore,
          'created_at', new.createdAt,
          'namespace', new.namespace
        ));
      END;
    `;

    await prisma.$executeRaw`
      CREATE TRIGGER IF NOT EXISTS memory_fts_delete_short_term
      AFTER DELETE ON short_term_memory
      BEGIN
        DELETE FROM memory_fts WHERE rowid = old.id;
      END;
    `;

    await prisma.$executeRaw`
      CREATE TRIGGER IF NOT EXISTS memory_fts_update_short_term
      AFTER UPDATE ON short_term_memory
      BEGIN
        DELETE FROM memory_fts WHERE rowid = old.id;
        INSERT INTO memory_fts(rowid, content, metadata)
        VALUES (new.id, new.searchableContent, json_object(
          'memory_type', new.retentionType,
          'category_primary', new.categoryPrimary,
          'importance_score', new.importanceScore,
          'created_at', new.createdAt,
          'namespace', new.namespace
        ));
      END;
    `;

    logInfo('Created short-term memory FTS triggers', { component: 'DatabaseInit' });

    // Create indexes for performance optimization (FTS5 virtual tables cannot be indexed)
    // We create indexes on the main tables for better query performance
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_long_term_memory_namespace
      ON long_term_memory(namespace);
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_short_term_memory_namespace
      ON short_term_memory(namespace);
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_long_term_memory_importance
      ON long_term_memory(importanceScore DESC);
    `;

    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS idx_short_term_memory_importance
      ON short_term_memory(importanceScore DESC);
    `;

    logInfo('Created performance indexes on main tables', { component: 'DatabaseInit' });

    // Populate FTS table with existing data for backward compatibility
    // Note: This is skipped for now as it causes datatype issues with Prisma
    // The triggers will handle new data going forward
    logInfo('Skipping FTS table population - triggers will handle new data', { component: 'DatabaseInit' });

    logInfo('FTS5 search schema initialized successfully', { component: 'DatabaseInit' });
    return true;

  } catch (error) {
    logError('Failed to initialize FTS5 search schema', {
      component: 'DatabaseInit',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return false;
  }
}

/**
 * Populate FTS table with existing data for backward compatibility
 */
async function populateFTSTableWithExistingData(prisma: PrismaClient): Promise<void> {
  try {
    logInfo('Populating FTS table with existing data...', { component: 'DatabaseInit' });

    // Insert existing long-term memories
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO memory_fts(rowid, content, metadata)
      SELECT
        id,
        searchableContent,
        json_object(
          'memory_type', retentionType,
          'category_primary', categoryPrimary,
          'importance_score', importanceScore,
          'classification', classification,
          'created_at', createdAt,
          'namespace', namespace
        )
      FROM long_term_memory;
    `;

    // Insert existing short-term memories
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO memory_fts(rowid, content, metadata)
      SELECT
        id,
        searchable_content,
        json_object(
          'memory_type', retentionType,
          'category_primary', categoryPrimary,
          'importance_score', importanceScore,
          'created_at', createdAt,
          'namespace', namespace
        )
      FROM short_term_memory;
    `;

    logInfo('Populated FTS table with existing data', { component: 'DatabaseInit' });

  } catch (error) {
    logError('Failed to populate FTS table with existing data', {
      component: 'DatabaseInit',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Don't throw here - this is for backward compatibility, so it shouldn't fail initialization
  }
}

/**
 * Verify FTS table structure and functionality
 */
export async function verifyFTSSchema(prisma: PrismaClient): Promise<{
  isValid: boolean;
  issues: string[];
  stats: { tables: number; triggers: number; indexes: number };
}> {
  const issues: string[] = [];
  const stats = { tables: 0, triggers: 0, indexes: 0 };

  try {
    // Check if FTS table exists
    const ftsTableResult = await prisma.$executeRaw`
      SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts';
    `;

    if (!ftsTableResult) {
      issues.push('FTS5 virtual table memory_fts does not exist');
    } else {
      stats.tables++;
    }

    // Check triggers
    const triggers = [
      'memory_fts_insert_long_term',
      'memory_fts_delete_long_term',
      'memory_fts_update_long_term',
      'memory_fts_insert_short_term',
      'memory_fts_delete_short_term',
      'memory_fts_update_short_term',
    ];

    for (const trigger of triggers) {
      const triggerResult = await prisma.$executeRaw`
        SELECT name FROM sqlite_master WHERE type='trigger' AND name=${trigger};
      `;

      if (!triggerResult) {
        issues.push(`Trigger ${trigger} does not exist`);
      } else {
        stats.triggers++;
      }
    }

    // Check indexes
    const indexes = [
      'idx_long_term_memory_namespace',
      'idx_short_term_memory_namespace',
      'idx_long_term_memory_importance',
      'idx_short_term_memory_importance',
    ];

    for (const index of indexes) {
      const indexResult = await prisma.$executeRaw`
        SELECT name FROM sqlite_master WHERE type='index' AND name=${index};
      `;

      if (!indexResult) {
        issues.push(`Index ${index} does not exist`);
      } else {
        stats.indexes++;
      }
    }

    // Test BM25 function availability
    try {
      await prisma.$executeRaw`
        SELECT bm25(memory_fts, 1.0, 1.0, 1.0) FROM memory_fts LIMIT 1;
      `;
    } catch {
      issues.push('BM25 function not available - FTS5 may not be properly configured');
    }

    return {
      isValid: issues.length === 0,
      issues,
      stats,
    };

  } catch (error) {
    return {
      isValid: false,
      issues: [`Schema verification failed: ${error instanceof Error ? error.message : String(error)}`],
      stats,
    };
  }
}

/**
 * Clean up FTS schema (for testing or migration rollback)
 */
export async function cleanupFTSSchema(prisma: PrismaClient): Promise<void> {
  try {
    logInfo('Cleaning up FTS schema...', { component: 'DatabaseInit' });

    // Drop triggers
    const triggers = [
      'memory_fts_insert_long_term',
      'memory_fts_delete_long_term',
      'memory_fts_update_long_term',
      'memory_fts_insert_short_term',
      'memory_fts_delete_short_term',
      'memory_fts_update_short_term',
    ];

    for (const trigger of triggers) {
      await prisma.$executeRaw`DROP TRIGGER IF EXISTS ${trigger}`;
    }

    // Drop indexes
    const indexes = [
      'idx_memory_fts_namespace',
      'idx_long_term_memory_namespace',
      'idx_short_term_memory_namespace',
      'idx_long_term_memory_importance',
      'idx_short_term_memory_importance',
    ];

    for (const index of indexes) {
      await prisma.$executeRaw`DROP INDEX IF EXISTS ${index}`;
    }

    // Drop FTS table
    await prisma.$executeRaw`DROP TABLE IF EXISTS memory_fts`;

    logInfo('FTS schema cleaned up successfully', { component: 'DatabaseInit' });

  } catch (error) {
    logError('Failed to cleanup FTS schema', {
      component: 'DatabaseInit',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}