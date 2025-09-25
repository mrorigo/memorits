import { Memori } from '../../../src/core/Memori';
import { DatabaseManager } from '../../../src/core/database/DatabaseManager';
import { MemoryAgent } from '../../../src/core/agents/MemoryAgent';
import { OpenAIProvider } from '../../../src/core/providers/OpenAIProvider';
import { ConfigManager } from '../../../src/core/utils/ConfigManager';

// Mock dependencies
jest.mock('../../../src/core/database/DatabaseManager');
jest.mock('../../../src/core/agents/MemoryAgent');
jest.mock('../../../src/core/providers/OpenAIProvider');
jest.mock('../../../src/core/utils/ConfigManager');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

const MockDatabaseManager = DatabaseManager as jest.MockedClass<typeof DatabaseManager>;
const MockMemoryAgent = MemoryAgent as jest.MockedClass<typeof MemoryAgent>;
const MockOpenAIProvider = OpenAIProvider as jest.MockedClass<typeof OpenAIProvider>;
const mockLoadConfig = jest.fn();
(ConfigManager.loadConfig as jest.Mock) = mockLoadConfig;

describe('Memori', () => {
  let memori: Memori;
  let mockConfig: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock config
    mockConfig = {
      databaseUrl: 'file::memory:',
      apiKey: 'test-api-key',
      model: 'gpt-4o-mini',
      baseUrl: 'https://api.openai.com/v1',
      namespace: 'test',
      userContext: {
        userPreferences: [],
        currentProjects: [],
        relevantSkills: [],
      },
    };

    mockLoadConfig.mockReturnValue(mockConfig);

    // Setup method mocks
    MockDatabaseManager.prototype.initializeSchema = jest.fn().mockResolvedValue(undefined);
    MockDatabaseManager.prototype.storeChatHistory = jest.fn().mockResolvedValue('mock-uuid');
    MockDatabaseManager.prototype.storeLongTermMemory = jest.fn().mockResolvedValue('memory-id');
    MockDatabaseManager.prototype.searchMemories = jest.fn().mockResolvedValue([]);
    MockDatabaseManager.prototype.close = jest.fn().mockResolvedValue(undefined);
    MockMemoryAgent.prototype.processConversation = jest.fn().mockResolvedValue({ content: 'processed' });

    // Create Memori instance
    memori = new Memori();
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      expect(mockLoadConfig).toHaveBeenCalled();
      expect(MockDatabaseManager).toHaveBeenCalledWith(mockConfig.databaseUrl);
      expect(MockOpenAIProvider).toHaveBeenCalledWith({
        apiKey: mockConfig.apiKey,
        model: mockConfig.model,
        baseUrl: mockConfig.baseUrl,
      });
      expect(MockMemoryAgent).toHaveBeenCalledWith({
        apiKey: mockConfig.apiKey,
        model: mockConfig.model,
        baseUrl: mockConfig.baseUrl,
      });
    });

    it('should merge provided config with default', () => {
      const customConfig = { model: 'gpt-4' };
      new Memori(customConfig);

      expect(mockConfig.model).toBe('gpt-4');
    });
  });

  describe('enable', () => {
    it('should enable Memori successfully', async () => {
      await memori.enable();

      expect(MockDatabaseManager.prototype.initializeSchema).toHaveBeenCalled();
      expect(memori.isEnabled()).toBe(true);
    });

    it('should throw error if already enabled', async () => {
      await memori.enable();

      await expect(memori.enable()).rejects.toThrow('Memori is already enabled');
    });
  });

  describe('recordConversation', () => {
    beforeEach(async () => {
      await memori.enable();
    });

    it('should throw error if not enabled', async () => {
      const disabledMemori = new Memori();
      await expect(disabledMemori.recordConversation('test', 'response')).rejects.toThrow('Memori is not enabled');
    });

    it('should store chat history and return chatId', async () => {
      const chatId = await memori.recordConversation('Hello', 'Hi there');

      expect(MockDatabaseManager.prototype.storeChatHistory).toHaveBeenCalledWith({
        chatId: 'mock-uuid',
        userInput: 'Hello',
        aiOutput: 'Hi there',
        model: mockConfig.model,
        sessionId: expect.any(String),
        namespace: mockConfig.namespace,
        metadata: undefined,
      });
      expect(chatId).toBe('mock-uuid');
    });

    it('should use provided options', async () => {
      const options = { model: 'gpt-4', metadata: { test: true } };
      await memori.recordConversation('Hello', 'Hi there', options);

      expect(MockDatabaseManager.prototype.storeChatHistory).toHaveBeenCalledWith({
        chatId: 'mock-uuid',
        userInput: 'Hello',
        aiOutput: 'Hi there',
        model: 'gpt-4',
        sessionId: expect.any(String),
        namespace: mockConfig.namespace,
        metadata: { test: true },
      });
    });

    it('should process memory asynchronously', async () => {
      await memori.recordConversation('Hello', 'Hi there');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(MockMemoryAgent.prototype.processConversation).toHaveBeenCalledWith({
        chatId: 'mock-uuid',
        userInput: 'Hello',
        aiOutput: 'Hi there',
        context: {
          sessionId: expect.any(String),
          modelUsed: mockConfig.model,
          userPreferences: [],
          currentProjects: [],
          relevantSkills: [],
        },
      });
      expect(MockDatabaseManager.prototype.storeLongTermMemory).toHaveBeenCalledWith(
        { content: 'processed' },
        'mock-uuid',
        mockConfig.namespace
      );
    });
  });

  describe('searchMemories', () => {
    it('should search memories with default limit', async () => {
      await memori.searchMemories('test query');

      expect(MockDatabaseManager.prototype.searchMemories).toHaveBeenCalledWith('test query', {
        namespace: mockConfig.namespace,
        limit: 5,
      });
    });

    it('should search memories with custom limit', async () => {
      await memori.searchMemories('test query', 10);

      expect(MockDatabaseManager.prototype.searchMemories).toHaveBeenCalledWith('test query', {
        namespace: mockConfig.namespace,
        limit: 10,
      });
    });
  });

  describe('close', () => {
    it('should close database connection', async () => {
      await memori.close();

      expect(MockDatabaseManager.prototype.close).toHaveBeenCalled();
    });
  });

  describe('getSessionId', () => {
    it('should return session id', () => {
      const sessionId = memori.getSessionId();
      expect(sessionId).toBe('mock-uuid');
    });
  });

  describe('isEnabled', () => {
    it('should return false initially', () => {
      expect(memori.isEnabled()).toBe(false);
    });

    it('should return true after enabling', async () => {
      await memori.enable();
      expect(memori.isEnabled()).toBe(true);
    });
  });
});