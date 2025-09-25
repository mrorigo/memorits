// tests/unit/core/MemoryAgent.test.ts
import { MemoryAgent } from '../../../src/core/agents/MemoryAgent';
import { OpenAIProvider } from '../../../src/core/providers/OpenAIProvider';

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

describe('MemoryAgent', () => {
  let memoryAgent: MemoryAgent;
  let mockOpenAIProvider: jest.Mocked<OpenAIProvider>;

  beforeEach(() => {
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
            promotionEligible: false,
          }),
        },
      }],
    };

    // Create a simple mock OpenAIProvider
    mockOpenAIProvider = {
      getClient: jest.fn().mockReturnValue({
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue(mockChatCompletion),
          },
        },
      }),
      getModel: jest.fn().mockReturnValue('gpt-4o-mini'),
      createEmbedding: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
    } as any;

    memoryAgent = new MemoryAgent(mockOpenAIProvider);
  });

  it('should process conversation', async () => {
    const result = await memoryAgent.processConversation({
      chatId: 'test-chat',
      userInput: 'What is TypeScript?',
      aiOutput: 'TypeScript is a programming language',
      context: {
        conversationId: 'test-chat',
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

// Global cleanup after all tests
afterAll(async () => {
  // Clear any pending timers
  jest.clearAllTimers();
  jest.useRealTimers();

  // Restore any global mocks
  jest.restoreAllMocks();

  // Small delay to ensure any pending async operations complete
  await new Promise(resolve => setTimeout(resolve, 100));
});