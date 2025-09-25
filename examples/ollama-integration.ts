/**
 * Ollama Integration Example
 *
 * This example demonstrates how to use Memori with Ollama as the backend.
 * It shows configuration for local Ollama server and memory integration.
 */

import { Memori, ConfigManager } from '../src/index';

async function ollamaIntegrationExample(): Promise<void> {
  console.log('🚀 Starting Ollama Integration Example...\n');

  let memori: Memori | undefined;

  try {
    // Load configuration - should be configured for Ollama
    const config = ConfigManager.loadConfig();
    console.log('📋 Ollama Configuration:', {
      databaseUrl: config.databaseUrl,
      namespace: config.namespace,
      model: config.model,
      baseUrl: config.baseUrl || 'Not configured',
    });

    // Verify Ollama configuration
    if (!config.baseUrl || !config.baseUrl.includes('11434')) {
      console.log('⚠️  Warning: Base URL does not appear to be configured for Ollama');
      console.log('   Expected: http://localhost:11434/v1');
      console.log('   Current: ', config.baseUrl || 'Not set');
    }

    if (!config.apiKey || config.apiKey === 'your-openai-api-key-here') {
      console.log('ℹ️  Info: Using Ollama - no API key required');
    }

    // Initialize Memori instance
    memori = new Memori(config);
    console.log('✅ Memori instance created with Ollama backend');

    // Enable Memori (initializes database schema)
    await memori.enable();
    console.log('✅ Memori enabled successfully\n');

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

    console.log('💬 Recording conversations with Ollama context...');

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
      console.log(`✅ Conversation ${i + 1} recorded: ${chatId}`);
    }

    // Wait for memory processing
    console.log('\n⏳ Waiting for memory processing...');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search for local LLM related memories
    console.log('\n🔍 Searching memories for "local LLM"...');
    const localLLMMemories = await memori.searchMemories('local LLM', 5);

    if (localLLMMemories.length > 0) {
      console.log(`✅ Found ${localLLMMemories.length} memories about local LLMs:`);
      localLLMMemories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
        if (memory.metadata) {
          console.log(`   Model: ${memory.metadata.modelUsed || 'Unknown'}`);
          console.log(`   Category: ${memory.metadata.category || 'None'}`);
        }
      });
    }

    // Search for efficiency-related memories
    console.log('\n🔍 Searching memories for "efficient"...');
    const efficiencyMemories = await memori.searchMemories('efficient', 3);

    if (efficiencyMemories.length > 0) {
      console.log(`✅ Found ${efficiencyMemories.length} efficiency-related memories:`);
      efficiencyMemories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
      });
    }

    // Search for programming-related memories
    console.log('\n🔍 Searching memories for "programming"...');
    const programmingMemories = await memori.searchMemories('programming', 3);

    if (programmingMemories.length > 0) {
      console.log(`✅ Found ${programmingMemories.length} programming-related memories:`);
      programmingMemories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
      });
    }

    console.log('\n🎉 Ollama integration example completed successfully!');
    console.log('💡 Tip: Make sure Ollama is running on http://localhost:11434');
    console.log('   Use "ollama pull" commands to download models as needed');

  } catch (error) {
    console.error('❌ Error in Ollama integration example:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);

      // Provide helpful troubleshooting for common Ollama issues
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
        console.log('\n🔧 Troubleshooting suggestions:');
        console.log('1. Make sure Ollama is installed: https://ollama.ai');
        console.log('2. Start Ollama server: ollama serve');
        console.log('3. Check if Ollama is running on port 11434');
        console.log('4. Pull a model: ollama pull llama2');
      }
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
ollamaIntegrationExample().catch(console.error);