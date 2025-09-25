// src/core/agents/MemoryAgent.ts
import { z } from 'zod';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import {
  ProcessedLongTermMemorySchema,
  MemoryClassification,
  MemoryImportanceLevel,
} from '../types/schemas';
import { MemoryProcessingParams } from '../types/models';

// Memory processing schema definition for prompt generation
const MEMORY_SCHEMA = {
  content: 'string',
  summary: 'string',
  classification: 'ESSENTIAL|CONTEXTUAL|CONVERSATIONAL|REFERENCE|PERSONAL|CONSCIOUS_INFO',
  importance: 'CRITICAL|HIGH|MEDIUM|LOW',
  topic: 'string',
  entities: ['string'],
  keywords: ['string'],
  confidenceScore: 'number',
  classificationReason: 'string',
  promotionEligible: 'boolean',
} as const;

// Detailed classification guidelines
const CLASSIFICATION_GUIDELINES = `
CLASSIFICATION GUIDELINES:
- ESSENTIAL: Critical information, facts, or decisions that must be remembered
- CONTEXTUAL: Supporting information that provides useful background
- CONVERSATIONAL: General discussion without lasting importance
- REFERENCE: Technical information, links, or reference material
- PERSONAL: User-specific preferences, habits, or personal details
- CONSCIOUS_INFO: Insights requiring higher-order reasoning or pattern recognition
`;

// Importance level criteria
const IMPORTANCE_CRITERIA = `
IMPORTANCE CRITERIA:
- CRITICAL (0.8-1.0): Must-remember information affecting decisions or safety
- HIGH (0.6-0.8): Important information with significant relevance
- MEDIUM (0.4-0.6): Useful information with moderate relevance
- LOW (0.0-0.4): Background information with limited importance
`;

export class MemoryAgent {
  private openaiProvider: OpenAIProvider;

  constructor(openaiProvider: OpenAIProvider) {
    this.openaiProvider = openaiProvider;
  }

  /**
   * Process LLM response and return validated memory object
   * This method can be tested independently of OpenAI API calls
   */
  static processLLMResponse(
    content: string,
    chatId: string,
  ): z.infer<typeof ProcessedLongTermMemorySchema> {
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
    } catch {
      console.warn('Failed to parse JSON response, using fallback:', cleanContent.substring(0, 100));
      throw new Error('Invalid JSON response from model');
    }

    // Convert uppercase enum values to lowercase to match schema expectations
    const normalizedClassification = parsedMemory.classification?.toLowerCase();
    const normalizedImportance = parsedMemory.importance?.toLowerCase();

    // Validate with Zod schema
    return ProcessedLongTermMemorySchema.parse({
      ...parsedMemory,
      conversationId: chatId,
      classification: normalizedClassification || MemoryClassification.CONVERSATIONAL,
      importance: normalizedImportance || MemoryImportanceLevel.MEDIUM,
      entities: parsedMemory.entities || [],
      keywords: parsedMemory.keywords || [],
    });
  }

  /**
   * Create fallback memory structure for error cases
   * This method can be tested independently
   */
  static createFallbackMemory(
    userInput: string,
    aiOutput: string,
    chatId: string,
  ): z.infer<typeof ProcessedLongTermMemorySchema> {
    return ProcessedLongTermMemorySchema.parse({
      content: userInput + ' ' + aiOutput,
      summary: userInput.slice(0, 100) + '...',
      classification: MemoryClassification.CONVERSATIONAL,
      importance: MemoryImportanceLevel.MEDIUM,
      entities: [],
      keywords: [],
      conversationId: chatId,
      confidenceScore: 0.5,
      classificationReason: 'Fallback processing due to error',
      promotionEligible: false,
    });
  }

  async processConversation(params: MemoryProcessingParams): Promise<z.infer<typeof ProcessedLongTermMemorySchema>> {
    const systemPrompt = `You are a memory processing agent specializing in conversational analysis.

${CLASSIFICATION_GUIDELINES}
${IMPORTANCE_CRITERIA}

CONTEXT USAGE:
- Prioritize current conversation over historical context
- Use user preferences and project context to inform classification
- Consider conversation flow and topic transitions

Return valid JSON matching this exact schema: ${JSON.stringify(MEMORY_SCHEMA, null, 2)}`;

    // Create structured context template
    const contextTemplate = `
User Preferences: ${params.context.userPreferences?.join(', ') || 'None'}
Current Projects: ${params.context.currentProjects?.join(', ') || 'None'}
Relevant Skills: ${params.context.relevantSkills?.join(', ') || 'None'}
`;

    const userPrompt = `Analyze this conversation segment:

CURRENT CONVERSATION:
User: ${params.userInput}
AI: ${params.aiOutput}

${contextTemplate}

INSTRUCTIONS:
1. Extract the core information and its significance
2. Determine appropriate classification based on content type and importance
3. Identify key entities (people, places, concepts) and topics
4. Generate concise summary (max 200 characters)
5. Provide clear reasoning for your classification choice
6. Set confidence score (0.0-1.0) based on analysis clarity
7. Determine if this warrants conscious context promotion

Extract and classify this memory:`;

    try {
      const response = await this.openaiProvider.getClient().chat.completions.create({
        model: this.openaiProvider.getModel(),
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      return MemoryAgent.processLLMResponse(content, params.chatId);
    } catch (error) {
      console.error('Memory processing failed:', error);
      return MemoryAgent.createFallbackMemory(params.userInput, params.aiOutput, params.chatId);
    }
  }
}