/**
 * Anthropic SDK Integration Example
 *
 * This example demonstrates how to use MemoriTS with the official Anthropic SDK.
 * The new implementation provides enhanced features including:
 * - Native streaming support
 * - Structured error handling
 * - Automatic retry logic
 * - Better performance and reliability
 */

import { Memori, ConfigManager } from '../src/index';
import { LLMProviderFactory } from '../src/core/infrastructure/providers/LLMProviderFactory';
import { ProviderType } from '../src/core/infrastructure/providers/ProviderType';
import { logInfo, logError } from '../src/core/infrastructure/config/Logger';

async function basicAnthropicUsage() {
  logInfo('🚀 Starting Basic Anthropic Integration Example', { component: 'basic-anthropic-usage' });

  let memori: Memori | undefined;

  try {
    // Load configuration and override for Anthropic
    const baseConfig = ConfigManager.loadConfig();

    // Verify Anthropic API key
    if (!process.env.ANTHROPIC_API_KEY) {
      logError('❌ Error: ANTHROPIC_API_KEY not configured', {
        component: 'basic-anthropic-usage',
        hint: 'Please set ANTHROPIC_API_KEY in your environment variables',
      });
      return;
    }

    // Initialize Memori with Anthropic configuration
    memori = new Memori({
      ...baseConfig,
      model: 'claude-3-5-sonnet-20241022',
      apiKey: process.env.ANTHROPIC_API_KEY,
      baseUrl: 'https://api.anthropic.com/',
      autoIngest: true,
      enableRelationshipExtraction: true,
    });

    logInfo('✅ Memori instance created with Anthropic SDK', { component: 'basic-anthropic-usage' });

    // Enable memory processing
    await memori.enable();
    logInfo('✅ Memori enabled successfully', { component: 'basic-anthropic-usage' });

    // Record a conversation
    const chatId = await memori.recordConversation(
      'What are the benefits of using the official Anthropic SDK?',
      'The official Anthropic SDK provides several advantages including better error handling, native streaming support, automatic retries, and improved performance compared to custom HTTP implementations.'
    );

    console.log(`✅ Conversation recorded with ID: ${chatId}`);

    // Search for memories related to SDK benefits
    const memories = await memori.searchMemories('SDK benefits', { limit: 5 });

    console.log(`📚 Found ${memories.length} related memories`);
    memories.forEach((memory, index) => {
      console.log(`${index + 1}. ${memory.summary || memory.content}`);
    });

  } catch (error) {
    logError('❌ Error in basic Anthropic usage example', {
      component: 'basic-anthropic-usage',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Always close the database connection
    if (memori) {
      try {
        await memori.close();
        logInfo('✅ Database connection closed', { component: 'basic-anthropic-usage' });
      } catch (error) {
        logError('❌ Error closing database', {
          component: 'basic-anthropic-usage',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

async function anthropicStreamingExample() {
  logInfo('\n🌊 Starting Anthropic Streaming Example', { component: 'anthropic-streaming' });

  // Create Anthropic provider directly for streaming
  const provider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
    apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here',
    model: 'claude-3-5-sonnet-20241022',
  });

  try {
    logInfo('📡 Streaming response from Claude', { component: 'anthropic-streaming' });

    const response = await provider.createChatCompletion({
      messages: [
        { role: 'user', content: 'Write a short poem about artificial intelligence and memory.' },
      ],
      stream: true,
      max_tokens: 200,
      temperature: 0.7,
    });

    console.log('📝 Poem:');
    console.log(response.message.content);

    // The response will contain the complete streamed content
    logInfo(`📊 Token usage: ${response.usage?.total_tokens || 'N/A'} tokens`, {
      component: 'anthropic-streaming',
      tokens: response.usage?.total_tokens || 'N/A',
    });

  } catch (error) {
    logError('❌ Streaming error', {
      component: 'anthropic-streaming',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await provider.dispose();
  }
}

async function anthropicErrorHandlingExample() {
  logInfo('\n🛡️ Starting Anthropic Error Handling Example', { component: 'anthropic-error-handling' });

  const provider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
    apiKey: 'invalid-api-key', // This will trigger an error
    model: 'claude-3-5-sonnet-20241022',
  });

  try {
    await provider.createChatCompletion({
      messages: [
        { role: 'user', content: 'Hello, Claude!' },
      ],
    });
  } catch (error) {
    // The SDK provides structured error information
    logInfo('✅ Caught expected error', {
      component: 'anthropic-error-handling',
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
    });

    // Check if it's an Anthropic API error with additional details
    if (error instanceof Error && error.message.includes('Anthropic API error')) {
      logInfo('🔍 This is a structured Anthropic API error with proper error codes', {
        component: 'anthropic-error-handling',
      });
    }
  } finally {
    await provider.dispose();
  }
}

async function anthropicMemoryIntegrationExample() {
  logInfo('\n🧠 Starting Anthropic Memory Integration Example', { component: 'anthropic-memory-integration' });

  let memori: Memori | undefined;

  try {
    // Load configuration and override for Anthropic
    const baseConfig = ConfigManager.loadConfig();

    // Initialize Memori with Anthropic configuration for memory integration
    memori = new Memori({
      ...baseConfig,
      model: 'claude-3-5-sonnet-20241022',
      apiKey: process.env.ANTHROPIC_API_KEY || 'your-api-key-here',
      baseUrl: 'https://api.anthropic.com/v1',
      autoIngest: true,
      enableRelationshipExtraction: true,
    });

    logInfo('✅ Memori instance created for memory integration', { component: 'anthropic-memory-integration' });

    await memori.enable();
    logInfo('✅ Memori enabled successfully', { component: 'anthropic-memory-integration' });

    // Have a conversation about AI and memory
    const conversations = [
      {
        userInput: 'What is the importance of memory in AI systems?',
        aiOutput: 'Memory is crucial for AI systems as it enables learning from past experiences, maintaining context in conversations, and building coherent responses over time.',
      },
      {
        userInput: 'How does MemoriTS implement memory processing?',
        aiOutput: 'MemoriTS implements memory processing through sophisticated analysis that extracts meaning, relationships, and importance from conversations, storing them for future retrieval.',
      },
      {
        userInput: 'What are the benefits of using official SDKs like Anthropic\'s?',
        aiOutput: 'Official SDKs provide better reliability, automatic error handling, native streaming support, and stay up-to-date with API changes, reducing maintenance overhead.',
      },
    ];

    // Record multiple conversations
    for (const conv of conversations) {
      await memori.recordConversation(conv.userInput, conv.aiOutput);
      console.log(`✅ Recorded: "${conv.userInput.slice(0, 50)}..."`);
    }

    // Search for memories about memory and AI
    const memoryMemories = await memori.searchMemories('memory AI', { limit: 10 });
    console.log(`\n📚 Found ${memoryMemories.length} memories about memory and AI`);

    // Search for memories about SDKs
    const sdkMemories = await memori.searchMemories('SDK', { limit: 10 });
    console.log(`📚 Found ${sdkMemories.length} memories about SDKs`);

    // Get session statistics
    const sessionId = memori.getSessionId();
    console.log(`\n📊 Session ID: ${sessionId}`);
    console.log(`🔄 Memory processing mode: ${memori.isAutoModeEnabled() ? 'Auto' : 'Conscious'}`);

  } catch (error) {
    logError('❌ Error in Anthropic memory integration example', {
      component: 'anthropic-memory-integration',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Always close the database connection
    if (memori) {
      try {
        await memori.close();
        logInfo('✅ Database connection closed', { component: 'anthropic-memory-integration' });
      } catch (error) {
        logError('❌ Error closing database', {
          component: 'anthropic-memory-integration',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

// Example usage with environment variable check
if (require.main === module) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    logError('⚠️  ANTHROPIC_API_KEY environment variable not set', {
      component: 'anthropic-integration-main',
      hint: 'Please set ANTHROPIC_API_KEY to run these examples',
      example: 'export ANTHROPIC_API_KEY="your-api-key-here"',
    });
    process.exit(1);
  }

  // Run all examples
  logInfo('🚀 Starting all Anthropic SDK examples', { component: 'anthropic-integration-main' });
  basicAnthropicUsage()
    .then(() => anthropicStreamingExample())
    .then(() => anthropicErrorHandlingExample())
    .then(() => anthropicMemoryIntegrationExample())
    .then(() => {
      logInfo('\n🎉 All Anthropic SDK examples completed successfully!', { component: 'anthropic-integration-main' });
    })
    .catch((error) => {
      logError('💥 Example failed', {
        component: 'anthropic-integration-main',
        error: error instanceof Error ? error.message : String(error),
      });
    });
}

export {
  basicAnthropicUsage,
  anthropicStreamingExample,
  anthropicErrorHandlingExample,
  anthropicMemoryIntegrationExample,
};