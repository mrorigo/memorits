/**
 * Base configuration interface for LLM providers
 */
export interface IProviderConfig {
  /** API key for the provider */
  apiKey: string;
  /** Model to use for completions */
  model?: string;
  /** Base URL for the provider API (optional, for custom endpoints) */
  baseUrl?: string;
  /** Provider-specific configuration options */
  options?: Record<string, any>;
}