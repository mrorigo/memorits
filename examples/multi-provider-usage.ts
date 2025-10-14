/**
 * Multi-Provider Usage Example
 *
 * This example demonstrates how to use multiple LLM providers within the same Memori application.
 * The unified API makes multi-provider usage simple and intuitive.
 */

import { Memori, OpenAIWrapper, AnthropicWrapper, OllamaWrapper } from '../src/index';
import { logInfo, logError } from '../src/core/infrastructure/config/Logger';

async function multiProviderDemo(): Promise<void> {
  logInfo('🔧 Multi-Provider Capabilities Demo', { component: 'multi-provider-example' });
  logInfo('=====================================', { component: 'multi-provider-example' });

  // Same Memori instance, different provider wrappers
  const memori = new Memori({
    databaseUrl: 'sqlite:./multi-provider.db',
    namespace: 'multi-provider-demo',
    apiKey: 'your-api-key',
    model: 'gpt-4o-mini',
    autoIngest: true,
    consciousIngest: false,
    enableRelationshipExtraction: true
  });

  const openai = new OpenAIWrapper(memori);
  const anthropic = new AnthropicWrapper(memori);
  const ollama = new OllamaWrapper(memori);

  logInfo('✅ All provider wrappers created successfully', { component: 'multi-provider-example' });

  logInfo('\n📋 Supported Provider Types:', { component: 'multi-provider-example' });
  logInfo('   • OpenAI: GPT models with memory integration', { component: 'multi-provider-example' });
  logInfo('   • Anthropic: Claude models with memory integration', { component: 'multi-provider-example' });
  logInfo('   • Ollama: Local LLMs with memory integration', { component: 'multi-provider-example' });

  // Demonstrate conversations with different providers
  logInfo('\n💬 Testing conversations with all providers...', { component: 'multi-provider-example' });

  const openaiResponse = await openai.chat({
    messages: [{ role: 'user', content: 'Hello from OpenAI!' }]
  });
  logInfo(`✅ OpenAI conversation recorded: ${openaiResponse.chatId}`, {
    component: 'multi-provider-example',
    chatId: openaiResponse.chatId
  });

  const claudeResponse = await anthropic.chat({
    messages: [{ role: 'user', content: 'Hello from Claude!' }]
  });
  logInfo(`✅ Claude conversation recorded: ${claudeResponse.chatId}`, {
    component: 'multi-provider-example',
    chatId: claudeResponse.chatId
  });

  const ollamaResponse = await ollama.chat({
    messages: [{ role: 'user', content: 'Hello from Ollama!' }]
  });
  logInfo(`✅ Ollama conversation recorded: ${ollamaResponse.chatId}`, {
    component: 'multi-provider-example',
    chatId: ollamaResponse.chatId
  });

  await memori.close();
}

