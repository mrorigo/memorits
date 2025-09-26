/**
 * Basic Memori Usage Example
 *
 * This example demonstrates the fundamental usage of the Memori TypeScript library.
 * It shows how to initialize Memori, record conversations, and search memories.
 */

import { Memori, ConfigManager } from '../src/index';
import { logInfo, logError } from '../src/core/utils/Logger';

async function basicUsageExample(): Promise<void> {
  logInfo('🚀 Starting Basic Memori Usage Example', { component: 'basic-usage-example' });

  let memori: Memori | undefined;

  try {
    // Load configuration from environment variables
    const config = ConfigManager.loadConfig();
    logInfo('📋 Configuration loaded', {
      component: 'basic-usage-example',
      databaseUrl: config.databaseUrl,
      namespace: config.namespace,
      model: config.model,
      baseUrl: config.baseUrl || 'OpenAI default',
    });

    // Initialize Memori instance
    memori = new Memori(config);
    logInfo('✅ Memori instance created', { component: 'basic-usage-example' });

    // Enable Memori (initializes database schema)
    await memori.enable();
    logInfo('✅ Memori enabled successfully', { component: 'basic-usage-example' });

    // Simulate a conversation
    logInfo('💬 Recording conversation...', { component: 'basic-usage-example' });
    const chatId = await memori.recordConversation(
      'What is TypeScript and why should I use it?',
      'TypeScript is a superset of JavaScript that adds static typing. It helps catch errors early, improves code maintainability, and provides better IDE support.',
    );
    logInfo(`✅ Conversation recorded with ID: ${chatId}`, { component: 'basic-usage-example', chatId });

    // Add more conversations to build memory
    logInfo('💬 Recording more conversations...', { component: 'basic-usage-example' });
    await memori.recordConversation(
      'How do I declare variables in TypeScript?',
      'You can declare variables using let, const, or var. TypeScript also supports type annotations like: let name: string = "John";',
    );

    await memori.recordConversation(
      'What are interfaces in TypeScript?',
      'Interfaces define the structure of objects. They help with type checking and can be implemented by classes or used for object shapes.',
    );

    // Wait a moment for memory processing (asynchronous)
    logInfo('⏳ Waiting for memory processing...', { component: 'basic-usage-example' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search for memories
    logInfo('🔍 Searching memories for "TypeScript"...', { component: 'basic-usage-example' });
    const memories = await memori.searchMemories('TypeScript', { limit: 5 });

    // Search for specific concepts
    logInfo('🔍 Searching memories for "interfaces"...', { component: 'basic-usage-example' });

    if (memories.length > 0) {
      logInfo(`✅ Found ${memories.length} relevant memories:`, {
        component: 'basic-usage-example',
        memoryCount: memories.length,
      });
      memories.forEach((memory, index) => {
        logInfo(`${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'basic-usage-example',
          memoryIndex: index + 1,
          memoryId: memory.id,
        });
        if (memory.metadata) {
          logInfo('Memory metadata', {
            component: 'basic-usage-example',
            memoryId: memory.id,
            metadata: memory.metadata,
          });
        }
      });
    } else {
      logInfo('ℹ️ No memories found. This might be expected on first run.', {
        component: 'basic-usage-example',
      });
    }

    // Search for specific concepts
    logInfo('🔍 Searching memories for "interfaces"...', { component: 'basic-usage-example' });
    const interfaceMemories = await memori.searchMemories('interfaces', { limit: 3 });

    if (interfaceMemories.length > 0) {
      logInfo(`✅ Found ${interfaceMemories.length} memories about interfaces:`, {
        component: 'basic-usage-example',
        memoryCount: interfaceMemories.length,
      });
      interfaceMemories.forEach((memory, index) => {
        logInfo(`${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'basic-usage-example',
          memoryIndex: index + 1,
          memoryId: memory.id,
        });
      });
    }

    logInfo('🎉 Basic usage example completed successfully!', { component: 'basic-usage-example' });

  } catch (error) {
    logError('❌ Error in basic usage example', {
      component: 'basic-usage-example',
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    // Always close the database connection
    if (memori) {
      try {
        await memori.close();
        logInfo('✅ Database connection closed', { component: 'basic-usage-example' });
      } catch (error) {
        logError('❌ Error closing database', {
          component: 'basic-usage-example',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Promise Rejection', {
    component: 'basic-usage-example',
    promise: String(promise),
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
});

// Run the example
basicUsageExample().catch((error) => {
  logError('Unhandled error in basic usage example', {
    component: 'basic-usage-example',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
});