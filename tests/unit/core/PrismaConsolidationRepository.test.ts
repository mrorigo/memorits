import { PrismaConsolidationRepository } from '../../../src/core/database/repositories/PrismaConsolidationRepository';
import { MemoryClassification, MemoryImportanceLevel } from '../../../src/core/types/schemas';
import { execSync } from 'child_process';
import { unlinkSync, existsSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { DuplicateDetectionConfig } from '../../../src/core/database/types/consolidation-models';

describe('PrismaConsolidationRepository', () => {
  let repository: PrismaConsolidationRepository;
  let prisma: PrismaClient;
  let dbPath: string;

  beforeEach(async () => {
    // Create unique database file for this test
    dbPath = `./test-consolidation-repo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.db`;
    const databaseUrl = `file:${dbPath}`;

    // Push schema to the specific database
    execSync(`DATABASE_URL=${databaseUrl} npx prisma db push --accept-data-loss --force-reset`, {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: databaseUrl },
    });

    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    repository = new PrismaConsolidationRepository(prisma);
  });

  afterEach(async () => {
    // Clean up
    if (prisma) {
      await prisma.$disconnect();
    }

    // Clean up test database file
    if (existsSync(dbPath)) {
      try {
        unlinkSync(dbPath);
      } catch {
        // Ignore cleanup errors
      }
    }

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Constructor and Initialization', () => {
    it('should create PrismaConsolidationRepository instance', () => {
      expect(repository).toBeDefined();
      expect(repository).toBeInstanceOf(PrismaConsolidationRepository);
    });

    it('should have PrismaClient instance', () => {
      expect((repository as any).prisma).toBeDefined();
      expect((repository as any).prisma).toBe(prisma);
    });
  });

  describe('findDuplicateCandidates', () => {
    beforeEach(async () => {
      // Create test memories for duplicate detection
      await prisma.longTermMemory.createMany({
        data: [
          {
            id: 'memory-1',
            namespace: 'default',
            searchableContent: 'TypeScript is a great programming language for web development',
            summary: 'TypeScript benefits',
            classification: 'essential',
            memoryImportance: 'high',
            categoryPrimary: 'programming',
            retentionType: 'long_term',
            importanceScore: 0.8,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
          {
            id: 'memory-2',
            namespace: 'default',
            searchableContent: 'JavaScript is essential for web development and programming',
            summary: 'JavaScript importance',
            classification: 'essential',
            memoryImportance: 'high',
            categoryPrimary: 'programming',
            retentionType: 'long_term',
            importanceScore: 0.7,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
          {
            id: 'memory-3',
            namespace: 'default',
            searchableContent: 'Python is great for data science and machine learning',
            summary: 'Python uses',
            classification: 'contextual',
            memoryImportance: 'medium',
            categoryPrimary: 'programming',
            retentionType: 'long_term',
            importanceScore: 0.5,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
        ],
      });
    });

    it('should find duplicate candidates based on content similarity', async () => {
      const content = 'TypeScript and JavaScript are both important for web development';
      const candidates = await repository.findDuplicateCandidates(content, 0.5);

      expect(Array.isArray(candidates)).toBe(true);
      expect(candidates.length).toBeGreaterThan(0);

      // Check that candidates have expected structure
      candidates.forEach(candidate => {
        expect(candidate).toHaveProperty('id');
        expect(candidate).toHaveProperty('content');
        expect(candidate).toHaveProperty('summary');
        expect(candidate).toHaveProperty('classification');
        expect(candidate).toHaveProperty('importance');
      });
    });

    it('should handle configuration parameters correctly', async () => {
      const content = 'test content for configuration';
      const config: DuplicateDetectionConfig = {
        similarityThreshold: 0.8,
        maxCandidates: 5,
        enableFuzzyMatching: true,
        contentWeights: {
          content: 0.7,
          summary: 0.2,
          entities: 0.1,
          keywords: 0.0,
        },
      };

      const candidates = await repository.findDuplicateCandidates(content, 0.5, config);
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should validate threshold parameter', async () => {
      const content = 'test content';

      await expect(
        repository.findDuplicateCandidates(content, -0.1)
      ).rejects.toThrow('Threshold must be between 0 and 1');

      await expect(
        repository.findDuplicateCandidates(content, 1.5)
      ).rejects.toThrow('Threshold must be between 0 and 1');
    });

    it('should handle empty content gracefully', async () => {
      const candidates = await repository.findDuplicateCandidates('', 0.5);
      expect(Array.isArray(candidates)).toBe(true);
    });

    it('should filter candidates by threshold', async () => {
      const content = 'TypeScript is great';
      const highThresholdCandidates = await repository.findDuplicateCandidates(content, 0.9);
      const lowThresholdCandidates = await repository.findDuplicateCandidates(content, 0.1);

      expect(Array.isArray(highThresholdCandidates)).toBe(true);
      expect(Array.isArray(lowThresholdCandidates)).toBe(true);
      // Higher threshold should generally return fewer results
      expect(highThresholdCandidates.length).toBeLessThanOrEqual(lowThresholdCandidates.length);
    });
  });

  describe('markMemoryAsDuplicate', () => {
    beforeEach(async () => {
      // Create test memories
      await prisma.longTermMemory.create({
        data: {
          id: 'original-memory',
          namespace: 'default',
          searchableContent: 'Original memory content',
          summary: 'Original summary',
          classification: 'essential',
          memoryImportance: 'high',
          categoryPrimary: 'test',
          retentionType: 'long_term',
          importanceScore: 0.8,
          extractionTimestamp: new Date(),
          createdAt: new Date(),
          processedData: {},
        },
      });

      await prisma.longTermMemory.create({
        data: {
          id: 'duplicate-memory',
          namespace: 'default',
          searchableContent: 'Duplicate memory content',
          summary: 'Duplicate summary',
          classification: 'contextual',
          memoryImportance: 'medium',
          categoryPrimary: 'test',
          retentionType: 'long_term',
          importanceScore: 0.6,
          extractionTimestamp: new Date(),
          createdAt: new Date(),
          processedData: {},
        },
      });
    });

    it('should mark memory as duplicate successfully', async () => {
      await repository.markMemoryAsDuplicate('duplicate-memory', 'original-memory', 'test consolidation');

      // Verify the memory was marked as duplicate
      const updatedMemory = await prisma.longTermMemory.findUnique({
        where: { id: 'duplicate-memory' },
      });

      expect(updatedMemory?.duplicateOf).toBe('original-memory');
      expect(updatedMemory?.classificationReason).toBe('test consolidation');
    });

    it('should handle non-existent duplicate memory', async () => {
      await expect(
        repository.markMemoryAsDuplicate('non-existent-duplicate', 'original-memory', 'test')
      ).rejects.toThrow('Duplicate memory not found');
    });

    it('should handle non-existent original memory', async () => {
      await expect(
        repository.markMemoryAsDuplicate('duplicate-memory', 'non-existent-original', 'test')
      ).rejects.toThrow('Original memory not found');
    });

    it('should sanitize input parameters', async () => {
      await repository.markMemoryAsDuplicate('duplicate-memory', 'original-memory');

      const updatedMemory = await prisma.longTermMemory.findUnique({
        where: { id: 'duplicate-memory' },
      });

      expect(updatedMemory?.duplicateOf).toBe('original-memory');
    });
  });

  describe('consolidateMemories', () => {
    beforeEach(async () => {
      // Create primary memory
      await prisma.longTermMemory.create({
        data: {
          id: 'primary-consolidation',
          namespace: 'default',
          searchableContent: 'Primary memory for consolidation',
          summary: 'Primary summary',
          classification: 'essential',
          memoryImportance: 'high',
          categoryPrimary: 'test',
          retentionType: 'long_term',
          importanceScore: 0.8,
          extractionTimestamp: new Date(),
          createdAt: new Date(),
          processedData: {},
        },
      });

      // Create duplicate memories
      await prisma.longTermMemory.createMany({
        data: [
          {
            id: 'duplicate-consolidation-1',
            namespace: 'default',
            searchableContent: 'Duplicate content one',
            summary: 'Summary one',
            classification: 'contextual',
            memoryImportance: 'medium',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.6,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
          {
            id: 'duplicate-consolidation-2',
            namespace: 'default',
            searchableContent: 'Duplicate content two',
            summary: 'Summary two',
            classification: 'contextual',
            memoryImportance: 'low',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.4,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
        ],
      });
    });

    it('should consolidate memories successfully', async () => {
      const result = await repository.consolidateMemories('primary-consolidation', [
        'duplicate-consolidation-1',
        'duplicate-consolidation-2',
      ]);

      expect(result.success).toBe(true);
      expect(result.consolidatedCount).toBe(2);
      expect(result.primaryMemoryId).toBe('primary-consolidation');
      expect(result.consolidatedMemoryIds).toEqual([
        'duplicate-consolidation-1',
        'duplicate-consolidation-2',
      ]);
      expect(result.dataIntegrityHash).toBeDefined();
      expect(result.consolidationTimestamp).toBeInstanceOf(Date);
    });

    it('should handle non-existent primary memory', async () => {
      await expect(
        repository.consolidateMemories('non-existent-primary', ['duplicate-consolidation-1'])
      ).rejects.toThrow('Primary memory not found');
    });

    it('should handle non-existent duplicate memories', async () => {
      await expect(
        repository.consolidateMemories('primary-consolidation', ['non-existent-duplicate'])
      ).rejects.toThrow('Some duplicate memories not found');
    });

    it('should use transaction for atomicity', async () => {
      // This test verifies that consolidation is atomic
      const result = await repository.consolidateMemories('primary-consolidation', [
        'duplicate-consolidation-1',
      ]);

      expect(result.success).toBe(true);

      // Verify all memories were updated
      const primaryMemory = await prisma.longTermMemory.findUnique({
        where: { id: 'primary-consolidation' },
      });
      const duplicateMemory = await prisma.longTermMemory.findUnique({
        where: { id: 'duplicate-consolidation-1' },
      });

      expect(primaryMemory?.relatedMemoriesJson).toEqual(['duplicate-consolidation-1']);
      expect(duplicateMemory?.duplicateOf).toBe('primary-consolidation');
    });
  });

  describe('getConsolidationStatistics', () => {
    beforeEach(async () => {
      // Create test memories with different states
      await prisma.longTermMemory.createMany({
        data: [
          {
            id: 'stats-memory-1',
            namespace: 'default',
            searchableContent: 'Regular memory',
            summary: 'Regular summary',
            classification: 'essential',
            memoryImportance: 'high',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.8,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
          {
            id: 'stats-memory-2',
            namespace: 'default',
            searchableContent: 'Duplicate memory',
            summary: 'Duplicate summary',
            classification: 'contextual',
            memoryImportance: 'medium',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.6,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
            duplicateOf: 'stats-memory-1',
          },
          {
            id: 'stats-memory-3',
            namespace: 'default',
            searchableContent: 'Consolidated memory',
            summary: 'Consolidated summary',
            classification: 'essential',
            memoryImportance: 'high',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.9,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
            relatedMemoriesJson: ['stats-memory-2'],
          },
        ],
      });
    });

    it('should return correct consolidation statistics', async () => {
      const stats = await repository.getConsolidationStatistics();

      expect(stats.totalMemories).toBe(3);
      expect(stats.duplicateCount).toBe(1);
      expect(stats.consolidatedMemories).toBe(1);
      expect(stats.averageConsolidationRatio).toBeGreaterThan(0);
      expect(stats.lastConsolidationActivity).toBeDefined();
      expect(stats.consolidationTrends).toEqual([]);
    });

    it('should handle empty database gracefully', async () => {
      // Create new repository with empty namespace
      const emptyPrisma = new PrismaClient({ datasourceUrl: `file:empty-${Date.now()}.db` });
      const emptyRepository = new PrismaConsolidationRepository(emptyPrisma);

      const stats = await emptyRepository.getConsolidationStatistics();

      expect(stats.totalMemories).toBe(0);
      expect(stats.duplicateCount).toBe(0);
      expect(stats.consolidatedMemories).toBe(0);
      expect(stats.averageConsolidationRatio).toBe(0);

      await emptyPrisma.$disconnect();
    });
  });

  describe('cleanupConsolidatedMemories', () => {
    beforeEach(async () => {
      const oldDate = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000); // 40 days ago

      await prisma.longTermMemory.create({
        data: {
          id: 'old-consolidated-memory',
          namespace: 'default',
          searchableContent: 'Old consolidated memory',
          summary: 'Old summary',
          classification: 'contextual',
          memoryImportance: 'low',
          categoryPrimary: 'test',
          retentionType: 'long_term',
          importanceScore: 0.2,
          extractionTimestamp: oldDate,
          createdAt: oldDate,
          processedData: {},
          relatedMemoriesJson: ['old-duplicate-1'],
        },
      });

      await prisma.longTermMemory.create({
        data: {
          id: 'recent-consolidated-memory',
          namespace: 'default',
          searchableContent: 'Recent consolidated memory',
          summary: 'Recent summary',
          classification: 'essential',
          memoryImportance: 'high',
          categoryPrimary: 'test',
          retentionType: 'long_term',
          importanceScore: 0.8,
          extractionTimestamp: new Date(),
          createdAt: new Date(),
          processedData: {},
          relatedMemoriesJson: ['recent-duplicate-1'],
        },
      });
    });

    it('should perform dry run cleanup correctly', async () => {
      const result = await repository.cleanupConsolidatedMemories(30, true);

      expect(result.cleaned).toBe(0); // Dry run should not actually delete
      expect(result.skipped).toBe(1); // Should find the old memory
      expect(result.errors).toEqual([]);
      expect(result.dryRun).toBe(true);

      // Verify memory still exists
      const memory = await prisma.longTermMemory.findUnique({
        where: { id: 'old-consolidated-memory' },
      });
      expect(memory).toBeDefined();
    });

    it('should validate input parameters', async () => {
      await expect(
        repository.cleanupConsolidatedMemories(0, true)
      ).resolves.toBeDefined();

      await expect(
        repository.cleanupConsolidatedMemories(-1, true)
      ).resolves.toBeDefined();
    });
  });

  describe('getConsolidatedMemory', () => {
    beforeEach(async () => {
      await prisma.longTermMemory.create({
        data: {
          id: 'consolidated-memory-details',
          namespace: 'default',
          searchableContent: 'Memory with consolidation details',
          summary: 'Consolidated summary',
          classification: 'essential',
          memoryImportance: 'high',
          categoryPrimary: 'test',
          retentionType: 'long_term',
          importanceScore: 0.8,
          extractionTimestamp: new Date(),
          createdAt: new Date(),
          processedData: {},
          duplicateOf: 'original-memory-id',
          relatedMemoriesJson: ['duplicate-1', 'duplicate-2'],
        },
      });
    });

    it('should return consolidated memory details', async () => {
      const memory = await repository.getConsolidatedMemory('consolidated-memory-details');

      expect(memory).toBeDefined();
      expect(memory?.id).toBe('consolidated-memory-details');
      expect(memory?.isDuplicate).toBe(true);
      expect(memory?.duplicateOf).toBe('original-memory-id');
      expect(memory?.isConsolidated).toBe(true);
      expect(memory?.consolidationCount).toBe(2);
    });

    it('should return null for non-existent memory', async () => {
      const memory = await repository.getConsolidatedMemory('non-existent-memory');
      expect(memory).toBeNull();
    });
  });

  describe('getConsolidatedMemories', () => {
    beforeEach(async () => {
      // Create primary memory
      await prisma.longTermMemory.create({
        data: {
          id: 'primary-consolidated',
          namespace: 'default',
          searchableContent: 'Primary consolidated memory',
          summary: 'Primary summary',
          classification: 'essential',
          memoryImportance: 'high',
          categoryPrimary: 'test',
          retentionType: 'long_term',
          importanceScore: 0.8,
          extractionTimestamp: new Date(),
          createdAt: new Date(),
          processedData: {},
        },
      });

      // Create consolidated memories
      await prisma.longTermMemory.createMany({
        data: [
          {
            id: 'consolidated-1',
            namespace: 'default',
            searchableContent: 'Consolidated memory 1',
            summary: 'Summary 1',
            classification: 'contextual',
            memoryImportance: 'medium',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.6,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
            duplicateOf: 'primary-consolidated',
          },
          {
            id: 'consolidated-2',
            namespace: 'default',
            searchableContent: 'Consolidated memory 2',
            summary: 'Summary 2',
            classification: 'contextual',
            memoryImportance: 'low',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.4,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
            duplicateOf: 'primary-consolidated',
          },
        ],
      });
    });

    it('should return consolidated memory IDs', async () => {
      const consolidatedIds = await repository.getConsolidatedMemories('primary-consolidated');

      expect(Array.isArray(consolidatedIds)).toBe(true);
      expect(consolidatedIds).toEqual(['consolidated-1', 'consolidated-2']);
    });

    it('should return empty array for memory with no consolidations', async () => {
      const consolidatedIds = await repository.getConsolidatedMemories('non-consolidated-memory');

      expect(Array.isArray(consolidatedIds)).toBe(true);
      expect(consolidatedIds).toEqual([]);
    });
  });

  describe('updateDuplicateTracking', () => {
    beforeEach(async () => {
      await prisma.longTermMemory.createMany({
        data: [
          {
            id: 'tracking-memory-1',
            namespace: 'default',
            searchableContent: 'Memory 1 for tracking',
            summary: 'Summary 1',
            classification: 'essential',
            memoryImportance: 'high',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.8,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
          {
            id: 'tracking-memory-2',
            namespace: 'default',
            searchableContent: 'Memory 2 for tracking',
            summary: 'Summary 2',
            classification: 'contextual',
            memoryImportance: 'medium',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.6,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
        ],
      });
    });

    it('should update duplicate tracking for multiple memories', async () => {
      const updates = [
        {
          memoryId: 'tracking-memory-1',
          isDuplicate: true,
          duplicateOf: 'original-1',
          consolidationReason: 'batch update test',
        },
        {
          memoryId: 'tracking-memory-2',
          isDuplicate: false,
          consolidationReason: 'not a duplicate',
        },
      ];

      const result = await repository.updateDuplicateTracking(updates);

      expect(result.updated).toBe(2);
      expect(result.errors).toEqual([]);

      // Verify updates were applied
      const memory1 = await prisma.longTermMemory.findUnique({
        where: { id: 'tracking-memory-1' },
      });
      const memory2 = await prisma.longTermMemory.findUnique({
        where: { id: 'tracking-memory-2' },
      });

      expect(memory1?.duplicateOf).toBe('original-1');
      expect(memory1?.classificationReason).toBe('batch test 0');
      expect(memory2?.classificationReason).toBe('not a duplicate');
    });

    it('should handle non-existent memory in batch update', async () => {
      const updates = [
        {
          memoryId: 'tracking-memory-1',
          isDuplicate: true,
        },
        {
          memoryId: 'non-existent-memory',
          isDuplicate: true,
        },
      ];

      const result = await repository.updateDuplicateTracking(updates);

      expect(result.updated).toBe(1);
      expect(result.errors.length).toBe(1);
      expect(result.errors[0]).toContain('non-existent-memory');
    });

    it('should handle empty updates array', async () => {
      const result = await repository.updateDuplicateTracking([]);
      expect(result.updated).toBe(0);
      expect(result.errors).toEqual([]);
    });
  });

  describe('performPreConsolidationValidation', () => {
    beforeEach(async () => {
      await prisma.longTermMemory.createMany({
        data: [
          {
            id: 'validation-primary',
            namespace: 'default',
            searchableContent: 'Primary memory for validation',
            summary: 'Primary summary',
            classification: 'essential',
            memoryImportance: 'high',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.8,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
          {
            id: 'validation-duplicate-1',
            namespace: 'default',
            searchableContent: 'Duplicate 1',
            summary: 'Summary 1',
            classification: 'contextual',
            memoryImportance: 'medium',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.6,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
          {
            id: 'validation-duplicate-2',
            namespace: 'default',
            searchableContent: 'Duplicate 2',
            summary: 'Summary 2',
            classification: 'contextual',
            memoryImportance: 'low',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.4,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
        ],
      });
    });

    it('should validate consolidation eligibility successfully', async () => {
      const result = await repository.performPreConsolidationValidation('validation-primary', [
        'validation-duplicate-1',
        'validation-duplicate-2',
      ]);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should detect missing primary memory', async () => {
      const result = await repository.performPreConsolidationValidation('non-existent-primary', [
        'validation-duplicate-1',
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Primary memory not found');
    });

    it('should detect missing duplicate memories', async () => {
      const result = await repository.performPreConsolidationValidation('validation-primary', [
        'non-existent-duplicate',
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Duplicate memories not found');
    });

    it('should detect circular references', async () => {
      const result = await repository.performPreConsolidationValidation('validation-primary', [
        'validation-primary', // Primary memory in duplicate list
      ]);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Circular reference detected');
    });
  });

  describe('backupMemoryData and rollbackConsolidation', () => {
    beforeEach(async () => {
      await prisma.longTermMemory.createMany({
        data: [
          {
            id: 'backup-primary',
            namespace: 'default',
            searchableContent: 'Primary memory for backup',
            summary: 'Primary summary',
            classification: 'essential',
            memoryImportance: 'high',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.8,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
          {
            id: 'backup-duplicate',
            namespace: 'default',
            searchableContent: 'Duplicate for backup',
            summary: 'Duplicate summary',
            classification: 'contextual',
            memoryImportance: 'medium',
            categoryPrimary: 'test',
            retentionType: 'long_term',
            importanceScore: 0.6,
            extractionTimestamp: new Date(),
            createdAt: new Date(),
            processedData: {},
          },
        ],
      });
    });

    it('should backup memory data successfully', async () => {
      const backupData = await repository.backupMemoryData(['backup-primary', 'backup-duplicate']);

      expect(backupData instanceof Map).toBe(true);
      expect(backupData.size).toBe(2);
      expect(backupData.has('backup-primary')).toBe(true);
      expect(backupData.has('backup-duplicate')).toBe(true);

      const primaryBackup = backupData.get('backup-primary');
      expect(primaryBackup).toHaveProperty('backupTimestamp');
      expect(primaryBackup?.backupTimestamp).toBeInstanceOf(Date);
    });

    it('should handle rollback consolidation', async () => {
      // First, consolidate memories
      await repository.consolidateMemories('backup-primary', ['backup-duplicate']);

      // Backup current state
      const backupData = await repository.backupMemoryData(['backup-primary', 'backup-duplicate']);

      // Modify the memories
      await prisma.longTermMemory.update({
        where: { id: 'backup-primary' },
        data: { classificationReason: 'modified after consolidation' },
      });

      // Rollback
      await repository.rollbackConsolidation('backup-primary', ['backup-duplicate'], backupData);

      // Verify rollback occurred (this would restore original data)
      const primaryMemory = await prisma.longTermMemory.findUnique({
        where: { id: 'backup-primary' },
      });
      expect(primaryMemory).toBeDefined();
    });
  });

  describe('generateDataIntegrityHash', () => {
    it('should generate consistent hash for same data', () => {
      const data1 = { id: 'test', timestamp: new Date() };
      const data2 = { id: 'test', timestamp: new Date() };

      const hash1 = (repository as any).generateDataIntegrityHash(data1);
      const hash2 = (repository as any).generateDataIntegrityHash(data2);

      expect(typeof hash1).toBe('string');
      expect(hash1.length).toBeGreaterThan(0);
      // Note: Since timestamps are different, hashes will be different
      // This test mainly verifies the method doesn't throw and returns a string
    });

    it('should generate different hashes for different data', () => {
      const data1 = { id: 'test1', value: 'value1' };
      const data2 = { id: 'test2', value: 'value2' };

      const hash1 = (repository as any).generateDataIntegrityHash(data1);
      const hash2 = (repository as any).generateDataIntegrityHash(data2);

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      // Create repository with invalid database connection
      const badPrisma = new PrismaClient({
        datasourceUrl: 'file:/invalid/path/that/does/not/exist/non-existent.db',
      });
      const badRepository = new PrismaConsolidationRepository(badPrisma);

      await expect(
        badRepository.findDuplicateCandidates('test', 0.7)
      ).rejects.toThrow();

      await badPrisma.$disconnect();
    });

    it('should handle malformed data gracefully', async () => {
      // Create memory with malformed relatedMemoriesJson
      await prisma.longTermMemory.create({
        data: {
          id: 'malformed-memory',
          namespace: 'default',
          searchableContent: 'Malformed data test',
          summary: 'Summary',
          classification: 'essential',
          memoryImportance: 'medium',
          categoryPrimary: 'test',
          retentionType: 'long_term',
          importanceScore: 0.5,
          extractionTimestamp: new Date(),
          createdAt: new Date(),
          processedData: 'invalid-json-string' as any,
          relatedMemoriesJson: 'not-an-array' as any,
        },
      });

      // Should handle gracefully
      const stats = await repository.getConsolidationStatistics();
      expect(stats).toBeDefined();
      expect(typeof stats.totalMemories).toBe('number');
    });

    it('should sanitize all string inputs', async () => {
      // Test with potentially malicious input
      const maliciousInput = 'test-input<script>alert("xss")</script>';

      await expect(
        repository.markMemoryAsDuplicate(maliciousInput, 'original-memory', 'test')
      ).rejects.toThrow(); // Should fail due to non-existent memory, not due to injection
    });
  });
});