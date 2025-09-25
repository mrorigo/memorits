/**
 * Dual Memory Mode Example
 *
 * This example demonstrates the dual memory mode functionality in Memori:
 * 1. Auto-ingestion mode: Automatically processes conversations into memories
 * 2. Conscious ingestion mode: Stores conversations for manual processing
 * 3. Background monitoring for conscious updates
 */

import { Memori, ConfigManager } from '../src/index';

async function autoIngestionExample(): Promise<void> {
  console.log('🤖 Auto-Ingestion Mode Example');
  console.log('=====================================');

  const config = ConfigManager.loadConfig();
  config.autoIngest = true;
  config.consciousIngest = false;

  const memori = new Memori(config);
  await memori.enable();

  console.log('✅ Auto-ingestion mode enabled');
  console.log('✅ Background monitoring: Disabled (not needed for auto mode)');

  // Record conversations - they will be automatically processed
  await memori.recordConversation(
    'What is the capital of France?',
    'The capital of France is Paris.',
  );

  await memori.recordConversation(
    'What is 15 + 27?',
    '15 + 27 equals 42.',
  );

  console.log('✅ Conversations automatically processed into memories');

  await memori.close();
}

async function consciousIngestionExample(): Promise<void> {
  console.log('\n🧠 Conscious Ingestion Mode Example');
  console.log('=====================================');

  const config = ConfigManager.loadConfig();
  config.autoIngest = false;
  config.consciousIngest = true;

  const memori = new Memori(config);
  await memori.enable();

  console.log('✅ Conscious ingestion mode enabled');
  console.log('✅ Background monitoring: Enabled (30-second intervals)');

  // Record conversations - they will be stored for conscious processing
  await memori.recordConversation(
    'What are the benefits of renewable energy?',
    'Renewable energy sources like solar and wind power reduce greenhouse gas emissions, decrease dependence on fossil fuels, and provide sustainable long-term energy solutions.',
  );

  await memori.recordConversation(
    'How does machine learning work?',
    'Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed.',
  );

  console.log('✅ Conversations stored for conscious processing');

  // Manually trigger conscious processing
  console.log('🔄 Manually triggering conscious context updates...');
  await memori.checkForConsciousContextUpdates();

  // Configure background monitoring interval
  memori.setBackgroundUpdateInterval(60000); // 60 seconds
  console.log('✅ Background monitoring interval set to 60 seconds');

  // Check if background monitoring is active
  console.log(`✅ Background monitoring active: ${memori.isBackgroundMonitoringActive()}`);

  // Check mode status
  console.log(`✅ Conscious mode enabled: ${memori.isConsciousModeEnabled()}`);
  console.log(`✅ Auto mode enabled: ${memori.isAutoModeEnabled()}`);

  await memori.close();
}

async function dualModeComparison(): Promise<void> {
  console.log('\n⚖️ Dual Mode Comparison');
  console.log('=====================================');

  const config = ConfigManager.loadConfig();
  config.autoIngest = false;
  config.consciousIngest = false;

  const memori = new Memori(config);
  await memori.enable();

  console.log('✅ Neither auto nor conscious mode enabled');
  console.log('✅ Background monitoring: Disabled');

  // Record conversation without automatic processing
  await memori.recordConversation(
    'What is the weather like today?',
    'The weather is sunny and warm with a temperature of 25°C.',
  );

  console.log('✅ Conversation stored without automatic processing');
  console.log('✅ Manual processing would be required for memory creation');

  // Check mode status
  console.log(`✅ Conscious mode enabled: ${memori.isConsciousModeEnabled()}`);
  console.log(`✅ Auto mode enabled: ${memori.isAutoModeEnabled()}`);

  await memori.close();
}

async function main(): Promise<void> {
  console.log('🚀 Memori Dual Memory Mode Examples');
  console.log('=====================================\n');

  try {
    await autoIngestionExample();
    await consciousIngestionExample();
    await dualModeComparison();

    console.log('\n🎉 All dual memory mode examples completed successfully!');
  } catch (error) {
    console.error('❌ Error in dual memory mode examples:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
    }
  }
}

// Run the examples
main().catch(console.error);