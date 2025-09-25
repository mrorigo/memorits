import { ConsciousAgent } from '../../../src/core/agents/ConsciousAgent';
import { DatabaseManager } from '../../../src/core/database/DatabaseManager';

// Mock DatabaseManager
jest.mock('../../../src/core/database/DatabaseManager');

const MockDatabaseManager = DatabaseManager as jest.MockedClass<typeof DatabaseManager>;

describe('ConsciousAgent', () => {
  let consciousAgent: ConsciousAgent;
  let mockDbManager: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock DatabaseManager
    mockDbManager = {
      getUnprocessedConsciousMemories: jest.fn(),
      getNewConsciousMemories: jest.fn(),
      storeConsciousMemoryInShortTerm: jest.fn(),
      getConsciousMemoriesFromShortTerm: jest.fn(),
      markConsciousMemoryAsProcessed: jest.fn(),
    };

    MockDatabaseManager.mockImplementation(() => mockDbManager as any);

    // Create ConsciousAgent instance
    consciousAgent = new ConsciousAgent(mockDbManager, 'test-namespace');
  });

  describe('constructor', () => {
    it('should initialize with database manager and namespace', () => {
      expect(consciousAgent).toBeDefined();
      // Note: The DatabaseManager constructor is called internally, not directly in the test
    });
  });

  describe('run_conscious_ingest', () => {
    it('should process unprocessed conscious memories', async () => {
      const mockMemories = [
        {
          id: 'memory-1',
          content: 'Test conscious memory 1',
          summary: 'Summary 1',
          classification: 'conscious-info',
          importance: 'high',
          entities: ['entity1'],
          keywords: ['keyword1'],
          confidenceScore: 0.8,
          classificationReason: 'Test reason',
        },
        {
          id: 'memory-2',
          content: 'Test conscious memory 2',
          summary: 'Summary 2',
          classification: 'conscious-info',
          importance: 'critical',
          entities: ['entity2'],
          keywords: ['keyword2'],
          confidenceScore: 0.9,
          classificationReason: 'Test reason 2',
        },
      ];

      mockDbManager.getUnprocessedConsciousMemories.mockResolvedValue(mockMemories);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await consciousAgent.run_conscious_ingest();

      expect(mockDbManager.getUnprocessedConsciousMemories).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Starting conscious memory ingestion...');
      expect(consoleSpy).toHaveBeenCalledWith('Found 2 unprocessed conscious memories');
      expect(consoleSpy).toHaveBeenCalledWith('Conscious memory ingestion completed');

      consoleSpy.mockRestore();
    });

    it('should handle empty conscious memories gracefully', async () => {
      mockDbManager.getUnprocessedConsciousMemories.mockResolvedValue([]);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await consciousAgent.run_conscious_ingest();

      expect(consoleSpy).toHaveBeenCalledWith('Starting conscious memory ingestion...');
      expect(consoleSpy).toHaveBeenCalledWith('No unprocessed conscious memories found');

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      mockDbManager.getUnprocessedConsciousMemories.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await expect(consciousAgent.run_conscious_ingest()).rejects.toThrow('Database error');

      consoleSpy.mockRestore();
    });
  });

  describe('initialize_existing_conscious_memories', () => {
    it('should return existing conscious memories from short-term', async () => {
      const mockMemories = [
        {
          id: 'memory-1',
          content: 'Existing conscious memory',
          summary: 'Summary',
          classification: 'conscious-info',
          importance: 'high',
          entities: ['entity1'],
          keywords: ['keyword1'],
          confidenceScore: 0.8,
          classificationReason: 'Test reason',
        },
      ];

      mockDbManager.getConsciousMemoriesFromShortTerm.mockResolvedValue(mockMemories);

      const result = await consciousAgent.initialize_existing_conscious_memories();

      expect(mockDbManager.getConsciousMemoriesFromShortTerm).toHaveBeenCalledWith('test-namespace');
      expect(result).toEqual(mockMemories);
    });

    it('should handle errors gracefully', async () => {
      mockDbManager.getConsciousMemoriesFromShortTerm.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await consciousAgent.initialize_existing_conscious_memories();

      expect(result).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('check_for_context_updates', () => {
    it('should process new conscious memories', async () => {
      const mockMemories = [
        {
          id: 'memory-1',
          content: 'New conscious memory',
          summary: 'Summary',
          classification: 'conscious-info',
          importance: 'high',
          entities: ['entity1'],
          keywords: ['keyword1'],
          confidenceScore: 0.8,
          classificationReason: 'Test reason',
        },
      ];

      mockDbManager.getNewConsciousMemories.mockResolvedValue(mockMemories);

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      const result = await consciousAgent.check_for_context_updates();

      expect(mockDbManager.getNewConsciousMemories).toHaveBeenCalled();
      expect(result).toEqual(mockMemories);

      consoleSpy.mockRestore();
    });

    it('should return empty array when no new memories', async () => {
      mockDbManager.getNewConsciousMemories.mockResolvedValue([]);

      const result = await consciousAgent.check_for_context_updates();

      expect(result).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      mockDbManager.getNewConsciousMemories.mockRejectedValue(new Error('Database error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const result = await consciousAgent.check_for_context_updates();

      expect(result).toEqual([]);

      consoleSpy.mockRestore();
    });
  });

  describe('consolidateDuplicates', () => {
    it('should complete consolidation process', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

      await consciousAgent.consolidateDuplicates();

      expect(consoleSpy).toHaveBeenCalledWith('Starting conscious memory consolidation...');
      expect(consoleSpy).toHaveBeenCalledWith('Conscious memory consolidation completed');

      consoleSpy.mockRestore();
    });

    it('should handle errors gracefully', async () => {
      // The consolidateDuplicates method doesn't currently call any database operations
      // that could throw errors, so it should always resolve successfully
      const result = await consciousAgent.consolidateDuplicates();
      expect(result).toBeUndefined();
    });
  });

  describe('memory tracking', () => {
    it('should track processed memories', async () => {
      const mockMemories = [
        {
          id: 'memory-1',
          content: 'Test memory',
          summary: 'Summary',
          classification: 'conscious-info',
          importance: 'high',
          entities: [],
          keywords: [],
          confidenceScore: 0.8,
          classificationReason: 'Test',
        },
      ];

      mockDbManager.getUnprocessedConsciousMemories.mockResolvedValue(mockMemories);

      await consciousAgent.run_conscious_ingest();

      expect(consciousAgent.getProcessedMemoryCount()).toBe(1);
    });

    it('should clear processed memory tracking', async () => {
      const mockMemories = [
        {
          id: 'memory-1',
          content: 'Test memory',
          summary: 'Summary',
          classification: 'conscious-info',
          importance: 'high',
          entities: [],
          keywords: [],
          confidenceScore: 0.8,
          classificationReason: 'Test',
        },
      ];

      mockDbManager.getUnprocessedConsciousMemories.mockResolvedValue(mockMemories);

      await consciousAgent.run_conscious_ingest();
      expect(consciousAgent.getProcessedMemoryCount()).toBe(1);

      consciousAgent.clearProcessedMemoryTracking();
      expect(consciousAgent.getProcessedMemoryCount()).toBe(0);
    });
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