/**
 * OpenAI Integration Example
 *
 * This example demonstrates how to use Memori with OpenAI's API.
 * It shows configuration for OpenAI and demonstrates memory integration with GPT models.
 */

import { Memori, ConfigManager } from '../src/index';

async function openaiIntegrationExample(): Promise<void> {
  console.log('🚀 Starting OpenAI Integration Example...\n');

  let memori: Memori | undefined;

  try {
    // Load configuration - should be configured for OpenAI
    const config = ConfigManager.loadConfig();
    console.log('📋 OpenAI Configuration:', {
      databaseUrl: config.databaseUrl,
      namespace: config.namespace,
      model: config.model,
      baseUrl: config.baseUrl || 'OpenAI default',
      apiKey: config.apiKey ? '***configured***' : 'Not configured',
    });

    // Verify OpenAI configuration
    if (!config.apiKey || config.apiKey === 'your-openai-api-key-here') {
      console.log('❌ Error: OpenAI API key not configured');
      console.log('   Please set OPENAI_API_KEY in your .env file');
      console.log('   Get your API key from: https://platform.openai.com/api-keys');
      return;
    }

    if (config.baseUrl && config.baseUrl.includes('11434')) {
      console.log('⚠️  Warning: Base URL appears to be configured for Ollama, not OpenAI');
      console.log('   For OpenAI, remove OPENAI_BASE_URL from .env or set it to empty');
    }

    // Initialize Memori instance
    memori = new Memori(config);
    console.log('✅ Memori instance created with OpenAI backend');

    // Enable Memori (initializes database schema)
    await memori.enable();
    console.log('✅ Memori enabled successfully\n');

    // Test conversations with OpenAI context
    const conversations = [
      {
        user: 'Explain the concept of async/await in JavaScript.',
        ai: 'Async/await is a modern JavaScript syntax for handling asynchronous operations. The async keyword declares a function as asynchronous, and await pauses execution until a Promise resolves. This makes asynchronous code look and behave like synchronous code.',
      },
      {
        user: 'What are the benefits of using TypeScript over JavaScript?',
        ai: 'TypeScript offers static typing, better IDE support, early error detection, improved refactoring capabilities, and enhanced code maintainability. It compiles to JavaScript so it runs everywhere JavaScript does.',
      },
      {
        user: 'How do you handle errors in async functions?',
        ai: 'Error handling in async functions can be done using try/catch blocks with await, or by chaining .catch() methods on Promises. The try/catch approach is generally preferred as it provides cleaner, more readable code.',
      },
      {
        user: 'What are React hooks and how do they work?',
        ai: 'React hooks are functions that let you use state and lifecycle features in functional components. They include useState for state management, useEffect for side effects, useContext for context access, and many others. Hooks must be called at the top level of components.',
      },
    ];

    console.log('💬 Recording conversations with OpenAI context...');

    for (let i = 0; i < conversations.length; i++) {
      const { user, ai } = conversations[i];
      const chatId = await memori.recordConversation(user, ai, {
        model: config.model,
        metadata: {
          modelType: 'openai',
          conversationIndex: i + 1,
          category: 'programming-concepts',
        },
      });
      console.log(`✅ Conversation ${i + 1} recorded: ${chatId}`);
    }

    // Wait for memory processing
    console.log('\n⏳ Waiting for memory processing...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Search for programming concept memories
    console.log('\n🔍 Searching memories for "JavaScript"...');
    const jsMemories = await memori.searchMemories('JavaScript', 5);

    if (jsMemories.length > 0) {
      console.log(`✅ Found ${jsMemories.length} JavaScript-related memories:`);
      jsMemories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
        if (memory.metadata) {
          console.log(`   Model: ${memory.metadata.modelUsed || 'Unknown'}`);
          console.log(`   Category: ${memory.metadata.category || 'None'}`);
        }
      });
    }

    // Search for async/await memories
    console.log('\n🔍 Searching memories for "async"...');
    const asyncMemories = await memori.searchMemories('async', 3);

    if (asyncMemories.length > 0) {
      console.log(`✅ Found ${asyncMemories.length} async-related memories:`);
      asyncMemories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
      });
    }

    // Search for React-related memories
    console.log('\n🔍 Searching memories for "React"...');
    const reactMemories = await memori.searchMemories('React', 3);

    if (reactMemories.length > 0) {
      console.log(`✅ Found ${reactMemories.length} React-related memories:`);
      reactMemories.forEach((memory, index) => {
        console.log(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`);
      });
    }

    console.log('\n🎉 OpenAI integration example completed successfully!');
    console.log('💡 Tip: Make sure your OPENAI_API_KEY is valid and has sufficient credits');

  } catch (error) {
    console.error('❌ Error in OpenAI integration example:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);

      // Provide helpful troubleshooting for common OpenAI issues
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        console.log('\n🔧 Troubleshooting suggestions:');
        console.log('1. Check your OPENAI_API_KEY in the .env file');
        console.log('2. Verify the API key is correct and active');
        console.log('3. Make sure you have sufficient API credits');
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        console.log('\n🔧 Troubleshooting suggestions:');
        console.log('1. You are being rate limited by OpenAI');
        console.log('2. Wait a moment before trying again');
        console.log('3. Check your OpenAI account usage limits');
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
openaiIntegrationExample().catch(console.error);