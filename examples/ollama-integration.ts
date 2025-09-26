/**
 * Ollama Integration Example
 *
 * This example demonstrates how to use Memori with Ollama as the backend.
 * It shows configuration for local Ollama server and memory integration.
 */

import { Memori, ConfigManager } from '../src/index';
import { logInfo, logError } from '../src/core/utils/Logger';

async function ollamaIntegrationExample(): Promise<void> {
  logInfo('🚀 Starting Ollama Integration Example...\n', { component: 'ollama-integration-example' });

  let memori: Memori | undefined;

  try {
    // Load configuration - should be configured for Ollama
    const config = ConfigManager.loadConfig();
    logInfo('📋 Ollama Configuration loaded', {
      component: 'ollama-integration-example',
      databaseUrl: config.databaseUrl,
      namespace: config.namespace,
      model: config.model,
      baseUrl: config.baseUrl || 'Not configured',
    });

    // Verify Ollama configuration
    if (!config.baseUrl || !config.baseUrl.includes('11434')) {
      logInfo('⚠️  Warning: Base URL does not appear to be configured for Ollama', {
        component: 'ollama-integration-example',
        expected: 'http://localhost:11434/v1',
        current: config.baseUrl || 'Not set'
      });
    }

    if (!config.apiKey || config.apiKey === 'your-openai-api-key-here') {
      logInfo('ℹ️  Info: Using Ollama - no API key required', { component: 'ollama-integration-example' });
    }

    // Initialize Memori instance
    memori = new Memori(config);
    logInfo('✅ Memori instance created with Ollama backend', { component: 'ollama-integration-example' });

    // Enable Memori (initializes database schema)
    await memori.enable();
    logInfo('✅ Memori enabled successfully\n', { component: 'ollama-integration-example' });

    // Test conversations with different Ollama models
    const conversations = [
      {
        user: 'What are the benefits of using local LLMs like Ollama?',
        ai: 'Local LLMs provide privacy, no internet required, full control over data, and can run on consumer hardware. They are ideal for development, testing, and sensitive applications.',
      },
      {
        user: 'How do I run Ollama models efficiently?',
        ai: 'To run Ollama efficiently: use GPU acceleration if available, keep models on fast storage, use appropriate model sizes for your hardware, and consider using model quantization for better performance.',
      },
      {
        user: 'What programming tasks are good for local LLMs?',
        ai: 'Local LLMs excel at code completion, debugging help, documentation generation, unit test writing, code refactoring, and learning new programming concepts without exposing sensitive code to external services.',
      },
    ];

    logInfo('💬 Recording conversations with Ollama context...', { component: 'ollama-integration-example' });

    for (let i = 0; i < conversations.length; i++) {
      const { user, ai } = conversations[i];
      const chatId = await memori.recordConversation(user, ai, {
        model: config.model,
        metadata: {
          modelType: 'ollama',
          conversationIndex: i + 1,
          category: 'local-llm-usage',
        },
      });
      logInfo(`✅ Conversation ${i + 1} recorded: ${chatId}`, { component: 'ollama-integration-example', chatId });
    }

    // Wait for memory processing
    logInfo('\n⏳ Waiting for memory processing...', { component: 'ollama-integration-example' });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search for local LLM related memories
    logInfo('\n🔍 Searching memories for "local LLM"...', { component: 'ollama-integration-example' });
    const localLLMMemories = await memori.searchMemories('local LLM', { limit: 5 });

    if (localLLMMemories.length > 0) {
      logInfo(`✅ Found ${localLLMMemories.length} memories about local LLMs:`, {
        component: 'ollama-integration-example',
        count: localLLMMemories.length,
      });
      localLLMMemories.forEach((memory, index) => {
        logInfo(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'ollama-integration-example',
          memoryIndex: index + 1,
          modelUsed: memory.metadata?.modelUsed || 'Unknown',
          category: memory.metadata?.category || 'None',
        });
      });
    }

    // Search for efficiency-related memories
    logInfo('\n🔍 Searching memories for "efficient"...', { component: 'ollama-integration-example' });
    const efficiencyMemories = await memori.searchMemories('efficient', { limit: 3 });

    if (efficiencyMemories.length > 0) {
      logInfo(`✅ Found ${efficiencyMemories.length} efficiency-related memories:`, {
        component: 'ollama-integration-example',
        count: efficiencyMemories.length,
      });
      efficiencyMemories.forEach((memory, index) => {
        logInfo(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'ollama-integration-example',
          memoryIndex: index + 1,
        });
      });
    }

    // Search for programming-related memories
    logInfo('\n🔍 Searching memories for "programming"...', { component: 'ollama-integration-example' });
    const programmingMemories = await memori.searchMemories('programming', { limit: 3 });

    if (programmingMemories.length > 0) {
      logInfo(`✅ Found ${programmingMemories.length} programming-related memories:`, {
        component: 'ollama-integration-example',
        count: programmingMemories.length,
      });
      programmingMemories.forEach((memory, index) => {
        logInfo(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'ollama-integration-example',
          memoryIndex: index + 1,
        });
      });
    }

    logInfo('\n🎉 Ollama integration example completed successfully!', { component: 'ollama-integration-example' });
    logInfo('💡 Tip: Make sure Ollama is running on http://localhost:11434', { component: 'ollama-integration-example' });
    logInfo('   Use "ollama pull" commands to download models as needed', { component: 'ollama-integration-example' });

  } catch (error) {
    logError('❌ Error in Ollama integration example:', { component: 'ollama-integration-example', error });
    if (error instanceof Error) {
      logError('Error message:', { component: 'ollama-integration-example', message: error.message });

      // Provide helpful troubleshooting for common Ollama issues
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
        logInfo('\n🔧 Troubleshooting suggestions:', { component: 'ollama-integration-example' });
        logInfo('1. Make sure Ollama is installed: https://ollama.ai', { component: 'ollama-integration-example' });
        logInfo('2. Start Ollama server: ollama serve', { component: 'ollama-integration-example' });
        logInfo('3. Check if Ollama is running on port 11434', { component: 'ollama-integration-example' });
        logInfo('4. Pull a model: ollama pull llama2', { component: 'ollama-integration-example' });
      }
    }
  } finally {
    // Always close the database connection
    if (memori) {
      try {
        await memori.close();
        logInfo('✅ Database connection closed', { component: 'ollama-integration-example' });
      } catch (error) {
        logError('❌ Error closing database:', { component: 'ollama-integration-example', error });
      }
    }
  }
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Run the example
ollamaIntegrationExample().catch(console.error);