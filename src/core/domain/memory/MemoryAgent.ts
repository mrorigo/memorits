// src/core/agents/MemoryAgent.ts
/**
 * MemoryAgent with Relationship Extraction
 *
 * This agent processes conversations and extracts structured memory information,
 * including relationships between memories for better context building and recall.
 *
 * Key Features:
 * - Processes conversations with LLM analysis
 * - Extracts memory relationships (continuation, reference, related, supersedes, contradiction)
 * - Calculates relationship confidence and strength scores
 * - Integrates with database for relationship storage
 * - Validates relationships for quality assurance
 *
 * Example Usage:
 * ```typescript
 * const agent = new MemoryAgent(openaiProvider, dbManager);
 *
 * const result = await agent.processConversation({
 *   chatId: 'chat-123',
 *   userInput: 'I need help with TypeScript interfaces',
 *   aiOutput: 'TypeScript interfaces define object structure...',
 *   context: { sessionId: 'session-1', modelUsed: 'gpt-4' }
 * });
 *
 * // Result includes extracted relationships
 * console.log(result.relatedMemories); // Array of MemoryRelationship objects
 * ```
 */
import { z } from 'zod';
import { ILLMProvider } from '../../infrastructure/providers/ILLMProvider';
import {
  ProcessedLongTermMemorySchema,
  MemoryClassification,
  MemoryImportanceLevel,
  MemoryRelationshipType,
  MemoryRelationship,
  ProcessedLongTermMemory,
} from '@/core/types/schemas';
import { MemoryProcessingParams } from '@/core/types/models';
import { DatabaseManager } from '../../infrastructure/database/DatabaseManager';
import { MemoryProcessingState } from './MemoryProcessingStateManager';
import { RelationshipProcessor } from '../search/relationship/RelationshipProcessor';
import { logWarn, logError } from '../../infrastructure/config/Logger';

/**
 * Simple wrapper provider that bypasses memory processing for analysis
 * This prevents infinite recursion when MemoryAgent analyzes conversations
 */
class AnalysisOnlyProvider implements ILLMProvider {
  private wrappedProvider: ILLMProvider;

  constructor(wrappedProvider: ILLMProvider) {
    this.wrappedProvider = wrappedProvider;
  }

  getProviderType() {
    return this.wrappedProvider.getProviderType();
  }

  getConfig() {
    return this.wrappedProvider.getConfig();
  }

  async initialize(config?: any): Promise<void> {
    // Skip initialization to avoid any potential recursion
    return Promise.resolve();
  }

  async dispose(): Promise<void> {
    // Skip disposal as this is just a wrapper
    return Promise.resolve();
  }

  async isHealthy(): Promise<boolean> {
    return this.wrappedProvider.isHealthy();
  }

  async getDiagnostics() {
    return this.wrappedProvider.getDiagnostics();
  }

  getModel(): string {
    return this.wrappedProvider.getModel();
  }

  getClient(): any {
    return this.wrappedProvider.getClient();
  }

  // These methods bypass memory processing to prevent recursion
  async createChatCompletion(params: any) {
    // Directly call the underlying provider's core methods without memory processing
    if (this.wrappedProvider.getClient() && this.wrappedProvider.getClient().chat) {
      // Use the raw client to bypass all wrapper logic
      const client = this.wrappedProvider.getClient();
      const response = await client.chat.completions.create({
        model: params.model || this.wrappedProvider.getModel(),
        messages: params.messages,
        temperature: params.temperature,
        max_tokens: params.max_tokens,
        stream: params.stream || false,
      });

      // Convert to expected format
      return {
        message: {
          role: response.choices[0].message.role || 'assistant',
          content: response.choices[0].message.content || '',
        },
        finish_reason: response.choices[0].finish_reason || 'stop',
        usage: response.usage ? {
          prompt_tokens: response.usage.prompt_tokens,
          completion_tokens: response.usage.completion_tokens,
          total_tokens: response.usage.total_tokens,
        } : undefined,
        id: response.id,
        model: response.model,
        created: response.created,
      };
    }

    // Fallback to wrapped provider if direct client access fails
    return this.wrappedProvider.createChatCompletion(params);
  }

