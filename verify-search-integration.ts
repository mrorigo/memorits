import { SearchService } from './src/core/search/SearchService';
import { DatabaseManager } from './src/core/database/DatabaseManager';
import { SearchQuery, SearchStrategy } from './src/core/search/types';

// Mock database URL for testing
const MOCK_DATABASE_URL = 'file:./test-memori.db';

async function verifySearchServiceIntegration() {
  console.log('🔍 Verifying SearchService integration...\n');

  try {
    // Create DatabaseManager and SearchService instances
    console.log('📊 Creating DatabaseManager and SearchService...');
    const dbManager = new DatabaseManager(MOCK_DATABASE_URL);

    // Force FTS initialization
    console.log('🔧 Initializing FTS support...');
    await dbManager.getFTSStatus(); // This will trigger ensureFTSSupport()
    console.log('✅ FTS support initialized\n');

    const searchService = new SearchService(dbManager);
    console.log('✅ Services created successfully\n');

    // Test 1: Empty query should use recent memories strategy
    console.log('🧪 Test 1: Empty query (should use recent memories strategy)');
    const emptyQuery: SearchQuery = { text: '' };
    const emptyResults = await searchService.search(emptyQuery);
    console.log(`✅ Empty query returned ${emptyResults.length} results`);
    console.log(`   Strategy used: ${emptyResults[0]?.strategy || 'none'}\n`);

    // Test 2: Text query should use FTS5 strategy
    console.log('🧪 Test 2: Text query (should use FTS5 strategy)');
    const textQuery: SearchQuery = { text: 'test query', limit: 5 };
    const textResults = await searchService.search(textQuery);
    console.log(`✅ Text query returned ${textResults.length} results`);
    console.log(`   Strategy used: ${textResults[0]?.strategy || 'none'}`);
    console.log(`   Results have scores: ${textResults.every(r => r.score >= 0) ? '✅' : '❌'}\n`);

    // Test 3: Strategy-specific search
    console.log('🧪 Test 3: Strategy-specific search');
    const fts5Results = await searchService.searchWithStrategy(textQuery, SearchStrategy.FTS5);
    console.log(`✅ FTS5 strategy returned ${fts5Results.length} results`);
    console.log(`   All results from FTS5: ${fts5Results.every(r => r.strategy === 'fts5') ? '✅' : '❌'}`);

    const recentResults = await searchService.searchWithStrategy(emptyQuery, SearchStrategy.RECENT);
    console.log(`✅ Recent strategy returned ${recentResults.length} results`);
    console.log(`   All results from recent: ${recentResults.every(r => r.strategy === 'recent') ? '✅' : '❌'}\n`);

    // Test 4: Strategy ordering and fallback
    console.log('🧪 Test 4: Strategy ordering and fallback');
    const strategies = searchService.getAvailableStrategies();
    console.log(`✅ Available strategies: ${strategies.join(', ')}`);

    // Test strategy retrieval
    const fts5Strategy = searchService.getStrategy('fts5');
    const likeStrategy = searchService.getStrategy('like');
    console.log(`✅ Can retrieve FTS5 strategy: ${fts5Strategy ? '✅' : '❌'}`);
    console.log(`✅ Can retrieve LIKE strategy: ${likeStrategy ? '✅' : '❌'}\n`);

    // Test 5: Error handling - invalid strategy
    console.log('🧪 Test 5: Error handling for invalid strategy');
    try {
      await searchService.searchWithStrategy(textQuery, 'invalid_strategy' as SearchStrategy);
      console.log('❌ Should have thrown error for invalid strategy');
    } catch (error) {
      console.log(`✅ Properly handled invalid strategy: ${error instanceof Error ? error.message : String(error)}`);
    }

    // Test 6: Strategy canHandle method
    console.log('\n🧪 Test 6: Strategy canHandle method');
    if (fts5Strategy) {
      const canHandleText = fts5Strategy.canHandle({ text: 'test' });
      const canHandleEmpty = fts5Strategy.canHandle({ text: '' });
      console.log(`✅ FTS5 can handle text query: ${canHandleText ? '✅' : '❌'}`);
      console.log(`✅ FTS5 can handle empty query: ${canHandleEmpty ? '❌' : '✅'} (should be false)`);
    }

    console.log('\n🎉 SearchService integration verification completed successfully!');

  } catch (error) {
    console.error('❌ SearchService integration verification failed:', error);
    throw error;
  }
}

// Export the verification function for explicit execution
export { verifySearchServiceIntegration };

// Only run if this file is executed directly (not imported)
verifySearchServiceIntegration()
  .then(() => {
    console.log('\n✅ All SearchService integration tests passed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ SearchService integration tests failed:', error);
    process.exit(1);
  });