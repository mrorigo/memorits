// src/integrations/openai-dropin/example.ts
// Example usage of MemoriOpenAI as a drop-in replacement for OpenAI SDK
// Demonstrates all initialization patterns and basic usage

import {
  MemoriOpenAIFromConfig,
  MemoriOpenAIFromEnv,
  MemoriOpenAIFromDatabase,
} from './index';
import MemoriOpenAI from './index';

/**
 * Example 1: Simple drop-in replacement (most common use case)
 * Replace OpenAI import with MemoriOpenAI - no other code changes needed!
 */
async function basicDropInExample() {
  console.log('=== Basic Drop-in Example ===');

  // Pattern 1: Traditional configuration object (current pattern)
  const client = new MemoriOpenAI('your-api-key', {
    enableChatMemory: true,
    autoInitialize: true,
    baseUrl: 'https://api.openai.com/v1', // Supports baseURL option
  });

  try {
    // Use exactly like OpenAI client - memory recording happens automatically
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'Hello! Remember this conversation for later.' },
      ],
    });

    console.log('Response:', response.choices[0]?.message?.content);

    // Memory was automatically recorded - you can search it
    const memories = await client.memory.searchMemories('Hello');
    console.log('Found memories:', memories.length);

    await client.close();
  } catch (error) {
    console.error('Error in basic example:', error);
  }
}

/**
 * Example 2: Environment-based configuration
 * Configure everything through environment variables
 */
async function environmentExample() {
  console.log('=== Environment Configuration Example ===');

  // Set environment variables (in real usage, these would be set in your environment)
  process.env.OPENAI_API_KEY = 'your-api-key';
  process.env.MEMORI_DATABASE_URL = 'sqlite:./memori-env.db';
  process.env.MEMORI_NAMESPACE = 'env-session';
  process.env.MEMORI_AUTO_INGEST = 'true';
  process.env.MEMORI_PROCESSING_MODE = 'auto';

  try {
    const client = await MemoriOpenAIFromEnv('your-api-key', {
      enableChatMemory: true,
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'This is configured via environment variables!' },
      ],
    });

    console.log('Response:', response.choices[0]?.message?.content);
    await client.close();
  } catch (error) {
    console.error('Error in environment example:', error);
  }
}

/**
 * Example 3: Database URL configuration
 * Specify a custom database location
 */
async function databaseExample() {
  console.log('=== Database URL Configuration Example ===');

  try {
    const client = await MemoriOpenAIFromDatabase(
      'your-api-key',
      'sqlite:./custom-memori.db',
      {
        enableChatMemory: true,
        namespace: 'custom-session',
        memoryProcessingMode: 'conscious',
      },
    );

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'This conversation is stored in a custom database!' },
      ],
    });

    console.log('Response:', response.choices[0]?.message?.content);
    await client.close();
  } catch (error) {
    console.error('Error in database example:', error);
  }
}

/**
 * Example 4: Advanced configuration
 * Full control over all memory settings
 */
async function advancedExample() {
  console.log('=== Advanced Configuration Example ===');

  try {
    const client = await MemoriOpenAIFromConfig('your-api-key', {
      enableChatMemory: true,
      enableEmbeddingMemory: false,
      memoryProcessingMode: 'auto',
      databaseConfig: {
        type: 'sqlite',
        url: 'sqlite:./advanced-memori.db',
        namespace: 'advanced-session',
      },
      autoIngest: true,
      consciousIngest: false,
      minImportanceLevel: 'medium' as any,
      maxMemoryAge: 30, // Keep memories for 30 days
      bufferTimeout: 15000, // 15 second streaming timeout
      debugMode: true,
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'This is an advanced configuration example!' },
      ],
    });

    console.log('Response:', response.choices[0]?.message?.content);

    // Check memory statistics
    const stats = await client.memory.getMemoryStats();
    console.log('Memory stats:', stats);

    await client.close();
  } catch (error) {
    console.error('Error in advanced example:', error);
  }
}

