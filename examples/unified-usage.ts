/**
 * Memori API Usage Examples
 *
 * This file demonstrates the unified Memori API with comprehensive configuration options.
 * Maximum flexibility with full configuration control for all use cases.
 */

import {
  Memori,
  OpenAIWrapper,
  AnthropicWrapper,
  OllamaWrapper,
  validateConfig,
  detectProvider
} from '../src/index';

/**
 * Basic usage - stupid simple
 */
async function basicUsage() {
  console.log('🚀 Basic Memori Usage\n================');

  // 1. Create Memori instance with full configuration
  const memori = new Memori({
    databaseUrl: 'file://memori.db',
    namespace: 'my-app',
    apiKey: 'sk-your-openai-key',
    model: 'gpt-4o-mini',
    autoIngest: true,
    consciousIngest: false,
    enableRelationshipExtraction: true
  });

  // 2. Wrap with provider (direct integration)
  const openai = new OpenAIWrapper(memori);

  // 3. Use normally (memory is automatic)
  const response = await openai.chat({
    messages: [
      { role: 'user', content: 'Hello! Remember that I like cats.' },
    ]
  });

  console.log('💬 Chat response:', response.content);
  console.log('🆔 Chat ID for memory:', response.chatId);

  // 4. Search memories (same Memori instance)
  const memories = await memori.searchMemories('cats');
  console.log(`📚 Found ${memories.length} memories about cats`);

  await memori.close();
}

/**
 * Multiple providers, same Memori instance
 */
async function multiProviderUsage() {
  console.log('\n🔄 Multiple Providers\n===================');

  // Same Memori instance, different wrappers
  const memori = new Memori({
    databaseUrl: 'postgresql://localhost:5432/memori',
    namespace: 'multi-provider-app',
    apiKey: 'sk-your-key',
    model: 'gpt-4o-mini',
    autoIngest: true,
    consciousIngest: false,
    enableRelationshipExtraction: true
  });

  const openai = new OpenAIWrapper(memori);
  const anthropic = new AnthropicWrapper(memori);

  // Both record to the same memory pool
  await openai.chat({
    messages: [{ role: 'user', content: 'I am learning about AI providers' }]
  });

  await anthropic.chat({
    messages: [{ role: 'user', content: 'Claude is great for safety' }]
  });

  const allMemories = await memori.searchMemories('AI');
  console.log(`📚 Total memories about AI: ${allMemories.length}`);

  await memori.close();
}

/**
 * Local development with Ollama
 */
async function localDevelopment() {
  console.log('\n🏠 Local Development\n===================');

  // Local setup with full configuration
  const memori = new Memori({
    databaseUrl: 'sqlite:./local.db',
    namespace: 'local-dev',
    apiKey: 'ollama-local',
    model: 'llama2',
    baseUrl: 'http://localhost:11434',
    autoIngest: true,
    consciousIngest: false,
    enableRelationshipExtraction: true
  });

  const ollama = new OllamaWrapper(memori);

  const response = await ollama.chat({
    messages: [{ role: 'user', content: 'Explain quantum computing simply' }]
  });

  console.log('🤖 Ollama response:', response.content);

  await memori.close();
}

/**
 * Configuration validation example
 */
function configurationExamples() {
  console.log('\n⚙️ Configuration Examples\n========================');

  // Valid configuration
  const validConfig = {
    databaseUrl: 'postgresql://localhost:5432/memori',
    namespace: 'my-app',
    apiKey: 'sk-your-key',
    model: 'gpt-4o-mini',
    autoIngest: true,
    consciousIngest: false,
    enableRelationshipExtraction: true
  };

  const validation = validateConfig(validConfig);
  console.log('✅ Valid config:', validation.isValid);

  // Provider detection
  const provider = detectProvider('sk-ant-api03-your-anthropic-key');
  console.log('🔍 Detected provider:', provider);

  // Invalid configuration example
  const invalidConfig = {
    databaseUrl: 'postgresql://localhost:5432/memori',
    namespace: 'my-app',
    apiKey: 'sk-your-key',
    model: 'gpt-4o-mini',
    autoIngest: true,
    consciousIngest: false,
    enableRelationshipExtraction: true
  };

  const invalidValidation = validateConfig(invalidConfig);
  console.log('❌ Invalid config errors:', invalidValidation.errors);
}

/**
 * Advanced usage patterns
 */
async function advancedUsage() {
  console.log('\n🎛️ Advanced Usage\n=================');

  const memori = new Memori({
    databaseUrl: 'postgresql://localhost:5432/memori',
    namespace: 'advanced-app',
    apiKey: 'sk-your-key',
    model: 'gpt-4',
    autoIngest: true,
    consciousIngest: false,
    enableRelationshipExtraction: true
  });

  const openai = new OpenAIWrapper(memori, {
    temperature: 0.7,
    maxTokens: 1000
  });

  // Use with custom parameters
  const response = await openai.chat({
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: 'Explain the unified Memori API' }
    ],
    temperature: 0.5,
    maxTokens: 500
  });

  console.log('🎯 Response with custom params:', response.content);

  await memori.close();
}

/**
 * Error handling examples
 */
async function errorHandling() {
  console.log('\n🚨 Error Handling\n=================');

  try {
    // This will fail with helpful error messages
    const memori = new Memori({
      databaseUrl: 'invalid-url',
      namespace: 'test',
      apiKey: 'sk-test',
      model: 'gpt-4o-mini',
      autoIngest: true,
      consciousIngest: false,
      enableRelationshipExtraction: true
    });

    await memori.enable();
  } catch (error) {
    console.log('💥 Expected error:', error instanceof Error ? error.message : String(error));
  }
}

/**
 * Main demo function
 */
async function main() {
   console.log('🎉 Memori API Demonstration');
   console.log('============================\n');

  try {
    await basicUsage();
    await multiProviderUsage();
    await localDevelopment();
    configurationExamples();
    await advancedUsage();
    await errorHandling();

    console.log('\n🎊 Demo completed successfully!');
    console.log('\n💡 Key Takeaways:');
    console.log('   • Single, unified configuration interface');
    console.log('   • Provider wrappers integrate directly with Memori');
    console.log('   • Memory recording happens automatically');
    console.log('   • Full configuration flexibility for all use cases');
    console.log('   • Helpful validation and error messages');

  } catch (error) {
    console.error('❌ Demo failed:', error instanceof Error ? error.message : String(error));
  }
}

// Run the demo
main().catch(console.error);