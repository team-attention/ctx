import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';
import YAML from 'yaml';

const { addCommand } = await import('../../src/commands/add.js');

describe('add command - Phase 2 auto-pattern', () => {
  let testEnv: TestEnvironment;
  let consoleOutput: ReturnType<typeof suppressConsole>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    await testEnv.initProject();
    consoleOutput = suppressConsole();

    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
      throw new Error(`process.exit(${code})`);
    }) as any;
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    consoleOutput.restore();
    await testEnv.cleanup();
  });

  describe('auto-add pattern to context_paths', () => {
    it('should auto-add pattern when file does not match existing patterns', async () => {
      // Create a test file
      const testFile = 'docs/test-guide.md';
      const testContent = `---
what: Test guide
keywords:
  - test
---

# Test Guide
`;
      await testEnv.createFile(testFile, testContent);

      // Read initial registry
      const registryBefore = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const initialPatternCount = registryBefore.settings?.context_paths?.length || 0;

      // Add the file
      await addCommand([testFile], { global: false });

      // Read updated registry
      const registryAfter = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const finalPatternCount = registryAfter.settings?.context_paths?.length || 0;

      // Verify pattern was added
      expect(finalPatternCount).toBe(initialPatternCount + 1);

      // Verify the specific pattern exists
      const hasPattern = registryAfter.settings?.context_paths?.some(
        (cp: any) => cp.path === testFile
      );
      expect(hasPattern).toBe(true);

      // Verify file is in registry
      expect(registryAfter.contexts[testFile]).toBeDefined();
    });

    it('should NOT add duplicate pattern if file already matches', async () => {
      // Add a pattern first
      let registry = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      if (!registry.settings) {
        registry.settings = { context_paths: [] };
      }
      registry.settings.context_paths.push({
        path: 'docs/**/*.md',
        purpose: 'Documentation'
      });
      await testEnv.createFile('.ctx/registry.yaml', YAML.stringify(registry));

      // Create a file that matches the pattern
      const testFile = 'docs/api-guide.md';
      const testContent = `---
what: API Guide
keywords:
  - api
---

# API Guide
`;
      await testEnv.createFile(testFile, testContent);

      const patternCountBefore = registry.settings.context_paths.length;

      // Add the file
      await addCommand([testFile], { global: false });

      // Read updated registry
      const registryAfter = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const patternCountAfter = registryAfter.settings?.context_paths?.length || 0;

      // Pattern count should NOT increase
      expect(patternCountAfter).toBe(patternCountBefore);

      // File should still be in registry (via sync)
      expect(registryAfter.contexts[testFile]).toBeDefined();
    });

    it('should add multiple patterns for multiple unmatched files', async () => {
      // Create test files
      const files = [
        'random/file1.md',
        'another/file2.md',
        'third/file3.md'
      ];

      for (const file of files) {
        const content = `---
what: Test file
keywords:
  - test
---

# Test
`;
        await testEnv.createFile(file, content);
      }

      const registryBefore = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const initialCount = registryBefore.settings?.context_paths?.length || 0;

      // Add all files
      await addCommand(files, { global: false });

      const registryAfter = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const finalCount = registryAfter.settings?.context_paths?.length || 0;

      // Should have added 3 patterns
      expect(finalCount).toBe(initialCount + 3);
    });
  });

  describe('sync after pattern addition', () => {
    it('should auto-sync after adding patterns', async () => {
      const testFile = 'test-sync.md';
      const testContent = `---
what: Test sync
keywords:
  - test
---

# Test
`;
      await testEnv.createFile(testFile, testContent);

      await addCommand([testFile], { global: false });

      const registry = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));

      // Verify sync updated the registry
      expect(registry.contexts[testFile]).toBeDefined();
      expect(registry.contexts[testFile].checksum).toBeDefined();
      expect(registry.contexts[testFile].last_modified).toBeDefined();
    });
  });
});