/**
 * Example 5: Migration from existing OpenAI code
 * How to migrate existing code with minimal changes
 */
async function migrationExample() {
  console.log('=== Migration Example ===');

  // BEFORE (existing OpenAI code):
  /*
  import OpenAI from 'openai';
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello!' }]
  });
  */

  // AFTER (just change the import and constructor):
  const client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
    enableChatMemory: true,
    autoInitialize: true,
  });

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Hello! This is migrated code!' }],
    });

    console.log('Migrated response:', response.choices[0]?.message?.content);
    await client.close();
  } catch (error) {
    console.error('Error in migration example:', error);
  }
}

/**
 * Example 6: Error handling and recovery
 * Demonstrates graceful error handling
 */
async function errorHandlingExample() {
  console.log('=== Error Handling Example ===');

  try {
    const client = new MemoriOpenAI('invalid-api-key', {
      enableChatMemory: true,
    });

    // This will fail with authentication error
    await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'This will fail' }],
    });
  } catch (error) {
    console.log('Expected error caught:', error instanceof Error ? error.message : String(error));

    // Memory recording errors don't break the main functionality
    // The OpenAI error is preserved exactly as it would be
  }
}

/**
 * Example 7: OpenAI SDK pattern with baseURL
 * Use the exact same pattern as OpenAI SDK
 */
async function openaiSDKPatternExample() {
  console.log('=== OpenAI SDK Pattern Example ===');

  try {
    // Pattern 2: OpenAI SDK style constructor with baseURL support
    const client = new MemoriOpenAI({
      apiKey: 'your-api-key',
      baseURL: 'https://api.openai.com/v1', // Direct baseURL support
      organization: 'your-org-id',
      project: 'your-project-id',
      enableChatMemory: true,
      autoInitialize: true,
    });

    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'This uses the OpenAI SDK pattern with baseURL!' },
      ],
    });

    console.log('SDK Pattern Response:', response.choices[0]?.message?.content);
    await client.close();
  } catch (error) {
    console.error('Error in OpenAI SDK pattern example:', error);
  }
}

/**
 * Example 8: Memory search and retrieval
 * How to search and use stored memories
 */
async function memorySearchExample() {
  console.log('=== Memory Search Example ===');

  try {
    const client = new MemoriOpenAI('your-api-key', {
      enableChatMemory: true,
      autoInitialize: true,
    });

    // Have a conversation to create memories
    await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'My name is Alice and I love TypeScript programming.' },
      ],
    });

    await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: 'I work on AI projects and enjoy reading sci-fi books.' },
      ],
    });

    // Search for memories
    const memories = await client.memory.searchMemories('Alice', {
      limit: 5,
      minImportance: 'medium' as any,
    });

    console.log(`Found ${memories.length} memories about Alice:`);
    memories.forEach((memory, index) => {
      console.log(`${index + 1}. ${memory.content.substring(0, 100)}...`);
    });

    // Search for programming-related memories
    const programmingMemories = await client.memory.searchMemories('programming');
    console.log(`Found ${programmingMemories.length} programming-related memories`);

    await client.close();
  } catch (error) {
    console.error('Error in memory search example:', error);
  }
}

/**
 * Run all examples (for demonstration purposes)
 * In real usage, you would only run the examples you need
 */
export async function runAllExamples() {
  console.log('Starting MemoriOpenAI Examples...\n');

  try {
    await basicDropInExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await openaiSDKPatternExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await environmentExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await databaseExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await advancedExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await migrationExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await memorySearchExample();
    console.log('\n' + '='.repeat(50) + '\n');

    await errorHandlingExample();
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Export individual examples for selective usage
export {
  basicDropInExample,
  openaiSDKPatternExample,
  environmentExample,
  databaseExample,
  advancedExample,
  migrationExample,
  errorHandlingExample,
  memorySearchExample,
};

// If this file is run directly, execute all examples
if (require.main === module) {
  runAllExamples().catch(console.error);
}