# Multi-Provider Integration Guide

This guide explains how to integrate Memorits with multiple LLM providers (OpenAI, Anthropic, Ollama) using both drop-in replacement patterns and the provider factory system, enabling automatic memory recording with zero code changes.

## Overview

Memorits provides **zero breaking changes** drop-in replacements and provider factory patterns that automatically record conversations and enable intelligent memory retrieval across multiple LLM providers including OpenAI, Anthropic, and Ollama.

## Quick Integration (30 seconds)

### 1. Replace OpenAI Import

```typescript
// Before (standard OpenAI)
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// After (MemoriOpenAI drop-in)
import { MemoriOpenAI } from 'memorits/integrations/openai-dropin/client';
const client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  autoInitialize: true
});
```

### 2. Use Normally

```typescript
// Same API, now with memory!
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }]
});

// Access memory functionality
const memories = await client.memory.searchMemories('important information');
```

### 3. Multi-Provider Setup

```typescript
import { LLMProviderFactory, ProviderType } from '@memori/providers';

// Create multiple providers with shared memory
const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini'
});

const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022'
});

// Use different providers - all share the same memory system
const openaiResponse = await openaiProvider.chat.completions.create({...});
const anthropicResponse = await anthropicProvider.chat.completions.create({...});

// Search across all conversations regardless of provider
const allMemories = await openaiProvider.memory.searchMemories('cross-provider context');
```

## Integration Patterns

### Pattern 1: Drop-in Replacement (OpenAI Compatible)

#### Simple Constructor (Most Common)

```typescript
import { MemoriOpenAIClient } from 'memorits';

// Simple replacement - existing code works unchanged
const client = new MemoriOpenAIClient('your-api-key', {
  enableChatMemory: true,
  autoInitialize: true
});

// Use exactly like OpenAI client
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello, remember this!' }]
});

// Memory automatically recorded
const memories = await client.memory.searchMemories('Hello');
```

### Pattern 2: Configuration Object Constructor

```typescript
// Alternative constructor with configuration object
const client = new MemoriOpenAIClient({
  apiKey: 'your-api-key',
  baseURL: 'https://api.openai.com/v1',
  enableChatMemory: true,
  autoInitialize: true,
  namespace: 'my-app'
});
```

### Pattern 2: Provider Factory (Multi-Provider Support)

```typescript
import { LLMProviderFactory, ProviderType } from '@memori/providers';

// Create OpenAI provider with memory
const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  enableMemory: true,
  memoryConfig: {
    databaseUrl: 'sqlite:./memories.db',
    namespace: 'my-app'
  }
});

// Create Anthropic provider with shared memory
const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  enableMemory: true,
  memoryConfig: {
    databaseUrl: 'sqlite:./memories.db', // Same database for shared memory
    namespace: 'my-app'
  }
});

// Use providers with unified interface
const openaiResponse = await openaiProvider.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello from OpenAI!' }]
});

const anthropicResponse = await anthropicProvider.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello from Anthropic!' }]
});

// Search across all conversations
const memories = await openaiProvider.memory.searchMemories('cross-provider context');
```

### Pattern 3: Mixed Integration (Drop-in + Factory)

```typescript
// Use drop-in for existing OpenAI code
const openaiClient = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  autoInitialize: true
});

// Use factory for additional providers
const ollamaProvider = await LLMProviderFactory.createProvider(ProviderType.OLLAMA, {
  baseUrl: 'http://localhost:11434',
  model: 'llama2:7b',
  enableMemory: true,
  memoryConfig: {
    databaseUrl: 'sqlite:./memories.db',
    namespace: 'my-app'
  }
});

// All providers share the same memory system
const memories = await openaiClient.memory.searchMemories('unified context');
```

## Memory-Enhanced Conversations

### Automatic Memory Recording

```typescript
// Conversations are automatically recorded
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'I am a software engineer specializing in AI' }
  ]
});

// Memory is automatically created and processed
// - Conversation is stored in database
// - Memory is classified and indexed
// - Context is available for future queries
```

### Context-Aware Responses

```typescript
// Ask about previously discussed topics
const followUpResponse = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'What did I say about my specialization?' }
  ]
});

// AI can access previous conversation context
// - Automatic memory retrieval
// - Context injection into conversation
// - Intelligent response generation
```

### Multi-Turn Context Preservation

