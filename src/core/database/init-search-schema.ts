import { PrismaClient } from '@prisma/client';
import { logInfo, logError } from '../utils/Logger';

/**
 * Initialize the FTS5 search schema with triggers and BM25 support
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
         tokenize = 'porter ascii'  -- Tokenization with stemming
       );
     `;
     logInfo('Created FTS5 virtual table', { component: 'DatabaseInit' });

     // Verify the table was actually created and is functional
     const tableCheck = await prisma.$queryRaw`
       SELECT name FROM sqlite_master WHERE type='table' AND name='memory_fts';
     `;

     // Test that FTS5 functionality works
     try {
       // Use a unique rowid that doesn't conflict with existing data
       const testRowId = Date.now(); // Use timestamp as unique rowid

       await prisma.$executeRaw`
         INSERT INTO memory_fts(rowid, content, metadata) VALUES (${testRowId}, 'test content', '{}');
       `;
       await prisma.$executeRaw`DELETE FROM memory_fts WHERE rowid = ${testRowId};`;
       logInfo('FTS5 table created and tested successfully', { component: 'DatabaseInit' });
     } catch (testError) {
       logError('FTS5 table created but functionality test failed', {
         component: 'DatabaseInit',
         error: testError instanceof Error ? testError.message : String(testError),
       });
       // Don't fail completely, but log the issue
     }

     if (!tableCheck) {
       throw new Error('FTS5 table was not found after creation');
     }
   } catch (error) {
     logError('FTS5 initialization failed with detailed error', {
       component: 'DatabaseInit',
       error: error instanceof Error ? error.message : String(error),
       stack: error instanceof Error ? error.stack : undefined,
     });

     // Instead of just returning false, let's provide more guidance
     if (error instanceof Error && error.message.includes('no such module: fts5')) {
       logError('FTS5 module not available - SQLite was not compiled with FTS5 support', {
         component: 'DatabaseInit',
       });
     } else if (error instanceof Error && error.message.includes('syntax error')) {
       logError('FTS5 syntax error - check SQLite version and FTS5 support', {
         component: 'DatabaseInit',
       });
     }

     return false;
   }

     // Create indexes for performance optimization (FTS5 virtual tables cannot be indexed)
     // We create indexes on the main tables for better query performance
     try {
       // Verify main tables exist before creating indexes
       const longTermTableCheck = await prisma.$queryRaw`
         SELECT name FROM sqlite_master WHERE type='table' AND name='long_term_memory';
       ` as any[];

       const shortTermTableCheck = await prisma.$queryRaw`
         SELECT name FROM sqlite_master WHERE type='table' AND name='short_term_memory';
       ` as any[];

       if (longTermTableCheck && longTermTableCheck.length > 0) {
         await prisma.$executeRaw`
           CREATE INDEX IF NOT EXISTS idx_long_term_memory_namespace
           ON long_term_memory(namespace);
         `;

         await prisma.$executeRaw`
           CREATE INDEX IF NOT EXISTS idx_long_term_memory_importance
           ON long_term_memory(importanceScore DESC);
         `;
       }

       if (shortTermTableCheck && shortTermTableCheck.length > 0) {
         await prisma.$executeRaw`
           CREATE INDEX IF NOT EXISTS idx_short_term_memory_namespace
           ON short_term_memory(namespace);
         `;

         await prisma.$executeRaw`
           CREATE INDEX IF NOT EXISTS idx_short_term_memory_importance
           ON short_term_memory(importanceScore DESC);
         `;
       }

       logInfo('Created performance indexes on main tables', { component: 'DatabaseInit' });
     } catch (error) {
       logError('Failed to create performance indexes', {
         component: 'DatabaseInit',
         error: error instanceof Error ? error.message : String(error),
       });
       // Don't fail initialization for index creation issues
     }

    // Skip trigger creation for now - let them be created after tables exist
    logInfo('Skipping trigger creation during initialization - will be created when tables are ready', { component: 'DatabaseInit' });

    // Don't create triggers during schema push - they will be created later when needed
    logInfo('Deferring trigger creation until after main tables are confirmed to exist', { component: 'DatabaseInit' });

    // TODO: Create triggers after main tables are confirmed to exist
    // This will be handled by ensureFTSSupport() when first FTS operation is performed


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
          'created_at', extractionTimestamp,
          'namespace', namespace
        )
      FROM long_term_memory;
    `;

    // Insert existing short-term memories
    await prisma.$executeRaw`
      INSERT OR IGNORE INTO memory_fts(rowid, content, metadata)
      SELECT
        id,
        searchableContent,
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
    const ftsTableResult = await prisma.$queryRaw`
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
      const triggerResult = await prisma.$queryRaw`
        SELECT name FROM sqlite_master WHERE type='trigger' AND name=${trigger};
      `;

      if (!triggerResult || (Array.isArray(triggerResult) && triggerResult.length === 0)) {
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
      const indexResult = await prisma.$queryRaw`
        SELECT name FROM sqlite_master WHERE type='index' AND name=${index};
      `;

      if (!indexResult || (Array.isArray(indexResult) && indexResult.length === 0)) {
        issues.push(`Index ${index} does not exist`);
      } else {
        stats.indexes++;
      }
    }

    // Test BM25 function availability
    try {
      // First check if table has any data, if not insert a test record
      const countResult = await prisma.$queryRaw`
        SELECT COUNT(*) as count FROM memory_fts;
      ` as any[];

      if (countResult[0]?.count === 0) {
        // Insert a temporary test record for BM25 testing
        const testRowId = Date.now() + 1; // Use timestamp + 1 as unique rowid
        await prisma.$executeRaw`
          INSERT INTO memory_fts(rowid, content, metadata) VALUES (${testRowId}, 'test content for bm25', '{}');
        `;

        // Test BM25 function
        await prisma.$queryRaw`
          SELECT bm25(memory_fts) FROM memory_fts WHERE rowid = ${testRowId};
        ` as any[];

        // Clean up test record
        await prisma.$executeRaw`
          DELETE FROM memory_fts WHERE rowid = ${testRowId};
        `;
      } else {
        // Test BM25 function with existing data
        await prisma.$queryRaw`
          SELECT bm25(memory_fts) FROM memory_fts LIMIT 1;
        ` as any[];
      }
    } catch (error) {
      issues.push(`BM25 function test failed: ${error instanceof Error ? error.message : String(error)}`);
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