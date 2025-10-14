# Multi-Provider Integration Guide

This guide explains how to integrate Memorits with multiple LLM providers (OpenAI, Anthropic, Ollama) using both drop-in replacement patterns and the provider factory system, featuring **AI-powered memory processing** with zero code changes.

## Overview

Memorits provides **zero breaking changes** drop-in replacements and provider factory patterns that automatically record conversations and enable intelligent memory retrieval across multiple LLM providers including OpenAI, Anthropic, and Ollama.

### 🧠 **Sophisticated Memory Processing**

The MemoryAgent architecture provides sophisticated AI-powered memory processing capabilities across all LLM providers.

**Core AI-Powered Features:**
- **🤖 LLM-Powered Classification**: Automatic categorization using AI analysis
- **⭐ Intelligent Importance Scoring**: Dynamic importance assessment based on content analysis
- **🏷️ Entity Extraction**: Automated extraction of key entities, concepts, and relationships
- **🔗 Relationship Detection**: Smart identification of memory connections and dependencies
- **📊 Advanced Analytics**: Rich metadata and contextual insights for every memory

## Quick Integration (30 seconds)

### 1. Replace OpenAI Import

```typescript
// Before (standard OpenAI)
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// After (MemoriOpenAI drop-in with AI-powered MemoryAgent)
import { MemoriOpenAI } from 'memorits/integrations/openai-dropin/client';
const client = new MemoriOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app-session'
  }
});
```

### 2. Use Normally - Now with AI-Powered Memory Processing

```typescript
// Same API, now with sophisticated AI-powered memory!
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Remember this for later...' }]
});

// Memory automatically processed with AI analysis:
// 🤖 Classification: Automatically categorized as 'essential' or 'contextual'
// ⭐ Importance Scoring: AI determines 'high', 'medium', or 'low' importance
// 🏷️ Entity Extraction: Key entities, concepts extracted automatically
// 🔗 Relationship Detection: Connections to previous memories identified

// Access enhanced memory functionality with AI-powered search
const memories = await client.memory.searchMemories('important information');
console.log(`Found ${memories.length} memories with AI-enhanced metadata`);
```

### 3. Multi-Provider Setup with AI-Powered Memory Processing

```typescript
import { LLMProviderFactory, ProviderType } from '@memori/providers';

// Create multiple providers with shared AI-powered memory using new IProviderConfig
const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'multi-provider-session'
  }
});

const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'multi-provider-session' // Same session for shared AI-powered memory
  }
});

// Use different providers - all share the same sophisticated MemoryAgent system
const openaiResponse = await openaiProvider.chat.completions.create({...});
const anthropicResponse = await anthropicProvider.chat.completions.create({...});

// Search across all conversations with AI-enhanced memory capabilities
const allMemories = await openaiProvider.memory.searchMemories('cross-provider context');

// Each memory includes AI-powered analysis:
// - Classification: 'essential', 'contextual', 'conversational'
// - Importance: 'critical', 'high', 'medium', 'low'
// - Entities: Extracted people, places, concepts, code, etc.
// - Relationships: Links to related memories and conversations
console.log(`Found ${allMemories.length} AI-enhanced memories across providers`);
```

## MemoryAgent Integration Architecture

### 🏗️ **Sophisticated MemoryAgent Architecture**

The MemoryAgent architecture provides sophisticated AI-powered memory processing capabilities across all LLM providers.

### 🤖 **MemoryAgent Capabilities**

The MemoryAgent-powered architecture provides enterprise-grade memory processing:

#### **AI-Powered Classification**
- **Automatic Categorization**: Memories automatically classified as 'essential', 'contextual', 'conversational', 'reference', 'personal', or 'conscious-info'
- **Dynamic Importance Scoring**: AI analysis determines importance levels from 'critical' to 'low' based on content significance
- **Context-Aware Processing**: Classification adapts based on conversation context and user intent

#### **Advanced Entity Extraction**
- **Named Entity Recognition**: Automatic extraction of people, organizations, locations, dates, and concepts
- **Technical Entity Detection**: Identification of code elements, APIs, frameworks, and technical terms
- **Relationship Mapping**: Connection of entities across memories and conversations

#### **Intelligent Relationship Detection**
- **Continuation Relationships**: Identifies follow-up discussions and related topics
- **Reference Relationships**: Links to previously mentioned concepts or decisions
- **Contradiction Detection**: Flags conflicting information across conversations
- **Superseding Relationships**: Tracks when new information replaces previous knowledge

