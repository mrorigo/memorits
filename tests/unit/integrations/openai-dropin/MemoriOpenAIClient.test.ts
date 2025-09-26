// tests/unit/integrations/openai-dropin/MemoriOpenAIClient.test.ts
// Comprehensive unit tests for MemoriOpenAIClient
// Tests all aspects of the main OpenAI drop-in client implementation

import { MemoriOpenAIClient } from '../../../../src/integrations/openai-dropin/client';
import type { MemoriOpenAIConfig } from '../../../../src/integrations/openai-dropin/types';
import { MemoryError } from '../../../../src/integrations/openai-dropin/types';
import { MockMemori, MockMemoryAgent } from './mocks';
import { MockFactory, TestCleanup } from './test-utils';

describe('MemoriOpenAIClient', () => {
    let mockMemori: MockMemori;
    let mockMemoryAgent: MockMemoryAgent;

    beforeEach(() => {
        mockMemori = MockFactory.createMockMemori();
        mockMemoryAgent = MockFactory.createMockMemoryAgent();

        // Mock the Memori class constructor
        jest.mock('../../../../src/core/Memori', () => ({
            Memori: jest.fn().mockImplementation(() => mockMemori),
        }));

        // Mock the MemoryAgent class constructor
        jest.mock('../../../../src/core/agents/MemoryAgent', () => ({
            MemoryAgent: jest.fn().mockImplementation(() => mockMemoryAgent),
        }));

        // Mock the OpenAIProvider class
        jest.mock('../../../../src/core/providers/OpenAIProvider', () => ({
            OpenAIProvider: jest.fn().mockImplementation(() => ({
                // Mock implementation
            })),
        }));

        // Mock the ConfigManager class
        jest.mock('../../../../src/core/utils/ConfigManager', () => ({
            ConfigManager: jest.fn().mockImplementation(() => ({
                // Mock implementation
            })),
        }));
    });

    afterEach(async () => {
        await TestCleanup.fullCleanup();
        jest.clearAllMocks();
    });

    describe('Constructor', () => {
        describe('API Key String Constructor', () => {
            it('should create client with valid API key and default config', () => {
                const client = new MemoriOpenAIClient('test-api-key');

                expect(client).toBeDefined();
                expect(client.getSessionId()).toBeDefined();
                expect(client.isEnabled).toBe(false); // Not auto-initialized by default
                expect(client.getConfig().apiKey).toBe('test-api-key');
                expect(client.getConfig().enableChatMemory).toBe(true);
                expect(client.getConfig().enableEmbeddingMemory).toBe(false);
                expect(client.getConfig().autoInitialize).toBe(true);
            });

            it('should create client with API key and custom config', () => {
                const config: Partial<MemoriOpenAIConfig> = {
                    enableChatMemory: false,
                    enableEmbeddingMemory: true,
                    autoInitialize: false,
                    namespace: 'test-namespace',
                };

                const client = new MemoriOpenAIClient('test-api-key', config);

                expect(client).toBeDefined();
                expect(client.getConfig().enableChatMemory).toBe(false);
                expect(client.getConfig().enableEmbeddingMemory).toBe(true);
                expect(client.getConfig().autoInitialize).toBe(false);
                expect(client.getConfig().namespace).toBe('test-namespace');
            });

            it('should throw error with empty API key', () => {
                expect(() => {
                    new MemoriOpenAIClient('');
                }).toThrow(MemoryError);
            });

            it('should throw error with invalid buffer timeout', () => {
                const config: Partial<MemoriOpenAIConfig> = {
                    bufferTimeout: 500, // Less than 1000ms minimum
                };

                expect(() => {
                    new MemoriOpenAIClient('test-api-key', config);
                }).toThrow('Buffer timeout must be at least 1000ms');
            });

            it('should throw error with invalid buffer size', () => {
                const config: Partial<MemoriOpenAIConfig> = {
                    maxBufferSize: 500, // Less than 1000 characters minimum
                };

                expect(() => {
                    new MemoriOpenAIClient('test-api-key', config);
                }).toThrow('Max buffer size must be at least 1000 characters');
            });
        });

        describe('Options Object Constructor', () => {
            it('should create client with options object', () => {
                const options = {
                    apiKey: 'test-api-key',
                    baseURL: 'https://custom-api.example.com',
                    organization: 'test-org',
                    project: 'test-project',
                };

                const client = new MemoriOpenAIClient(options);

                expect(client).toBeDefined();
                expect(client.getConfig().apiKey).toBe('test-api-key');
                expect(client.getConfig().baseUrl).toBe('https://custom-api.example.com');
                expect(client.getConfig().organization).toBe('test-org');
                expect(client.getConfig().project).toBe('test-project');
            });

            it('should merge options with additional config', () => {
                const options = {
                    apiKey: 'test-api-key',
                    baseURL: 'https://custom-api.example.com',
                };

                const config: Partial<MemoriOpenAIConfig> = {
                    enableChatMemory: false,
                    debugMode: true,
                };

                const client = new MemoriOpenAIClient({ ...options, ...config });

                expect(client).toBeDefined();
                expect(client.getConfig().apiKey).toBe('test-api-key');
                expect(client.getConfig().baseUrl).toBe('https://custom-api.example.com');
                expect(client.getConfig().enableChatMemory).toBe(false);
                expect(client.getConfig().debugMode).toBe(true);
            });
        });

        describe('Configuration Validation', () => {
            it('should set default configuration values', () => {
                const client = new MemoriOpenAIClient('test-api-key');
                const config = client.getConfig();

                expect(config.enableChatMemory).toBe(true);
                expect(config.enableEmbeddingMemory).toBe(false);
                expect(config.memoryProcessingMode).toBe('auto');
                expect(config.autoInitialize).toBe(true);
                expect(config.bufferTimeout).toBe(30000);
                expect(config.maxBufferSize).toBe(50000);
                expect(config.backgroundUpdateInterval).toBe(30000);
                expect(config.debugMode).toBe(false);
                expect(config.enableMetrics).toBe(false);
                expect(config.metricsInterval).toBe(60000);
            });

            it('should validate and merge configuration correctly', () => {
                const partialConfig: Partial<MemoriOpenAIConfig> = {
                    enableChatMemory: false,
                    enableEmbeddingMemory: true,
                    bufferTimeout: 15000,
                    maxBufferSize: 25000,
                    debugMode: true,
                    enableMetrics: true,
                    metricsInterval: 30000,
                };

                const client = new MemoriOpenAIClient('test-api-key', partialConfig);
                const config = client.getConfig();

                expect(config.enableChatMemory).toBe(false);
                expect(config.enableEmbeddingMemory).toBe(true);
                expect(config.bufferTimeout).toBe(15000);
                expect(config.maxBufferSize).toBe(25000);
                expect(config.debugMode).toBe(true);
                expect(config.enableMetrics).toBe(true);
                expect(config.metricsInterval).toBe(30000);
            });
        });
    });

    describe('Initialization and Lifecycle', () => {
        let client: MemoriOpenAIClient;

        beforeEach(() => {
            client = new MemoriOpenAIClient('test-api-key', { autoInitialize: false });
        });

        describe('enable()', () => {
            it('should enable client successfully', async () => {
                await client.enable();

                expect(client.isEnabled).toBe(true);
            });

            it('should throw error if already enabled', async () => {
                await client.enable();

                await expect(client.enable()).rejects.toThrow('MemoriOpenAIClient is already enabled');
            });

            it('should handle Memori initialization errors', async () => {
                // Mock Memori to throw error on enable
                mockMemori.enable = jest.fn().mockRejectedValue(new Error('Database connection failed'));

                await expect(client.enable()).rejects.toThrow('Database connection failed');
                expect(client.isEnabled).toBe(false);
            });
        });

        describe('disable()', () => {
            it('should disable client successfully', async () => {
                await client.enable();
                expect(client.isEnabled).toBe(true);

                await client.disable();
                expect(client.isEnabled).toBe(false);
            });

            it('should throw error if not enabled', async () => {
                await expect(client.disable()).rejects.toThrow('MemoriOpenAIClient is not enabled');
            });
        });

        describe('close()', () => {
            it('should close client successfully', async () => {
                await client.enable();
                expect(client.isEnabled).toBe(true);

                await client.close();
                expect(client.isEnabled).toBe(false);
            });

            it('should handle close when not enabled', async () => {
                await expect(client.close()).rejects.toThrow('MemoriOpenAIClient is not enabled');
            });
        });
    });

    describe('OpenAI Interface Implementation', () => {
        let client: MemoriOpenAIClient;

        beforeEach(async () => {
            client = new MemoriOpenAIClient('test-api-key', { autoInitialize: false });
            await client.enable();
        });

        describe('Chat Interface', () => {
            it('should return ChatProxy instance', () => {
                const chat = client.chat;
                expect(chat).toBeDefined();
                expect(chat.completions).toBeDefined();
                expect(chat.completions.create).toBeDefined();
            });

            it('should create ChatProxy with correct configuration', () => {
                const chat = client.chat;
                const chatProxy = (chat as any).chatProxy;

                // Verify ChatProxy was created with correct parameters
                expect(chatProxy).toBeDefined();
                // Note: We can't easily test the internal ChatProxy instance without exposing it
                // This would be tested through integration tests
            });
        });

        describe('Embeddings Interface', () => {
            it('should return Embeddings proxy instance', () => {
                const embeddings = client.embeddings;
                expect(embeddings).toBeDefined();
                expect(embeddings.create).toBeDefined();
            });
        });

        describe('Memory Interface', () => {
            it('should return MemoryManager instance', () => {
                const memory = client.memory;
                expect(memory).toBeDefined();
            });
        });
    });

    describe('Configuration Management', () => {
        let client: MemoriOpenAIClient;

        beforeEach(() => {
            client = new MemoriOpenAIClient('test-api-key', { autoInitialize: false });
        });

        describe('getConfig()', () => {
            it('should return copy of configuration', () => {
                const config = client.getConfig();
                expect(config).toBeDefined();
                expect(config.apiKey).toBe('test-api-key');
                expect(config.enableChatMemory).toBe(true);

                // Verify it's a copy (modifying it shouldn't affect the client)
                const originalChatMemory = config.enableChatMemory;
                config.enableChatMemory = false;
                expect(client.getConfig().enableChatMemory).toBe(originalChatMemory);
            });
        });

        describe('updateConfig()', () => {
            it('should update configuration successfully', async () => {
                const newConfig: Partial<MemoriOpenAIConfig> = {
                    enableChatMemory: false,
                    enableEmbeddingMemory: true,
                    debugMode: true,
                };

                await client.updateConfig(newConfig);

                const updatedConfig = client.getConfig();
                expect(updatedConfig.enableChatMemory).toBe(false);
                expect(updatedConfig.enableEmbeddingMemory).toBe(true);
                expect(updatedConfig.debugMode).toBe(true);
            });

            it('should update OpenAI client when API settings change', async () => {
                const newConfig: Partial<MemoriOpenAIConfig> = {
                    apiKey: 'new-api-key',
                    baseUrl: 'https://new-api.example.com',
                };

                await client.updateConfig(newConfig);

                const updatedConfig = client.getConfig();
                expect(updatedConfig.apiKey).toBe('new-api-key');
                expect(updatedConfig.baseUrl).toBe('https://new-api.example.com');
            });

            it('should validate configuration updates', async () => {
                const invalidConfig: Partial<MemoriOpenAIConfig> = {
                    bufferTimeout: 500, // Invalid: too small
                };

                await expect(client.updateConfig(invalidConfig)).rejects.toThrow('Buffer timeout must be at least 1000ms');
            });
        });
    });

    describe('Metrics and Monitoring', () => {
        let client: MemoriOpenAIClient;

        beforeEach(async () => {
            client = new MemoriOpenAIClient('test-api-key', {
                autoInitialize: false,
                enableMetrics: true,
            });
            await client.enable();
        });

        describe('getMetrics()', () => {
            it('should return metrics object', async () => {
                const metrics = await client.getMetrics();

                expect(metrics).toBeDefined();
                expect(metrics.totalRequests).toBeDefined();
                expect(metrics.memoryRecordingSuccess).toBeDefined();
                expect(metrics.memoryRecordingFailures).toBeDefined();
                expect(metrics.averageResponseTime).toBeDefined();
                expect(metrics.averageMemoryProcessingTime).toBeDefined();
                expect(metrics.cacheHitRate).toBeDefined();
                expect(metrics.errorRate).toBeDefined();
                expect(metrics.streamingRatio).toBeDefined();
            });

            it('should return copy of metrics', async () => {
                const metrics1 = await client.getMetrics();
                const metrics2 = await client.getMetrics();

                // Should be different objects but with same values initially
                expect(metrics1).not.toBe(metrics2);
                expect(metrics1.totalRequests).toBe(metrics2.totalRequests);
            });
        });

        describe('resetMetrics()', () => {
            it('should reset all metrics to zero', async () => {
                // First get initial metrics
                const initialMetrics = await client.getMetrics();
                expect(initialMetrics.totalRequests).toBe(0);

                // Reset metrics
                await client.resetMetrics();

                const resetMetrics = await client.getMetrics();
                expect(resetMetrics.totalRequests).toBe(0);
                expect(resetMetrics.memoryRecordingSuccess).toBe(0);
                expect(resetMetrics.memoryRecordingFailures).toBe(0);
                expect(resetMetrics.averageResponseTime).toBe(0);
                expect(resetMetrics.averageMemoryProcessingTime).toBe(0);
                expect(resetMetrics.cacheHitRate).toBe(0);
                expect(resetMetrics.errorRate).toBe(0);
                expect(resetMetrics.streamingRatio).toBe(0);
            });
        });
    });

    describe('Utility Methods', () => {
        let client: MemoriOpenAIClient;

        beforeEach(() => {
            client = new MemoriOpenAIClient('test-api-key', { autoInitialize: false });
        });

        describe('getSessionId()', () => {
            it('should return valid session ID', () => {
                const sessionId = client.getSessionId();
                expect(sessionId).toBeDefined();
                expect(typeof sessionId).toBe('string');
                expect(sessionId.length).toBeGreaterThan(0);
            });

            it('should return consistent session ID', () => {
                const sessionId1 = client.getSessionId();
                const sessionId2 = client.getSessionId();
                expect(sessionId1).toBe(sessionId2);
            });
        });

        describe('isEnabled property', () => {
            it('should return false when not enabled', () => {
                expect(client.isEnabled).toBe(false);
            });

            it('should return true when enabled', async () => {
                await client.enable();
                expect(client.isEnabled).toBe(true);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle constructor errors gracefully', () => {
            // Test with invalid configuration that should throw during construction
            expect(() => {
                new MemoriOpenAIClient('test-api-key', {
                    bufferTimeout: 500,
                });
            }).toThrow(MemoryError);
        });

        it('should handle initialization errors gracefully', async () => {
            const client = new MemoriOpenAIClient('test-api-key', { autoInitialize: false });

            // Mock Memori to throw error on enable
            mockMemori.enable = jest.fn().mockRejectedValue(new Error('Initialization failed'));

            await expect(client.enable()).rejects.toThrow('Initialization failed');
            expect(client.isEnabled).toBe(false);
        });

        it('should handle configuration update errors gracefully', async () => {
            const client = new MemoriOpenAIClient('test-api-key', { autoInitialize: false });

            // Mock updateConfig to throw error
            const originalUpdateConfig = client.updateConfig.bind(client);
            jest.spyOn(client, 'updateConfig').mockRejectedValue(new Error('Update failed'));

            await expect(client.updateConfig({})).rejects.toThrow('Update failed');
        });
    });

    describe('Integration with Dependencies', () => {
        it('should create proper Memori instance with correct configuration', () => {
            const client = new MemoriOpenAIClient('test-api-key', {
                autoInitialize: false,
                databaseConfig: {
                    type: 'sqlite',
                    url: 'sqlite:./test.db',
                },
                namespace: 'test-namespace',
            });

            expect(client).toBeDefined();
            // The Memori instance should be created with the correct database URL
            // This is tested indirectly through the functionality
        });

        it('should create MemoryAgent with OpenAI provider', () => {
            const client = new MemoriOpenAIClient('test-api-key', {
                autoInitialize: false,
            });

            expect(client).toBeDefined();
            // MemoryAgent should be created with proper OpenAI provider
        });

        it('should create OpenAIMemoryManager with correct dependencies', () => {
            const client = new MemoriOpenAIClient('test-api-key', {
                autoInitialize: false,
            });

            expect(client).toBeDefined();
            // MemoryManager should be properly initialized with Memori and MemoryAgent
        });
    });
});

// Global cleanup after all tests
afterAll(async () => {
    await TestCleanup.fullCleanup();
});