// Core provider interfaces and types
export { ILLMProvider } from './ILLMProvider';
export { IProviderConfig } from './IProviderConfig';
export { ProviderType } from './ProviderType';
export { ProviderDiagnostics } from './types/ProviderDiagnostics';

// Provider implementations
export { OpenAIProvider } from './OpenAIProvider';
export { AnthropicProvider } from './AnthropicProvider';
export { OllamaProvider } from './OllamaProvider';
export { MemoryEnabledLLMProvider } from './MemoryEnabledLLMProvider';

// Factory and registration
export { LLMProviderFactory } from './LLMProviderFactory';

// Configuration management
export { ProviderConfigManager, providerConfigManager } from './ProviderConfigManager';
export type { ProviderConfigWithMemory, EnvironmentProviderConfig, ConfigValidationResult } from './ProviderConfigManager';

// Supporting types
export type { ChatCompletionParams, ChatMessage } from './types/ChatCompletionParams';
export type { ChatCompletionResponse } from './types/ChatCompletionResponse';
export type { EmbeddingParams } from './types/EmbeddingParams';
export type { EmbeddingResponse } from './types/EmbeddingResponse';

// Provider mocking - relocated to tests/mocks for proper separation
// These are now available via tests/mocks for test code only

// Provider testing
export { ProviderTestSuite, ProviderBenchmark } from './testing';
export type { TestCase, TestSuiteResult, TestResult, BenchmarkConfig, ProviderBenchmarkResults, BenchmarkResult } from './testing';

// Performance optimizations
export { ConnectionPool, globalConnectionPool } from './performance/ConnectionPool';
export { RequestCache, globalRequestCache } from './performance/RequestCache';
export { HealthMonitor, globalHealthMonitor } from './performance/HealthMonitor';
export { OptimizedProvider, createOptimizedProvider } from './performance/OptimizedProvider';
export type { ConnectionPoolConfig, PooledConnection } from './performance/ConnectionPool';
export type { RequestCacheConfig } from './performance/RequestCache';
export type { HealthMonitorConfig, ProviderHealthStatus, HealthCheckEvent } from './performance/HealthMonitor';
export type { OptimizedProviderConfig } from './performance/OptimizedProvider';