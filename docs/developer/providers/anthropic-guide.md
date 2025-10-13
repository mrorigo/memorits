# 🤖 Anthropic Provider Guide

## Overview

The `AnthropicProvider` enables integration with Anthropic's Claude models through their REST API. This provider supports Claude-3, Claude-2, and other Anthropic models with full message handling, error management, and rate limiting.

## Features

- **Full Claude Support**: Compatible with all Claude models (Claude-3, Claude-2, etc.)
- **Anthropic API Integration**: Native REST API integration with proper authentication
- **Message Format Conversion**: Automatic conversion between standard and Anthropic message formats
- **Error Handling**: Comprehensive error handling with detailed error messages
- **Rate Limiting**: Built-in rate limiting and retry logic
- **Health Monitoring**: Provider health checks and diagnostic information

## Configuration

### Basic Configuration

```typescript
import { AnthropicProvider, ProviderType } from '@memori/providers';

const config = {
  apiKey: 'sk-ant-api03-your-anthropic-api-key-here',
  model: 'claude-3-5-sonnet-20241022',
  baseUrl: 'https://api.anthropic.com/v1', // Optional, defaults to official API
};

const provider = new AnthropicProvider(config);
await provider.initialize(config);
```

### Advanced Configuration

```typescript
const config = {
  apiKey: 'sk-ant-api03-your-anthropic-api-key-here',
  model: 'claude-3-5-sonnet-20241022',
  baseUrl: 'https://your-custom-anthropic-proxy.com/v1',
  timeout: 60000, // Request timeout in milliseconds
  maxRetries: 3,   // Maximum retry attempts
};
```

### Environment Variables

```bash
# Required: Your Anthropic API key
ANTHROPIC_API_KEY=sk-ant-api03-your-anthropic-api-key-here

# Optional: Custom model (defaults to claude-3-5-sonnet-20241022)
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022

# Optional: Custom base URL for proxies or local deployments
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
```

## Supported Models

| Model | Description | Max Tokens | Notes |
|-------|-------------|------------|-------|
| `claude-3-5-sonnet-20241022` | Latest Claude 3.5 Sonnet | 8192 | Default model, recommended for most use cases |
| `claude-3-5-sonnet-20240620` | Claude 3.5 Sonnet (older) | 8192 | Previous version |
| `claude-3-opus-20240229` | Claude 3 Opus | 8192 | Most capable model |
| `claude-3-sonnet-20240229` | Claude 3 Sonnet | 8192 | Balanced performance |
| `claude-3-haiku-20240307` | Claude 3 Haiku | 8192 | Fastest model |

## Usage Examples

### Basic Chat Completion

```typescript
import { AnthropicProvider } from '@memori/providers';

const provider = new AnthropicProvider({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-5-sonnet-20241022',
});

await provider.initialize({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const response = await provider.createChatCompletion({
  messages: [
    { role: 'user', content: 'Hello, Claude! How are you?' }
  ],
  max_tokens: 1000,
  temperature: 0.7,
});

console.log(response.message.content);
```

### System Messages

```typescript
const response = await provider.createChatCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant.' },
    { role: 'user', content: 'Help me debug this JavaScript function.' }
  ],
  max_tokens: 500,
});
```

### Error Handling

```typescript
try {
  const response = await provider.createChatCompletion({
    messages: [{ role: 'user', content: 'Test message' }],
  });

  console.log('Success:', response.message.content);
} catch (error) {
  console.error('Error:', error.message);

  // Check if provider is healthy
  const isHealthy = await provider.isHealthy();
  console.log('Provider healthy:', isHealthy);
}
```

### Diagnostics

```typescript
const diagnostics = await provider.getDiagnostics();
console.log('Provider status:', {
  type: diagnostics.providerType,
  healthy: diagnostics.isHealthy,
  model: diagnostics.model,
  metadata: diagnostics.metadata,
});
```

## Message Format Conversion

The provider automatically converts between standard message formats and Anthropic's format:

### Standard Format → Anthropic Format

```typescript
// Standard format
{
  role: 'system',
  content: 'You are a helpful assistant.'
}

// Converted to Anthropic format
// System message is extracted and passed separately
```

```typescript
// Standard format
{
  role: 'user',
  content: 'Hello!'
}

// Converted to Anthropic format
{
  role: 'user',
  content: 'Hello!'
}
```

## Best Practices

### 1. API Key Security

- Store API keys in environment variables, never in code
- Use restricted API keys with minimal required permissions
- Rotate API keys regularly

### 2. Error Handling

- Always wrap provider calls in try-catch blocks
- Check provider health before making requests
- Implement retry logic for transient failures

### 3. Rate Limiting

- Respect Anthropic's rate limits (requests per minute)
- Implement exponential backoff for retries
- Monitor usage to avoid hitting limits

### 4. Model Selection

- Use `claude-3-5-sonnet-20241022` for most use cases
- Consider `claude-3-haiku-20240307` for latency-sensitive applications
- Use `claude-3-opus-20240229` for maximum capability when cost is not a constraint

## Common Issues

### Authentication Errors

```typescript
// Error: Invalid API key
Error: Anthropic API error: 401 - Invalid API key

// Solution: Check your API key format and permissions
```

### Rate Limiting

```typescript
// Error: Rate limit exceeded
Error: Anthropic API error: 429 - Rate limit exceeded

// Solution: Implement retry logic with exponential backoff
```

### Model Not Found

```typescript
// Error: Model not available
Error: Anthropic API error: 404 - Model not found

// Solution: Check model name spelling and availability
```

## Performance Considerations

- **Latency**: Anthropic API typically responds within 1-3 seconds
- **Throughput**: Monitor your requests per minute to avoid rate limits
- **Costs**: Track token usage for cost optimization
- **Caching**: Consider caching frequent requests when appropriate

## Integration with Memory System

When used with the memory-enabled wrapper:

```typescript
import { MemoriOpenAI } from '@memori/openai-dropin';

const client = new MemoriOpenAI({
  apiKey: process.env.ANTHROPIC_API_KEY,
  provider: 'anthropic', // Use Anthropic provider
  enableChatMemory: true,
  autoInitialize: true,
});

const response = await client.chat.completions.create({
  model: 'claude-3-5-sonnet-20241022',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Migration from OpenAI

### Configuration Changes

```typescript
// OpenAI configuration
const openaiConfig = {
  apiKey: 'sk-...',
  model: 'gpt-4',
};

// Anthropic configuration
const anthropicConfig = {
  apiKey: 'sk-ant-api03-...', // Different API key format
  model: 'claude-3-5-sonnet-20241022', // Different model name
};
```

### Message Format Differences

- System messages are handled differently (extracted from message array)
- Function calling is not supported in the same way
- Response format is slightly different

## Support and Resources

- **Anthropic Documentation**: [https://docs.anthropic.com/](https://docs.anthropic.com/)
- **API Reference**: [https://docs.anthropic.com/claude/reference/](https://docs.anthropic.com/claude/reference/)
- **Rate Limits**: Check current rate limits in your Anthropic console
- **Pricing**: [https://www.anthropic.com/pricing](https://www.anthropic.com/pricing)