  async createEmbedding(params: any) {
    return this.wrappedProvider.createEmbedding(params);
  }
}

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
  relatedMemories: [{
    type: 'continuation|reference|related|supersedes|contradiction',
    targetMemoryId: 'string (optional)',
    confidence: 'number (0.0-1.0)',
    strength: 'number (0.0-1.0)',
    reason: 'string',
    entities: ['string'],
    context: 'string',
  }],
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
  private llmProvider: ILLMProvider;
  private dbManager?: DatabaseManager;
  private relationshipProcessor?: RelationshipProcessor;

  constructor(openaiProvider: ILLMProvider, dbManager?: DatabaseManager) {
    // Create a raw provider for analysis that doesn't have memory processing
    // This prevents infinite recursion when MemoryAgent analyzes conversations
    this.llmProvider = this.createAnalysisProvider(openaiProvider);
    this.dbManager = dbManager;

    // Initialize relationship processor if database manager is available
    // Use the same analysis provider to avoid recursion during relationship extraction
    if (dbManager && this.llmProvider) {
      this.relationshipProcessor = new RelationshipProcessor(dbManager, this.llmProvider as any);
    }
  }

  /**
   * Create a raw provider for memory analysis that doesn't trigger memory processing
   * This prevents infinite recursion when the MemoryAgent analyzes conversations
   */
  private createAnalysisProvider(baseProvider: ILLMProvider): ILLMProvider {
    try {
      // Get the base provider's configuration
      const baseConfig = baseProvider.getConfig();

      // Create a completely separate configuration for analysis
      const analysisConfig = {
        ...baseConfig,
        features: {
          ...baseConfig.features,
          memory: {
            ...baseConfig.features?.memory,
            enableChatMemory: false, // Disable to prevent recursion during analysis
            enableEmbeddingMemory: false,
            memoryProcessingMode: 'none' as const,
          },
          performance: {
            ...baseConfig.features?.performance,
            enableConnectionPooling: false, // Disable pooling for analysis
            enableCaching: false, // Disable caching for analysis
            enableHealthMonitoring: false, // Disable health monitoring for analysis
          }
        }
      };

      // Create a new provider instance with all memory and performance features disabled
      const ProviderClass = (baseProvider as any).constructor;

      // Create the provider synchronously without going through the factory
      // to avoid any potential initialization issues
      const rawProvider = new ProviderClass(analysisConfig);

      // Initialize it synchronously if possible
      if (typeof rawProvider.initialize === 'function') {
        // Use synchronous initialization if available
        try {
          rawProvider.initialize(analysisConfig);
        } catch (error) {
          // If sync initialization fails, we'll handle it differently
          logWarn('Provider initialization may need async handling', {
            component: 'MemoryAgent',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return rawProvider;
    } catch (error) {
      logWarn('Failed to create analysis provider, using fallback approach', {
        component: 'MemoryAgent',
        error: error instanceof Error ? error.message : String(error),
      });

      // Fallback: create a simple wrapper that bypasses memory processing
      return new AnalysisOnlyProvider(baseProvider);
    }
  }

  /**
   * Set database manager for state tracking
   */
  setDatabaseManager(dbManager: DatabaseManager): void {
    this.dbManager = dbManager;
  }

  /**
   * Process LLM response and return validated memory object
   * This method can be tested independently of provider API calls
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
      logWarn('Failed to parse JSON response, using fallback', {
        component: 'MemoryAgent',
        contentPreview: cleanContent.substring(0, 100),
        chatId,
      });
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

  /**
   * Extract memory relationships from conversation content
   * Analyzes the current conversation against existing memories to find relationships
   */
  async extractMemoryRelationships(
    currentContent: string,
    currentMemory: z.infer<typeof ProcessedLongTermMemorySchema>,
    existingMemories: any[],
  ): Promise<MemoryRelationship[]> {
    try {
      // Analyze conversation for memory references
      const memoryReferences = await this.analyzeMemoryReferences(currentContent, existingMemories);

      // Analyze relationship types
      const relationships = await this.analyzeRelationshipTypes(
        currentContent,
        currentMemory,
        existingMemories,
        memoryReferences,
      );

      // Calculate relationship strength and confidence
      const validatedRelationships = relationships.map(relationship =>
        this.calculateRelationshipStrength(relationship, currentContent, existingMemories),
      );

      return validatedRelationships.filter(r => r.confidence > 0.3); // Filter low-confidence relationships
    } catch (error) {
      logWarn('Failed to extract memory relationships', {
        component: 'MemoryAgent',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  /**
   * Analyze conversation content for references to existing memories
   */
  private async analyzeMemoryReferences(
    content: string,
    existingMemories: any[],
  ): Promise<{ memoryId: string; referenceType: string; context: string }[]> {
    const references: { memoryId: string; referenceType: string; context: string }[] = [];

    for (const memory of existingMemories) {
      const memoryContent = memory.processedData?.content || memory.content || '';
      const memoryTopic = memory.processedData?.topic || memory.topic || '';

      // Check for direct content similarity
      const contentSimilarity = this.calculateTextSimilarity(content.toLowerCase(), memoryContent.toLowerCase());

      // Check for topic/entity overlap
      const topicOverlap = this.calculateTopicOverlap(content, memoryTopic, memory.processedData?.entities || memory.entities || []);

      // Check for temporal references
      const temporalReference = this.detectTemporalReference(content, memoryContent);

      if (contentSimilarity > 0.6 || topicOverlap > 0.4 || temporalReference) {
        references.push({
          memoryId: memory.id,
          referenceType: contentSimilarity > 0.6 ? 'direct' : topicOverlap > 0.4 ? 'topic' : 'temporal',
          context: `Similarity: ${contentSimilarity.toFixed(2)}, Topic overlap: ${topicOverlap.toFixed(2)}`,
        });
      }
    }

    return references;
  }

  /**
   * Analyze and determine relationship types between memories
   */
  private async analyzeRelationshipTypes(
    currentContent: string,
    currentMemory: z.infer<typeof ProcessedLongTermMemorySchema>,
    existingMemories: any[],
    memoryReferences: { memoryId: string; referenceType: string; context: string }[],
  ): Promise<MemoryRelationship[]> {
    const relationships: MemoryRelationship[] = [];

    for (const reference of memoryReferences) {
      const existingMemory = existingMemories.find(m => m.id === reference.memoryId);
      if (!existingMemory) continue;

      const existingContent = existingMemory.processedData?.content || existingMemory.content || '';

      // Continuation detection
      if (this.detectContinuation(currentContent, existingContent)) {
        relationships.push({
          type: MemoryRelationshipType.CONTINUATION,
          targetMemoryId: reference.memoryId,
          confidence: 0.8,
          strength: 0.9,
          reason: 'Conversation continues previous discussion thread',
          entities: this.extractCommonEntities(currentContent, existingContent),
          context: reference.context,
        });
      }

      // Reference detection
      else if (this.detectDirectReference(currentContent, existingContent)) {
        relationships.push({
          type: MemoryRelationshipType.REFERENCE,
          targetMemoryId: reference.memoryId,
          confidence: 0.7,
          strength: 0.8,
          reason: 'Current conversation directly references previous memory',
          entities: this.extractCommonEntities(currentContent, existingContent),
          context: reference.context,
        });
      }

      // Related topic detection
      else if (this.calculateTopicOverlap(currentContent, existingMemory.processedData?.topic || '', existingMemory.processedData?.entities || []) > 0.5) {
        relationships.push({
          type: MemoryRelationshipType.RELATED,
          targetMemoryId: reference.memoryId,
          confidence: 0.6,
          strength: 0.6,
          reason: 'Memories discuss similar topics or entities',
          entities: this.extractCommonEntities(currentContent, existingContent),
          context: reference.context,
        });
      }

      // Contradiction detection
      else if (this.detectContradiction(currentContent, existingContent)) {
        relationships.push({
          type: MemoryRelationshipType.CONTRADICTION,
          targetMemoryId: reference.memoryId,
          confidence: 0.7,
          strength: 0.9,
          reason: 'Current information conflicts with previous memory',
          entities: this.extractCommonEntities(currentContent, existingContent),
          context: reference.context,
        });
      }
    }

    return relationships;
  }

  /**
   * Calculate relationship strength and confidence based on various factors
   */
  private calculateRelationshipStrength(
    relationship: MemoryRelationship,
    currentContent: string,
    existingMemories: any[],
  ): MemoryRelationship {
    let strength = relationship.strength;
    let confidence = relationship.confidence;

    const existingMemory = existingMemories.find(m => m.id === relationship.targetMemoryId);
    if (!existingMemory) return relationship;

    const existingContent = existingMemory.processedData?.content || existingMemory.content || '';

    // Factor in temporal proximity (more recent memories get higher strength)
    const timeDiff = Date.now() - (new Date(existingMemory.createdAt || 0).getTime());
    const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
    const temporalFactor = Math.max(0.1, 1 - (daysDiff / 30)); // Decay over 30 days

    // Factor in entity overlap
    const entityOverlap = this.calculateEntityOverlap(currentContent, existingContent);
    const entityFactor = Math.min(1.0, entityOverlap * 2);

    // Factor in semantic similarity
    const semanticSimilarity = this.calculateSemanticSimilarity(currentContent, existingContent);
    const semanticFactor = semanticSimilarity;

    // Calculate weighted strength
    strength = (strength * 0.4) + (temporalFactor * 0.3) + (entityFactor * 0.2) + (semanticFactor * 0.1);
    confidence = (confidence * 0.5) + (temporalFactor * 0.2) + (entityFactor * 0.2) + (semanticFactor * 0.1);

    return {
      ...relationship,
      strength: Math.min(1.0, Math.max(0.0, strength)),
      confidence: Math.min(1.0, Math.max(0.0, confidence)),
    };
  }

  /**
   * Calculate text similarity using simple string matching
   */
  private calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.split(/\s+/).filter(w => w.length > 2);
    const words2 = text2.split(/\s+/).filter(w => w.length > 2);

    const intersection = words1.filter(w => words2.includes(w));
    const union = [...new Set([...words1, ...words2])];

    return union.length > 0 ? intersection.length / union.length : 0;
  }

  /**
   * Calculate topic overlap between conversations
   */
  private calculateTopicOverlap(content: string, topic: string, entities: string[]): number {
    const contentLower = content.toLowerCase();
    const topicLower = topic.toLowerCase();

    let overlap = 0;

    // Topic word overlap
    if (topicLower && contentLower.includes(topicLower)) {
      overlap += 0.5;
    }

    // Entity overlap
    const entityMatches = entities.filter(entity =>
      entity && contentLower.includes(entity.toLowerCase()),
    ).length;

    if (entities.length > 0) {
      overlap += (entityMatches / entities.length) * 0.5;
    }

    return Math.min(1.0, overlap);
  }

  /**
   * Detect if current conversation continues previous discussion
   */
  private detectContinuation(currentContent: string, existingContent: string): boolean {
    // Check for continuation phrases
    const continuationPhrases = ['building on', 'following up', 'continuing', 'regarding', 'about that', 'as we discussed'];

    const hasContinuationPhrase = continuationPhrases.some(phrase =>
      currentContent.toLowerCase().includes(phrase),
    );

    // Check for topic continuity
    const topicContinuity = this.calculateTextSimilarity(currentContent, existingContent) > 0.4;

    return hasContinuationPhrase || topicContinuity;
  }

  /**
   * Detect direct references to previous memories
   */
  private detectDirectReference(currentContent: string, existingContent: string): boolean {
    const referenceWords = ['remember', 'recall', 'previously', 'before', 'earlier', 'mentioned', 'discussed'];
    const hasReferenceWord = referenceWords.some(word =>
      currentContent.toLowerCase().includes(word),
    );

    return hasReferenceWord && this.calculateTextSimilarity(currentContent, existingContent) > 0.3;
  }

  /**
   * Detect contradictions between memories
   */
  private detectContradiction(currentContent: string, existingContent: string): boolean {
    const contradictionWords = ['however', 'but', 'contrary', 'instead', 'actually', 'no', 'not true', 'incorrect'];
    const hasContradictionWord = contradictionWords.some(word =>
      currentContent.toLowerCase().includes(word),
    );

    // Look for factual contradictions in similar topics
    const similarity = this.calculateTextSimilarity(currentContent, existingContent);
    return hasContradictionWord && similarity > 0.5;
  }

  /**
   * Extract common entities between two pieces of content
   */
  private extractCommonEntities(content1: string, content2: string): string[] {
    const entities1 = this.extractEntities(content1);
    const entities2 = this.extractEntities(content2);

    return entities1.filter(entity => entities2.includes(entity));
  }

  /**
   * Simple entity extraction from text
   */
  private extractEntities(content: string): string[] {
    // Simple pattern to extract potential entities (people, places, organizations)
    const patterns = [
      // Capitalized words (potential proper nouns)
      /\b[A-Z][a-z]+\b/g,
      // Quoted phrases
      /"([^"]+)"/g,
      /'([^']+)'/g,
    ];

    const entities = new Set<string>();

    patterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        entities.add(match[1] || match[0]);
      }
    });

    return Array.from(entities).filter(entity => entity.length > 2);
  }

  /**
   * Calculate overlap between entities in two pieces of content
   */
  private calculateEntityOverlap(content1: string, content2: string): number {
    const entities1 = this.extractEntities(content1);
    const entities2 = this.extractEntities(content2);

    if (entities1.length === 0 && entities2.length === 0) return 0;

    const intersection = entities1.filter(e => entities2.includes(e));
    const union = [...new Set([...entities1, ...entities2])];

    return union.length > 0 ? intersection.length / union.length : 0;
  }

  /**
   * Calculate semantic similarity between two pieces of content
   */
  private calculateSemanticSimilarity(content1: string, content2: string): number {
    // For now, use a simple word overlap approach
    // In a real implementation, this would use embeddings or more sophisticated NLP
    return this.calculateTextSimilarity(content1, content2);
  }

  /**
   * Detect temporal references in conversation
   */
  private detectTemporalReference(content: string, _existingContent: string): boolean {
    const temporalWords = ['before', 'after', 'earlier', 'later', 'previously', 'recently', 'then', 'next'];
    return temporalWords.some(word => content.toLowerCase().includes(word));
  }

  /**
   * Validate extracted relationships for quality and accuracy
   */
  private validateRelationships(relationships: MemoryRelationship[]): MemoryRelationship[] {
    return relationships.filter(relationship => {
      // Filter out relationships with very low confidence
      if (relationship.confidence < 0.3) {
        return false;
      }

      // Filter out relationships with insufficient reasoning
      if (!relationship.reason || relationship.reason.trim().length < 10) {
        return false;
      }

      // Filter out relationships without clear context
      if (!relationship.context || relationship.context.trim().length < 5) {
        return false;
      }

      // Validate relationship type
      const validTypes = Object.values(MemoryRelationshipType);
      if (!validTypes.includes(relationship.type)) {
        return false;
      }

      // Validate entity references if provided
      if (relationship.entities && relationship.entities.length > 0) {
        const validEntities = relationship.entities.filter(entity =>
          entity && typeof entity === 'string' && entity.trim().length > 0,
        );
        relationship.entities = validEntities;
      }

      return true;
    });
  }

  /**
   * Get existing memories for relationship analysis
   * This is a helper method to retrieve recent memories from the database
   */
  private async getRecentMemories(sessionId: string, limit: number = 50): Promise<any[]> {
    if (!this.dbManager) {
      return [];
    }

    try {
      // Use the correct method to search memories - don't access non-existent searchManager property
      const prisma = this.dbManager.getPrismaClient();
      const memories = await prisma.longTermMemory.findMany({
        where: { namespace: sessionId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      return memories.map(memory => ({
        id: memory.id,
        content: memory.searchableContent,
        summary: memory.summary,
        topic: memory.topic,
        entities: memory.entitiesJson as string[] || [],
        createdAt: memory.extractionTimestamp,
        searchableContent: memory.searchableContent,
      }));
    } catch (error) {
      logWarn('Failed to retrieve recent memories for relationship analysis', {
        component: 'MemoryAgent',
        error: error instanceof Error ? error.message : String(error),
        sessionId,
      });
      return [];
    }
  }

  /**
   * Enhanced relationship extraction that includes LLM analysis
   * This method can be used when more sophisticated relationship analysis is needed
   */
  async extractMemoryRelationshipsWithLLM(
    currentContent: string,
    currentMemory: z.infer<typeof ProcessedLongTermMemorySchema>,
    existingMemories: any[],
  ): Promise<MemoryRelationship[]> {
    try {
      // First, use our rule-based extraction
      const ruleBasedRelationships = await this.extractMemoryRelationships(
        currentContent,
        currentMemory,
        existingMemories,
      );

      // If we have a high-quality LLM, we could enhance with LLM analysis
      // For now, we'll stick with rule-based extraction for reliability

      // Validate and return relationships
      return this.validateRelationships(ruleBasedRelationships);
    } catch (error) {
      logWarn('Enhanced relationship extraction failed', {
        component: 'MemoryAgent',
        error: error instanceof Error ? error.message : String(error),
      });
      return [];
    }
  }

  async processConversation(params: MemoryProcessingParams): Promise<ProcessedLongTermMemory> {
    // Initialize state tracking if database manager is available
    if (this.dbManager && params.chatId) {
      try {
        // First initialize the memory state if it doesn't exist
        await this.dbManager.initializeExistingMemoryState(params.chatId, MemoryProcessingState.PENDING);

        // Then transition to processing
        await this.dbManager.transitionMemoryState(
          params.chatId,
          MemoryProcessingState.PROCESSING,
          {
            reason: 'Starting memory processing',
            agentId: 'MemoryAgent',
            metadata: {
              userInputLength: params.userInput.length,
              aiOutputLength: params.aiOutput.length,
            },
          },
        );
      } catch (error) {
        logWarn('Failed to initialize state tracking for memory processing', {
          component: 'MemoryAgent',
          error: error instanceof Error ? error.message : String(error),
          chatId: params.chatId,
        });
      }
    }

    const systemPrompt = `You are a memory processing agent specializing in conversational analysis and relationship extraction.

${CLASSIFICATION_GUIDELINES}
${IMPORTANCE_CRITERIA}

MEMORY RELATIONSHIP ANALYSIS:
- Analyze how current conversation relates to previous discussions
- Identify continuation of topics, references to past information, or contradictions
- Detect relationships: continuation, reference, related topics, superseding information, contradictions
- Extract entities and context that connect memories
- Calculate relationship confidence based on semantic similarity and temporal proximity

RELATIONSHIP TYPES:
- CONTINUATION: Memory continues previous conversation thread
- REFERENCE: Memory references specific previous memories
- RELATED: Memory discusses similar topics or entities
- SUPERSEDES: Memory replaces or updates previous information
- CONTRADICTION: Memory conflicts with previous information

CONTEXT USAGE:
- Prioritize current conversation over historical context
- Use user preferences and project context to inform classification
- Consider conversation flow and topic transitions
- Identify memory relationships for better recall and context building

Return valid JSON matching this exact schema: ${JSON.stringify(MEMORY_SCHEMA, null, 2)}`;

    // Create structured context template
    const contextTemplate = `
User Preferences: ${params.context.userPreferences?.join(', ') || 'None'}
Current Projects: ${params.context.currentProjects?.join(', ') || 'None'}
Relevant Skills: ${params.context.relevantSkills?.join(', ') || 'None'}
`;

    const userPrompt = `Analyze this conversation segment for memory processing and relationship extraction:

CURRENT CONVERSATION:
User: ${params.userInput}
AI: ${params.aiOutput}

${contextTemplate}

PROCESSING INSTRUCTIONS:
1. Extract the core information and its significance
2. Determine appropriate classification based on content type and importance
3. Identify key entities (people, places, concepts) and topics
4. Generate concise summary (max 200 characters)
5. Provide clear reasoning for your classification choice
6. Set confidence score (0.0-1.0) based on analysis clarity
7. Determine if this warrants conscious context promotion

RELATIONSHIP ANALYSIS INSTRUCTIONS:
8. Analyze how this conversation relates to previous discussions
9. Identify potential memory relationships (continuation, reference, related, supersedes, contradiction)
10. Extract entities and context that might connect to existing memories
11. Consider temporal aspects and topic continuity
12. Assess relationship confidence based on semantic and contextual similarity

Extract and classify this memory, including relationship analysis:`;

    try {
      const response = await this.llmProvider.createChatCompletion({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      });

      const content = response.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const processedMemory = MemoryAgent.processLLMResponse(content, params.chatId);

      // Extract memory relationships if database manager is available
      let extractedRelationships: MemoryRelationship[] = [];
      let relationshipMetadata: ProcessedLongTermMemory['relationshipMetadata'];

      if (this.dbManager) {
        try {
          // Use direct database access instead of non-existent searchManager property
          const prisma = this.dbManager.getPrismaClient();
          const memories = await prisma.longTermMemory.findMany({
            where: { namespace: params.context.sessionId || 'default' },
            orderBy: { createdAt: 'desc' },
            take: 50,
          });

          const existingMemories = memories.map(memory => ({
            id: memory.id,
            content: memory.searchableContent,
            summary: memory.summary,
            topic: memory.topic,
            entities: memory.entitiesJson as string[] || [],
            createdAt: memory.extractionTimestamp,
            searchableContent: memory.searchableContent,
            processedData: {
              content: memory.searchableContent,
              topic: memory.topic,
              entities: memory.entitiesJson,
            },
          }));

          // Extract memory relationships using the new RelationshipProcessor
          if (this.relationshipProcessor) {
            // Use LLM-based relationship extraction
            const relationshipExtractionResult = await this.relationshipProcessor.extractRelationships(
              processedMemory.content,
              {
                sessionId: params.context.sessionId,
                userPreferences: params.context.userPreferences,
                currentProjects: params.context.currentProjects,
                analysisDepth: 3,
                namespace: params.context.sessionId || 'default',
              },
              existingMemories,
            );

            // Use LLM-extracted relationships if available and high quality
            if (relationshipExtractionResult.relationships.length > 0 &&
              relationshipExtractionResult.confidence > 0.5) {
              extractedRelationships = relationshipExtractionResult.relationships;
              relationshipMetadata = {
                extractionMethod: relationshipExtractionResult.extractionMethod,
                confidence: relationshipExtractionResult.confidence,
                extractedAt: relationshipExtractionResult.extractedAt,
                processingMetadata: relationshipExtractionResult.processingMetadata,
              };
            } else {
              // Fall back to rule-based extraction
              const fallbackRelationships = await this.extractMemoryRelationships(
                processedMemory.content,
                processedMemory,
                existingMemories,
              );
              const validatedRelationships = this.validateRelationships(fallbackRelationships);
              extractedRelationships = validatedRelationships;
              relationshipMetadata = {
                extractionMethod: 'rule_based_fallback',
                confidence: 0.5,
                extractedAt: new Date(),
              };
            }
          } else {
            // Fall back to original rule-based extraction if RelationshipProcessor not available
            const relationships = await this.extractMemoryRelationships(
              processedMemory.content,
              processedMemory,
              existingMemories,
            );
            const validatedRelationships = this.validateRelationships(relationships);
            extractedRelationships = validatedRelationships;
            relationshipMetadata = {
              extractionMethod: 'rule_based',
              confidence: 0.5,
              extractedAt: new Date(),
            };
          }

          // Add relationships to the processed memory using proper typing
          return {
            ...processedMemory,
            relatedMemories: extractedRelationships,
            relationshipMetadata,
          };
        } catch (error) {
          logWarn('Failed to extract memory relationships', {
            component: 'MemoryAgent',
            error: error instanceof Error ? error.message : String(error),
          });
          // Continue without relationships - don't fail the entire process
        }
      }

      // Return processed memory with empty relationships if none were extracted
      return {
        ...processedMemory,
        relatedMemories: extractedRelationships,
        relationshipMetadata,
      };
    } catch (error) {
      // Track processing failure
      if (this.dbManager && params.chatId) {
        try {
          await this.dbManager.transitionMemoryState(
            params.chatId,
            MemoryProcessingState.FAILED,
            {
              reason: 'Memory processing failed',
              agentId: 'MemoryAgent',
              errorMessage: error instanceof Error ? error.message : String(error),
              metadata: {
                errorType: 'processing_failure',
                userInputLength: params.userInput.length,
                aiOutputLength: params.aiOutput.length,
              },
            },
          );
        } catch (stateError) {
          logWarn('Failed to update state tracking for failed memory processing', {
            component: 'MemoryAgent',
            error: stateError instanceof Error ? stateError.message : String(stateError),
            chatId: params.chatId,
          });
        }
      }

      logError('Memory processing failed', {
        component: 'MemoryAgent',
        error: error instanceof Error ? error.message : String(error),
        chatId: params.chatId,
        userInputLength: params.userInput.length,
        aiOutputLength: params.aiOutput.length,
      });
      const fallbackMemory = MemoryAgent.createFallbackMemory(params.userInput, params.aiOutput, params.chatId);
      return {
        ...fallbackMemory,
        relatedMemories: [],
        relationshipMetadata: {
          extractionMethod: 'fallback',
          confidence: 0.0,
          extractedAt: new Date(),
        },
      } as ProcessedLongTermMemory;
    }
  }
}