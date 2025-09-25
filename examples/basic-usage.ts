/**
 * Basic Memori Usage Example
 *
 * This example demonstrates the fundamental usage of the Memori TypeScript library.
 * It shows how to initialize Memori, record conversations, and search memories.
 */

import { Memori, ConfigManager } from '../src/index';

async function basicUsageExample(): Promise<void> {
  console.log('🚀 Starting Basic Memori Usage Example...\n');

  let memori: Memori | undefined;

  try {
    // Load configuration from environment variables
    const config = ConfigManager.loadConfig();
    console.log('📋 Configuration loaded:', {
      databaseUrl: config.databaseUrl,
      namespace: config.namespace,
      model: config.model,
      baseUrl: config.baseUrl || 'OpenAI default',
    });

    // Initialize Memori instance
    memori = new Memori(config);
    console.log('✅ Memori instance created');

    // Enable Memori (initializes database schema)
    await memori.enable();
    console.log('✅ Memori enabled successfully\n');

    // Simulate a conversation
    console.log('💬 Recording conversation...');
    const chatId = await memori.recordConversation(
      'What is TypeScript and why should I use it?',
      'TypeScript is a superset of JavaScript that adds static typing. It helps catch errors early, improves code maintainability, and provides better IDE support.'
    );
    console.log(`✅ Conversation recorded with ID: ${chatId}\n`);

    // Add more conversations to build memory
    console.log('💬 Recording more conversations...');
    await memori.recordConversation(
      'How do I declare variables in TypeScript?',
      'You can declare variables using let, const, or var. TypeScript also supports type annotations like: let name: string = "John";'
    );

    await memori.recordConversation(
      'What are interfaces in TypeScript?',
      'Interfaces define the structure of objects. They help with type checking and can be implemented by classes or used for object shapes.'
    );

    // Wait a moment for memory processing (asynchronous)
    console.log('⏳ Waiting for memory processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search for memories
    console.log('\n🔍 Searching memories for "TypeScript"...');
    const memories = await memori.searchMemories('TypeScript', 5);

    if (memories.length > 0) {
      console.log(`✅ Found ${memories.length} relevant memories:`);
      memories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
        if (memory.metadata) {
          console.log(`   Metadata:`, memory.metadata);
        }
      });
    } else {
      console.log('ℹ️ No memories found. This might be expected on first run.');
    }

    // Search for specific concepts
    console.log('\n🔍 Searching memories for "interfaces"...');
    const interfaceMemories = await memori.searchMemories('interfaces', 3);

    if (interfaceMemories.length > 0) {
      console.log(`✅ Found ${interfaceMemories.length} memories about interfaces:`);
      interfaceMemories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
      });
    }

    console.log('\n🎉 Basic usage example completed successfully!');

  } catch (error) {
    console.error('❌ Error in basic usage example:', error);
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
basicUsageExample().catch(console.error);