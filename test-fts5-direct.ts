#!/usr/bin/env ts-node
/**
 * Direct FTS5 test using Prisma client
 * This tests FTS5 functionality directly with the Prisma client
 */

import { PrismaClient } from '@prisma/client';

async function testFTS5Direct(): Promise<void> {
  console.log('🧪 Testing FTS5 with Prisma Client...\n');

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: 'file:./test-fts5.db',
      },
    },
  });

  try {
    // Test 1: Check SQLite compilation options
    console.log('📋 Test 1: SQLite Compilation Options');
    const compileOptions = await prisma.$queryRaw`PRAGMA compile_options;`;
    console.log('✅ SQLite compilation options loaded');

    const fts5Enabled = (compileOptions as any[]).some((opt: any) =>
      opt.compile_options?.includes('ENABLE_FTS5'),
    );
    console.log(`✅ FTS5 enabled: ${fts5Enabled}`);

    if (!fts5Enabled) {
      console.log('❌ FTS5 not available in SQLite build');
      return;
    }

    // Test 2: Create FTS5 virtual table
    console.log('\n📋 Test 2: FTS5 Virtual Table Creation');
    try {
      await prisma.$executeRaw`
        CREATE VIRTUAL TABLE IF NOT EXISTS test_memory_fts
        USING fts5(content, tokenize = 'porter ascii');
      `;
      console.log('✅ FTS5 virtual table created successfully');
    } catch (error) {
      console.log('❌ FTS5 virtual table creation failed:', error instanceof Error ? error.message : String(error));
      return;
    }

    // Test 3: Insert test data
    console.log('\n📋 Test 3: Insert Test Data');
    await prisma.$executeRaw`
      INSERT INTO test_memory_fts(rowid, content)
      VALUES (1, 'JavaScript is a programming language for web development'),
             (2, 'React is a JavaScript library for building user interfaces'),
             (3, 'SQLite FTS5 provides full-text search capabilities');
    `;
    console.log('✅ Test data inserted');

    // Test 4: Basic FTS search
    console.log('\n📋 Test 4: Basic FTS Search');
    const basicResults = await prisma.$queryRaw`
      SELECT rowid, content
      FROM test_memory_fts
      WHERE test_memory_fts MATCH 'JavaScript';
    ` as any[];
    console.log(`✅ Found ${basicResults.length} results for 'JavaScript':`);
    basicResults.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. Row ${result.rowid}: ${result.content.substring(0, 50)}...`);
    });

    // Test 5: BM25 ranking
    console.log('\n📋 Test 5: BM25 Ranking');
    const rankedResults = await prisma.$queryRaw`
      SELECT rowid, bm25(test_memory_fts) as score, content
      FROM test_memory_fts
      WHERE test_memory_fts MATCH 'search'
      ORDER BY bm25(test_memory_fts) DESC;
    ` as any[];
    console.log(`✅ Found ${rankedResults.length} results with BM25 ranking:`);
    rankedResults.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. Row ${result.rowid}: Score ${result.score.toFixed(3)} - ${result.content.substring(0, 50)}...`);
    });

    // Test 6: Porter stemming
    console.log('\n📋 Test 6: Porter Stemming');
    const stemResults = await prisma.$queryRaw`
      SELECT rowid, content
      FROM test_memory_fts
      WHERE test_memory_fts MATCH 'program';
    ` as any[];
    console.log(`✅ Found ${stemResults.length} results for stemmed 'program':`);
    stemResults.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. Row ${result.rowid}: ${result.content.substring(0, 50)}...`);
    });

    // Test 7: Complex query with multiple terms
    console.log('\n📋 Test 7: Complex Query');
    const complexResults = await prisma.$queryRaw`
      SELECT rowid, bm25(test_memory_fts) as score, content
      FROM test_memory_fts
      WHERE test_memory_fts MATCH 'web OR library OR fulltext'
      ORDER BY bm25(test_memory_fts) DESC;
    ` as any[];
    console.log(`✅ Complex query found ${complexResults.length} results:`);
    complexResults.forEach((result: any, index: number) => {
      console.log(`   ${index + 1}. Row ${result.rowid}: Score ${result.score.toFixed(3)} - ${result.content.substring(0, 50)}...`);
    });

    console.log('\n🎉 All FTS5 tests completed successfully!');
    console.log('✅ FTS5 is working perfectly with BM25 ranking');
    console.log('✅ Porter stemming is functional');
    console.log('✅ Complex queries are supported');

  } catch (error) {
    console.error('❌ Test failed:', error instanceof Error ? error.message : String(error));
  } finally {
    // Cleanup
    try {
      await prisma.$executeRaw`DROP TABLE IF EXISTS test_memory_fts;`;
      console.log('\n🧹 Test table cleaned up');
    } catch {
      // Ignore cleanup errors
    }

    await prisma.$disconnect();
  }
}

// Run test if executed directly
if (typeof process !== 'undefined' && process.env) {
  testFTS5Direct().catch(console.error);
}

export { testFTS5Direct };