#### **Enhanced Memory Metadata**
```typescript
// Example of AI-enhanced memory with rich metadata
const memory = {
  id: 'mem_123',
  content: 'User discussed TypeScript interfaces for API design',
  classification: {
    category: 'essential',
    importance: 'high',
    confidence: 0.92
  },
  entities: [
    { type: 'technology', value: 'TypeScript', confidence: 0.95 },
    { type: 'concept', value: 'API design', confidence: 0.88 },
    { type: 'code_element', value: 'interfaces', confidence: 0.91 }
  ],
  relationships: [
    { type: 'continuation', targetMemoryId: 'mem_89', confidence: 0.85 },
    { type: 'reference', targetMemoryId: 'mem_45', confidence: 0.72 }
  ],
  metadata: {
    createdAt: '2024-01-15T10:30:00Z',
    sessionId: 'my-app',
    provider: 'openai',
    model: 'gpt-4o-mini'
  }
};
```

### 🔧 **Infrastructure Integration**

The architecture leverages the **MemoryEnabledLLMProvider** pattern:

- **Unified Processing Pipeline**: All providers use the same MemoryAgent infrastructure
- **Single Implementation**: Shared codebase across OpenAI, Anthropic, and Ollama
- **Consistent Behavior**: Identical memory processing capabilities across all providers
- **Unified Maintenance**: Single codebase for memory functionality

## Integration Patterns

### Pattern 1: Drop-in Replacement (OpenAI Compatible)

#### Simple Constructor (Most Common)

```typescript
import { MemoriOpenAIClient } from 'memorits';

// Simple replacement with new IProviderConfig format
const client = new MemoriOpenAIClient({
  apiKey: 'your-api-key',
  model: 'gpt-4',                    // ✅ Configurable chat model
  memory: {
    enableChatMemory: true,
    enableEmbeddingMemory: true,
    memoryProcessingMode: 'auto',
    minImportanceLevel: 'medium'
  }
});

// Use exactly like OpenAI client - models are configurable!
const response = await client.chat.completions.create({
  model: 'gpt-4',  // Uses configured model
  messages: [{ role: 'user', content: 'Hello, remember this!' }]
});

// The configured model is used automatically in responses
console.log('Model used:', response.model); // Will show 'gpt-4'

// Memory automatically recorded
const memories = await client.memory.searchMemories('Hello');
```

### Pattern 2: Configuration Object Constructor

```typescript
// Alternative constructor using IProviderConfig format
const client = new MemoriOpenAIClient({
  apiKey: 'your-api-key',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app'
  }
});
```

### Pattern 2: Provider Factory (Multi-Provider Support)

```typescript
import { LLMProviderFactory, ProviderType } from '@memori/providers';

// Create OpenAI provider with new IProviderConfig format
const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app'
  }
});

// Create Anthropic provider with shared memory using same sessionId
const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app' // Same session for shared memory
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
// Use drop-in for existing OpenAI code with new IProviderConfig
const openaiClient = new MemoriOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app'
  }
});

// Use factory for additional providers with same session for shared memory
const ollamaProvider = await LLMProviderFactory.createProvider(ProviderType.OLLAMA, {
  baseUrl: 'http://localhost:11434',
  model: 'llama2:7b',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app' // Same session for shared memory
  }
});

// All providers share the same memory system
const memories = await openaiClient.memory.searchMemories('unified context');
```

## Model Configuration

### Custom Model Selection

MemoriOpenAI supports configurable models for both chat completions and embeddings:

```typescript
// Use different models for different use cases with IProviderConfig
const client = new MemoriOpenAIClient({
  apiKey: 'your-api-key',
  model: 'gpt-4',                          // High-quality chat model
  memory: {
    enableChatMemory: true,
    enableEmbeddingMemory: true,
    memoryProcessingMode: 'auto',
    minImportanceLevel: 'medium'
  }
});

// Models are used automatically
const chatResponse = await client.chat.completions.create({
  model: 'gpt-4',  // ✅ Uses configured model
  messages: [{ role: 'user', content: 'Complex analysis...' }]
});

const embeddingResponse = await client.embeddings.create({
  model: 'text-embedding-3-large',  // ✅ Uses configured embedding model
  input: 'Document content for embedding'
});
```

### Multi-Provider Support