```typescript
// Context is maintained across conversation turns
const conversation = [
  { role: 'user' as const, content: 'I need help with TypeScript interfaces' },
  { role: 'assistant' as const, content: 'I can help with TypeScript interfaces...' },
  { role: 'user' as const, content: 'Can you show me an example?' }
];

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: conversation
});

// All conversation turns are recorded
// Context is available for future reference
const relatedMemories = await client.memory.searchMemories('TypeScript interfaces');
```

## Advanced Integration Features

### Streaming with Memory

```typescript
const stream = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Tell me a long story...' }],
  stream: true
});

let fullContent = '';
for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || '';
  fullContent += content;
  process.stdout.write(content); // Your streaming logic here
}

// Memory is automatically recorded when streaming completes
console.log(`\n\nMemory recorded: ${fullContent.length} characters`);
```

### Memory Search Integration

```typescript
// Direct access to memory functionality
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true
});

// Search memories directly
const relevantMemories = await client.memory.searchMemories('previous discussion', {
  limit: 5,
  minImportance: 'high'
});

// Use memories to enhance responses
const context = relevantMemories.map(m => m.content).join('\n');
const enhancedPrompt = `Context: ${context}\n\nUser: ${userMessage}`;

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: enhancedPrompt }]
});
```

### Error Handling

```typescript
// Memory errors don't break OpenAI functionality
try {
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'Hello!' }]
  });

  console.log('Response:', response.choices[0].message.content);
} catch (error) {
  // OpenAI errors are preserved exactly as they would be
  // Memory recording errors are logged but don't affect the response
  console.error('OpenAI error:', error);
}
```

## Configuration Options

### MemoriOpenAIConfig Interface

```typescript
interface MemoriOpenAIConfig {
  // Core functionality
  enableChatMemory?: boolean;           // Enable chat memory recording
  enableEmbeddingMemory?: boolean;      // Enable embedding memory recording

  // Initialization
  autoInitialize?: boolean;             // Auto-create Memori instance
  namespace?: string;                   // Memory namespace

  // Memory modes
  autoIngest?: boolean;                 // Auto vs conscious ingestion
  consciousIngest?: boolean;            // Enable conscious processing

  // OpenAI client options (passed through)
  apiKey?: string;                      // Override API key
  baseUrl?: string;                     // Override base URL
  organization?: string;                // Organization ID
  project?: string;                     // Project ID
  timeout?: number;                     // Request timeout
  maxRetries?: number;                  // Maximum retries
  defaultHeaders?: Record<string, string>; // Default headers
}
```

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1

# Memory Configuration
DATABASE_URL=sqlite:./memories.db
MEMORI_NAMESPACE=default
MEMORI_AUTO_INGEST=true
MEMORI_CONSCIOUS_INGEST=false
MEMORI_ENABLE_RELATIONSHIP_EXTRACTION=true
MEMORI_MODEL=gpt-4o-mini
```

## Memory Modes in OpenAI Integration

### Auto-Ingestion Mode

```typescript
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  memoryProcessingMode: 'auto',
  autoIngest: true,
  consciousIngest: false
});

// Every API call triggers:
// 1. Conversation recording
// 2. Memory processing and classification
// 3. Dynamic context retrieval for next call
// 4. Automatic memory search and injection
```

### Conscious Processing Mode

```typescript
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  memoryProcessingMode: 'conscious',
  autoIngest: false,
  consciousIngest: true
});

// Features:
// 1. Background memory analysis
// 2. One-shot context injection at startup
// 3. Permanent working memory
// 4. Human-like memory reflection
```

### Combined Mode

```typescript
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  memoryProcessingMode: 'auto',
  autoIngest: true,
  consciousIngest: true
});

// Maximum intelligence:
// 1. Both dynamic and persistent memory
// 2. Real-time context + background learning
// 3. Immediate response + long-term retention
```

## Real-World Examples

### 1. Chatbot with Memory

```typescript
class MemoryEnabledChatbot {
  private client: MemoriOpenAI;

