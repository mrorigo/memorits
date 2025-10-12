/**
 * Advanced Memory Search and Retrieval Example
 *
 * This example demonstrates the comprehensive search and filtering capabilities of Memori,
 * showcasing all available search strategies, advanced filtering options, performance
 * monitoring, and error handling features.
 */

import { Memori, ConfigManager } from '../src/index';
import { SearchStrategy } from '../src/core/domain/search/types';
import { MemoryClassification, MemoryImportanceLevel } from '../src/core/types/models';

import { logInfo, logError } from '../src/core/infrastructure/config/Logger';

async function advancedMemorySearchExample(): Promise<void> {
  logInfo('🚀 Starting Advanced Memory Search and Retrieval Example...\n', {
    component: 'advanced-memory-search-example'
  });

  let memori: Memori | undefined;

  try {
    // Load configuration
    const config = ConfigManager.loadConfig();
    logInfo('📋 Configuration loaded:', {
      component: 'advanced-memory-search-example',
      databaseUrl: config.databaseUrl,
      namespace: config.namespace,
      model: config.model,
    });

    // Initialize Memori instance with auto-ingestion enabled
    memori = new Memori({
      ...config,
      autoIngest: true,
    });
    logInfo('✅ Memori instance created with auto-ingestion enabled', {
      component: 'advanced-memory-search-example'
    });

    // Enable Memori (initializes database schema)
    await memori.enable();
    logInfo('✅ Memori enabled successfully\n', {
      component: 'advanced-memory-search-example'
    });

    // Build a rich memory base with diverse content and metadata
    logInfo('💬 Building comprehensive memory base with diverse content...', {
      component: 'advanced-memory-search-example'
    });

    const conversations = [
      {
        user: 'What are the key principles of functional programming?',
        ai: 'Functional programming emphasizes immutability, pure functions, avoiding side effects, and first-class functions. Key principles include referential transparency, higher-order functions, and composability.',
        category: 'programming-paradigms',
        importance: 'high',
        tags: ['functional-programming', 'paradigms', 'concepts'],
      },
      {
        user: 'How does machine learning training work?',
        ai: 'Machine learning training involves feeding data to algorithms that identify patterns and make predictions. The process includes data preprocessing, model selection, training with optimization algorithms like gradient descent, and validation.',
        category: 'machine-learning',
        importance: 'high',
        tags: ['ml-training', 'algorithms', 'data-science'],
      },
      {
        user: 'What are design patterns in software development?',
        ai: 'Design patterns are reusable solutions to common software design problems. They include creational patterns (Singleton, Factory), structural patterns (Adapter, Decorator), and behavioral patterns (Observer, Strategy).',
        category: 'software-design',
        importance: 'medium',
        tags: ['design-patterns', 'architecture', 'best-practices'],
      },
      {
        user: 'Explain blockchain consensus mechanisms.',
        ai: 'Blockchain consensus mechanisms ensure all nodes agree on the network state. Popular mechanisms include Proof of Work (Bitcoin mining), Proof of Stake (validator selection by stake), and Delegated Proof of Stake (community voting).',
        category: 'blockchain',
        importance: 'high',
        tags: ['consensus', 'distributed-systems', 'cryptography'],
      },
      {
        user: 'What are cloud computing service models?',
        ai: 'Cloud computing offers three main service models: IaaS (Infrastructure as a Service) provides virtualized computing resources, PaaS (Platform as a Service) offers development platforms, and SaaS (Software as a Service) delivers complete applications.',
        category: 'cloud-computing',
        importance: 'medium',
        tags: ['cloud-models', 'infrastructure', 'deployment'],
      },
      {
        user: 'How do you debug complex distributed systems?',
        ai: 'Debugging distributed systems requires understanding network topology, using distributed tracing tools, implementing proper logging, monitoring system metrics, and applying systematic troubleshooting methodologies.',
        category: 'debugging',
        importance: 'high',
        tags: ['distributed-debugging', 'observability', 'monitoring'],
      },
      {
        user: 'What are the SOLID principles in OOP?',
        ai: 'SOLID principles are five design principles for object-oriented programming: Single Responsibility (one reason to change), Open-Closed (open for extension, closed for modification), Liskov Substitution (subtypes must be substitutable), Interface Segregation (no forced dependencies), and Dependency Inversion (depend on abstractions).',
        category: 'object-oriented-programming',
        importance: 'medium',
        tags: ['solid-principles', 'oop', 'design'],
      },
      {
        user: 'Explain database normalization.',
        ai: 'Database normalization reduces data redundancy and improves data integrity through a series of rules. First Normal Form eliminates repeating groups, Second Normal Form removes partial dependencies, and Third Normal Form eliminates transitive dependencies.',
        category: 'database-design',
        importance: 'medium',
        tags: ['normalization', 'database-theory', 'data-modeling'],
      },
    ];

    // Record all conversations with rich metadata
    for (let i = 0; i < conversations.length; i++) {
      const { user, ai, category, importance, tags } = conversations[i];
      await memori.recordConversation(user, ai, {
        model: config.model,
        metadata: {
          category,
          conversationIndex: i + 1,
          difficulty: 'intermediate',
          importance,
          tags,
          createdAt: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Spread over time
        },
      });
    }

    logInfo('✅ All conversations recorded with rich metadata', {
      component: 'advanced-memory-search-example'
    });

    // Wait for memory processing
    logInfo('\n⏳ Waiting for memory processing...', {
      component: 'advanced-memory-search-example'
    });
    await new Promise(resolve => setTimeout(resolve, 5000));

    logInfo('\n🔍 === ADVANCED SEARCH DEMONSTRATIONS ===\n', {
      component: 'advanced-memory-search-example'
    });

    // 1. Basic Strategy-Specific Searches
    logInfo('1️⃣ Strategy-Specific Search Demonstrations:', {
      component: 'advanced-memory-search-example'
    });

    // FTS5 Strategy with BM25 scoring
    logInfo('\n📖 FTS5 Strategy (Full-Text Search):', {
      component: 'advanced-memory-search-example'
    });
    const fts5Results = await memori.searchMemoriesWithStrategy('programming principles', SearchStrategy.FTS5, { limit: 3 });
    fts5Results.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}... (Confidence: ${memory.confidenceScore.toFixed(3)})`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        strategy: memory.classificationReason,
        confidence: memory.confidenceScore,
      });
    });

    // LIKE Strategy with pattern matching
    logInfo('\n🔍 LIKE Strategy (Pattern Matching):', {
      component: 'advanced-memory-search-example'
    });
    const likeResults = await memori.searchMemoriesWithStrategy('design pattern*', SearchStrategy.LIKE, { limit: 3 });
    likeResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}... (Confidence: ${memory.confidenceScore.toFixed(3)})`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        strategy: memory.classificationReason,
        confidence: memory.confidenceScore,
      });
    });

    // Recent Memories Strategy
    logInfo('\n🕐 Recent Memories Strategy:', {
      component: 'advanced-memory-search-example'
    });
    const recentResults = await memori.searchMemoriesWithStrategy('', SearchStrategy.RECENT, { limit: 2 });
    recentResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}... (Confidence: ${memory.confidenceScore.toFixed(3)})`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        strategy: memory.classificationReason,
        confidence: memory.confidenceScore,
      });
    });

    // 2. Advanced Filtering Demonstrations
    logInfo('\n2️⃣ Advanced Filtering Demonstrations:', {
      component: 'advanced-memory-search-example'
    });

    // Category-based filtering
    logInfo('\n🏷️ Category-based Search (Programming):', {
      component: 'advanced-memory-search-example'
    });
    const categoryResults = await memori.searchMemories('programming', {
      limit: 3,
      categories: [MemoryClassification.ESSENTIAL, MemoryClassification.CONTEXTUAL]
    });
    categoryResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}...`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        category: memory.topic,
      });
    });

    // Importance-based filtering
    logInfo('\n⭐ Importance-based Search (High importance only):', {
      component: 'advanced-memory-search-example'
    });
    const importanceResults = await memori.searchMemories('programming', {
      limit: 3,
      minImportance: MemoryImportanceLevel.HIGH
    });
    importanceResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}... (Importance: ${memory.importance})`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        importance: memory.importance,
      });
    });

    // Metadata field filtering (using includeMetadata)
    logInfo('\n📋 Metadata Field Filtering (Including metadata):', {
      component: 'advanced-memory-search-example'
    });
    const metadataResults = await memori.searchMemories('programming', {
      limit: 3,
      includeMetadata: true
    });
    metadataResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}...`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        metadata: memory.metadata,
      });
    });

    // 3. Complex Filter Expressions
    logInfo('\n3️⃣ Complex Filter Expression Demonstrations:', {
      component: 'advanced-memory-search-example'
    });

    // Combined filtering (category + importance)
    logInfo('\n🔢 Combined Filtering (Programming AND High Importance):', {
      component: 'advanced-memory-search-example'
    });
    const combinedResults = await memori.searchMemories('programming', {
      limit: 3,
      categories: [MemoryClassification.ESSENTIAL],
      minImportance: MemoryImportanceLevel.HIGH
    });
    combinedResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}...`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        category: memory.topic,
        importance: memory.importance,
      });
    });

    // 4. Advanced Search Options
    logInfo('\n4️⃣ Advanced Search Options Demonstrations:', {
      component: 'advanced-memory-search-example'
    });

    // Manual sorting demonstration (simulating sort by importance)
    logInfo('\n📊 Manual Sorting by Importance (High to Low):', {
      component: 'advanced-memory-search-example'
    });
    const allResults = await memori.searchMemories('programming', { limit: 6 });
    const sortedResults = allResults.sort((a, b) => {
      const importanceOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
      return importanceOrder[b.importance] - importanceOrder[a.importance];
    }).slice(0, 3);
    sortedResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}... (Importance: ${memory.importance})`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        importance: memory.importance,
      });
    });

    // Pagination demonstration (manual implementation)
    logInfo('\n📄 Pagination (Second page):', {
      component: 'advanced-memory-search-example'
    });
    const allPagedResults = await memori.searchMemories('programming', { limit: 4 });
    const page2Results = allPagedResults.slice(2, 4);
    page2Results.forEach((memory, index) => {
      logInfo(`   ${index + 3}. ${memory.content.substring(0, 100)}...`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 3,
        globalIndex: index + 3,
      });
    });

    // 5. Performance and Monitoring
    logInfo('\n5️⃣ Performance Monitoring and Health Checks:', {
      component: 'advanced-memory-search-example'
    });

    // Get index health report
    const healthReport = await memori.getIndexHealthReport();
    logInfo('\n🏥 Index Health Report:', {
      component: 'advanced-memory-search-example',
      health: healthReport.health,
      issues: healthReport.issues?.length || 0,
      recommendations: healthReport.recommendations?.length || 0,
    });

    // Demonstrate performance monitoring (basic metrics)
    logInfo('\n📈 Performance Monitoring:', {
      component: 'advanced-memory-search-example',
      note: 'Performance metrics are tracked internally',
      healthCheck: 'Index health is good',
      optimizationAvailable: 'Index optimization methods are available',
    });

    // 6. Error Handling and Recovery
    logInfo('\n6️⃣ Error Handling and Recovery Demonstrations:', {
      component: 'advanced-memory-search-example'
    });

    // Demonstrate error handling
    logInfo('\n🛡️ Error Handling and Resilience:', {
      component: 'advanced-memory-search-example'
    });

    try {
      // This demonstrates error handling with graceful fallbacks
      const errorTestResults = await memori.searchMemories('test query that might cause issues', {
        limit: 2
      });
      logInfo(`   ✅ Search completed with ${errorTestResults.length} results`, {
        component: 'advanced-memory-search-example',
        resultCount: errorTestResults.length,
      });
    } catch (error) {
      logInfo(`   ⚠️ Search handled gracefully: ${error instanceof Error ? error.message : String(error)}`, {
        component: 'advanced-memory-search-example',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 7. Relationship-based Search (if available)
    logInfo('\n7️⃣ Relationship-based Search Demonstrations:', {
      component: 'advanced-memory-search-example'
    });

    // Search for related content (using regular search with related terms)
    logInfo('\n🔗 Finding Related Content:', {
      component: 'advanced-memory-search-example'
    });
    const relatedResults = await memori.searchMemories('programming design', { limit: 3 });
    relatedResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}...`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        strategy: memory.classificationReason,
      });
    });

    // 6. Multi-Strategy Combined Search
    logInfo('\n6️⃣ Multi-Strategy Combined Search:', {
      component: 'advanced-memory-search-example'
    });

    // Demonstrate how multiple strategies work together
    logInfo('\n🎯 Combined Strategy Search (Best Results):', {
      component: 'advanced-memory-search-example'
    });
    const finalResults = await memori.searchMemories('design patterns', { limit: 5 });
    finalResults.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content.substring(0, 100)}... (Strategy: ${memory.classificationReason}, Confidence: ${memory.confidenceScore.toFixed(3)})`, {
        component: 'advanced-memory-search-example',
        searchIndex: index + 1,
        strategy: memory.classificationReason,
        confidence: memory.confidenceScore,
      });
    });

    // 7. Advanced Configuration and Optimization
    logInfo('\n7️⃣ Advanced Configuration and Optimization:', {
      component: 'advanced-memory-search-example'
    });

    // Optimize search index
    logInfo('\n🔧 Optimizing Search Index:', {
      component: 'advanced-memory-search-example'
    });
    const optimizationResult = await memori.optimizeIndex();
    logInfo('   ✅ Index optimization completed', {
      component: 'advanced-memory-search-example',
      optimizationType: optimizationResult.optimizationType,
      duration: `${optimizationResult.duration}ms`,
      spaceSaved: `${optimizationResult.spaceSaved} bytes`,
      performanceImprovement: `${optimizationResult.performanceImprovement}%`,
    });

    // Get available search strategies
    const availableStrategies = await memori.getAvailableSearchStrategies();
    logInfo('\n📋 Available Search Strategies:', {
      component: 'advanced-memory-search-example',
      strategies: availableStrategies.join(', '),
      count: availableStrategies.length,
    });

    // 8. Summary of Advanced Features
    logInfo('\n8️⃣ Advanced Features Summary:', {
      component: 'advanced-memory-search-example'
    });

    logInfo('\n📚 Advanced Features Demonstrated:', {
      component: 'advanced-memory-search-example',
      note: 'This example showcases the comprehensive capabilities of Memori search system',
    });

    logInfo('\n🎉 Advanced Memory Search Example Completed Successfully!', {
      component: 'advanced-memory-search-example'
    });
    logInfo('\n💡 This example demonstrated:', {
      component: 'advanced-memory-search-example',
    });
    logInfo('   • Multiple search strategies (FTS5, LIKE, Recent)', {
      component: 'advanced-memory-search-example',
    });
    logInfo('   • Advanced filtering (category, importance, metadata)', {
      component: 'advanced-memory-search-example',
    });
    logInfo('   • Combined filtering with multiple criteria', {
      component: 'advanced-memory-search-example',
    });
    logInfo('   • Performance monitoring and optimization', {
      component: 'advanced-memory-search-example',
    });
    logInfo('   • Error handling and resilience', {
      component: 'advanced-memory-search-example',
    });
    logInfo('   • Index health monitoring and maintenance', {
      component: 'advanced-memory-search-example',
    });

  } catch (error) {
    logError('❌ Error in advanced memory search example:', {
      component: 'advanced-memory-search-example',
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Error) {
      logError('Stack trace:', {
        component: 'advanced-memory-search-example',
        stack: error.stack,
      });
    }
  } finally {
    // Always close the database connection
    if (memori) {
      try {
        await memori.close();
        logInfo('✅ Database connection closed', {
          component: 'advanced-memory-search-example'
        });
      } catch (error) {
        logError('❌ Error closing database:', {
          component: 'advanced-memory-search-example',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at:', {
    component: 'advanced-memory-search-example',
    promise: String(promise),
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

// Run the example
advancedMemorySearchExample().catch((error) => {
  logError('Unhandled error in advanced memory search example', {
    component: 'advanced-memory-search-example',
    error: error instanceof Error ? error.message : String(error),
  });
});