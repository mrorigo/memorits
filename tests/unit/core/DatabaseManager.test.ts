import { DatabaseManager, ChatHistoryData } from '../../../src/core/database/DatabaseManager';
import { execSync } from 'child_process';
import { unlinkSync, existsSync } from 'fs';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let dbPath: string;

  beforeEach(async () => {
    // Create unique database file for this test
    dbPath = `./test-unit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;
    const databaseUrl = `file:${dbPath}`;

    // Push schema to the specific database
    execSync(`DATABASE_URL=${databaseUrl} npx prisma db push --accept-data-loss --force-reset`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    dbManager = new DatabaseManager(databaseUrl);
  });

  afterEach(async () => {
    // Properly close database connection first
    if (dbManager) {
      try {
        await dbManager.close();
      } catch {
        // Ignore close errors in cleanup
      }
    }

    // Clean up test database file
    if (existsSync(dbPath)) {
      try {
        unlinkSync(dbPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  describe('Constructor and Basic Operations', () => {
    it('should create DatabaseManager instance', () => {
      expect(dbManager).toBeDefined();
    });

    it('should store chat history successfully', async () => {
      const chatData: ChatHistoryData = {
        chatId: 'test-chat-1',
        userInput: 'Hello, how are you?',
        aiOutput: 'I am doing well, thank you for asking.',
        model: 'gpt-4o-mini',
        sessionId: 'test-session-1',
        namespace: 'test-namespace',
        metadata: { test: true },
      };

      const result = await dbManager.storeChatHistory(chatData);
      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
    });
  });

  describe('Error Handling', () => {
    it('should handle close operation safely', async () => {
      await expect(dbManager.close()).resolves.not.toThrow();
    });
  });
});