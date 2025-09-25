import { Memori } from '../../../src/core/Memori';
import { DatabaseManager } from '../../../src/core/database/DatabaseManager';
import { MemoryAgent } from '../../../src/core/agents/MemoryAgent';
import { ConsciousAgent } from '../../../src/core/agents/ConsciousAgent';
import { OpenAIProvider } from '../../../src/core/providers/OpenAIProvider';
import { ConfigManager } from '../../../src/core/utils/ConfigManager';
import * as Logger from '../../../src/core/utils/Logger';

// Mock dependencies
jest.mock('../../../src/core/database/DatabaseManager');
jest.mock('../../../src/core/agents/MemoryAgent');
jest.mock('../../../src/core/agents/ConsciousAgent');
jest.mock('../../../src/core/providers/OpenAIProvider');
jest.mock('../../../src/core/utils/ConfigManager');
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid'),
}));

const MockDatabaseManager = DatabaseManager as jest.MockedClass<typeof DatabaseManager>;
const MockMemoryAgent = MemoryAgent as jest.MockedClass<typeof MemoryAgent>;
const MockConsciousAgent = ConsciousAgent as jest.MockedClass<typeof ConsciousAgent>;
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
    MockDatabaseManager.prototype.storeChatHistory = jest.fn().mockResolvedValue('mock-uuid');
    MockDatabaseManager.prototype.storeLongTermMemory = jest.fn().mockResolvedValue('memory-id');
    MockDatabaseManager.prototype.searchMemories = jest.fn().mockResolvedValue([]);
    MockDatabaseManager.prototype.close = jest.fn().mockResolvedValue(undefined);
    MockMemoryAgent.prototype.processConversation = jest.fn().mockResolvedValue({ content: 'processed' });

    // Create Memori instance
    memori = new Memori();
  });

  afterEach(async () => {
    // Clean up any background intervals
    if (memori.isEnabled()) {
      await memori.close();
    }
    // Clear any pending timers
    jest.clearAllTimers();
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
      expect(MockMemoryAgent).toHaveBeenCalledWith(expect.any(MockOpenAIProvider));
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

    it('should process memory asynchronously when autoIngest is enabled', async () => {
      // Enable auto ingestion for this test
      const autoConfig = { ...mockConfig, autoIngest: true };
      mockLoadConfig.mockReturnValue(autoConfig);

      const autoMemori = new Memori();
      await autoMemori.enable();

      await autoMemori.recordConversation('Hello', 'Hi there');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(MockMemoryAgent.prototype.processConversation).toHaveBeenCalledWith({
        chatId: 'mock-uuid',
        userInput: 'Hello',
        aiOutput: 'Hi there',
        context: {
          conversationId: 'mock-uuid',
          sessionId: 'mock-uuid',
          modelUsed: mockConfig.model,
          userPreferences: [],
          currentProjects: [],
          relevantSkills: [],
        },
      });
      expect(MockDatabaseManager.prototype.storeLongTermMemory).toHaveBeenCalledWith(
        { content: 'processed' },
        'mock-uuid',
        mockConfig.namespace,
      );
    });
  });

  describe('searchMemories', () => {
    it('should search memories with default limit', async () => {
      await memori.searchMemories('test query');

      expect(MockDatabaseManager.prototype.searchMemories).toHaveBeenCalledWith('test query', {
        namespace: mockConfig.namespace,
        limit: 5,
        minImportance: undefined,
        categories: undefined,
        includeMetadata: undefined,
      });
    });

    it('should search memories with custom limit', async () => {
      await memori.searchMemories('test query', { limit: 10 });

      expect(MockDatabaseManager.prototype.searchMemories).toHaveBeenCalledWith('test query', {
        namespace: mockConfig.namespace,
        limit: 10,
        minImportance: undefined,
        categories: undefined,
        includeMetadata: undefined,
      });
    });
  });
  
  // Global cleanup after all tests
  afterAll(async () => {
    // Ensure all timers are cleared
    jest.clearAllTimers();
    jest.useRealTimers();
  
    // Restore any global mocks
    jest.restoreAllMocks();
  
    // Small delay to ensure any pending async operations complete
    await new Promise(resolve => setTimeout(resolve, 100));
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

  describe('conscious ingestion', () => {
    beforeEach(() => {
      // Setup ConsciousAgent mock
      MockConsciousAgent.prototype.run_conscious_ingest = jest.fn().mockResolvedValue(undefined);
      MockConsciousAgent.prototype.initialize_existing_conscious_memories = jest.fn().mockResolvedValue([]);
      MockConsciousAgent.prototype.check_for_context_updates = jest.fn().mockResolvedValue([]);
    });

    it('should initialize ConsciousAgent when consciousIngest is enabled', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      expect(MockConsciousAgent).toHaveBeenCalledWith(expect.any(MockDatabaseManager), consciousConfig.namespace);
      expect(MockConsciousAgent.prototype.run_conscious_ingest).toHaveBeenCalled();
    });

    it('should not initialize ConsciousAgent when consciousIngest is disabled', async () => {
      const nonConsciousConfig = { ...mockConfig, consciousIngest: false };
      mockLoadConfig.mockReturnValue(nonConsciousConfig);

      const nonConsciousMemori = new Memori();
      await nonConsciousMemori.enable();

      expect(MockConsciousAgent).not.toHaveBeenCalled();
    });

    it('should handle errors in conscious ingestion gracefully', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      MockConsciousAgent.prototype.run_conscious_ingest.mockRejectedValue(new Error('Ingestion error'));

      const logErrorSpy = jest.spyOn(Logger, 'logError').mockImplementation(() => {});

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      expect(consciousMemori.isEnabled()).toBe(true); // Should still be enabled despite error
      expect(logErrorSpy).toHaveBeenCalledWith('Error during initial conscious memory ingestion', expect.objectContaining({
        component: 'Memori',
        namespace: consciousConfig.namespace,
        error: 'Ingestion error',
      }));

      logErrorSpy.mockRestore();
    });

    it('should provide access to ConsciousAgent when enabled', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      const consciousAgent = consciousMemori.getConsciousAgent();
      expect(consciousAgent).toBeInstanceOf(MockConsciousAgent);
    });

    it('should return undefined for ConsciousAgent when not enabled', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();

      const consciousAgent = consciousMemori.getConsciousAgent();
      expect(consciousAgent).toBeUndefined();
    });

    it('should check for conscious context updates', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      await consciousMemori.checkForConsciousContextUpdates();

      expect(MockConsciousAgent.prototype.check_for_context_updates).toHaveBeenCalled();
    });

    it('should not check for conscious context updates when disabled', async () => {
      const nonConsciousConfig = { ...mockConfig, consciousIngest: false };
      mockLoadConfig.mockReturnValue(nonConsciousConfig);

      const nonConsciousMemori = new Memori();
      await nonConsciousMemori.enable();

      await nonConsciousMemori.checkForConsciousContextUpdates();

      expect(MockConsciousAgent.prototype.check_for_context_updates).not.toHaveBeenCalled();
    });

    it('should initialize conscious context', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      await consciousMemori.initializeConsciousContext();

      expect(MockConsciousAgent.prototype.initialize_existing_conscious_memories).toHaveBeenCalled();
    });
  });

  describe('dual memory mode functionality', () => {
    it('should return true for isConsciousModeEnabled when conscious mode is active', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      expect(consciousMemori.isConsciousModeEnabled()).toBe(true);
    });

    it('should return false for isConsciousModeEnabled when not enabled', () => {
      expect(memori.isConsciousModeEnabled()).toBe(false);
    });

    it('should return false for isConsciousModeEnabled when consciousIngest is false', async () => {
      const nonConsciousConfig = { ...mockConfig, consciousIngest: false };
      mockLoadConfig.mockReturnValue(nonConsciousConfig);

      const nonConsciousMemori = new Memori();
      await nonConsciousMemori.enable();

      expect(nonConsciousMemori.isConsciousModeEnabled()).toBe(false);
    });

    it('should return true for isAutoModeEnabled when autoIngest is enabled', async () => {
      const autoConfig = { ...mockConfig, autoIngest: true };
      mockLoadConfig.mockReturnValue(autoConfig);

      const autoMemori = new Memori();
      await autoMemori.enable();

      expect(autoMemori.isAutoModeEnabled()).toBe(true);
    });

    it('should return false for isAutoModeEnabled when autoIngest is disabled', async () => {
      const nonAutoConfig = { ...mockConfig, autoIngest: false };
      mockLoadConfig.mockReturnValue(nonAutoConfig);

      const nonAutoMemori = new Memori();
      await nonAutoMemori.enable();

      expect(nonAutoMemori.isAutoModeEnabled()).toBe(false);
    });

    it('should process memory automatically in auto ingestion mode', async () => {
      const autoConfig = { ...mockConfig, autoIngest: true };
      mockLoadConfig.mockReturnValue(autoConfig);

      const autoMemori = new Memori();
      await autoMemori.enable();

      await autoMemori.recordConversation('Hello', 'Hi there');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(MockMemoryAgent.prototype.processConversation).toHaveBeenCalled();
    });

    it('should not process memory automatically in conscious ingestion mode', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const logInfoSpy = jest.spyOn(Logger, 'logInfo').mockImplementation(() => {});

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      await consciousMemori.recordConversation('Hello', 'Hi there');

      expect(logInfoSpy).toHaveBeenCalledWith('Conversation stored for conscious processing: mock-uuid', expect.objectContaining({
        component: 'Memori',
        chatId: 'mock-uuid',
        mode: 'conscious-ingestion',
      }));
      expect(MockMemoryAgent.prototype.processConversation).not.toHaveBeenCalled();

      logInfoSpy.mockRestore();
    });

    it('should not process memory when neither mode is enabled', async () => {
      const noModeConfig = { ...mockConfig, autoIngest: false, consciousIngest: false };
      mockLoadConfig.mockReturnValue(noModeConfig);

      const logInfoSpy = jest.spyOn(Logger, 'logInfo').mockImplementation(() => {});

      const noModeMemori = new Memori();
      await noModeMemori.enable();

      await noModeMemori.recordConversation('Hello', 'Hi there');

      expect(logInfoSpy).toHaveBeenCalledWith('Conversation stored without processing: mock-uuid', expect.objectContaining({
        component: 'Memori',
        chatId: 'mock-uuid',
        mode: 'no-ingestion',
      }));
      expect(MockMemoryAgent.prototype.processConversation).not.toHaveBeenCalled();

      logInfoSpy.mockRestore();
    });
  });

  describe('background processing', () => {
    beforeEach(() => {
      // Mock setInterval and clearInterval for testing
      jest.useFakeTimers();
      jest.spyOn(global, 'setInterval');
      jest.spyOn(global, 'clearInterval');
    });

    afterEach(() => {
      jest.useRealTimers();
      jest.restoreAllMocks();
    });

    it('should start background monitoring when conscious mode is enabled', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 30000);
      expect(consciousMemori.isBackgroundMonitoringActive()).toBe(true);
    });

    it('should not start background monitoring when not in conscious mode', async () => {
      const nonConsciousConfig = { ...mockConfig, consciousIngest: false };
      mockLoadConfig.mockReturnValue(nonConsciousConfig);

      const nonConsciousMemori = new Memori();
      await nonConsciousMemori.enable();

      expect(setInterval).not.toHaveBeenCalled();
      expect(nonConsciousMemori.isBackgroundMonitoringActive()).toBe(false);
    });

    it('should stop background monitoring on close', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      await consciousMemori.close();

      expect(clearInterval).toHaveBeenCalled();
      expect(consciousMemori.isBackgroundMonitoringActive()).toBe(false);
    });

    it('should configure background update interval', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      // Stop initial monitoring
      await consciousMemori.close();

      // Configure new interval
      consciousMemori.setBackgroundUpdateInterval(60000);

      expect(consciousMemori.getBackgroundUpdateInterval()).toBe(60000);
    });

    it('should restart monitoring with new interval when already running', async () => {
      const consciousConfig = { ...mockConfig, consciousIngest: true };
      mockLoadConfig.mockReturnValue(consciousConfig);

      const consciousMemori = new Memori();
      await consciousMemori.enable();

      // Configure new interval while monitoring is active
      consciousMemori.setBackgroundUpdateInterval(60000);

      expect(clearInterval).toHaveBeenCalled();
      expect(setInterval).toHaveBeenCalledWith(expect.any(Function), 60000);
    });

    it('should throw error for invalid background update interval', () => {
      expect(() => memori.setBackgroundUpdateInterval(-1000)).toThrow('Background update interval must be positive');
      expect(() => memori.setBackgroundUpdateInterval(0)).toThrow('Background update interval must be positive');
    });
  });
});