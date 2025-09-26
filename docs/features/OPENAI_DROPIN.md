# OpenAI Drop-in Replacement Design Specification

## Overview

This document specifies the design for a comprehensive drop-in replacement for the OpenAI client that transparently enables memory functionality for agents. The replacement maintains 100% API compatibility with the OpenAI SDK while adding automatic memory recording and retrieval capabilities.

## Design Goals

- **Zero Breaking Changes**: Existing code using OpenAI SDK continues to work unchanged
- **Transparent Memory**: Automatic recording of conversations without manual intervention
- **Full API Compatibility**: Support for chat completions and embeddings (primary agent use cases)
- **Streaming Support**: Proper handling of streaming responses with complete memory capture
- **Flexible Initialization**: Multiple initialization patterns for different use cases
- **Type Safety**: Exact type matching with OpenAI SDK for compile-time safety

## Architecture

### Core Components

#### 1. MemoriOpenAIClient (Main Proxy)
- Implements the complete OpenAI SDK interface
- Acts as a transparent proxy to the underlying OpenAI client
- Handles initialization, configuration, and routing
- Maintains exact API compatibility with OpenAI SDK v5.x

#### 2. Endpoint Proxies
- **ChatProxy**: Handles chat completions with intelligent memory recording
- **EmbeddingProxy**: Handles embeddings with optional memory recording
- **OtherProxy**: Passthrough for non-memory endpoints (images, audio, etc.)

#### 3. Memory Manager
- **ConversationRecorder**: Records and processes chat interactions
- **EmbeddingRecorder**: Records embedding requests (configurable)
- **StreamingBuffer**: Buffers streaming responses for complete memory capture

#### 4. Initialization Factory
- Multiple factory functions for different initialization patterns
- Environment-based configuration
- Automatic database setup

### Component Relationships

```
┌─────────────────────────────────────────────────────────────┐
│                    MemoriOpenAIClient                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    OpenAI Proxy                          │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │  │  ChatProxy  │  │EmbeddingProx│  │ OtherProxy  │       │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  │                                                          │  │
│  │  ┌─────────────────────────────────────────────────────┐ │  │
│  │  │              Memory Manager                         │ │  │
│  │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │ │  │
│  │  │  │Conversation │  │  Embedding  │  │  Streaming  │  │ │  │
│  │  │  │  Recorder   │  │  Recorder   │  │  Buffer     │  │ │  │
│  │  │  └─────────────┘  └─────────────┘  └─────────────┘  │ │  │
│  │  └─────────────────────────────────────────────────────┘ │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## API Compatibility Strategy

### Type Re-exports
```typescript
// Re-export all OpenAI types to maintain exact compatibility
export type {
  ChatCompletion,
  ChatCompletionChunk,
  ChatCompletionCreateParams,
  EmbeddingCreateParams,
  // ... all other OpenAI types
} from 'openai';
```

### Method Proxying
- All methods maintain identical signatures
- Property delegation to underlying OpenAI client
- Error types and behavior preserved exactly

### Interface Implementation
```typescript
export class MemoriOpenAIClient implements OpenAI {
  // Exact implementation of OpenAI interface
  get chat(): OpenAI['chat'] { /* proxy implementation */ }
  get embeddings(): OpenAI['embeddings'] { /* proxy implementation */ }
  // ... all other OpenAI properties and methods
}
```

## Memory Recording Strategy

### Chat Completions
- **Non-streaming responses**: Record immediately after completion
- **Streaming responses**: Buffer entire response, record when stream ends
- **Memory processing**: Use existing MemoryAgent for classification
- **Metadata capture**: Model, temperature, tokens, conversation context

### Embeddings
- **Optional recording**: Configurable via `enableEmbeddingMemory`
- **Metadata storage**: Model, dimensions, input tokens, usage statistics
- **Lightweight processing**: Minimal classification for embedding data

### Streaming Response Handling
```typescript
class StreamingBuffer {
  private chunks: ChatCompletionChunk[] = [];
  private completeContent = '';
  private timeout: NodeJS.Timeout;

