/**
 * Comprehensive mock provider tests - focused and efficient
 * Tests core functionality, advanced scenarios, and edge cases
 */
import { MockAnthropicProvider, MockOllamaProvider, MockOpenAIProvider } from './providers';
import { MockErrorSimulator, MockStateManager } from './utils';

describe('Mock Provider Infrastructure', () => {
  describe('Core Provider Functionality', () => {
    test('all providers should initialize and respond correctly', async () => {
      const providers = [
        new MockAnthropicProvider({ apiKey: 'test', model: 'claude-3-5-sonnet-20241022' }),
        new MockOllamaProvider({ apiKey: 'test', model: 'llama2:7b' }),
        new MockOpenAIProvider({ apiKey: 'test', model: 'gpt-4o-mini' }),
      ];

      for (const provider of providers) {
        await provider.initialize({ apiKey: 'test' });
        expect(await provider.isHealthy()).toBe(true);

        const response = await provider.createChatCompletion({
          messages: [{ role: 'user', content: 'Hello' }],
        });

        expect(response.message.content).toBeTruthy();
        expect(response.message.role).toBe('assistant');
        expect(response.finish_reason).toBe('stop');
      }
    });

    test('providers should handle errors appropriately', async () => {
      const provider = new MockAnthropicProvider({ apiKey: 'test', mockError: true });
      await provider.initialize({ apiKey: 'test' });

      await expect(provider.createChatCompletion({
        messages: [{ role: 'user', content: 'Hello' }],
      })).rejects.toThrow('Mock Anthropic API error');
    });

    test('providers should provide accurate diagnostics', async () => {
      const provider = new MockAnthropicProvider({
        apiKey: 'test',
        mockError: true,
        mockDelay: 200,
      });
      await provider.initialize({ apiKey: 'test' });

      const diagnostics = await provider.getDiagnostics();
      expect(diagnostics.isHealthy).toBe(false);
      expect(diagnostics.metadata.mockError).toBe(true);
      expect(diagnostics.metadata.mockDelay).toBe(200);
    });
  });

  describe('Advanced Scenarios', () => {
    test('should handle intermittent failures realistically', async () => {
      const provider = new MockAnthropicProvider({ apiKey: 'test' });
      await provider.initialize({ apiKey: 'test' });

      const results = [];
      for (let i = 0; i < 20; i++) {
        // Randomly set error state to simulate intermittent failures (30% rate)
        provider.setMockError(Math.random() < 0.3);

        try {
          await provider.createChatCompletion({
            messages: [{ role: 'user', content: `test ${i}` }],
          });
          results.push('success');
        } catch {
          results.push('error');
        }
      }

      // Should have both successes and errors in realistic proportions
      expect(results).toContain('success');
      expect(results).toContain('error');
      expect(results.filter(r => r === 'success').length).toBeGreaterThan(10); // More lenient expectation
    });

    test('should simulate performance characteristics', async () => {
      const provider = new MockAnthropicProvider({
        apiKey: 'test',
        mockDelay: 100,
      });
      await provider.initialize({ apiKey: 'test' });

      const startTime = Date.now();
      await provider.createChatCompletion({
        messages: [{ role: 'user', content: 'test' }],
      });
      const duration = Date.now() - startTime;

      expect(duration).toBeGreaterThanOrEqual(90); // Should respect delay setting
    });

    test('OpenAI provider should handle function calling', async () => {
      const provider = new MockOpenAIProvider({
        apiKey: 'test',
        mockFunctions: [
          { name: 'get_weather', description: 'Get weather information' },
        ],
      });
      await provider.initialize({ apiKey: 'test' });

      const response = await provider.createChatCompletion({
        messages: [{ role: 'user', content: 'What is the weather?' }],
      });

      // Should either provide regular response or function call
      expect(response.message.role).toBe('assistant');
      expect(response.message.content || response.message.function_call).toBeTruthy();
    });
  });

  describe('State Management & Error Recovery', () => {
    test('should manage complex state workflows', () => {
      const stateManager = new MockStateManager();

      // Test state progression
      expect(stateManager.getCurrentState()).toBe('ready');

      stateManager.transitionTo('processing', 'Handling request');
      expect(stateManager.getCurrentState()).toBe('processing');

      stateManager.recordRequest(150);
      expect(stateManager.getCurrentState()).toBe('ready'); // Should return to ready

      // Test error handling
      stateManager.transitionTo('error', 'Simulated failure');
      expect(stateManager.isHealthy()).toBe(false);

      stateManager.simulateTimeProgression(2000); // Simulate time passing
      expect(stateManager.getCurrentState()).toBe('ready'); // Should recover
    });

    test('should simulate various error conditions', () => {
      const scenarios = [
        { type: 'network_error' as const, shouldRetry: true },
        { type: 'authentication_error' as const, shouldRetry: false },
        { type: 'rate_limit_error' as const, shouldRetry: true },
        { type: 'timeout_error' as const, shouldRetry: true },
      ];

      scenarios.forEach(({ type, shouldRetry }) => {
        const error = MockErrorSimulator.createError({ errorType: type });
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toBeTruthy();
        expect((error as any).retryable).toBe(shouldRetry);
      });
    });
  });

  describe('Integration & Edge Cases', () => {
    test('should work with multiple providers simultaneously', async () => {
      const stateManager = new MockStateManager();
      const providers = [
        new MockAnthropicProvider({ apiKey: 'test' }),
        new MockOllamaProvider({ apiKey: 'test' }),
        new MockOpenAIProvider({ apiKey: 'test' }),
      ];

      for (const provider of providers) {
        await provider.initialize({ apiKey: 'test' });
      }

      // Test concurrent usage
      const responses = await Promise.all(
        providers.map((provider, i) =>
          provider.createChatCompletion({
            messages: [{ role: 'user', content: `Message ${i}` }],
          })
        )
      );

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response.message.content).toBeTruthy();
        expect(response.finish_reason).toBe('stop');
      });
    });

    test('should handle provider disposal correctly', async () => {
      const provider = new MockAnthropicProvider({ apiKey: 'test' });
      await provider.initialize({ apiKey: 'test' });

      expect(await provider.isHealthy()).toBe(true);

      await provider.dispose();
      expect(await provider.isHealthy()).toBe(false);
    });

    test('should handle malformed input gracefully', async () => {
      const provider = new MockAnthropicProvider({ apiKey: 'test' });
      await provider.initialize({ apiKey: 'test' });

      // Test with empty messages array
      const response = await provider.createChatCompletion({
        messages: [],
      });

      expect(response.message.content).toBeTruthy();
      expect(response.message.role).toBe('assistant');
    });
  });
});