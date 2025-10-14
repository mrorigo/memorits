/**
 * Configuration validation for Memori API
 */
import { ValidationResult, MemoriError } from './types';
import { MemoriConfig } from '../core/infrastructure/config/ConfigManager';

/**
 * Configuration validation for unified MemoriConfig
 */
export function validateConfig(config: MemoriConfig): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.databaseUrl) {
    errors.push('databaseUrl is required');
  }

  if (!config.namespace) {
    errors.push('namespace is required');
  }

  if (!config.apiKey) {
    errors.push('apiKey is required');
  } else {
    // Validate API key format based on detected provider
    const detected = detectProvider(config.apiKey);
    if (detected === 'openai' && !config.apiKey.startsWith('sk-')) {
      errors.push('OpenAI API key should start with "sk-"');
    } else if (detected === 'anthropic' && !config.apiKey.startsWith('sk-ant-')) {
      errors.push('Anthropic API key should start with "sk-ant-"');
    } else if (detected === 'ollama' && config.apiKey !== 'ollama-local') {
      warnings.push('Ollama typically uses "ollama-local" as API key');
    }
  }

  if (!config.model) {
    errors.push('model is required');
  } else {
    // Validate model based on detected provider
    const detected = detectProvider(config.apiKey);
    if (detected === 'openai' && !config.model.includes('gpt') && !config.model.includes('text-embedding')) {
      warnings.push('OpenAI model name should typically include "gpt" or "text-embedding"');
    } else if (detected === 'anthropic' && !config.model.includes('claude')) {
      warnings.push('Anthropic model name should typically include "claude"');
    }
  }

  // Additional provider-specific validation based on baseUrl
  if (config.baseUrl) {
    if (config.apiKey === 'ollama-local' && !config.baseUrl.includes('11434') && !config.baseUrl.includes('localhost')) {
      warnings.push('Ollama typically runs on localhost:11434');
    }
  }

  // If we have an API key but can't detect the provider, it's likely invalid
  if (config.apiKey && !detectProvider(config.apiKey) && config.apiKey !== 'ollama-local') {
    errors.push('Could not detect provider from API key. Ensure API key format is correct for OpenAI (sk-...) or Anthropic (sk-ant-...).');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Detect provider from API key pattern
 */
export function detectProvider(apiKey: string): 'openai' | 'anthropic' | 'ollama' | null {
  if (apiKey.startsWith('sk-ant-')) return 'anthropic';
  if (apiKey.startsWith('sk-')) return 'openai';
  if (apiKey === 'ollama-local') return 'ollama';
  return null;
}

/**
 * Provider-specific validation functions (simplified for unified config)
 */
function validateOpenAIConfig(config: MemoriConfig, errors: string[], warnings: string[]) {
  // OpenAI-specific validation is now handled in main validation function
}

function validateAnthropicConfig(config: MemoriConfig, errors: string[], warnings: string[]) {
  // Anthropic-specific validation is now handled in main validation function
}

function validateOllamaConfig(config: MemoriConfig, errors: string[], warnings: string[]) {
  // Ollama-specific validation is now handled in main validation function
}

/**
 * Enhanced error creation with suggestions
 */
export function createMemoriError(
  message: string,
  code?: string,
  suggestions?: string[]
): MemoriError {
  return new MemoriError(message, code, suggestions);
}

/**
 * Common error types for the unified API
 */
export const ErrorCodes = {
  INVALID_CONFIG: 'INVALID_CONFIG',
  DATABASE_ERROR: 'DATABASE_ERROR',
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  MEMORY_ERROR: 'MEMORY_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR'
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];