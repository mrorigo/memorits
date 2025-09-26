// examples/openai-dropin-usage.ts
// Example demonstrating OpenAI Drop-in replacement with ChatProxy
// This example shows how to use the MemoriOpenAI client as a drop-in replacement

import { MemoriOpenAIClient } from '../src/integrations/openai-dropin/client';
import { memoriOpenAIFactory } from '../src/integrations/openai-dropin/factory';

/**
 * Example: Basic Drop-in Replacement
 * Shows how existing OpenAI code can be easily migrated to use memory functionality
 */
async function basicDropInExample() {
  console.log('🚀 Basic OpenAI Drop-in Replacement Example');

  // Create MemoriOpenAI client (drop-in replacement for OpenAI)
  const client = new MemoriOpenAIClient('your-api-key-here', {
    enableChatMemory: true,
    autoInitialize: true,
    databaseConfig: {
      type: 'sqlite',
      url: 'sqlite:./memori-dropin.db',
      namespace: 'basic-example',
    },
  });

  // Enable the client
  await client.enable();

  console.log(`📝 Memory recording enabled: ${client.config.enableChatMemory}`);
  console.log(`🔗 Session ID: ${client.sessionId}`);

  // Example conversation - memory is automatically recorded
  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant that remembers our conversations.',
        },
        {
          role: 'user',
          content: 'Hello! My name is Alice and I love TypeScript. Please remember this for our future conversations.',
        },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    console.log('✅ Chat completion successful');
    console.log('📄 Response:', response.choices[0]?.message?.content);

    // Search for memories (this should include the conversation we just had)
    const memories = await client.memory.searchMemories('Alice TypeScript');
    console.log(`🔍 Found ${memories.length} memories related to "Alice TypeScript"`);

    memories.forEach((memory, index) => {
      console.log(`  Memory ${index + 1}: ${memory.content}`);
    });

    // Get memory statistics
    const stats = await client.memory.getMemoryStats();
    console.log('📊 Memory Statistics:', stats);

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : String(error));
  }

  // Clean up
  await client.close();
  console.log('👋 Basic example completed');
}

/**
 * Example: Using Different Initialization Patterns
 * Shows the various ways to initialize the MemoriOpenAI client
 */
async function initializationPatternsExample() {
  console.log('\n🔧 Initialization Patterns Example');

  // Pattern 1: Factory function with config
  const client1 = await memoriOpenAIFactory.fromConfig('your-api-key-here', {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    namespace: 'pattern1',
  });

  // Pattern 2: Factory function from environment
  const client2 = await memoriOpenAIFactory.fromEnv('your-api-key-here', {
    enableChatMemory: true,
    memoryProcessingMode: 'conscious',
  });

  // Pattern 3: Factory function with database URL
  const client3 = await memoriOpenAIFactory.fromDatabaseUrl('your-api-key-here', 'sqlite:./pattern3.db', {
    enableChatMemory: true,
    namespace: 'pattern3',
  });

  console.log('✅ All initialization patterns work');
  console.log('📝 Client 1 namespace:', client1.config.namespace);
  console.log('📝 Client 2 processing mode:', client2.config.memoryProcessingMode);
  console.log('📝 Client 3 database:', client3.config.databaseConfig?.url);

  // Clean up
  await Promise.all([client1.close(), client2.close(), client3.close()]);
  console.log('👋 Initialization patterns example completed');
}

/**
 * Example: Memory Configuration Options
 * Shows different memory recording configurations
 */
async function memoryConfigurationExample() {
  console.log('\n⚙️ Memory Configuration Example');

  // Configuration with auto ingestion
  const autoClient = new MemoriOpenAIClient('your-api-key-here', {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    autoIngest: true,
    consciousIngest: false,
    minImportanceLevel: 'all' as const,
    namespace: 'auto-memory',
  });

  // Configuration with conscious ingestion
  const consciousClient = new MemoriOpenAIClient('your-api-key-here', {
    enableChatMemory: true,
    memoryProcessingMode: 'conscious',
    autoIngest: false,
    consciousIngest: true,
    namespace: 'conscious-memory',
  });

  // Configuration with no ingestion (just storage)
  const storageClient = new MemoriOpenAIClient('your-api-key-here', {
    enableChatMemory: true,
    memoryProcessingMode: 'none',
    autoIngest: false,
    consciousIngest: false,
    namespace: 'storage-only',
  });

  console.log('✅ Memory configurations created');
  console.log('📝 Auto ingestion:', autoClient.config.autoIngest);
  console.log('📝 Conscious ingestion:', consciousClient.config.consciousIngest);
  console.log('📝 Storage only:', !storageClient.config.autoIngest && !storageClient.config.consciousIngest);

  // Clean up
  await Promise.all([autoClient.close(), consciousClient.close(), storageClient.close()]);
  console.log('👋 Memory configuration example completed');
}

/**
 * Example: Error Handling and Resilience
 * Shows how memory recording failures don't break chat functionality
 */
async function errorHandlingExample() {
  console.log('\n🛡️ Error Handling Example');

  // Create client with invalid database URL to simulate memory recording failure
  const client = new MemoriOpenAIClient('your-api-key-here', {
    enableChatMemory: true,
    autoInitialize: false, // Don't auto-initialize to avoid immediate errors
    databaseConfig: {
      type: 'sqlite',
      url: '/invalid/path/database.db',
      namespace: 'error-test',
    },
  });

  try {
    // This should fail during enable due to invalid database path
    await client.enable();
  } catch (error) {
    console.log('✅ Expected error during enable:', error instanceof Error ? error.message : String(error));

    // Even with memory recording disabled due to error, chat should still work
    console.log('📝 Chat functionality should still work even with memory errors...');

    // Note: This would work if we had a valid API key, but would fail memory recording
    // The chat completion itself would succeed, but memory recording would fail gracefully
  }

  // Clean up
  await client.close();
  console.log('👋 Error handling example completed');
}

/**
 * Example: Metrics and Monitoring
 * Shows how to monitor memory recording performance
 */
async function metricsExample() {
  console.log('\n📊 Metrics and Monitoring Example');

  const client = await memoriOpenAIFactory.fromConfig('your-api-key-here', {
    enableChatMemory: true,
    enableMetrics: true,
    autoInitialize: true,
    namespace: 'metrics-test',
  });

  await client.enable();

  // Get initial metrics
  const initialMetrics = await client.getMetrics();
  console.log('📈 Initial metrics:', {
    totalRequests: initialMetrics.totalRequests,
    memoryRecordingSuccess: initialMetrics.memoryRecordingSuccess,
    averageResponseTime: initialMetrics.averageResponseTime,
  });

  // Reset metrics for a clean test
  await client.resetMetrics();

  // Clean up
  await client.close();
  console.log('👋 Metrics example completed');
}

// Export examples for use in other files
export {
  basicDropInExample,
  initializationPatternsExample,
  memoryConfigurationExample,
  errorHandlingExample,
  metricsExample,
};

// Run examples if this file is executed directly
if (typeof process !== 'undefined' && process.argv0) {
  console.log('⚠️  These examples require a valid OpenAI API key to run.');
  console.log('💡 Set your API key and uncomment the function calls below to run examples.');

  // Uncomment to run examples:
  // basicDropInExample().catch(console.error);
  // initializationPatternsExample().catch(console.error);
  // memoryConfigurationExample().catch(console.error);
  // errorHandlingExample().catch(console.error);
  // metricsExample().catch(console.error);
}