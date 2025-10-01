/**
 * Memory Search and Retrieval Example
 *
 * This example demonstrates advanced memory search and retrieval capabilities.
 * It shows how to search memories with different queries, filters, and contexts.
 */

import { Memori, ConfigManager } from '../src/index';

import { logInfo, logError } from '../src/core/utils/Logger';

async function memorySearchExample(): Promise<void> {
  logInfo('🚀 Starting Memory Search and Retrieval Example...\n', { component: 'memory-search-example' });

  let memori: Memori | undefined;

  try {
    // Load configuration
    const config = ConfigManager.loadConfig();
    logInfo('📋 Configuration loaded:', {
      component: 'memory-search-example',
      databaseUrl: config.databaseUrl,
      namespace: config.namespace,
      model: config.model,
    });

    // Initialize Memori instance with auto-ingestion enabled
    memori = new Memori({
      ...config,
      autoIngest: true, // Enable auto-ingestion to process conversations into searchable memories
    });
    logInfo('✅ Memori instance created with auto-ingestion enabled', { component: 'memory-search-example' });

    // Enable Memori (initializes database schema)
    await memori.enable();
    logInfo('✅ Memori enabled successfully\n', { component: 'memory-search-example' });

    // Add diverse conversations to build a rich memory base
    logInfo('💬 Building memory base with diverse conversations...', { component: 'memory-search-example' });

    const conversations = [
      {
        user: 'What are the benefits of functional programming?',
        ai: 'Functional programming emphasizes immutability, pure functions, and avoiding side effects. Benefits include easier testing, debugging, and reasoning about code, as well as better support for parallel processing.',
        category: 'programming-paradigms',
      },
      {
        user: 'How does machine learning work?',
        ai: 'Machine learning involves training algorithms on data to recognize patterns and make predictions. It includes supervised learning (with labeled data), unsupervised learning (finding patterns in unlabeled data), and reinforcement learning (learning through trial and error).',
        category: 'artificial-intelligence',
      },
      {
        user: 'What are the principles of good software architecture?',
        ai: 'Good software architecture follows SOLID principles: Single Responsibility, Open-Closed, Liskov Substitution, Interface Segregation, and Dependency Inversion. It also emphasizes modularity, scalability, and maintainability.',
        category: 'software-architecture',
      },
      {
        user: 'Explain the concept of blockchain technology.',
        ai: 'Blockchain is a distributed ledger technology that maintains a continuously growing list of records called blocks. Each block contains a timestamp and a link to the previous block, making it resistant to data modification.',
        category: 'blockchain',
      },
      {
        user: 'What are the key concepts in cloud computing?',
        ai: 'Cloud computing involves delivering computing services over the internet. Key concepts include Infrastructure as a Service (IaaS), Platform as a Service (PaaS), Software as a Service (SaaS), virtualization, and scalability.',
        category: 'cloud-computing',
      },
      {
        user: 'How do you approach debugging complex systems?',
        ai: 'Debugging complex systems requires systematic approaches: reproduce the issue, isolate components, use logging and monitoring, apply binary search techniques, and understand the system architecture. Tools like debuggers and profilers are essential.',
        category: 'debugging',
      },
    ];

    // Record all conversations
    for (let i = 0; i < conversations.length; i++) {
      const { user, ai, category } = conversations[i];
      await memori.recordConversation(user, ai, {
        model: config.model,
        metadata: {
          category,
          conversationIndex: i + 1,
          difficulty: 'intermediate',
        },
      });
    }

    logInfo('✅ All conversations recorded', { component: 'memory-search-example' });

    // Wait for memory processing
    logInfo('\n⏳ Waiting for memory processing...', { component: 'memory-search-example' });
    await new Promise(resolve => setTimeout(resolve, 5000));

    logInfo('\n🔍 === MEMORY SEARCH DEMONSTRATIONS ===\n', { component: 'memory-search-example' });

    // Basic keyword search
    logInfo('1️⃣ Basic keyword search for "programming":', { component: 'memory-search-example' });
    const programmingMemories = await memori.searchMemories('programming', { limit: 3 });
    programmingMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'basic-keyword',
      });
    });

    // Category-specific search
    logInfo('\n2️⃣ Searching for artificial intelligence content:', { component: 'memory-search-example' });
    const aiMemories = await memori.searchMemories('machine learning', { limit: 2 });
    aiMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'category-specific',
      });
    });

    // Architecture and design patterns
    logInfo('\n3️⃣ Searching for software architecture concepts:', { component: 'memory-search-example' });
    const architectureMemories = await memori.searchMemories('SOLID', { limit: 2 });
    architectureMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'architecture-patterns',
      });
    });

    // Technology-specific search
    logInfo('\n4️⃣ Searching for distributed systems (blockchain):', { component: 'memory-search-example' });
    const blockchainMemories = await memori.searchMemories('blockchain', { limit: 2 });
    blockchainMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'technology-specific',
      });
    });

    // Cloud computing search
    logInfo('\n5️⃣ Searching for cloud computing concepts:', { component: 'memory-search-example' });
    const cloudMemories = await memori.searchMemories('cloud computing', { limit: 2 });
    cloudMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'cloud-computing',
      });
    });

    // Debugging and troubleshooting
    logInfo('\n6️⃣ Searching for debugging techniques:', { component: 'memory-search-example' });
    const debugMemories = await memori.searchMemories('debugging', { limit: 2 });
    debugMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'debugging-techniques',
      });
    });

    // Cross-topic search - finding related concepts
    logInfo('\n7️⃣ Cross-topic search for "systems":', { component: 'memory-search-example' });
    const systemsMemories = await memori.searchMemories('systems', { limit: 4 });
    systemsMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'cross-topic'
      });
    });

    // Concept intersection search
    logInfo('\n8️⃣ Concept intersection search for "learning":', { component: 'memory-search-example' });
    const learningMemories = await memori.searchMemories('learning', { limit: 3 });
    learningMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'concept-intersection'
      });
    });

    // Pattern-based search
    logInfo('\n9️⃣ Pattern-based search for "principles":', { component: 'memory-search-example' });
    const principlesMemories = await memori.searchMemories('principles', { limit: 3 });
    principlesMemories.forEach((memory, index) => {
      logInfo(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
        component: 'memory-search-example',
        searchIndex: index + 1,
        searchType: 'pattern-based'
      });
    });

    // Comprehensive search across all memories
    logInfo('\n🔍📊 COMPREHENSIVE SEARCH RESULTS 📊🔍', { component: 'memory-search-example' });
    logInfo('\n🔍 Searching for "technology" across all memories:', { component: 'memory-search-example' });
    const allTechMemories = await memori.searchMemories('technology', { limit: 10 });

    if (allTechMemories.length > 0) {
      logInfo(`✅ Found ${allTechMemories.length} technology-related memories:`, {
        component: 'memory-search-example',
        memoryCount: allTechMemories.length
      });
      const categories = new Set();
      allTechMemories.forEach((memory, index) => {
        logInfo(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'memory-search-example',
          searchIndex: index + 1,
          searchType: 'comprehensive'
        });
        if (memory.metadata?.category) {
          categories.add(memory.metadata.category);
        }
      });
      logInfo(`\n📂 Categories found: ${Array.from(categories).join(', ')}`, {
        component: 'memory-search-example',
        categories: Array.from(categories)
      });
    }

    logInfo('\n🎉 Memory search example completed successfully!', { component: 'memory-search-example' });
    logInfo('💡 This demonstrates how Memori can retrieve relevant information', { component: 'memory-search-example' });
    logInfo('   across different topics and contexts based on semantic search.', { component: 'memory-search-example' });

  } catch (error) {
    logError('❌ Error in memory search example:', {
      component: 'memory-search-example',
      error: error instanceof Error ? error.message : String(error),
    });
    if (error instanceof Error) {
      logError('Error message:', {
        component: 'memory-search-example',
        error: error.message,
      });
    }
  } finally {
    // Always close the database connection
    if (memori) {
      try {
        await memori.close();
        logInfo('✅ Database connection closed', { component: 'memory-search-example' });
      } catch (error) {
        logError('❌ Error closing database:', {
          component: 'memory-search-example',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at:', {
    component: 'memory-search-example',
    promise: String(promise),
    reason: reason instanceof Error ? reason.message : String(reason),
  });
});

// Run the example
memorySearchExample().catch((error) => {
  logError('Unhandled error in memory search example', {
    component: 'memory-search-example',
    error: error instanceof Error ? error.message : String(error),
  });
});