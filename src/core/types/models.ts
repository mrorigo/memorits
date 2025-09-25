// src/core/types/models.ts
import { MemoryClassification, MemoryImportanceLevel, ProcessedLongTermMemory, ConversationContext as ZodConversationContext } from './schemas';

// Re-export Zod types for convenience
export { MemoryClassification, MemoryImportanceLevel, ProcessedLongTermMemory };
export type ConversationContext = ZodConversationContext;

// Core API Interfaces
export interface MemorySearchResult {
  id: string;
  content: string;
  summary: string;
  classification: MemoryClassification;
  importance: MemoryImportanceLevel;
  topic?: string;
  entities: string[];
  keywords: string[];
  confidenceScore: number;
  classificationReason: string;
  metadata?: Record<string, unknown>;
}

export interface ConversationMetadata {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  tokensUsed?: number;
  modelType?: 'openai' | 'ollama';
  conversationIndex?: number;
  category?: string;
  [key: string]: unknown;
}

export interface RecordConversationOptions {
  model?: string;
  metadata?: ConversationMetadata;
}

// Database Operation Interfaces
export interface SearchOptions {
  namespace?: string;
  limit?: number;
  minImportance?: MemoryImportanceLevel;
  categories?: MemoryClassification[];
  includeMetadata?: boolean;
}

export interface DatabaseStats {
  totalConversations: number;
  totalMemories: number;
  shortTermMemories: number;
  longTermMemories: number;
  consciousMemories: number;
  lastActivity?: Date;
}

// Provider Interfaces
export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface EmbeddingResult {
  vector: number[];
  tokensUsed: number;
  model: string;
}

// Agent Interfaces
export interface ConsciousMemory extends MemorySearchResult {
  processedAt?: Date;
  isConsciousContext: boolean;
}

export interface MemoryProcessingParams {
  chatId: string;
  userInput: string;
  aiOutput: string;
  context: ConversationContext;
}

export interface MemoryProcessingResult {
  success: boolean;
  memory?: ProcessedLongTermMemory;
  error?: string;
  processingTime: number;
  fallbackUsed?: boolean;
}

// Configuration Interfaces
export interface UserContext {
  userPreferences?: string[];
  currentProjects?: string[];
  relevantSkills?: string[];
}

export interface MemoriConfig {
  databaseUrl: string;
  namespace: string;
  consciousIngest: boolean;
  autoIngest: boolean;
  model: string;
  apiKey: string;
  baseUrl?: string;
  userContext?: UserContext;
  backgroundUpdateInterval?: number;
}

// Logger Interfaces
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

export interface LogContext {
  component?: string;
  userId?: string;
  sessionId?: string;
  chatId?: string;
  namespace?: string;
  [key: string]: any;
}

export interface LoggerConfig {
  level: LogLevel;
  enableFileLogging: boolean;
  enableConsoleLogging: boolean;
  logDir?: string;
  environment: 'development' | 'production' | 'test';
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type MemoryWithMetadata = ProcessedLongTermMemory & {
  metadata: ConversationMetadata;
};

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};