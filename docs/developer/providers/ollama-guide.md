# 🦙 Ollama Provider Guide

## Overview

The `OllamaProvider` enables integration with local Ollama models running on your machine. This provider supports running LLMs locally without requiring internet connectivity or API keys, making it ideal for development, privacy-sensitive applications, and offline scenarios.

## Features

- **Local Model Execution**: Run models locally without internet connectivity
- **No API Keys Required**: Uses local endpoints, no authentication needed
- **Offline Capability**: Works completely offline once models are downloaded
- **Model Flexibility**: Support for any model compatible with Ollama
- **Performance Optimization**: Optimized for local execution
- **Health Monitoring**: Automatic detection of Ollama service status

## Prerequisites

### 1. Install Ollama

**macOS/Linux:**
```bash
curl -fsSL https://ollama.ai/install.sh | sh
```

**Windows:**
Download and run the installer from [https://ollama.ai/download](https://ollama.ai/download)

**Docker:**
```bash
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

### 2. Start Ollama Service

```bash
ollama serve
```

The service runs on `http://localhost:11434` by default.

### 3. Download Models

```bash
# Download a model (e.g., Llama 2 7B)
ollama pull llama2:7b

# Download other popular models
ollama pull mistral:7b
ollama pull codellama:7b
ollama pull vicuna:7b
```

## Configuration

### Basic Configuration

```typescript
import { OllamaProvider, ProviderType } from '@memori/providers';

const config = {
  baseUrl: 'http://localhost:11434', // Default Ollama endpoint
  model: 'llama2:7b',                // Model to use
};

const provider = new OllamaProvider(config);
await provider.initialize(config);
```

### Custom Configuration

```typescript
const config = {
  baseUrl: 'http://192.168.1.100:11434', // Custom Ollama server
  model: 'mistral:7b',
  timeout: 120000, // Longer timeout for larger models
};
```

### Environment Variables

```bash
# Optional: Custom Ollama endpoint
OLLAMA_BASE_URL=http://localhost:11434

# Optional: Default model to use
OLLAMA_MODEL=llama2:7b
```

## Supported Models

Ollama supports hundreds of models. Here are some popular ones:

| Model | Size | Description | Use Case |
|-------|------|-------------|----------|
| `llama2:7b` | 7B | Meta Llama 2 | General purpose, balanced performance |
| `llama2:13b` | 13B | Meta Llama 2 | Better quality, higher resource usage |
| `mistral:7b` | 7B | Mistral AI | High quality, efficient |
| `codellama:7b` | 7B | Code Llama | Code generation and understanding |
| `vicuna:7b` | 7B | Vicuna | Instruction following |
| `orca-mini:3b` | 3B | Orca Mini | Lightweight, fast responses |

### Finding Available Models

```bash
# List downloaded models
ollama list

# Search for models to download
ollama search llama2
ollama search mistral
ollama search codellama
```

## Usage Examples

### Basic Chat Completion

```typescript
import { OllamaProvider } from '@memori/providers';

const provider = new OllamaProvider({
  baseUrl: 'http://localhost:11434',
  model: 'llama2:7b',
});

await provider.initialize({
  baseUrl: 'http://localhost:11434',
});

const response = await provider.createChatCompletion({
  messages: [
    { role: 'user', content: 'Hello! Tell me about yourself.' }
  ],
  max_tokens: 200,
  temperature: 0.7,
});

console.log(response.message.content);
```

### System Messages

```typescript
const response = await provider.createChatCompletion({
  messages: [
    { role: 'system', content: 'You are a helpful coding assistant. Provide clear, concise explanations.' },
    { role: 'user', content: 'Explain how async/await works in JavaScript.' }
  ],
  max_tokens: 300,
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

  // Check if Ollama service is running
  const isHealthy = await provider.isHealthy();
  console.log('Ollama running:', isHealthy);
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

## Embeddings Support

Ollama provider supports embedding generation for models that have embedding capabilities:

```typescript
const embeddingResponse = await provider.createEmbedding({
  input: 'The future of AI is bright',
  model: 'llama2:7b', // Use embedding-capable model
});

console.log('Embedding dimension:', embeddingResponse.data[0].embedding.length);
console.log('Embedding vector:', embeddingResponse.data[0].embedding.slice(0, 10));
```

## Best Practices

### 1. Service Management

- **Auto-start**: Configure Ollama to start automatically with your system
- **Health Checks**: Always check if Ollama is running before making requests
- **Resource Monitoring**: Monitor CPU and memory usage, especially with larger models

### 2. Model Selection

- **Start Small**: Begin with smaller models (3B-7B) for testing
- **Match Use Case**: Choose models based on your specific needs:
  - `llama2` for general purposes
  - `codellama` for coding tasks
  - `mistral` for high-quality responses

### 3. Performance Optimization

- **Hardware Acceleration**: Use GPU if available for better performance
- **Model Quantization**: Consider quantized versions for faster inference
- **Context Management**: Keep context windows reasonable to manage memory usage

### 4. Error Handling

- **Connection Errors**: Handle cases where Ollama service is not running
- **Model Loading**: Be patient when loading models for the first time
- **Resource Limits**: Handle out-of-memory errors gracefully

## Common Issues

### Ollama Service Not Running

```typescript
// Error: Connection refused
Error: Ollama API error: ECONNREFUSED

// Solution: Start Ollama service
ollama serve

// Or check if it's already running
curl http://localhost:11434/api/version
```

### Model Not Found

```typescript
// Error: Model not available
Error: Ollama API error: 404 - Model not found

// Solution: Download the model first
ollama pull llama2:7b
```

### Out of Memory

```typescript
// Error: Insufficient memory
Error: Ollama API error: 500 - Insufficient memory

// Solution: Use smaller model or reduce context
ollama pull llama2:7b  // Instead of llama2:13b
```

### Slow Responses

```typescript
// Issue: Very slow responses

// Solutions:
// 1. Use GPU acceleration if available
// 2. Use smaller, quantized models
// 3. Reduce context length
// 4. Check system resources
```

## Performance Considerations

### Local vs Cloud

| Aspect | Ollama (Local) | Cloud APIs |
|--------|----------------|------------|
| **Latency** | Very low (local) | Network dependent |
| **Cost** | Free (your hardware) | Pay per token |
| **Privacy** | Complete | Depends on provider |
| **Reliability** | Depends on hardware | High (SLA) |
| **Scalability** | Limited by hardware | Virtually unlimited |

### Hardware Requirements

| Model Size | Minimum RAM | Recommended RAM | GPU |
|------------|-------------|-----------------|-----|
| 3B-7B | 8GB | 16GB | Optional |
| 13B | 16GB | 32GB | Recommended |
| 30B+ | 32GB+ | 64GB+ | Required |

### Performance Tuning

```bash
# Run with GPU acceleration (NVIDIA)
OLLAMA_USE_CUDA=1 ollama serve

# Run with GPU acceleration (AMD)
OLLAMA_USE_ROCM=1 ollama serve

# Limit context to improve speed
ollama run llama2:7b --context 2048
```

## Integration with Memory System

When used with the memory-enabled wrapper:

```typescript
import { MemoriOpenAI } from '@memori/openai-dropin';

const client = new MemoriOpenAI({
  apiKey: 'ollama-local', // Special API key for Ollama
  baseURL: 'http://localhost:11434/v1', // Use OpenAI-compatible endpoint
  enableChatMemory: true,
  autoInitialize: true,
});

const response = await client.chat.completions.create({
  model: 'llama2:7b',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## Migration from Cloud Providers

### Benefits of Local Models

1. **Privacy**: Complete data control, no external API calls
2. **Cost**: No usage costs after initial setup
3. **Latency**: Sub-second response times
4. **Reliability**: No network dependencies
5. **Customization**: Full control over model versions and parameters

### Migration Steps

```typescript
// Cloud configuration (OpenAI/Anthropic)
const cloudConfig = {
  apiKey: 'sk-...',
  model: 'gpt-4',
};

// Local configuration (Ollama)
const localConfig = {
  baseUrl: 'http://localhost:11434',
  model: 'llama2:7b', // Choose equivalent model
};
```

### Model Equivalents

| Cloud Model | Ollama Equivalent | Notes |
|-------------|-------------------|-------|
| GPT-4 | llama2:13b | Similar capabilities, different style |
| GPT-3.5 | llama2:7b | Good balance of speed and quality |
| Claude | mistral:7b | Similar helpfulness |
| Code-focused | codellama:7b | Specialized for coding |

## Advanced Usage

### Custom Ollama Server

```typescript
const provider = new OllamaProvider({
  baseUrl: 'http://192.168.1.100:11434', // Remote Ollama server
  model: 'mistral:7b',
});
```

### Model Parameters

```typescript
const response = await provider.createChatCompletion({
  messages: [{ role: 'user', content: 'Write a story' }],
  max_tokens: 500,
  temperature: 0.8,
  top_p: 0.9,
  options: {
    // Ollama-specific parameters
    repeat_penalty: 1.1,
    presence_penalty: 0.1,
  },
});
```

## Troubleshooting

### Check Ollama Status

```bash
# Check if Ollama is running
curl http://localhost:11434/api/version

# List available models
curl http://localhost:11434/api/tags

# Test basic functionality
curl http://localhost:11434/api/generate -d '{"model": "llama2:7b", "prompt": "Hello"}'
```

### Logs and Debugging

```bash
# View Ollama logs
ollama serve 2>&1 | tee ollama.log

# Monitor resource usage
htop  # or top
nvidia-smi  # if using GPU
```

### Common Commands

```bash
# Download a model
ollama pull llama2:7b

# Remove a model
ollama rm llama2:7b

# Show model information
ollama show llama2:7b

# List running models
ollama ps
```

## Support and Resources

- **Ollama Documentation**: [https://github.com/jmorganca/ollama](https://github.com/jmorganca/ollama)
- **Model Library**: [https://ollama.ai/library](https://ollama.ai/library)
- **GitHub Issues**: [https://github.com/jmorganca/ollama/issues](https://github.com/jmorganca/ollama/issues)
- **Community Discord**: Join the Ollama community for support