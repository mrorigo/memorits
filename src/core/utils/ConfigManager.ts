// src/core/utils/ConfigManager.ts
import { z } from 'zod';

export const MemoriConfigSchema = z.object({
  databaseUrl: z.string().default('file:./memori.db'),
  namespace: z.string().default('default'),
  consciousIngest: z.boolean().default(false),
  autoIngest: z.boolean().default(false),
  model: z.string().default('gpt-4o-mini'),
  apiKey: z.string(),
  baseUrl: z.string().optional(),
  userContext: z.object({
    userPreferences: z.array(z.string()).optional(),
    currentProjects: z.array(z.string()).optional(),
    relevantSkills: z.array(z.string()).optional(),
  }).optional(),
});

export type MemoriConfig = z.infer<typeof MemoriConfigSchema>;

export class ConfigManager {
  static loadConfig(): MemoriConfig {
    const configData: any = {
      databaseUrl: process.env.DATABASE_URL || 'file:./memori.db',
      namespace: process.env.MEMORI_NAMESPACE || 'default',
      consciousIngest: process.env.MEMORI_CONSCIOUS_INGEST === 'true',
      autoIngest: process.env.MEMORI_AUTO_INGEST === 'true',
      model: process.env.MEMORI_MODEL || 'gpt-4o-mini',
      apiKey: process.env.OPENAI_API_KEY || '',
      baseUrl: process.env.OPENAI_BASE_URL,
    };

    // Validate that we have the minimum required configuration
    if (!configData.apiKey || configData.apiKey === 'your-openai-api-key-here') {
      // For Ollama, we don't need a real API key, but we should have a baseUrl
      if (!configData.baseUrl) {
        throw new Error('Invalid configuration: Either provide a valid OPENAI_API_KEY or set OPENAI_BASE_URL for Ollama');
      }
      // Set a dummy API key for Ollama
      configData.apiKey = 'ollama-local';
    }

    return MemoriConfigSchema.parse(configData);
  }
}