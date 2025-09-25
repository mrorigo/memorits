import { Logger, LoggerConfig } from '../../../src/core/utils/Logger';

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
});