  async bufferAndRecord(
    stream: AsyncIterable<ChatCompletionChunk>,
    memori: Memori
  ): Promise<string> {
    for await (const chunk of stream) {
      this.chunks.push(chunk);
      this.completeContent += chunk.choices[0]?.delta?.content || '';

      // Reset timeout on each chunk
      this.resetTimeout();
    }

    // Record complete conversation when streaming ends
    return await this.recordCompleteConversation(memori);
  }
}
```

## Configuration System

### Configuration Interface
```typescript
interface MemoriOpenAIConfig {
  // Core functionality
  enableChatMemory?: boolean;           // Enable chat memory recording
  enableEmbeddingMemory?: boolean;      // Enable embedding memory recording
  memoryProcessingMode?: 'auto' | 'conscious' | 'none';

  // Initialization
  autoInitialize?: boolean;             // Auto-create Memori instance
  databaseUrl?: string;                 // Database configuration
  namespace?: string;                   // Memory namespace

  // Memory filtering
  minImportanceLevel?: MemoryImportanceLevel;
  maxMemoryAge?: number;                // Days to keep memories
  autoIngest?: boolean;                 // Auto vs conscious ingestion
  consciousIngest?: boolean;

  // Performance tuning
  bufferTimeout?: number;               // Streaming buffer timeout (ms)
  maxBufferSize?: number;               // Max streaming buffer size (chars)

  // OpenAI client options
  apiKey?: string;                      // Override API key
  baseUrl?: string;                     // Override base URL
  // ... other OpenAI options
}
```

## Initialization Patterns

### Pattern 1: Explicit Memori Instance (Current)
```typescript
const memori = new Memori(config);
await memori.enable();
const client = createMemoriOpenAI(memori, apiKey);
```

### Pattern 2: Automatic Initialization
```typescript
const client = MemoriOpenAI.fromConfig(apiKey, {
  enableChatMemory: true,
  enableEmbeddingMemory: false,
  databaseUrl: 'sqlite:./memories.db'
});
```

### Pattern 3: Environment-Based Setup
```typescript
const client = MemoriOpenAI.fromEnv(apiKey, {
  enableChatMemory: true,
  autoInitialize: true
});
```

### Pattern 4: Direct Constructor Replacement
```typescript
const client = new MemoriOpenAI(apiKey, {
  enableChatMemory: true,
  autoInitialize: true
});
```

## Implementation Details

### Memory Recording Logic

#### Conversation Recording
```typescript
class ConversationRecorder {
  async recordChatCompletion(
    params: ChatCompletionCreateParams,
    response: ChatCompletion | AsyncIterable<ChatCompletionChunk>,
    memori: Memori
  ): Promise<string> {
    // Extract user input
    const userMessage = this.extractUserMessage(params.messages);
    const model = params.model || 'gpt-4o-mini';

    if (this.isStreaming(response)) {
      // Handle streaming response
      return await this.recordStreamingConversation(response, memori, {
        userInput: userMessage,
        model
      });
    } else {
      // Handle non-streaming response
      const content = response.choices[0]?.message?.content || '';
      return await memori.recordConversation(userInput, content, {
        model,
        metadata: {
          temperature: params.temperature,
          maxTokens: params.max_tokens,
          tokensUsed: response.usage?.total_tokens || 0,
        }
      });
    }
  }
}
```

### Streaming Implementation
```typescript
class StreamingBuffer {
  private chunks: ChatCompletionChunk[] = [];
  private contentBuffer = '';
  private metadata: StreamingMetadata;