  constructor() {
    this.client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
      enableChatMemory: true,
      autoInitialize: true,
      memoryProcessingMode: 'auto'
    });
  }

  async chat(message: string, sessionId: string) {
    // Get AI response with automatic memory
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: message }]
    });

    // Record conversation for future context
    await this.client.memory.recordConversation(
      message,
      response.choices[0].message.content,
      'gpt-4o-mini',
      { sessionId }
    );

    return response.choices[0].message.content;
  }

  async searchHistory(query: string) {
    return this.client.memory.searchMemories(query, {
      limit: 10,
      includeMetadata: true
    });
  }
}
```

### 2. AI Assistant with Context

```typescript
class ContextAwareAssistant {
  async answerWithContext(question: string) {
    // Search for relevant context
    const context = await this.client.memory.searchMemories(question, {
      limit: 3,
      minImportance: 'medium'
    });

    // Build context-enhanced prompt
    const contextText = context.map(c => c.content).join('\n');
    const prompt = `Previous context:\n${contextText}\n\nQuestion: ${question}`;

    // Get response with context
    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    });

    return response.choices[0].message.content;
  }
}
```

### 3. Code Assistant with Learning

```typescript
class LearningCodeAssistant {
  async helpWithCode(problem: string, language: string) {
    // Search for similar problems and solutions
    const similarSolutions = await this.client.memory.searchMemories(
      `${language} ${problem}`,
      {
        categories: ['reference', 'essential'],
        minImportance: 'high',
        limit: 5
      }
    );

    // Include relevant examples in prompt
    const examples = similarSolutions.map(s => s.content).join('\n');
    const prompt = `Previous similar solutions:\n${examples}\n\nCurrent problem: ${problem}`;

    const response = await this.client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }]
    });

    return response.choices[0].message.content;
  }
}
```

## Getting Started with Multi-Provider Integration

### Step 1: Install Memorits

```bash
npm install memorits
```

### Step 2: Choose Your Integration Pattern

#### Option A: Drop-in Replacement (OpenAI Compatible)

```typescript
import { MemoriOpenAI } from 'memorits';

const client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  autoInitialize: true
});
```

#### Option B: Provider Factory (Multi-Provider Support)

```typescript
import { LLMProviderFactory, ProviderType } from '@memori/providers';

const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  enableMemory: true
});

const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  enableMemory: true
});
```

### Step 3: Use Memory Features

```typescript
// Search across all conversations (works with both patterns)
const relevantMemories = await client.memory.searchMemories('previous work');
const context = relevantMemories.map(m => m.content).join('\n');

// Use context in prompts
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'system', content: `Context: ${context}` },
    { role: 'user', content: userMessage }
  ]
});

// Multi-provider usage
const openaiResponse = await openaiProvider.chat.completions.create({...});
const anthropicResponse = await anthropicProvider.chat.completions.create({...});
```

## Troubleshooting

### Common Integration Issues

**"MemoriOpenAI is not a constructor"**
```typescript
// Make sure you're importing correctly
import { MemoriOpenAI } from 'memorits';  // ✅ Correct
// import Memorits from 'memorits';        // ❌ Wrong
```

**"Memory not being recorded"**
```typescript
// Ensure memory is enabled
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,  // ✅ Enable memory
  autoInitialize: true     // ✅ Auto-initialize
});
```

**"Search returns empty results"**
```typescript
// Wait for processing and check configuration
setTimeout(async () => {
  const memories = await client.memory.searchMemories('test', {
    limit: 100,  // Increase limit
    minImportance: 'low'  // Lower threshold
  });
  console.log('Found memories:', memories.length);
}, 5000);
```

## Performance Optimization

### Streaming Optimization

```typescript
// Optimize for streaming applications
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  bufferTimeout: 5000,      // Shorter buffer for faster recording
  maxBufferSize: 10000,     // Smaller buffer for memory efficiency
  memoryProcessingMode: 'auto'  // Real-time processing
});
```

### Memory-Efficient Configuration

```typescript
// Optimize memory usage
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  minImportanceLevel: 'medium',  // Only process important memories
  maxMemoryAge: 30,              // Auto-cleanup old memories
  enableCache: true              // Cache search results
});
```

This integration approach makes it incredibly easy to add sophisticated memory capabilities to existing LLM applications with minimal code changes and maximum benefit.

## Related Documentation

- **[Provider Documentation](../providers/)** - Complete guides for OpenAI, Anthropic, Ollama, and custom providers
- **[Core API Reference](../api/core-api.md)** - Main Memori class and memory management APIs
- **[Examples](../../../examples/)** - Real-world usage examples and demos