```typescript
// OpenAI with custom models using new IProviderConfig
const openaiClient = new MemoriOpenAIClient({
  apiKey: 'sk-openai-key',
  model: 'gpt-4-turbo-preview',
  memory: {
    enableChatMemory: true,
    enableEmbeddingMemory: true,
    memoryProcessingMode: 'auto'
  }
});

// Ollama with local models using new IProviderConfig
const ollamaClient = new MemoriOpenAIClient({
  apiKey: 'ollama-local',
  model: 'llama2:70b',
  baseUrl: 'http://localhost:11434/v1',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'local-dev'
  }
});

// Anthropic with Claude models using new IProviderConfig
const anthropicClient = new MemoriOpenAIClient({
  apiKey: 'sk-ant-api-key',
  model: 'claude-3-5-sonnet-20241022',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto'
  }
});
```

### Model Configuration Best Practices

```typescript
// Production configuration with model optimization using new IProviderConfig
const productionClient = new MemoriOpenAIClient({
  apiKey: 'your-api-key',
  model: 'gpt-4',                    // High quality for complex tasks
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    minImportanceLevel: 'medium'     // Only process important memories
  }
});

// Development configuration with faster models using new IProviderConfig
const devClient = new MemoriOpenAIClient({
  apiKey: 'your-api-key',
  model: 'gpt-3.5-turbo',            // Faster and cheaper for development
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    minImportanceLevel: 'low',       // Process all memories for testing
    sessionId: 'dev-session'
  }
});
```

## Memory-Enhanced Conversations with AI-Powered Processing

### Automatic Memory Recording with AI Analysis

```typescript
// Conversations are automatically recorded and AI-processed
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'I am a software engineer specializing in AI' }
  ]
});

// Memory is automatically created and processed with sophisticated AI analysis:
// 🤖 Classification: Categorized as 'personal' with high confidence
// ⭐ Importance Scoring: Rated as 'medium' importance based on content analysis
// 🏷️ Entity Extraction: 'software engineer', 'AI' entities identified
// 🔗 Relationship Detection: Connected to previous technical discussions
// 📊 Rich Metadata: Provider, model, timestamp, session tracking
```

### Context-Aware Responses with Enhanced Memory Retrieval

```typescript
// Ask about previously discussed topics with AI-enhanced context
const followUpResponse = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'What did I say about my specialization?' }
  ]
});

// AI can access previous conversation context with enhanced capabilities:
// 🔍 Semantic Search: Finds relevant memories using AI understanding
// 📊 Metadata Filtering: Filters by importance, category, entities
// 🔗 Relationship Traversal: Follows memory connections for deeper context
// ⏰ Temporal Awareness: Considers conversation timing and relevance
```

### Multi-Turn Context Preservation with Advanced Analytics

```typescript
// Context is maintained across conversation turns with full AI analysis
const conversation = [
  { role: 'user' as const, content: 'I need help with TypeScript interfaces' },
  { role: 'assistant' as const, content: 'I can help with TypeScript interfaces...' },
  { role: 'user' as const, content: 'Can you show me an example?' }
];

const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: conversation
});

// All conversation turns are recorded with comprehensive AI processing:
// 🎯 Entity Extraction: 'TypeScript', 'interfaces' automatically identified
// 📈 Importance Tracking: Technical questions often marked as 'high' importance
// 🔗 Relationship Mapping: Links to previous coding discussions
// 📊 Analytics: Usage patterns, topic frequency, expertise areas tracked

const relatedMemories = await client.memory.searchMemories('TypeScript interfaces');
// Returns memories with rich metadata and AI-powered relevance scoring
console.log(`Found ${relatedMemories.length} related memories with ${relatedMemories[0].entities.length} extracted entities`);
```

## Advanced Integration Features

### Streaming with AI-Powered Memory

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

// Memory is automatically recorded with full AI analysis when streaming completes
console.log(`\n\nMemory recorded: ${fullContent.length} characters`);

// The streamed content receives the same AI-powered processing:
// 🤖 Classification: Story content categorized as 'conversational'
// ⭐ Importance Scoring: Length and engagement determine importance
// 🏷️ Entity Extraction: Characters, settings, themes automatically identified
// 🔗 Relationship Detection: Connected to previous storytelling discussions
```

### AI-Enhanced Memory Search Integration

```typescript
// Direct access to memory functionality with AI-powered search
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true
});

// Search memories with AI-enhanced filtering and ranking
const relevantMemories = await client.memory.searchMemories('previous discussion', {
  limit: 5,
  minImportance: 'high',
  categories: ['essential', 'contextual']
});

