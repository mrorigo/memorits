/**
 * OpenAI Integration Example
 *
 * This example demonstrates how to use Memori with OpenAI's API using the unified API.
 * It shows simple configuration and direct provider integration with automatic memory recording.
 */

import { Memori, OpenAIWrapper } from '../src/index';
import { logInfo, logError } from '../src/core/infrastructure/config/Logger';

async function openaiIntegrationExample(): Promise<void> {
  logInfo('🚀 Starting OpenAI Integration Example...\n', { component: 'openai-integration-example' });

  let memori: Memori | undefined;
  let openai: OpenAIWrapper | undefined;

  try {
    // Create Memori instance with unified configuration
    memori = new Memori({
      databaseUrl: 'sqlite:./memories.db',
      namespace: 'openai-integration',
      apiKey: process.env.OPENAI_API_KEY || 'your-openai-api-key',
      model: 'gpt-4o-mini',
      autoIngest: true,
      consciousIngest: false,
      enableRelationshipExtraction: true
    });
    logInfo('✅ Memori instance created with OpenAI integration', { component: 'openai-integration-example' });

    // Create provider wrapper (direct integration)
    openai = new OpenAIWrapper(memori);
    logInfo('✅ OpenAI wrapper created', { component: 'openai-integration-example' });

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

    logInfo('💬 Recording conversations with OpenAI context...', { component: 'openai-integration-example' });

    for (let i = 0; i < conversations.length; i++) {
      const { user, ai } = conversations[i];

      // Use provider wrapper for automatic memory recording
      const response = await openai!.chat({
        messages: [
          { role: 'user', content: user },
          { role: 'assistant', content: ai }
        ]
      });

      logInfo(`✅ Conversation ${i + 1} recorded: ${response.chatId}`, {
        component: 'openai-integration-example',
        chatId: response.chatId,
        conversationIndex: i + 1,
      });
    }

    // Wait for memory processing
    logInfo('\n⏳ Waiting for memory processing...', { component: 'openai-integration-example' });
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Search for programming concept memories
    logInfo('\n🔍 Searching memories for "JavaScript"...', { component: 'openai-integration-example' });
    const jsMemories = await memori!.searchMemories('JavaScript', { limit: 5 });

    if (jsMemories.length > 0) {
      logInfo(`✅ Found ${jsMemories.length} JavaScript-related memories:`, {
        component: 'openai-integration-example',
        count: jsMemories.length,
      });
      jsMemories.forEach((memory, index) => {
        logInfo(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'openai-integration-example',
          memoryIndex: index + 1,
          modelUsed: memory.metadata?.modelUsed || 'Unknown',
          category: memory.metadata?.category || 'None',
        });
      });
    }

    // Search for async/await memories
    logInfo('\n🔍 Searching memories for "async"...', { component: 'openai-integration-example' });
    const asyncMemories = await memori!.searchMemories('async', { limit: 3 });

    if (asyncMemories.length > 0) {
      logInfo(`✅ Found ${asyncMemories.length} async-related memories:`, {
        component: 'openai-integration-example',
        count: asyncMemories.length,
      });
      asyncMemories.forEach((memory, index) => {
        logInfo(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'openai-integration-example',
          memoryIndex: index + 1,
        });
      });
    }

    // Search for React-related memories
    logInfo('\n🔍 Searching memories for "React"...', { component: 'openai-integration-example' });
    const reactMemories = await memori!.searchMemories('React', { limit: 3 });

    if (reactMemories.length > 0) {
      logInfo(`✅ Found ${reactMemories.length} React-related memories:`, {
        component: 'openai-integration-example',
        count: reactMemories.length,
      });
      reactMemories.forEach((memory, index) => {
        logInfo(`\n${index + 1}. ${memory.content || memory.summary || 'Memory content'}`, {
          component: 'openai-integration-example',
          memoryIndex: index + 1,
        });
      });
    }

    logInfo('\n🎉 OpenAI integration example completed successfully!', { component: 'openai-integration-example' });
    logInfo('💡 Tip: Make sure your OPENAI_API_KEY is valid and has sufficient credits', { component: 'openai-integration-example' });

  } catch (error) {
    logError('❌ Error in OpenAI integration example:', { component: 'openai-integration-example', error });
    if (error instanceof Error) {
      logError('Error message:', { component: 'openai-integration-example', message: error.message });

      // Provide helpful troubleshooting for common OpenAI issues
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        logInfo('\n🔧 Troubleshooting suggestions:', { component: 'openai-integration-example' });
        logInfo('1. Check your API key is valid', { component: 'openai-integration-example' });
        logInfo('2. Verify the API key has sufficient credits', { component: 'openai-integration-example' });
        logInfo('3. Make sure the key format starts with "sk-"', { component: 'openai-integration-example' });
      } else if (error.message.includes('429') || error.message.includes('rate limit')) {
        logInfo('\n🔧 Troubleshooting suggestions:', { component: 'openai-integration-example' });
        logInfo('1. You are being rate limited by OpenAI', { component: 'openai-integration-example' });
        logInfo('2. Wait a moment before trying again', { component: 'openai-integration-example' });
        logInfo('3. Check your OpenAI account usage limits', { component: 'openai-integration-example' });
      }
    }
  } finally {
    // Always close the database connection
    if (memori) {
      try {
        await memori.close();
        logInfo('✅ Database connection closed', { component: 'openai-integration-example' });
      } catch (error) {
        logError('❌ Error closing database:', { component: 'openai-integration-example', error });
      }
    }
  }
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at:', { component: 'openai-integration-example', promise, reason });
});

// Run the example
openaiIntegrationExample().catch(console.error);