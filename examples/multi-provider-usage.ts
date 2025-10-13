/**
 * Multi-Provider Usage Example
 *
 * This example demonstrates how to use multiple LLM providers within the same Memori application.
 * It shows provider selection, configuration, and switching between different provider types.
 */

import { Memori, ConfigManager } from '../src/index';
import { LLMProviderFactory } from '../src/core/infrastructure/providers/LLMProviderFactory';
import { ProviderType } from '../src/core/infrastructure/providers/ProviderType';
import { logInfo, logError } from '../src/core/infrastructure/config/Logger';

async function providerCapabilitiesDemo(): Promise<void> {
  logInfo('🔧 Provider Capabilities Demonstration', { component: 'multi-provider-example' });
  logInfo('=====================================', { component: 'multi-provider-example' });

  // Show all registered provider types using the async method
  const registeredProviders = await LLMProviderFactory.getRegisteredProviderTypesAsync();
  logInfo(`📋 Registered provider types: ${registeredProviders.join(', ')}`, {
    component: 'multi-provider-example',
    count: registeredProviders.length,
  });

  if (registeredProviders.length > 0) {
    logInfo('✅ Provider factory is working correctly!', { component: 'multi-provider-example' });

    // Demonstrate provider detection from different configurations
    const configurations = [
      {
        name: 'OpenAI Configuration',
        config: { apiKey: 'sk-1234567890abcdef', baseUrl: 'https://api.openai.com/v1' },
        expectedType: ProviderType.OPENAI,
      },
      {
        name: 'Ollama Configuration',
        config: { apiKey: 'ollama-local', baseUrl: 'http://localhost:11434/v1' },
        expectedType: ProviderType.OLLAMA,
      },
      {
        name: 'Anthropic Configuration',
        config: { apiKey: 'sk-ant-api03-1234567890abcdef', baseUrl: 'https://api.anthropic.com' },
        expectedType: ProviderType.ANTHROPIC,
      },
    ];

    for (const { name, config, expectedType } of configurations) {
      if (LLMProviderFactory.isProviderRegistered(expectedType)) {
        logInfo(`\n✅ ${name}: Provider type '${expectedType}' is registered and available`, {
          component: 'multi-provider-example',
          providerType: expectedType,
        });
      } else {
        logInfo(`\n⚠️  ${name}: Provider type '${expectedType}' is not registered`, {
          component: 'multi-provider-example',
          providerType: expectedType,
        });
      }
    }
  } else {
    logInfo('⚠️  No providers are registered yet. This may be because:', {
      component: 'multi-provider-example',
    });
    logInfo('   • Providers are registered asynchronously on first Memori instantiation', {
      component: 'multi-provider-example',
    });
    logInfo('   • The example runs before providers have finished registering', {
      component: 'multi-provider-example',
    });
  }

  logInfo('\n📋 Supported Provider Types:', { component: 'multi-provider-example' });
  logInfo('   • OpenAI: GPT models with full API compatibility', { component: 'multi-provider-example' });
  logInfo('   • Ollama: Local LLMs with privacy and control', { component: 'multi-provider-example' });
  logInfo('   • Anthropic: Claude models with safety focus', { component: 'multi-provider-example' });

  logInfo('\n🔍 Provider Detection:', { component: 'multi-provider-example' });
  logInfo('   • OpenAI: API keys starting with "sk-"', { component: 'multi-provider-example' });
  logInfo('   • Ollama: Base URL containing "11434" or "localhost"', { component: 'multi-provider-example' });
  logInfo('   • Anthropic: API keys starting with "sk-ant-"', { component: 'multi-provider-example' });
}

