/**
 * Basic Memori Usage Example
 *
 * This example demonstrates the unified Memori API with comprehensive configuration,
 * direct provider integration, and automatic memory recording.
 */

import { Memori, OpenAIWrapper } from '../src/index';
import { logInfo, logError } from '../src/core/infrastructure/config/Logger';

async function basicUsageExample(): Promise<void> {
  logInfo('🚀 Starting Basic Memori Usage Example', { component: 'basic-usage-example' });

  let memori: Memori | undefined;
  let openai: OpenAIWrapper | undefined;

  try {
    // Create Memori instance with unified configuration
    memori = new Memori({
      databaseUrl: 'sqlite:./memories.db',
      namespace: 'basic-example',
      apiKey: process.env.OPENAI_API_KEY || 'your-api-key',
      model: 'gpt-4o-mini',
      autoIngest: true,
      consciousIngest: false,
      enableRelationshipExtraction: true
    });
    logInfo('✅ Memori instance created', { component: 'basic-usage-example' });

    // Create provider wrapper (direct integration)
    openai = new OpenAIWrapper(memori);
    logInfo('✅ OpenAI wrapper created', { component: 'basic-usage-example' });

    // Chat normally - memory is recorded automatically
    logInfo('💬 Starting conversation...', { component: 'basic-usage-example' });
    const response1 = await openai.chat({
      messages: [
        { role: 'user', content: 'What is TypeScript and why should I use it?' }
      ]
    });
    logInfo(`✅ Conversation recorded with ID: ${response1.chatId}`, {
      component: 'basic-usage-example',
      chatId: response1.chatId
    });

    // Add more conversations to build memory
    logInfo('💬 Recording more conversations...', { component: 'basic-usage-example' });
    await openai.chat({
      messages: [
        { role: 'user', content: 'How do I declare variables in TypeScript?' }
      ]
    });

    await openai.chat({
      messages: [
        { role: 'user', content: 'What are interfaces in TypeScript?' }
      ]
    });

    // Wait a moment for memory processing (asynchronous)
    logInfo('⏳ Waiting for memory processing...', { component: 'basic-usage-example' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search for memories
    logInfo('🔍 Searching memories for "TypeScript"...', { component: 'basic-usage-example' });
    const memories = await memori!.searchMemories('TypeScript', { limit: 5 });

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