async function sharedMemoryExample(): Promise<void> {
  logInfo('\n🧠 Shared Memory Example', { component: 'multi-provider-example' });
  logInfo('========================', { component: 'multi-provider-example' });

  // Single Memori instance shared across multiple providers
  const memori = new Memori({
    databaseUrl: 'sqlite:./shared-memory.db',
    namespace: 'shared-memory-demo',
    apiKey: 'your-api-key',
    model: 'gpt-4o-mini',
    autoIngest: true,
    consciousIngest: false,
    enableRelationshipExtraction: true
  });

  const openai = new OpenAIWrapper(memori);
  const anthropic = new AnthropicWrapper(memori);

  try {
    logInfo('🚀 Recording conversations with different providers...', { component: 'multi-provider-example' });

    // Record conversations with different providers (same memory pool)
    const openaiResponse = await openai.chat({
      messages: [
        { role: 'user', content: 'I am learning about different AI providers and their strengths.' }
      ]
    });

    const claudeResponse = await anthropic.chat({
      messages: [
        { role: 'user', content: 'Claude is great for safety and helpfulness.' }
      ]
    });

    logInfo(`✅ OpenAI conversation: ${openaiResponse.chatId}`, { component: 'multi-provider-example' });
    logInfo(`✅ Claude conversation: ${claudeResponse.chatId}`, { component: 'multi-provider-example' });

    // Wait for memory processing
    logInfo('\n⏳ Waiting for memory processing...', { component: 'multi-provider-example' });
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search memories across all providers (shared memory pool)
    logInfo('\n🔍 Searching shared memory pool...', { component: 'multi-provider-example' });

    const memories = await memori.searchMemories('AI providers', { limit: 5 });

    if (memories.length > 0) {
      logInfo(`✅ Found ${memories.length} memories across all providers:`, {
        component: 'multi-provider-example',
        count: memories.length,
      });

      memories.forEach((memory, index) => {
        logInfo(`  ${index + 1}. ${memory.content?.substring(0, 100) || 'Memory content'}...`, {
          component: 'multi-provider-example',
          memoryIndex: index + 1,
        });
      });
    } else {
      logInfo('ℹ️ No memories found in shared pool', { component: 'multi-provider-example' });
    }

    logInfo('\n🎉 Shared memory example completed successfully!', { component: 'multi-provider-example' });

  } catch (error) {
    logError('❌ Error in shared memory example:', {
      component: 'multi-provider-example',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await memori.close();
  }
}

async function providerSwitchingExample(): Promise<void> {
  logInfo('\n🔄 Provider Switching Example', { component: 'multi-provider-example' });
  logInfo('===========================', { component: 'multi-provider-example' });

  try {
    // Start with OpenAI
    logInfo('🚀 Starting with OpenAI provider...', { component: 'multi-provider-example' });

    const memori = new Memori({
      databaseUrl: 'sqlite:./switching-demo.db',
      namespace: 'switching-demo',
      apiKey: 'sk-openai-key',
      model: 'gpt-4o-mini',
      autoIngest: true,
      consciousIngest: false,
      enableRelationshipExtraction: true
    });

    const openai = new OpenAIWrapper(memori);

    // Record a conversation with OpenAI
    const openaiResponse = await openai.chat({
      messages: [
        { role: 'user', content: 'I am learning about different AI providers and their capabilities.' }
      ]
    });

    logInfo('✅ Initial conversation recorded with OpenAI', {
      component: 'multi-provider-example',
      chatId: openaiResponse.chatId
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search memories
    let memories = await memori.searchMemories('AI providers', { limit: 5 });
    logInfo(`📊 Found ${memories.length} memories about AI providers`, {
      component: 'multi-provider-example',
      count: memories.length,
    });

    // Switch to Ollama with same Memori instance
    logInfo('\n🔄 Switching to Ollama provider (same memory)...', { component: 'multi-provider-example' });

    const ollama = new OllamaWrapper(memori);

    // Record a conversation with Ollama (same memory namespace)
    const ollamaResponse = await ollama.chat({
      messages: [
        { role: 'user', content: 'I want to learn about local LLMs and their privacy benefits.' }
      ]
    });

    logInfo('✅ Conversation recorded with Ollama', {
      component: 'multi-provider-example',
      chatId: ollamaResponse.chatId
    });

    // Search memories in the same namespace (includes both providers)
    memories = await memori.searchMemories('privacy', { limit: 5 });
    logInfo(`📊 Found ${memories.length} memories about privacy`, {
      component: 'multi-provider-example',
      count: memories.length,
    });

    await memori.close();

    logInfo('🎉 Provider switching example completed successfully!', { component: 'multi-provider-example' });

  } catch (error) {
    logError('❌ Error in provider switching example:', {
      component: 'multi-provider-example',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function main(): Promise<void> {
  logInfo('🚀 Memori Multi-Provider Examples', { component: 'multi-provider-example' });
  logInfo('=================================\n', { component: 'multi-provider-example' });

  try {
    await multiProviderDemo();
    await sharedMemoryExample();
    await providerSwitchingExample();

    logInfo('\n🎉 All multi-provider examples completed successfully!', { component: 'multi-provider-example' });
    logInfo('\n💡 Key Takeaways:', { component: 'multi-provider-example' });
    logInfo('   • Multiple providers can be used with the same Memori instance', { component: 'multi-provider-example' });
    logInfo('   • All providers share the same memory pool for unified search', { component: 'multi-provider-example' });
    logInfo('   • Provider switching is seamless with direct wrapper integration', { component: 'multi-provider-example' });
    logInfo('   • Simple configuration makes multi-provider setup effortless', { component: 'multi-provider-example' });

  } catch (error) {
    logError('❌ Error in multi-provider examples:', {
      component: 'multi-provider-example',
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logError('Unhandled Rejection at:', { component: 'multi-provider-example', promise, reason });
});

// Run the examples
main().catch((error) => {
  logError('Unhandled error in multi-provider example', {
    component: 'multi-provider-example',
    error: error instanceof Error ? error.message : String(error),
  });
});