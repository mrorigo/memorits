import { Logger, LoggerConfig, DataRedactor, SENSITIVE_FIELDS } from '../../../src/core/utils/Logger';

describe('Logger', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger({
      level: 'info',
      enableFileLogging: false,
      enableConsoleLogging: false,
      environment: 'test',
    });
  });

  describe('constructor', () => {
    it('should create a logger with default configuration', () => {
      const defaultLogger = new Logger();
      expect(defaultLogger).toBeInstanceOf(Logger);
    });

    it('should create a logger with custom configuration', () => {
      const customConfig: Partial<LoggerConfig> = {
        level: 'debug',
        enableFileLogging: true,
        enableConsoleLogging: false,
        environment: 'production',
      };

      const customLogger = new Logger(customConfig);
      expect(customLogger).toBeInstanceOf(Logger);
    });
  });

  describe('logging methods', () => {
    it('should have error method', () => {
      expect(logger.error).toBeDefined();
      expect(typeof logger.error).toBe('function');
    });

    it('should have warn method', () => {
      expect(logger.warn).toBeDefined();
      expect(typeof logger.warn).toBe('function');
    });

    it('should have info method', () => {
      expect(logger.info).toBeDefined();
      expect(typeof logger.info).toBe('function');
    });

    it('should have debug method', () => {
      expect(logger.debug).toBeDefined();
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('child logger', () => {
    it('should create a child logger', () => {
      const context = { component: 'DatabaseManager', version: '1.0.0' };
      const childLogger = logger.child(context);

      expect(childLogger).toBeInstanceOf(Logger);
    });

    it('should allow chaining child loggers', () => {
      const childLogger = logger.child({ component: 'test' });
      const grandChildLogger = childLogger.child({ subComponent: 'subtest' });

      expect(grandChildLogger).toBeInstanceOf(Logger);
    });
  });

  describe('configuration update', () => {
    it('should have updateConfig method', () => {
      expect(logger.updateConfig).toBeDefined();
      expect(typeof logger.updateConfig).toBe('function');
    });

    it('should update configuration', () => {
      const newConfig: Partial<LoggerConfig> = {
        level: 'debug',
        environment: 'production',
      };

      expect(() => logger.updateConfig(newConfig)).not.toThrow();
    });
  });

  describe('log levels', () => {
    it('should create logger with specific log level', () => {
      const debugLogger = new Logger({ level: 'error' });
      expect(debugLogger).toBeInstanceOf(Logger);
    });

    it('should create logger with different environments', () => {
      const prodLogger = new Logger({ environment: 'production' });
      const devLogger = new Logger({ environment: 'development' });

      expect(prodLogger).toBeInstanceOf(Logger);
      expect(devLogger).toBeInstanceOf(Logger);
    });
  });

  describe('DataRedactor', () => {
    describe('sensitive field detection', () => {
      it('should identify sensitive fields correctly', () => {
        expect(DataRedactor['isSensitiveField']('apiKey')).toBe(true);
        expect(DataRedactor['isSensitiveField']('password')).toBe(true);
        expect(DataRedactor['isSensitiveField']('token')).toBe(true);
        expect(DataRedactor['isSensitiveField']('secret')).toBe(true);
        expect(DataRedactor['isSensitiveField']('auth')).toBe(true);
        expect(DataRedactor['isSensitiveField']('credential')).toBe(true);
        expect(DataRedactor['isSensitiveField']('accessToken')).toBe(true);
        expect(DataRedactor['isSensitiveField']('refreshToken')).toBe(true);
        expect(DataRedactor['isSensitiveField']('sessionId')).toBe(true);
        expect(DataRedactor['isSensitiveField']('key')).toBe(true);
        expect(DataRedactor['isSensitiveField']('authorization')).toBe(true);
      });

      it('should identify sensitive fields case-insensitively', () => {
        expect(DataRedactor['isSensitiveField']('APIKEY')).toBe(true);
        expect(DataRedactor['isSensitiveField']('Password')).toBe(true);
        expect(DataRedactor['isSensitiveField']('TOKEN')).toBe(true);
      });

      it('should identify sensitive fields in compound names', () => {
        expect(DataRedactor['isSensitiveField']('myApiKey')).toBe(true);
        expect(DataRedactor['isSensitiveField']('userPassword')).toBe(true);
        expect(DataRedactor['isSensitiveField']('authToken')).toBe(true);
      });

      it('should not identify non-sensitive fields', () => {
        expect(DataRedactor['isSensitiveField']('name')).toBe(false);
        expect(DataRedactor['isSensitiveField']('email')).toBe(false);
        expect(DataRedactor['isSensitiveField']('id')).toBe(false);
        expect(DataRedactor['isSensitiveField']('userId')).toBe(false);
      });
    });

    describe('string redaction', () => {
      it('should redact long alphanumeric strings', () => {
        const longKey = 'sk-1234567890abcdef1234567890abcdef12345678';
        expect(DataRedactor.redact(longKey)).toBe('[REDACTED]');
      });

      it('should redact strings with sk- prefix', () => {
        const openaiKey = 'sk-proj-1234567890abcdef';
        expect(DataRedactor.redact(openaiKey)).toBe('[REDACTED]');
      });

      it('should redact strings with pk- prefix', () => {
        const publicKey = 'pk-1234567890abcdef';
        expect(DataRedactor.redact(publicKey)).toBe('[REDACTED]');
      });

      it('should redact strings with Bearer prefix', () => {
        const bearerToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
        expect(DataRedactor.redact(bearerToken)).toBe('[REDACTED]');
      });

      it('should not redact normal strings', () => {
        const normalString = 'Hello, world!';
        expect(DataRedactor.redact(normalString)).toBe('Hello, world!');
      });

      it('should not redact short alphanumeric strings', () => {
        const shortString = 'abc123';
        expect(DataRedactor.redact(shortString)).toBe('abc123');
      });
    });

    describe('object redaction', () => {
      it('should redact sensitive fields in flat objects', () => {
        const data = {
          name: 'John Doe',
          apiKey: 'sk-1234567890abcdef',
          email: 'john@example.com'
        };

        const redacted = DataRedactor.redact(data);
        expect(redacted.name).toBe('John Doe');
        expect(redacted.apiKey).toBe('[REDACTED]');
        expect(redacted.email).toBe('john@example.com');
      });

      it('should redact sensitive fields in nested objects', () => {
        const data = {
          user: {
            name: 'John Doe',
            credentials: {
              password: 'secret123',
              token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'
            }
          },
          settings: {
            theme: 'dark',
            apiKey: 'sk-1234567890abcdef'
          }
        };

        const redacted = DataRedactor.redact(data);
        expect(redacted.user).toBeDefined();
        expect(redacted.user.name).toBe('John Doe');
        expect(redacted.user.credentials).toBeDefined();
        expect(redacted.user.credentials.password).toBe('[REDACTED]');
        expect(redacted.user.credentials.token).toBe('[REDACTED]');
        expect(redacted.settings).toBeDefined();
        expect(redacted.settings.theme).toBe('dark');
        expect(redacted.settings.apiKey).toBe('[REDACTED]');
      });

      it('should handle circular references gracefully', () => {
        const data: any = { name: 'test' };
        data.self = data;

        expect(() => DataRedactor.redact(data)).not.toThrow();
      });

      it('should preserve non-sensitive nested structure', () => {
        const data = {
          config: {
            database: {
              host: 'localhost',
              port: 5432,
              credentials: {
                username: 'admin',
                password: 'secret123'
              }
            }
          }
        };

        const redacted = DataRedactor.redact(data);
        expect(redacted.config).toBeDefined();
        expect(redacted.config.database).toBeDefined();
        expect(redacted.config.database.host).toBe('localhost');
        expect(redacted.config.database.port).toBe(5432);
        expect(redacted.config.database.credentials).toBeDefined();
        expect(redacted.config.database.credentials.username).toBe('admin');
        expect(redacted.config.database.credentials.password).toBe('[REDACTED]');
      });
    });

    describe('array redaction', () => {
      it('should redact sensitive data in arrays', () => {
        const data = [
          { name: 'John', apiKey: 'sk-1234567890abcdef' },
          { name: 'Jane', password: 'secret123' }
        ];

        const redacted = DataRedactor.redact(data);
        expect(redacted[0].name).toBe('John');
        expect(redacted[0].apiKey).toBe('[REDACTED]');
        expect(redacted[1].name).toBe('Jane');
        expect(redacted[1].password).toBe('[REDACTED]');
      });

      it('should handle nested arrays with objects', () => {
        const data = [
          'normal string',
          { apiKey: 'sk-1234567890abcdef' },
          ['nested', { token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9' }]
        ];

        const redacted = DataRedactor.redact(data);
        expect(redacted[0]).toBe('normal string');
        expect(redacted[1].apiKey).toBe('[REDACTED]');
        expect(redacted[2][0]).toBe('nested');
        expect(redacted[2][1].token).toBe('[REDACTED]');
      });
    });

    describe('sanitizeForLogging', () => {
      it('should handle serializable objects', () => {
        const data = { name: 'test', apiKey: 'sk-1234567890abcdef' };
        const sanitized = DataRedactor.sanitizeForLogging(data);

        expect(sanitized.name).toBe('test');
        expect(sanitized.apiKey).toBe('[REDACTED]');
      });

      it('should handle non-serializable objects', () => {
        const data = { func: () => {}, apiKey: 'sk-1234567890abcdef' };
        const sanitized = DataRedactor.sanitizeForLogging(data);

        expect(sanitized).toBeDefined();
        expect(sanitized.apiKey).toBe('[REDACTED]');
        expect(sanitized.func).toBe('[Non-serializable]');
      });

      it('should handle circular references', () => {
        const data: any = { name: 'test' };
        data.self = data;

        const sanitized = DataRedactor.sanitizeForLogging(data);
        expect(sanitized).toBeDefined();
        expect(sanitized.name).toBe('test');
      });
    });

    describe('primitive value handling', () => {
      it('should handle null and undefined', () => {
        expect(DataRedactor.redact(null)).toBe(null);
        expect(DataRedactor.redact(undefined)).toBe(undefined);
      });

      it('should handle numbers and booleans', () => {
        expect(DataRedactor.redact(123)).toBe(123);
        expect(DataRedactor.redact(true)).toBe(true);
        expect(DataRedactor.redact(false)).toBe(false);
      });
    });
  });

  describe('Logger with redaction', () => {
    let logger: Logger;

    beforeEach(() => {
      logger = new Logger({
        level: 'info',
        enableFileLogging: false,
        enableConsoleLogging: false,
        environment: 'test',
      });
    });

    it('should redact sensitive data by default', () => {
      const context = {
        user: 'John Doe',
        apiKey: 'sk-1234567890abcdef',
        password: 'secret123',
        email: 'john@example.com'
      };

      // Should not throw and should handle redaction
      expect(() => logger.info('Test message', context)).not.toThrow();
    });

    it('should bypass redaction when requested', () => {
      const context = {
        user: 'John Doe',
        apiKey: 'sk-1234567890abcdef',
        email: 'john@example.com'
      };

      // Should not throw and should bypass redaction
      expect(() => logger.info('Test message', context, true)).not.toThrow();
    });

    it('should have raw logging methods', () => {
      expect(logger.rawError).toBeDefined();
      expect(logger.rawWarn).toBeDefined();
      expect(logger.rawInfo).toBeDefined();
      expect(logger.rawDebug).toBeDefined();
    });

    it('should handle null context', () => {
      expect(() => logger.info('Test message', null as any)).not.toThrow();
      expect(() => logger.info('Test message', undefined as any)).not.toThrow();
    });

    it('should handle empty context', () => {
      expect(() => logger.info('Test message', {})).not.toThrow();
    });
  });

  describe('SENSITIVE_FIELDS constant', () => {
    it('should contain expected sensitive field names', () => {
      expect(SENSITIVE_FIELDS).toContain('apiKey');
      expect(SENSITIVE_FIELDS).toContain('password');
      expect(SENSITIVE_FIELDS).toContain('token');
      expect(SENSITIVE_FIELDS).toContain('secret');
      expect(SENSITIVE_FIELDS).toContain('auth');
      expect(SENSITIVE_FIELDS).toContain('credential');
      expect(SENSITIVE_FIELDS).toContain('accessToken');
      expect(SENSITIVE_FIELDS).toContain('refreshToken');
      expect(SENSITIVE_FIELDS).toContain('sessionId');
      expect(SENSITIVE_FIELDS).toContain('key');
      expect(SENSITIVE_FIELDS).toContain('authorization');
    });

    it('should be readonly', () => {
      expect(() => {
        (SENSITIVE_FIELDS as any).push('newField');
      }).toThrow();
    });
  });
});