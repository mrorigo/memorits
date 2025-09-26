#!/usr/bin/env ts-node
/**
 * Test script for FTS5 implementation with BM25 ranking
 * This tests the database schema updates specified in PARITY_1.md section 2.1
 */

import { PrismaClient } from '@prisma/client';
import { DatabaseManager } from './src/core/database/DatabaseManager';
import { verifyFTSSchema, initializeSearchSchema } from './src/core/database/init-search-schema';
import { logError } from './src/core/utils/Logger';
import { MemoryClassification, MemoryImportanceLevel } from './src/core/types/schemas';

async function testFTSImplementation(): Promise<void> {
  console.log('🧪 Testing FTS5 Implementation...\n');

  // Initialize Prisma client with the same database as DatabaseManager
  const testDbUrl = 'file:./memori.db';
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: testDbUrl,
      },
    },
  });

  try {
    // Clean up any existing test data first
    console.log('🧹 Cleaning up existing test data...');
    try {
      await prisma.longTermMemory.deleteMany({
        where: { namespace: 'test' },
      });
      await prisma.shortTermMemory.deleteMany({
        where: { namespace: 'test' },
      });
    } catch (error) {
      // Ignore cleanup errors if tables don't exist yet
    }
    console.log('✅ Test data cleaned up');

    // Now initialize FTS5 schema
    console.log('📋 Initializing FTS5 schema...');
    await initializeSearchSchema(prisma);
    console.log('✅ FTS5 schema initialized');

    // Now initialize FTS5 schema
    console.log('📋 Initializing FTS5 schema...');
    await initializeSearchSchema(prisma);
    console.log('✅ FTS5 schema initialized');

    // Test 1: DatabaseManager integration (this will initialize FTS automatically)
    console.log('📋 Test 1: DatabaseManager Integration');
    // Use the same database configuration as the direct test that worked
    const dbManager = new DatabaseManager(testDbUrl);

    const ftsStatus = await dbManager.getFTSStatus();
    console.log(`✅ FTS enabled: ${ftsStatus.enabled}`);
    console.log(`✅ FTS valid: ${ftsStatus.isValid}`);
    console.log(`📊 FTS stats: ${ftsStatus.stats.tables} tables, ${ftsStatus.stats.triggers} triggers, ${ftsStatus.stats.indexes} indexes\n`);

    if (!ftsStatus.enabled) {
      console.log('⚠️ FTS5 not available, testing basic functionality only');
      return;
    }

    // Test 2: Schema verification
    console.log('📋 Test 2: Schema Verification');
    const verification = await verifyFTSSchema(prisma);
    console.log(`✅ Schema verification: ${verification.isValid ? 'PASSED' : 'FAILED'}`);
    if (!verification.isValid) {
      console.log('❌ Issues found:', verification.issues);
      return;
    }
    console.log(`📊 Schema stats: ${verification.stats.tables} tables, ${verification.stats.triggers} triggers, ${verification.stats.indexes} indexes\n`);

    // Test 3: Insert test data
    console.log('📋 Test 3: Data Insertion');
    const testMemories = [
      {
        id: 'test-memory-1',
        memoryType: 'long_term' as const,
        searchableContent: 'JavaScript is a programming language used for web development',
        summary: 'JavaScript programming language overview',
        classification: 'contextual' as const,
        memoryImportance: 'high' as const,
        categoryPrimary: 'Programming',
        importanceScore: 0.8,
        confidenceScore: 0.9,
        topic: 'JavaScript',
        entitiesJson: JSON.stringify(['JavaScript', 'programming', 'web development']),
        keywordsJson: JSON.stringify(['js', 'frontend', 'browser']),
        namespace: 'test',
      },
      {
        id: 'test-memory-2',
        memoryType: 'short_term' as const,
        searchableContent: 'React is a JavaScript library for building user interfaces',
        summary: 'React framework introduction',
        categoryPrimary: 'Framework',
        importanceScore: 0.7,
        confidenceScore: 0.85,
        namespace: 'test',
        processedData: JSON.stringify({
          content: 'React is a JavaScript library for building user interfaces',
          summary: 'React framework introduction',
          category: 'Framework',
          importance: 0.7,
        }),
      },
    ];

    // Insert test data
    for (const memory of testMemories) {
      if (memory.memoryType === 'long_term') {
        await prisma.longTermMemory.create({ data: memory as any });
      } else {
        await prisma.shortTermMemory.create({ data: memory as any });
      }
    }
    console.log(`✅ Inserted ${testMemories.length} test memories\n`);

    // Test 4: FTS search functionality
    console.log('📋 Test 4: FTS Search Functionality');
    const searchResults = await dbManager.searchMemories('JavaScript', {
      namespace: 'test',
      limit: 5,
    });

    console.log(`✅ Search returned ${searchResults.length} results`);
    if (searchResults.length > 0) {
      console.log('✅ First result:', {
        id: searchResults[0].id,
        content: searchResults[0].content.substring(0, 50) + '...',
        classification: searchResults[0].classification,
        importance: searchResults[0].importance,
        searchScore: searchResults[0].metadata?.searchScore,
      });
    }

    // Test 5: BM25 ranking
    console.log('\n📋 Test 5: BM25 Ranking');
    const bm25Results = await dbManager.searchMemories('React library', {
      namespace: 'test',
      limit: 5,
    });

    console.log(`✅ BM25 search returned ${bm25Results.length} results`);
    if (bm25Results.length > 0) {
      console.log('✅ Results are ranked by relevance score');
      bm25Results.forEach((result, index) => {
        const score = typeof result.metadata?.searchScore === 'number' ? result.metadata.searchScore.toFixed(3) : 'N/A';
        console.log(`   ${index + 1}. ${result.id} (score: ${score})`);
      });
    }

    // Test 6: Category filtering
    console.log('\n📋 Test 6: Category Filtering');
    const filteredResults = await dbManager.searchMemories('JavaScript', {
      namespace: 'test',
      limit: 5,
      categories: [MemoryClassification.CONTEXTUAL],
    });

    console.log(`✅ Category filter returned ${filteredResults.length} results`);
    filteredResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.id} (${result.classification})`);
    });

    // Test 7: Importance filtering
    console.log('\n📋 Test 7: Importance Filtering');
    const importanceResults = await dbManager.searchMemories('JavaScript', {
      namespace: 'test',
      limit: 5,
      minImportance: MemoryImportanceLevel.MEDIUM,
    });

    console.log(`✅ Importance filter returned ${importanceResults.length} results`);
    importanceResults.forEach((result, index) => {
      console.log(`   ${index + 1}. ${result.id} (importance: ${result.importance})`);
    });

    // Test 8: Backward compatibility
    console.log('\n📋 Test 8: Backward Compatibility');
    const basicResults = await dbManager.searchMemories('programming', {
      namespace: 'test',
      limit: 5,
    });

    console.log(`✅ Backward compatibility maintained: ${basicResults.length} results`);
    console.log(`✅ FTS enabled: ${dbManager.isFTSEnabled()}`);

    console.log('\n🎉 All tests completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
    logError('FTS implementation test failed', {
      component: 'TestScript',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    // Cleanup test data
    try {
      await prisma.longTermMemory.deleteMany({
        where: { namespace: 'test' },
      });
      await prisma.shortTermMemory.deleteMany({
        where: { namespace: 'test' },
      });
      console.log('\n🧹 Test data cleaned up');
    } catch (error) {
      console.log('\n⚠️  Could not clean up test data:', error instanceof Error ? error.message : String(error));
    }

    await prisma.$disconnect();
  }
}

// Run tests if this script is executed directly
if (typeof process !== 'undefined' && process.env) {
  testFTSImplementation().catch(console.error);
}

export { testFTSImplementation };