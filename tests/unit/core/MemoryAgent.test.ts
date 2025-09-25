// tests/unit/core/MemoryAgent.test.ts
import { MemoryAgent } from '../../../src/core/agents/MemoryAgent';

// Mock OpenAI
jest.mock('openai', () => {
  const mockOpenAI = {
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  };
  return jest.fn(() => mockOpenAI);
});

const MockOpenAI = require('openai');

describe('MemoryAgent', () => {
    let memoryAgent: MemoryAgent;

    beforeEach(() => {
        // Mock the OpenAI client
        const mockChatCompletion = {
            choices: [{
                message: {
                    content: JSON.stringify({
                        content: 'Processed memory content',
                        summary: 'Test summary',
                        classification: 'CONVERSATIONAL',
                        importance: 'MEDIUM',
                        topic: 'TypeScript',
                        entities: [],
                        keywords: [],
                        confidenceScore: 0.9,
                        classificationReason: 'Standard conversation',
                        promotionEligible: false
                    })
                }
            }]
        };

        MockOpenAI.mockReturnValue({
            chat: {
                completions: {
                    create: jest.fn().mockResolvedValue(mockChatCompletion)
                }
            }
        });

        memoryAgent = new MemoryAgent({
            baseUrl: 'https://api.openai.com/v1',
            apiKey: 'test-key',
            model: 'gpt-4o-mini',
        });
    });

    it('should process conversation', async () => {
        const result = await memoryAgent.processConversation({
            chatId: 'test-chat',
            userInput: 'What is TypeScript?',
            aiOutput: 'TypeScript is a programming language',
            context: {
                sessionId: 'test-session',
                modelUsed: 'gpt-4o-mini',
                userPreferences: [],
                currentProjects: [],
                relevantSkills: [],
            },
        });

        expect(result).toHaveProperty('content');
        expect(result).toHaveProperty('summary');
        expect(result).toHaveProperty('classification');
        expect(result).toHaveProperty('importance');
        expect(result).toHaveProperty('conversationId', 'test-chat');
    });
});