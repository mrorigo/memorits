/**
 * Simple test to verify the database optimization system works
 */
import { TestDatabaseManager } from './TestDatabaseManager';

async function testBasicFunctionality() {
  console.log('🧪 Testing basic database functionality...');

  const dbManager = TestDatabaseManager.getInstance();

  try {
    // Test unit database
    console.log('Testing unit database...');
    const unitClient = await dbManager.getClient('unit');
    console.log('✅ Unit database client created');

    // Test a simple query
    const result = await unitClient.$queryRaw`SELECT 1 as test`;
    console.log('✅ Basic query works:', result);

    // Test integration database
    console.log('Testing integration database...');
    const integrationClient = await dbManager.getClient('integration');
    console.log('✅ Integration database client created');

    // Test health check
    const isHealthy = await dbManager.healthCheck();
    console.log('✅ Health check result:', isHealthy);

    // Test metrics
    const metrics = dbManager.getMetrics();
    console.log('✅ Metrics:', JSON.stringify(metrics, null, 2));

    console.log('🎉 All basic functionality tests passed!');

  } catch (error) {
    console.error('❌ Basic functionality test failed:', error);
    throw error;
  }
}

// Run the test
testBasicFunctionality().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});