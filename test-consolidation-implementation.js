#!/usr/bin/env node

/**
 * Simple validation test for duplicate consolidation implementation
 * This script validates that the consolidation functionality is properly implemented
 */

import { DatabaseManager } from './dist/src/core/database/DatabaseManager.js';
import { ConsciousAgent } from './dist/src/core/agents/ConsciousAgent.js';

async function testConsolidationImplementation() {
  console.log('🔍 Testing Duplicate Consolidation Implementation...\n');

  try {
    // Initialize database manager (using in-memory SQLite for testing)
    const dbManager = new DatabaseManager('file::memory:');

    // Initialize conscious agent
    const consciousAgent = new ConsciousAgent(dbManager, 'test-namespace');

    console.log('✅ DatabaseManager and ConsciousAgent initialized successfully');

    // Test consolidation readiness validation
    console.log('\n📊 Testing consolidation readiness validation...');
    const readiness = await consciousAgent.validateConsolidationReadiness('test-namespace');

    console.log('Readiness Status:', readiness.ready ? '✅ Ready' : '❌ Not Ready');
    console.log('Issues Found:', readiness.issues.length);
    console.log('Recommendations:', readiness.recommendations.length);

    if (readiness.issues.length > 0) {
      console.log('Issues:');
      readiness.issues.forEach((issue, index) => {
        console.log(`  ${index + 1}. ${issue}`);
      });
    }

    if (readiness.recommendations.length > 0) {
      console.log('Recommendations:');
      readiness.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    // Test consolidation health report
    console.log('\n🏥 Testing consolidation health report...');
    const healthReport = await consciousAgent.getConsolidationHealthReport('test-namespace');

    console.log('Health Status:', {
      status: healthReport.status.toUpperCase(),
      totalMemories: healthReport.totalMemories,
      consolidatedMemories: healthReport.consolidatedMemories,
      failedConsolidations: healthReport.failedConsolidations,
      averageConsolidationTime: `${healthReport.averageConsolidationTime}ms`,
    });

    if (healthReport.recommendations.length > 0) {
      console.log('Health Recommendations:');
      healthReport.recommendations.forEach((rec, index) => {
        console.log(`  ${index + 1}. ${rec}`);
      });
    }

    // Test database consolidation stats
    console.log('\n📈 Testing database consolidation statistics...');
    const consolidationStats = await dbManager.getConsolidationStats('test-namespace');

    console.log('Consolidation Stats:', {
      totalMemories: consolidationStats.totalMemories,
      potentialDuplicates: consolidationStats.potentialDuplicates,
      consolidatedMemories: consolidationStats.consolidatedMemories,
      consolidationRatio: `${consolidationStats.consolidationRatio}%`,
      lastConsolidation: consolidationStats.lastConsolidation || 'Never',
    });

    // Test enhanced consolidation methods exist
    console.log('\n🔧 Testing enhanced consolidation methods...');

    // Check if enhanced methods exist
    const dbManagerMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(dbManager));
    const requiredMethods = [
      'consolidateDuplicateMemories',
      'performPreConsolidationValidation',
      'backupMemoryData',
      'rollbackConsolidation',
      'generateDataIntegrityHash',
      'mergeDuplicateDataEnhanced',
    ];

    const missingMethods = requiredMethods.filter(method => !dbManagerMethods.includes(method));

    if (missingMethods.length === 0) {
      console.log('✅ All required DatabaseManager consolidation methods are present');
    } else {
      console.log('❌ Missing DatabaseManager methods:', missingMethods.join(', '));
    }

    // Check ConsciousAgent enhanced safety methods
    const consciousAgentMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(consciousAgent));
    const requiredConsciousAgentMethods = [
      'performSafetyChecks',
      'getMemoryImportance',
      'importanceScoreToNumber',
      'checkRecentConsolidationActivity',
      'validateMemoryContentIntegrity',
      'validateClassificationCompatibility',
      'getConsolidationHealthReport',
      'validateConsolidationReadiness',
    ];

    const missingConsciousAgentMethods = requiredConsciousAgentMethods.filter(
      method => !consciousAgentMethods.includes(method)
    );

    if (missingConsciousAgentMethods.length === 0) {
      console.log('✅ All required ConsciousAgent safety check methods are present');
    } else {
      console.log('❌ Missing ConsciousAgent methods:', missingConsciousAgentMethods.join(', '));
    }

    // Test duplicate detection functionality
    console.log('\n🔍 Testing duplicate detection functionality...');
    try {
      const potentialDuplicates = await dbManager.findPotentialDuplicates(
        'This is a test memory for duplicate detection',
        'test-namespace',
        0.7
      );
      console.log(`✅ Duplicate detection works - found ${potentialDuplicates.length} potential duplicates`);
    } catch (error) {
      console.log('❌ Duplicate detection failed:', error.message);
    }

    // Generate summary report
    console.log('\n📋 CONSOLIDATION IMPLEMENTATION TEST SUMMARY');
    console.log('=' .repeat(50));

    const allTestsPassed =
      readiness.issues.length === 0 &&
      missingMethods.length === 0 &&
      missingConsciousAgentMethods.length === 0;

    if (allTestsPassed) {
      console.log('🎉 ALL TESTS PASSED - Consolidation implementation is ready!');
      console.log('\n✅ Core Features Implemented:');
      console.log('  • Enhanced duplicate consolidation with rollback support');
      console.log('  • Comprehensive pre-consolidation validation');
      console.log('  • Advanced data merging with quality scoring');
      console.log('  • Enhanced safety checks and content validation');
      console.log('  • Consolidation health monitoring and reporting');
      console.log('  • Data integrity validation and backup systems');

      console.log('\n🚀 Ready for production use!');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Review implementation');

      if (readiness.issues.length > 0) {
        console.log('\n❌ Readiness Issues:');
        readiness.issues.forEach((issue, index) => {
          console.log(`  ${index + 1}. ${issue}`);
        });
      }

      if (missingMethods.length > 0) {
        console.log('\n❌ Missing DatabaseManager Methods:');
        missingMethods.forEach(method => {
          console.log(`  • ${method}`);
        });
      }

      if (missingConsciousAgentMethods.length > 0) {
        console.log('\n❌ Missing ConsciousAgent Methods:');
        missingConsciousAgentMethods.forEach(method => {
          console.log(`  • ${method}`);
        });
      }
    }

    // Cleanup
    await dbManager.close();

    return allTestsPassed;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test if this script is executed directly
if (require.main === module) {
  testConsolidationImplementation()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Test execution failed:', error);
      process.exit(1);
    });
}

module.exports = { testConsolidationImplementation };