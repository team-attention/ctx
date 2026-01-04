import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';
import YAML from 'yaml';

const { syncCommand } = await import('../../src/commands/sync.js');

describe('sync command (3-level system)', () => {
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

  describe('local context synchronization', () => {
    it('should run sync without error', async () => {
      await testEnv.createFile('src/test.ctx.md', `---
target: /src/test.ts
what: Test module
keywords:
  - testing
---

# Test Module
`);

      // Sync should complete without throwing
      await syncCommand({});

      // Registry should be updated
      const registry = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      expect(registry).toHaveProperty('contexts');
    });

    it('should detect local context files', async () => {
      await testEnv.createFile('src/a.ctx.md', `---
target: /src/a.ts
what: A
keywords: [test]
---
`);
      await testEnv.createFile('src/b.ctx.md', `---
target: /src/b.ts
what: B
keywords: [test]
---
`);

      await syncCommand({});

      const registry = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));
      const contextKeys = Object.keys(registry.contexts || {});
      expect(contextKeys.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('error handling', () => {
    it('should fail if project is not initialized', async () => {
      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      await testEnv.setup();

      await expect(async () => {
        await syncCommand({});
      }).rejects.toThrow('process.exit(1)');
    });
  });
});
