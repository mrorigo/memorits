import { z } from 'zod';

export enum MemoryCategoryType {
    FACT = 'fact',
    PREFERENCE = 'preference',
    SKILL = 'skill',
    CONTEXT = 'context',
    RULE = 'rule'
}

export enum MemoryClassification {
    ESSENTIAL = 'essential',
    CONTEXTUAL = 'contextual',
    CONVERSATIONAL = 'conversational',
    REFERENCE = 'reference',
    PERSONAL = 'personal',
    CONSCIOUS_INFO = 'conscious-info'
}

export enum MemoryImportanceLevel {
    CRITICAL = 'critical',
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

// Constrained types
export const ConfidenceScore = z.number().min(0).max(1);
export const ImportanceScore = z.number().min(0).max(1);

// Core schemas
export const ProcessedLongTermMemorySchema = z.object({
    content: z.string(),
    summary: z.string(),
    classification: z.nativeEnum(MemoryClassification),
    importance: z.nativeEnum(MemoryImportanceLevel),
    topic: z.string().optional(),
    entities: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]),
    conversationId: z.string(),
    confidenceScore: ConfidenceScore.default(0.8),
    classificationReason: z.string(),
    promotionEligible: z.boolean().default(false),
});

export const ConversationContextSchema = z.object({
    userId: z.string().optional(),
    sessionId: z.string(),
    conversationId: z.string(),
    modelUsed: z.string(),
    userPreferences: z.array(z.string()).default([]),
    currentProjects: z.array(z.string()).default([]),
    relevantSkills: z.array(z.string()).default([]),
});

export type ProcessedLongTermMemory = z.infer<typeof ProcessedLongTermMemorySchema>;
export type ConversationContext = z.infer<typeof ConversationContextSchema>;