// Each memory includes rich AI-generated metadata
relevantMemories.forEach(memory => {
  console.log(`Category: ${memory.classification.category}`);
  console.log(`Importance: ${memory.classification.importance}`);
  console.log(`Entities: ${memory.entities.map(e => e.value).join(', ')}`);
  console.log(`Relationships: ${memory.relationships.length} connections`);
});
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

### IProviderConfig Interface

```typescript
interface IProviderConfig {
  // API configuration
  apiKey: string;                       // Required API key for the provider
  model?: string;                       // Chat completion model (e.g., 'gpt-4', 'gpt-3.5-turbo')
  baseUrl?: string;                     // Base URL for the provider API
  options?: Record<string, any>;        // Provider-specific configuration options

  // Memory configuration
  memory?: {
    enableChatMemory?: boolean;         // Enable chat memory recording
    enableEmbeddingMemory?: boolean;    // Enable embedding memory recording
    memoryProcessingMode?: 'auto' | 'conscious' | 'none'; // Memory processing mode
    minImportanceLevel?: 'low' | 'medium' | 'high' | 'critical' | 'all'; // Minimum importance level
    sessionId?: string;                 // Session ID for tracking memory operations
  };
}
```

### Configuration with IProviderConfig Interface

The `IProviderConfig` interface provides a unified configuration approach:

```typescript
// Old format (deprecated)
const oldConfig = {
  enableChatMemory: true,
  autoInitialize: true,
  memoryProcessingMode: 'auto',
  model: 'gpt-4'
};

// New format (recommended)
const newConfig = {
  apiKey: 'your-api-key',
  model: 'gpt-4',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto'
  }
};
```

### Environment Variables

```bash
# OpenAI Configuration
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1

# Memory Configuration
DATABASE_URL=sqlite:./memories.db
MEMORI_SESSION_ID=my-app-session
MEMORI_PROCESSING_MODE=auto
MEMORI_MIN_IMPORTANCE_LEVEL=medium
MEMORI_ENABLE_CHAT_MEMORY=true
MEMORI_ENABLE_EMBEDDING_MEMORY=false
```

## Memory Modes in OpenAI Integration

### Auto-Ingestion Mode

```typescript
const client = new MemoriOpenAI({
  apiKey: 'your-api-key',
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto'
  }
});

// Every API call triggers:
// 1. Conversation recording
// 2. Memory processing and classification
// 3. Dynamic context retrieval for next call
// 4. Automatic memory search and injection
```

### Conscious Processing Mode

```typescript
const client = new MemoriOpenAI({
  apiKey: 'your-api-key',
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'conscious'
  }
});

// Features:
// 1. Background memory analysis
// 2. One-shot context injection at startup
// 3. Permanent working memory
// 4. Human-like memory reflection
```

### Combined Mode

```typescript
const client = new MemoriOpenAI({
  apiKey: 'your-api-key',
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto'
  }
});

// Maximum intelligence:
// 1. Both dynamic and persistent memory
// 2. Real-time context + background learning
// 3. Immediate response + long-term retention
```

## MemoryAgent-Powered Enhanced Features

### 🏷️ **Entity Extraction in Practice**

```typescript
// Example: Technical discussion with automatic entity extraction
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'I need help with React components and TypeScript interfaces for API integration' }]
});

// MemoryAgent automatically extracts:
// 🏷️ Technology Entities: ['React', 'TypeScript', 'API']
// 🔧 Code Elements: ['components', 'interfaces', 'integration']
// 📚 Concepts: ['frontend development', 'type safety', 'API design']

const memories = await client.memory.searchMemories('React components');
memories.forEach(memory => {
  console.log(`Extracted entities: ${memory.entities.map(e => `${e.value} (${e.type})`).join(', ')}`);
  console.log(`Importance score: ${memory.classification.importance} (${memory.classification.confidence})`);
});
```

### 🔗 **Relationship Detection in Action**

```typescript
// Example: Follow-up discussion with relationship detection
const conversation1 = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'I want to implement user authentication' }]
});

const conversation2 = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'How should I handle JWT tokens in my React app?' }]
});

// MemoryAgent detects:
// 🔗 Continuation: conversation2 continues conversation1
// 🔗 Technical Relationship: Links authentication → JWT implementation
// 🔗 Entity Connection: Connects 'authentication' → 'JWT tokens' → 'React'

const relatedMemories = await client.memory.searchMemories('authentication');
console.log(`Found ${relatedMemories.length} connected memories`);
relatedMemories.forEach(memory => {
  console.log(`Relationships: ${memory.relationships.length} connections detected`);
});
```

