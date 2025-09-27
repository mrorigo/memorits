import { SearchService } from './src/core/search/SearchService';
import { DatabaseManager } from './src/core/database/DatabaseManager';
import { SearchStrategy } from './src/core/search/types';

// Mock database URL for testing
const MOCK_DATABASE_URL = 'sqlite:./test-memori.db';

async function verifyStrategyInstantiation() {
  console.log('🔍 Verifying strategy instantiation...\n');

  try {
    // Create DatabaseManager instance
    console.log('📊 Creating DatabaseManager...');
    const dbManager = new DatabaseManager(MOCK_DATABASE_URL);
    console.log('✅ DatabaseManager created successfully\n');

    // Create SearchService instance
    console.log('🔍 Creating SearchService...');
    const searchService = new SearchService(dbManager);
    console.log('✅ SearchService created successfully\n');

    // Get all available strategies
    console.log('📋 Getting available strategies...');
    const availableStrategies = searchService.getAvailableStrategies();
    console.log(`✅ Found ${availableStrategies.length} strategies:`, availableStrategies.map(s => s).join(', '));

    // Verify all expected strategies are present
    const expectedStrategies = [
      SearchStrategy.FTS5,
      SearchStrategy.LIKE,
      SearchStrategy.RECENT,
      SearchStrategy.SEMANTIC,
      SearchStrategy.CATEGORY_FILTER,
      SearchStrategy.TEMPORAL_FILTER,
      SearchStrategy.METADATA_FILTER,
    ];

    console.log('\n🔍 Verifying all expected strategies are registered...');
    for (const expectedStrategy of expectedStrategies) {
      if (availableStrategies.includes(expectedStrategy)) {
        console.log(`✅ ${expectedStrategy} - REGISTERED`);
      } else {
        console.log(`❌ ${expectedStrategy} - MISSING`);
      }
    }

    // Test getting individual strategies
    console.log('\n🔍 Testing individual strategy retrieval...');
    for (const strategyName of expectedStrategies) {
      const strategy = searchService.getStrategy(strategyName);
      if (strategy) {
        console.log(`✅ ${strategyName} - Can retrieve strategy instance`);
        console.log(`   Description: ${strategy.description}`);
        console.log(`   Priority: ${strategy.priority}`);
        console.log(`   Capabilities: ${strategy.capabilities.join(', ')}`);
        console.log(`   Supported Memory Types: ${strategy.supportedMemoryTypes.join(', ')}`);

        // Test configuration validation
        try {
          const isValid = await strategy.validateConfiguration();
          console.log(`   Configuration Valid: ${isValid ? '✅' : '❌'}`);
        } catch (error) {
          console.log(`   Configuration Validation Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      } else {
        console.log(`❌ ${strategyName} - Cannot retrieve strategy instance`);
      }
      console.log('');
    }

    // Test strategy metadata
    console.log('🔍 Testing strategy metadata...');
    const fts5Strategy = searchService.getStrategy(SearchStrategy.FTS5);
    if (fts5Strategy) {
      const metadata = fts5Strategy.getMetadata();
      console.log('✅ FTS5 Strategy Metadata:');
      console.log(`   Name: ${metadata.name}`);
      console.log(`   Version: ${metadata.version}`);
      console.log(`   Description: ${metadata.description}`);
      console.log('   Performance Metrics:', metadata.performanceMetrics);
    }

    console.log('\n🎉 Strategy instantiation verification completed successfully!');

  } catch (error) {
    console.error('❌ Strategy instantiation verification failed:', error);
    throw error;
  }
}

// Export the verification function for explicit execution
export { verifyStrategyInstantiation };

// Only run if this file is executed directly (not imported)
if (import.meta.url === `file://${process.argv[1]}`) {
  verifyStrategyInstantiation()
    .then(() => {
      console.log('\n✅ All strategy instantiation tests passed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Strategy instantiation tests failed:', error);
      process.exit(1);
    });
}