async function multiProviderMemoryExample(): Promise<void> {
  logInfo('\n🧠 Multi-Provider Memory Example', { component: 'multi-provider-example' });
  logInfo('==============================', { component: 'multi-provider-example' });

  // Create separate Memori instances with different provider configurations
  const providers = [
    { name: 'OpenAI', config: { apiKey: 'sk-openai123', model: 'gpt-4o-mini', namespace: 'openai-memories' } },
    { name: 'Ollama', config: { apiKey: 'ollama-local', model: 'gpt-oss:20b', baseUrl: 'http://localhost:11434/v1', namespace: 'ollama-memories' } },
  ];

  const memoriInstances: Memori[] = [];

  try {
    // Initialize all provider instances
    for (const { name, config } of providers) {
      logInfo(`🚀 Initializing ${name} provider...`, { component: 'multi-provider-example' });

      const memori = new Memori({
        ...ConfigManager.loadConfig(),
        ...config,
        autoIngest: true, // Enable auto-ingestion for all providers
      });

      await memori.enable();
      memoriInstances.push(memori);

      logInfo(`✅ ${name} provider initialized successfully`, {
        component: 'multi-provider-example',
        namespace: config.namespace,
      });
    }

    // Record conversations with each provider
    const conversations = [
      {
        user: 'What are the advantages of different LLM providers?',
        ai: 'Different LLM providers offer unique advantages: OpenAI excels in general tasks with broad model selection, Ollama provides privacy and local execution, while Anthropic focuses on safety and helpfulness.',
        provider: 'openai',
      },
      {
        user: 'How do I choose the right provider for my use case?',
        ai: 'Choose providers based on your needs: use OpenAI for high-quality general tasks, Ollama for privacy-sensitive local development, and Anthropic when safety and alignment are critical priorities.',
        provider: 'ollama',
      },
    ];

    for (let i = 0; i < conversations.length; i++) {
      const { user, ai, provider } = conversations[i];
      const providerIndex = providers.findIndex(p => p.name.toLowerCase().includes(provider));

      if (providerIndex >= 0) {
        const memori = memoriInstances[providerIndex];
        const chatId = await memori.recordConversation(user, ai, {
          metadata: {
            provider: providers[providerIndex].name,
            conversationIndex: i + 1,
            category: 'provider-comparison',
          },
        });

        logInfo(`💬 Recorded conversation ${i + 1} with ${providers[providerIndex].name}`, {
          component: 'multi-provider-example',
          chatId,
          provider: providers[providerIndex].name,
        });
      }
    }

    // Wait for memory processing
    logInfo('\n⏳ Waiting for memory processing...', { component: 'multi-provider-example' });
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Search memories across all providers
    logInfo('\n🔍 Searching memories across all providers...', { component: 'multi-provider-example' });

    for (let i = 0; i < memoriInstances.length; i++) {
      const memori = memoriInstances[i];
      const providerName = providers[i].name;

      logInfo(`\n📂 Searching in ${providerName} namespace:`, { component: 'multi-provider-example' });

      const memories = await memori.searchMemories('provider', { limit: 3 });

      if (memories.length > 0) {
        logInfo(`✅ Found ${memories.length} provider-related memories in ${providerName}:`, {
          component: 'multi-provider-example',
          provider: providerName,
          count: memories.length,
        });

        memories.forEach((memory, index) => {
          logInfo(`  ${index + 1}. ${memory.content?.substring(0, 100) || 'Memory content'}...`, {
            component: 'multi-provider-example',
            memoryIndex: index + 1,
            provider: providerName,
          });
        });
      } else {
        logInfo(`ℹ️ No memories found in ${providerName} namespace`, {
          component: 'multi-provider-example',
          provider: providerName,
        });
      }
    }

    logInfo('\n🎉 Multi-provider memory example completed successfully!', { component: 'multi-provider-example' });

  } catch (error) {
    logError('❌ Error in multi-provider memory example:', {
      component: 'multi-provider-example',
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    // Clean up all instances
    for (const memori of memoriInstances) {
      try {
        await memori.close();
      } catch (error) {
        logError('❌ Error closing Memori instance:', {
          component: 'multi-provider-example',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}

async function providerSwitchingExample(): Promise<void> {
  logInfo('\n🔄 Provider Switching Example', { component: 'multi-provider-example' });
  logInfo('===========================', { component: 'multi-provider-example' });

  try {
    // Start with OpenAI configuration
    logInfo('🚀 Starting with OpenAI provider...', { component: 'multi-provider-example' });

    const memori = new Memori({
      ...ConfigManager.loadConfig(),
      apiKey: 'sk-openai123',
      model: 'gpt-4o-mini',
      namespace: 'switching-demo',
      autoIngest: true,
    });

    await memori.enable();

    // Record a conversation with OpenAI
    await memori.recordConversation(
      'I am learning about different AI providers and their capabilities.',
      'OpenAI provides powerful language models like GPT-4 that excel at various natural language tasks including conversation, code generation, and creative writing.',
      {
        metadata: {
          provider: 'openai',
          phase: 'initial',
        },
      },
    );

    logInfo('✅ Initial conversation recorded with OpenAI', { component: 'multi-provider-example' });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search memories
    let memories = await memori.searchMemories('AI providers', { limit: 5 });
    logInfo(`📊 Found ${memories.length} memories about AI providers`, {
      component: 'multi-provider-example',
      count: memories.length,
    });

    // Close and restart with Ollama configuration (simulating provider switch)
    await memori.close();

    logInfo('\n🔄 Switching to Ollama provider...', { component: 'multi-provider-example' });

    const ollamaMemori = new Memori({
      ...ConfigManager.loadConfig(),
      apiKey: 'ollama-local',
      model: 'llama2',
      baseUrl: 'http://localhost:11434/v1',
      namespace: 'switching-demo',
      autoIngest: true,
    });

    await ollamaMemori.enable();

    // Record a conversation with Ollama
    await ollamaMemori.recordConversation(
      'I want to learn about local LLMs and their privacy benefits.',
      'Local LLMs like those run through Ollama offer significant privacy advantages since all processing happens on your local machine without sending data to external servers.',
      {
        metadata: {
          provider: 'ollama',
          phase: 'switched',
        },
      },
    );

    logInfo('✅ Conversation recorded with Ollama after provider switch', { component: 'multi-provider-example' });

    // Search memories in the same namespace (should include both providers' memories)
    memories = await ollamaMemori.searchMemories('privacy', { limit: 5 });
    logInfo(`📊 Found ${memories.length} memories about privacy`, {
      component: 'multi-provider-example',
      count: memories.length,
    });

    await ollamaMemori.close();

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
    await providerCapabilitiesDemo();
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for provider registration
    await multiProviderMemoryExample();
    await providerSwitchingExample();

    logInfo('\n🎉 All multi-provider examples completed successfully!', { component: 'multi-provider-example' });
    logInfo('\n💡 Key Takeaways:', { component: 'multi-provider-example' });
    logInfo('   • Multiple providers can be used simultaneously in the same application', { component: 'multi-provider-example' });
    logInfo('   • Each provider can maintain separate namespaces for organized memory', { component: 'multi-provider-example' });
    logInfo('   • Provider switching is seamless and maintains memory continuity', { component: 'multi-provider-example' });
    logInfo('   • The provider factory handles configuration and instantiation automatically', { component: 'multi-provider-example' });

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