### ⭐ **Importance Scoring Intelligence**

```typescript
// Example: Different content types receive appropriate importance scoring
const messages = [
  { role: 'user', content: 'Hello, how are you?' }, // → 'low' importance (casual)
  { role: 'user', content: 'I need help with a critical production issue' }, // → 'critical' importance (urgent)
  { role: 'user', content: 'Can you explain dependency injection?' }, // → 'medium' importance (educational)
  { role: 'user', content: 'The authentication system is down!' } // → 'critical' importance (emergency)
];

for (const message of messages) {
  await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [message]
  });
}

// MemoryAgent uses AI to understand context and assign appropriate importance:
// 🎯 Critical: Production issues, security problems, urgent business matters
// 📈 High: Technical decisions, architectural choices, important preferences
// 📝 Medium: Educational content, code examples, general discussions
// 💬 Low: Greetings, casual conversation, minor clarifications
```

### 📊 **Advanced Memory Analytics**

```typescript
// Example: Rich memory analytics and insights
const analytics = await client.memory.getMemoryAnalytics({
  timeRange: { start: '2024-01-01', end: '2024-12-31' },
  sessionId: 'my-app'
});

console.log(`Total memories processed: ${analytics.totalMemories}`);
console.log(`By importance:`, analytics.byImportance);
// {
//   critical: 12,
//   high: 45,
//   medium: 123,
//   low: 234
// }

console.log(`By category:`, analytics.byCategory);
// {
//   essential: 89,
//   contextual: 156,
//   conversational: 134,
//   reference: 67,
//   personal: 23,
//   conscious_info: 12
// }

console.log(`Entity frequency:`, analytics.topEntities);
// [
//   { value: 'React', count: 45, type: 'technology' },
//   { value: 'TypeScript', count: 38, type: 'technology' },
//   { value: 'API', count: 29, type: 'concept' }
// ]
```

## Real-World Examples

### 1. Chatbot with AI-Powered Memory

```typescript
class MemoryEnabledChatbot {
  private client: MemoriOpenAI;

  constructor() {
    this.client = new MemoriOpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
      model: 'gpt-4o-mini',
      memory: {
        enableChatMemory: true,
        memoryProcessingMode: 'auto',
        sessionId: 'chatbot-session'
      }
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

const client = new MemoriOpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app'
  }
});
```

#### Option B: Provider Factory (Multi-Provider Support)

```typescript
import { LLMProviderFactory, ProviderType } from '@memori/providers';

const openaiProvider = await LLMProviderFactory.createProvider(ProviderType.OPENAI, {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app'
  }
});

const anthropicProvider = await LLMProviderFactory.createProvider(ProviderType.ANTHROPIC, {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
  memory: {
    enableChatMemory: true,
    memoryProcessingMode: 'auto',
    sessionId: 'my-app' // Same session for shared memory
  }
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

## MemoryAgent Architecture Benefits

The **MemoryAgent integration** delivers sophisticated AI-powered memory processing:

### 🧠 **AI-Powered Memory Processing**
- **LLM-Powered Classification**: Automatic categorization using AI analysis
- **Intelligent Importance Scoring**: Dynamic importance assessment based on content
- **Advanced Entity Extraction**: Automated extraction of key entities and concepts
- **Smart Relationship Detection**: Identification of memory connections and dependencies
- **Rich Metadata Generation**: Comprehensive context and analytics for every memory

### 🔧 **Developer Experience**
- **Sophisticated Memory Capabilities**: Enterprise-grade features across all providers
- **Consistent Provider Behavior**: Identical memory processing across OpenAI, Anthropic, Ollama
- **Rich Memory Analytics**: Deep insights into conversation patterns and knowledge extraction
- **Extensible Architecture**: Design supports advanced memory features

### 📈 **Production Benefits**
- **Unified Architecture**: Single codebase for memory functionality across providers
- **Optimized Performance**: Efficient processing with advanced AI capabilities
- **Resource Efficiency**: Effective memory processing with comprehensive feature set
- **Enterprise Features**: Advanced analytics and relationship mapping

## Related Documentation

- **[Provider Documentation](../providers/)** - Complete guides for OpenAI, Anthropic, Ollama, and custom providers
- **[Core API Reference](../api/core-api.md)** - Main Memori class and memory management APIs
- **[Examples](../../../examples/)** - Real-world usage examples and demos