  async processStream(
    stream: AsyncIterable<ChatCompletionChunk>
  ): Promise<BufferedStream> {
    const timeout = setTimeout(() => {
      throw new Error('Streaming timeout exceeded');
    }, this.config.bufferTimeout);

    try {
      for await (const chunk of stream) {
        this.chunks.push(chunk);
        this.contentBuffer += chunk.choices[0]?.delta?.content || '';
        this.updateMetadata(chunk);
      }

      return {
        chunks: this.chunks,
        completeContent: this.contentBuffer,
        metadata: this.metadata
      };
    } finally {
      clearTimeout(timeout);
    }
  }
}
```

## Usage Examples

### Basic Drop-in Replacement
```typescript
import { MemoriOpenAI } from 'memorits';

// Simple replacement - existing code works unchanged
const client = new MemoriOpenAI('your-api-key', {
  enableChatMemory: true,
  autoInitialize: true
});

// Use exactly like OpenAI client
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello, remember this!' }]
});

// Memory automatically recorded
const memories = await client.memori.searchMemories('Hello');
```

### Advanced Configuration
```typescript
const client = MemoriOpenAI.fromConfig('your-api-key', {
  enableChatMemory: true,
  enableEmbeddingMemory: true,
  memoryProcessingMode: 'conscious',
  databaseUrl: 'postgresql://localhost/memories',
  namespace: 'agent-session-1',
  minImportanceLevel: 'medium',
  autoIngest: false,
  consciousIngest: true
});
```

### Existing Code Migration
```typescript
// Before (standard OpenAI)
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// After (drop-in replacement)
import { MemoriOpenAI } from 'memorits';
const client = new MemoriOpenAI(process.env.OPENAI_API_KEY, {
  enableChatMemory: true,
  autoInitialize: true
});

// No other code changes needed!
```

## Benefits

### For Users
- **Zero code changes** required for existing OpenAI usage
- **Gradual migration** - can enable memory features incrementally
- **Performance control** - configurable memory recording
- **Multiple initialization patterns** for different use cases

### For Developers
- **Type safety** - exact OpenAI SDK compatibility
- **Testable** - clear separation of concerns
- **Maintainable** - modular architecture
- **Extensible** - easy to add new endpoints or features

## Implementation Roadmap

### Phase 1: Core Infrastructure
- [ ] Create MemoriOpenAIClient base class
- [ ] Implement type re-exports and interfaces
- [ ] Set up basic proxy architecture
- [ ] Add configuration system

### Phase 2: Chat Completions
- [ ] Implement ChatProxy with memory recording
- [ ] Add non-streaming response handling
- [ ] Implement streaming buffer and recording
- [ ] Integrate with existing MemoryAgent

### Phase 3: Embeddings
- [ ] Implement EmbeddingProxy
- [ ] Add configurable embedding memory recording
- [ ] Support for text-embedding models
- [ ] Usage tracking and metadata

### Phase 4: Factory Functions
- [ ] Implement multiple initialization patterns
- [ ] Add environment-based configuration
- [ ] Create factory function for constructor replacement
- [ ] Add validation and error handling

### Phase 5: Testing & Documentation
- [ ] Write comprehensive test suite
- [ ] Add integration tests with existing Memori
- [ ] Update documentation and examples
- [ ] Performance benchmarking

## Compatibility Requirements

### OpenAI SDK Version
- Target: OpenAI SDK v5.x (current stable)
- Maintain compatibility with v4.x if needed
- Follow OpenAI SDK updates and maintain compatibility

### TypeScript Support
- Target: TypeScript 5.x+
- Full type safety with compile-time checking
- IDE support with autocomplete and IntelliSense

### Node.js Support
- Target: Node.js 18+
- ESM and CommonJS compatibility
- Browser compatibility if needed

## Error Handling

### OpenAI Error Preservation
- Maintain exact OpenAI error types and messages
- Add memory-specific errors with clear messaging
- Provide troubleshooting guidance for common issues

### Memory Recording Failures
- Graceful degradation when memory recording fails
- Silent failures for memory operations (non-breaking)
- Comprehensive logging for debugging
- Recovery mechanisms for transient failures

This design provides a robust, production-ready foundation for transparent memory integration with the OpenAI client while maintaining full backward compatibility and adding powerful new capabilities for AI agents.