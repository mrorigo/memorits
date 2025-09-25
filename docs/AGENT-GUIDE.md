# AI Agent Guide: Using memorits Library

## Overview
memorits is a TypeScript library enabling AI agents with persistent memory, LLM integration, and advanced planning capabilities.

## Quick Start

### Installation
```bash
npm install memorits
```

### Basic Memory-Enabled Agent
```typescript
import { Memori, MemoryAgent, OpenAIProvider } from 'memorits';

const memori = new Memori();
const provider = new OpenAIProvider({
  apiKey: process.env.OPENAI_API_KEY
});

memori.registerProvider(provider);
const agent = new MemoryAgent({ name: 'assistant', memori });

// Store memory
await agent.addMemory({
  content: "Important fact to remember",
  tags: ['category', 'context']
});

// Recall memories
const memories = await agent.searchMemories({
  query: "What do I know about...",
  limit: 3
});
```

## Core Components

### 1. Memori Instance
- Central orchestrator
- Manages providers and agents
- Handles memory persistence

### 2. Agents
Two main types:
- **MemoryAgent**: Basic memory operations
- **ConsciousAgent**: Advanced planning + memory

### 3. Providers
LLM integration (e.g., OpenAI)

## Key Operations

### Memory Management
```typescript
// Add memory
await agent.addMemory({
  content: "Information to store",
  tags: ['context']
});

// Search
const results = await agent.searchMemories({
  query: "Search terms",
  limit: 5
});

// Summarize
const summary = await agent.summarizeMemories({
  filter: { tags: ['meeting'] }
});
```

### Advanced Agent Features
```typescript
import { ConsciousAgent } from 'memorits';

class SmartAgent extends ConsciousAgent {
  async processTask(goal: string) {
    // Generate plan
    const plan = await this.plan(goal);
    
    // Execute with memory context
    for (const step of plan.steps) {
      const context = await this.searchMemories({
        query: step.description,
        limit: 2
      });
      
      await this.executeStep(step, context);
    }
  }
}
```

## Best Practices

1. **Environment Setup**
```typescript
// config.ts
export const config = {
  openaiKey: process.env.OPENAI_API_KEY,
  dbUrl: process.env.DATABASE_URL || 'file:./memori.db'
};
```

2. **Error Handling**
```typescript
try {
  await agent.addMemory({
    content: "Critical info",
    tags: ['important']
  });
} catch (error) {
  if (error.code === 'DB_ERROR') {
    // Handle storage issues
  }
  // Re-throw unexpected errors
  throw error;
}
```

3. **Testing**
```typescript
// agent.test.ts
describe('Agent Memory', () => {
  let agent: MemoryAgent;
  
  beforeEach(async () => {
    const memori = new Memori({
      database: ':memory:'  // Test database
    });
    agent = new MemoryAgent({ 
      name: 'test-agent',
      memori 
    });
  });

  test('stores and recalls memories', async () => {
    await agent.addMemory({
      content: "Test data",
      tags: ['test']
    });

    const results = await agent.searchMemories({
      query: "test",
      limit: 1
    });

    expect(results[0].content).toBe("Test data");
  });
});
```

## Tips for AI Agent Implementation

1. **Memory Context**
- Tag memories appropriately
- Use semantic search for relevance
- Maintain memory coherence

2. **Planning**
- Break complex tasks into steps
- Reference relevant memories
- Store execution results

3. **Performance**
- Batch memory operations
- Clean up old memories
- Use memory summaries

## Common Patterns

### Contextual Agent
```typescript
class ContextualAgent extends MemoryAgent {
  async respond(input: string) {
    // Get relevant context
    const context = await this.searchMemories({
      query: input,
      limit: 3
    });

    // Use LLM with context
    const response = await this.provider.chat({
      messages: [
        { role: 'system', content: this.buildContext(context) },
        { role: 'user', content: input }
      ]
    });

    // Store interaction
    await this.addMemory({
      content: `User: ${input}\nAssistant: ${response}`,
      tags: ['conversation']
    });

    return response;
  }
}
```

### Learning Agent
```typescript
class LearningAgent extends ConsciousAgent {
  async learn(information: string) {
    // Extract key points
    const points = await this.provider.complete({
      prompt: `Extract key facts from: ${information}`
    });

    // Store as separate memories
    for (const point of points) {
      await this.addMemory({
        content: point,
        tags: ['learned', 'fact']
      });
    }

    // Update knowledge summary
    await this.summarizeAndStore();
  }
}
```

## Reference

### Memory Operations
- `addMemory(content, tags?)`
- `searchMemories(query, opts?)`
- `getMemoryById(id)`
- `summarizeMemories(filter?)`

### Agent Methods
- `plan(goal)`
- `executeStep(step)`
- `think()`

### Provider Interface
- `chat(messages)`
- `complete(prompt)`

## Environment Variables
```env
OPENAI_API_KEY=your_key_here
DATABASE_URL=file:./memori.db
LOG_LEVEL=info
```

Remember: Focus on your agent's logic and let memorits handle the memory and LLM integration complexities.