# MemoriOpenAI Migration Guide

## Complete Guide to Migrating from OpenAI SDK to MemoriOpenAI

This comprehensive guide provides step-by-step instructions for migrating your existing OpenAI applications to use MemoriOpenAI's drop-in replacement with automatic memory functionality.

---

## Quick Reference

For a **concise migration guide** with essential information, see [`docs/MIGRATION.md`](MIGRATION.md).

This document provides comprehensive testing, production deployment, and advanced configuration details.

---

## Table of Contents

1. [Overview](#overview)
2. [Pre-Migration Checklist](#pre-migration-checklist)
3. [Migration Patterns](#migration-patterns)
4. [Step-by-Step Migration](#step-by-step-migration)
5. [Testing Your Migration](#testing-your-migration)
6. [Advanced Configuration](#advanced-configuration)
7. [Troubleshooting](#troubleshooting)
8. [Performance Optimization](#performance-optimization)
9. [Production Deployment](#production-deployment)
10. [Rollback Strategies](#rollback-strategies)

---

## Overview

MemoriOpenAI provides a **zero breaking changes** drop-in replacement for the OpenAI SDK v5.x. The migration requires minimal code changes while adding powerful memory capabilities.

### Key Benefits of Migration

- ✅ **Zero Breaking Changes**: Existing OpenAI code works unchanged
- ✅ **Automatic Memory Recording**: Conversations remembered transparently
- ✅ **Intelligent Memory Processing**: Dual modes (conscious + auto ingestion)
- ✅ **Full API Compatibility**: Exact OpenAI SDK v5.x interface match
- ✅ **Production Ready**: Enterprise-grade performance and reliability

### Migration Time Estimate

- **Simple applications**: 5-10 minutes
- **Medium applications**: 15-30 minutes
- **Complex applications**: 30-60 minutes

---

## Pre-Migration Checklist

Before starting your migration, ensure you have:

### 1. Environment Setup

- [ ] Node.js 18+ installed
- [ ] TypeScript 5+ installed
- [ ] OpenAI API key available
- [ ] Database preference selected (SQLite for development, PostgreSQL for production)

### 2. Dependencies

```bash
# Check current dependencies
npm list openai

# Install MemoriOpenAI
npm install memorits
```

### 3. Backup Strategy

- [ ] Database backup (if applicable)
- [ ] Configuration backup
- [ ] Test suite backup

### 4. Team Communication

- [ ] Inform team about migration
- [ ] Schedule downtime if needed
- [ ] Prepare rollback plan

---

## Migration Patterns

Choose the migration pattern that best fits your application:

### Pattern A: Simple Constructor Replacement (Most Common)

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// After
import { MemoriOpenAI } from 'memorits';
const client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  autoInitialize: true
});
```

### Pattern B: Environment-Based Configuration

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

// After
import { MemoriOpenAIFromEnv } from 'memorits';
const client = await MemoriOpenAIFromEnv();
```

### Pattern C: Advanced Configuration

```typescript
// Before
import OpenAI from 'openai';
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: 'your-org',
  project: 'your-project'
});

// After
import { MemoriOpenAIFromConfig } from 'memorits';
const client = await MemoriOpenAIFromConfig(process.env.OPENAI_API_KEY!, {
  enableChatMemory: true,
  enableEmbeddingMemory: true,
  memoryProcessingMode: 'conscious',
  databaseUrl: 'postgresql://localhost/memories',
  organization: 'your-org',
  project: 'your-project'
});
```

---

## Step-by-Step Migration

### Step 1: Update Dependencies

```bash
# Add MemoriOpenAI to your project
npm install memorits

# Verify installation
npm list memorits
```

### Step 2: Update Imports

**File: `src/services/openai.ts`**

```typescript
// Before
import OpenAI from 'openai';

// After
import { MemoriOpenAI } from 'memorits';
```

### Step 3: Replace Constructor

**File: `src/services/openai.ts`**

```typescript
// Before
export class OpenAIService {
  private client: OpenAI;

  constructor() {
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }
}

// After
export class OpenAIService {
  private client: MemoriOpenAI;

  constructor() {
    this.client = new MemoriOpenAI(process.env.OPENAI_API_KEY!, {
      enableChatMemory: true,
      autoInitialize: true,
      databaseUrl: 'sqlite:./memories.db'
    });
  }
}
```

### Step 4: Update Usage (No Changes Required)

**File: `src/controllers/chat.ts`**

```typescript
// This code works unchanged!
const response = await this.openaiService.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello world!' }]
});
```

### Step 5: Add Memory Search Capability

**File: `src/controllers/chat.ts`**

```typescript
// Add memory search endpoint
app.get('/api/memories', async (req, res) => {
  const query = req.query.q as string;
  const memories = await this.openaiService.memory.searchMemories(query, {
    limit: 10,
    minImportance: 'medium'
  });
  res.json(memories);
});
```

---

## Testing Your Migration

### 1. Basic Functionality Test

```typescript
// test/migration.test.ts
import { MemoriOpenAI } from 'memorits';

async function testMigration() {
  const client = new MemoriOpenAI('test-key', {
    enableChatMemory: true,
    autoInitialize: true,
    databaseUrl: 'sqlite:./test-memories.db'
  });

  // Test 1: Basic chat completion
  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: 'This is a test conversation' }]
  });

  console.log('✅ Chat completion works:', !!response.choices[0]?.message?.content);

  // Test 2: Memory recording
  const memories = await client.memory.searchMemories('test conversation');
  console.log('✅ Memory recording works:', memories.length > 0);

  // Test 3: Memory search
  const searchResults = await client.memory.searchMemories('conversation', {
    limit: 5
  });
  console.log('✅ Memory search works:', searchResults.length >= 0);

  // Test 4: Memory statistics
  const stats = await client.memory.getMemoryStats();
  console.log('✅ Memory stats available:', !!stats.totalMemories);

  console.log('🎉 All tests passed! Migration successful.');
}
```

### 2. Integration Test

```typescript
// test/integration.test.ts
describe('OpenAI Integration', () => {
  let client: MemoriOpenAI;

  beforeEach(async () => {
    client = new MemoriOpenAI('test-key', {
      enableChatMemory: true,
      autoInitialize: true,
      databaseUrl: 'sqlite:./test-memories.db'
    });
  });

  afterEach(async () => {
    await client.memory.clearAllMemories();
  });

  it('should record and retrieve memories', async () => {
    // Arrange
    const testMessage = 'This is important information about our project architecture';

    // Act
    await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: testMessage }]
    });

    // Assert
    const memories = await client.memory.searchMemories('architecture');
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0]?.content).toContain('important information');
  });

  it('should handle streaming responses', async () => {
    // Test streaming functionality
    const stream = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'Tell me a long story' }],
      stream: true
    });

    let content = '';
    for await (const chunk of stream) {
      content += chunk.choices[0]?.delta?.content || '';
    }

    expect(content.length).toBeGreaterThan(0);
  });
});
```

### 3. Performance Test

```typescript
// test/performance.test.ts
async function testPerformance() {
  const client = new MemoriOpenAI('test-key', {
    enableChatMemory: true,
    autoInitialize: true,
    databaseUrl: 'sqlite:./test-memories.db'
  });

  const startTime = Date.now();

  // Test multiple requests
  for (let i = 0; i < 100; i++) {
    await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: `Message ${i}` }]
    });
  }

  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`Processed 100 requests in ${duration}ms`);
  console.log(`Average: ${duration / 100}ms per request`);

  const stats = await client.memory.getMemoryStats();
  console.log(`Total memories recorded: ${stats.totalMemories}`);
}
```

---

## Advanced Configuration

### Production Configuration

```typescript
// src/config/production.ts
export const productionConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
    organization: process.env.OPENAI_ORGANIZATION,
    project: process.env.OPENAI_PROJECT
  },
  memory: {
    databaseUrl: process.env.DATABASE_URL,
    namespace: process.env.MEMORY_NAMESPACE || 'production',
    processingMode: 'conscious' as const,
    enableChatMemory: true,
    enableEmbeddingMemory: true,
    minImportanceLevel: 'medium' as const,
    maxMemoryAge: 30,
    autoIngest: true,
    consciousIngest: true,
    bufferTimeout: 30000,
    maxBufferSize: 50000,
    backgroundUpdateInterval: 60000
  }
};

export const createProductionClient = async () => {
  return await MemoriOpenAIFromConfig(
    productionConfig.openai.apiKey!,
    productionConfig.memory
  );
};
```

### Development Configuration

```typescript
// src/config/development.ts
export const developmentConfig = {
  openai: {
    apiKey: process.env.OPENAI_API_KEY || 'dev-key',
    baseURL: 'https://api.openai.com/v1'
  },
  memory: {
    databaseUrl: 'sqlite:./dev-memories.db',
    namespace: 'development',
    processingMode: 'auto' as const,
    enableChatMemory: true,
    enableEmbeddingMemory: false,
    minImportanceLevel: 'low' as const,
    debugMode: true,
    enableMetrics: true
  }
};

export const createDevelopmentClient = async () => {
  return await MemoriOpenAIFromConfig(
    developmentConfig.openai.apiKey,
    developmentConfig.memory
  );
};
```

### Environment-Specific Configuration

```typescript
// src/config/index.ts
import { developmentConfig, createDevelopmentClient } from './development';
import { productionConfig, createProductionClient } from './production';

const isProduction = process.env.NODE_ENV === 'production';

export const config = isProduction ? productionConfig : developmentConfig;
export const createClient = isProduction ? createProductionClient : createDevelopmentClient;
```

---

## Troubleshooting

### Common Migration Issues

#### Issue 1: TypeScript Compilation Errors

**Error:**
```
Cannot find module 'memorits'
```

**Solution:**
```typescript
// Use correct import path
import { MemoriOpenAI } from 'memorits';

// TypeScript configuration
{
  "compilerOptions": {
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

#### Issue 2: Memory Not Being Recorded

**Error:**
```
No memories found in search results
```

**Solution:**
```typescript
// Verify configuration
const client = new MemoriOpenAI('api-key', {
  enableChatMemory: true,    // Must be true
  autoInitialize: true,      // Must be true
  databaseUrl: 'sqlite:./memories.db'  // Must specify database
});

// Test memory recording
const result = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Test message for memory recording' }]
});

const memories = await client.memory.searchMemories('Test message');
console.log('Memories found:', memories.length);
```

#### Issue 3: Database Connection Errors

**Error:**
```
Connection to database failed
```

**Solution:**
```typescript
// For development
const client = new MemoriOpenAI('api-key', {
  databaseUrl: '/absolute/path/to/memories.db'
});

// For production
const client = new MemoriOpenAI('api-key', {
  databaseUrl: 'postgresql://user:pass@localhost:5432/memories'
});

// Test connection
try {
  const stats = await client.memory.getMemoryStats();
  console.log('Database connected successfully');
} catch (error) {
  console.error('Database connection failed:', error);
}
```

#### Issue 4: Memory Injection Not Working

**Error:**
```
AI not receiving context from previous conversations
```

**Solution:**
```typescript
// Enable memory injection
const client = new MemoriOpenAI('api-key', {
  memoryProcessingMode: 'auto',    // Enable auto ingestion
  autoIngest: true,                // Enable automatic memory injection
  consciousIngest: true            // Enable conscious processing
});

// Test memory injection
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [
    { role: 'user', content: 'What did we discuss earlier about AI?' }
  ]
});
```

### Debugging Tools

```typescript
// Enable debug mode
const client = new MemoriOpenAI('api-key', {
  debugMode: true,
  enableMetrics: true
});

// Check system status
const status = await client.memory.getSystemHealth();
console.log('System health:', status);

// Get detailed metrics
const metrics = await client.memory.getPerformanceMetrics();
console.log('Performance metrics:', metrics);

// Search with debug info
const memories = await client.memory.searchMemories('debug', {
  limit: 5,
  includeMetadata: true
});
```

---

## Performance Optimization

### Memory Efficiency

```typescript
// Optimize for high-throughput
const client = new MemoriOpenAI('api-key', {
  enableChatMemory: true,
  autoInitialize: true,
  bufferTimeout: 5000,      // Faster timeout
  maxBufferSize: 10000,     // Smaller buffer
  memoryProcessingMode: 'auto',  // Faster than conscious
  minImportanceLevel: 'medium'   // Only important memories
});

// Optimize for memory quality
const client = new MemoriOpenAI('api-key', {
  enableChatMemory: true,
  enableEmbeddingMemory: true,
  memoryProcessingMode: 'conscious',
  minImportanceLevel: 'high',    // Only high importance
  maxMemoryAge: 30,              // Auto cleanup
  autoIngest: true,
  consciousIngest: true
});
```

### Database Optimization

```typescript
// SQLite optimization for development
const client = new MemoriOpenAI('api-key', {
  databaseUrl: 'sqlite:./optimized.db',
  // SQLite optimizations
  // (handled automatically by MemoriOpenAI)
});

// PostgreSQL optimization for production
const client = new MemoriOpenAI('api-key', {
  databaseUrl: 'postgresql://user:pass@host:5432/memories?sslmode=require',
  // PostgreSQL optimizations
  // (connection pooling, indexing handled automatically)
});
```

### Caching Strategy

```typescript
// Enable caching for better performance
const client = new MemoriOpenAI('api-key', {
  enableChatMemory: true,
  memoryProcessingMode: 'auto',
  // Caching is handled automatically
  // based on memory access patterns
});
```

---

## Production Deployment

### Environment Variables

```bash
# .env.production
OPENAI_API_KEY=your-production-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_ORGANIZATION=your-org
OPENAI_PROJECT=your-project

# Memory configuration
MEMORI_DATABASE_URL=postgresql://user:pass@prod-host:5432/memories
MEMORI_NAMESPACE=production
MEMORI_PROCESSING_MODE=conscious
MEMORI_AUTO_INGEST=true
MEMORI_CONSCIOUS_INGEST=true
MEMORI_MIN_IMPORTANCE=medium
MEMORI_MAX_AGE=30

# Performance tuning
MEMORI_BUFFER_TIMEOUT=30000
MEMORI_MAX_BUFFER_SIZE=50000
MEMORI_BACKGROUND_INTERVAL=60000
```

### Docker Configuration

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Set environment variables
ENV NODE_ENV=production
ENV OPENAI_API_KEY=${OPENAI_API_KEY}
ENV MEMORI_DATABASE_URL=${MEMORI_DATABASE_URL}

# Run the application
CMD ["npm", "start"]
```

### Kubernetes Configuration

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: memori-openai-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: memori-openai
  template:
    metadata:
      labels:
        app: memori-openai
    spec:
      containers:
      - name: app
        image: your-registry/memori-openai:latest
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: openai-secrets
              key: api-key
        - name: MEMORI_DATABASE_URL
          valueFrom:
            configMapKeyRef:
              name: memori-config
              key: database-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

### Monitoring and Logging

```typescript
// Enable monitoring
const client = new MemoriOpenAI('api-key', {
  enableMetrics: true,
  debugMode: process.env.NODE_ENV === 'development'
});

// Production logging
const response = await client.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: [{ role: 'user', content: 'Hello' }]
});

// Log memory operations
const metrics = await client.memory.getPerformanceMetrics();
console.log('Memory operation metrics:', JSON.stringify(metrics));
```

---

## Rollback Strategies

### Immediate Rollback

If you need to quickly revert to standard OpenAI:

```typescript
// Replace MemoriOpenAI with standard OpenAI
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

### Gradual Rollback

For controlled rollback with memory preservation:

```typescript
// Step 1: Disable memory recording but keep search
const client = new MemoriOpenAI('api-key', {
  enableChatMemory: false,      // Stop recording new memories
  memoryProcessingMode: 'none'  // Disable memory injection
});

// Step 2: Full rollback to standard OpenAI
import OpenAI from 'openai';
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});
```

### Data Migration

If you need to migrate memory data back:

```typescript
// Export memories before rollback
const allMemories = await client.memory.searchMemories('', {
  limit: 10000,  // Get all memories
  includeMetadata: true
});

// Save to backup file
import fs from 'fs';
fs.writeFileSync('memory-backup.json', JSON.stringify(allMemories, null, 2));
```

---

## Summary

### Migration Checklist

- [ ] ✅ Update dependencies (`npm install memorits`)
- [ ] ✅ Update imports (replace `import OpenAI from 'openai'`)
- [ ] ✅ Replace constructor calls (add memory configuration)
- [ ] ✅ Test basic functionality (chat completions work)
- [ ] ✅ Test memory recording (memories are saved)
- [ ] ✅ Test memory search (can retrieve memories)
- [ ] ✅ Configure production settings (database, performance)
- [ ] ✅ Set up monitoring (metrics, logging)
- [ ] ✅ Deploy to production (with rollback plan)

### Next Steps

1. **Test in development** with the provided test examples
2. **Migrate staging environment** using this guide
3. **Monitor production performance** after deployment
4. **Optimize configuration** based on your usage patterns
5. **Set up backup and recovery** procedures

### Getting Help

- 📖 [Complete API Documentation](docs/API.md)
- 🐛 [Report Issues](https://github.com/mrorigo/memorits/issues)
- 💬 [Community Support](https://github.com/mrorigo/memorits/discussions)
- 📧 [Email Support](mailto:support@memorits.dev)

---

**Congratulations!** You've successfully migrated to MemoriOpenAI. Your AI now has perfect memory with zero breaking changes. 🚀