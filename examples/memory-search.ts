/**
 * Memory Search and Retrieval Example
 *
 * This example demonstrates advanced memory search and retrieval capabilities.
 * It shows how to search memories with different queries, filters, and contexts.
 */

import { Memori, ConfigManager } from '../src/index';

async function memorySearchExample(): Promise<void> {
  console.log('🚀 Starting Memory Search and Retrieval Example...\n');

  let memori: Memori | undefined;

  try {
    // Load configuration
    const config = ConfigManager.loadConfig();
    console.log('📋 Configuration loaded:', {
      databaseUrl: config.databaseUrl,
      namespace: config.namespace,
      model: config.model,
    });

    // Initialize Memori instance
    memori = new Memori(config);
    console.log('✅ Memori instance created');

    // Enable Memori (initializes database schema)
    await memori.enable();
    console.log('✅ Memori enabled successfully\n');

    // Add diverse conversations to build a rich memory base
    console.log('💬 Building memory base with diverse conversations...');

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

    console.log('✅ All conversations recorded');

    // Wait for memory processing
    console.log('\n⏳ Waiting for memory processing...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log('\n🔍 === MEMORY SEARCH DEMONSTRATIONS ===\n');

    // Basic keyword search
    console.log('1️⃣ Basic keyword search for "programming":');
    const programmingMemories = await memori.searchMemories('programming', 3);
    programmingMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Category-specific search
    console.log('\n2️⃣ Searching for artificial intelligence content:');
    const aiMemories = await memori.searchMemories('machine learning', 2);
    aiMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Architecture and design patterns
    console.log('\n3️⃣ Searching for software architecture concepts:');
    const architectureMemories = await memori.searchMemories('SOLID', 2);
    architectureMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Technology-specific search
    console.log('\n4️⃣ Searching for distributed systems (blockchain):');
    const blockchainMemories = await memori.searchMemories('blockchain', 2);
    blockchainMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Cloud computing search
    console.log('\n5️⃣ Searching for cloud computing concepts:');
    const cloudMemories = await memori.searchMemories('cloud computing', 2);
    cloudMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Debugging and troubleshooting
    console.log('\n6️⃣ Searching for debugging techniques:');
    const debugMemories = await memori.searchMemories('debugging', 2);
    debugMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Cross-topic search - finding related concepts
    console.log('\n7️⃣ Cross-topic search for "systems":');
    const systemsMemories = await memori.searchMemories('systems', 4);
    systemsMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Concept intersection search
    console.log('\n8️⃣ Concept intersection search for "learning":');
    const learningMemories = await memori.searchMemories('learning', 3);
    learningMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Pattern-based search
    console.log('\n9️⃣ Pattern-based search for "principles":');
    const principlesMemories = await memori.searchMemories('principles', 3);
    principlesMemories.forEach((memory, index) => {
      console.log(`   ${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
    });

    // Comprehensive search across all memories
    console.log('\n🔍📊 COMPREHENSIVE SEARCH RESULTS 📊🔍');
    console.log('\n🔍 Searching for "technology" across all memories:');
    const allTechMemories = await memori.searchMemories('technology', 10);

    if (allTechMemories.length > 0) {
      console.log(`✅ Found ${allTechMemories.length} technology-related memories:`);
      const categories = new Set();
      allTechMemories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
        if (memory.metadata?.category) {
          categories.add(memory.metadata.category);
        }
      });
      console.log(`\n📂 Categories found: ${Array.from(categories).join(', ')}`);
    }

    console.log('\n🎉 Memory search example completed successfully!');
    console.log('💡 This demonstrates how Memori can retrieve relevant information');
    console.log('   across different topics and contexts based on semantic search.');

  } catch (error) {
    console.error('❌ Error in memory search example:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  } finally {
    // Always close the database connection
    if (memori) {
      try {
        await memori.close();
        console.log('✅ Database connection closed');
      } catch (error) {
        console.error('❌ Error closing database:', error);
      }
    }
  }
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the example
memorySearchExample().catch(console.error);