// src/core/agents/MemoryAgent.ts
import OpenAI from 'openai';
import { z } from 'zod';
import {
  ProcessedLongTermMemorySchema,
  ConversationContextSchema,
  MemoryClassification,
  MemoryImportanceLevel
} from '../types/schemas';

export class MemoryAgent {
  private openai: OpenAI;
  private model: string;

  constructor(config: { apiKey: string; model?: string; baseUrl?: string }) {
    // Handle dummy API key for Ollama
    const apiKey = config.apiKey === 'ollama-local' ? 'sk-dummy-key-for-ollama' : config.apiKey;

    this.openai = new OpenAI({
      apiKey: apiKey,
      baseURL: config.baseUrl
    });
    this.model = config.model || 'gpt-4o-mini';
  }

  async processConversation(params: {
    chatId: string;
    userInput: string;
    aiOutput: string;
    context: any;
  }): Promise<z.infer<typeof ProcessedLongTermMemorySchema>> {
    const systemPrompt = `You are a memory processing agent. Analyze the conversation and extract structured memory information.

Classify the memory into appropriate categories and determine its importance level.
Extract entities, topics, and determine if this should be promoted to conscious context.

Return JSON with this structure:
{
  "content": "full memory content",
  "summary": "concise summary",
  "classification": "ESSENTIAL|CONTEXTUAL|CONVERSATIONAL|REFERENCE|PERSONAL|CONSCIOUS_INFO",
  "importance": "CRITICAL|HIGH|MEDIUM|LOW",
  "topic": "main topic",
  "entities": ["entity1", "entity2"],
  "keywords": ["keyword1", "keyword2"],
  "confidenceScore": 0.8,
  "classificationReason": "explanation",
  "promotionEligible": false
}`;

    const userPrompt = `Conversation:
User: ${params.userInput}
AI: ${params.aiOutput}

Context: ${JSON.stringify(params.context)}

Extract and classify this memory:`;

    try {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      // Clean up the content - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      let parsedMemory;
      try {
        parsedMemory = JSON.parse(cleanContent);
      } catch (parseError) {
        console.warn('Failed to parse JSON response, using fallback:', cleanContent.substring(0, 100));
        throw new Error('Invalid JSON response from model');
      }

      // Convert uppercase enum values to lowercase to match schema expectations
      const normalizedClassification = parsedMemory.classification?.toLowerCase();
      const normalizedImportance = parsedMemory.importance?.toLowerCase();

      // Validate with Zod schema
      const validatedMemory = ProcessedLongTermMemorySchema.parse({
        ...parsedMemory,
        conversationId: params.chatId,
        classification: normalizedClassification || MemoryClassification.CONVERSATIONAL,
        importance: normalizedImportance || MemoryImportanceLevel.MEDIUM,
        entities: parsedMemory.entities || [],
        keywords: parsedMemory.keywords || [],
      });

      return validatedMemory;
    } catch (error) {
      console.error('Memory processing failed:', error);
      // Return fallback memory structure
      return ProcessedLongTermMemorySchema.parse({
        content: params.userInput + ' ' + params.aiOutput,
        summary: params.userInput.slice(0, 100) + '...',
        classification: MemoryClassification.CONVERSATIONAL,
        importance: MemoryImportanceLevel.MEDIUM,
        entities: [],
        keywords: [],
        conversationId: params.chatId,
        confidenceScore: 0.5,
        classificationReason: 'Fallback processing due to error',
        promotionEligible: false,
      });
    }
  }
}