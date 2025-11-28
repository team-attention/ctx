import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';

const { checkCommand } = await import('../../src/commands/check.js');
const { syncCommand } = await import('../../src/commands/sync.js');

describe('check command', () => {
  let testEnv: TestEnvironment;
  let consoleOutput: ReturnType<typeof suppressConsole>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    await testEnv.initProject();
    consoleOutput = suppressConsole();

    // Track exit codes without throwing (to avoid catch block re-calling exit)
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined): never => {
        // Don't throw - just record the call and return
        return undefined as never;
      }) as any;
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    consoleOutput.restore();
    await testEnv.cleanup();
  });

  describe('basic check functionality', () => {
    it('should report fresh when all contexts are synced', async () => {
      // Create and sync a context
      const contextContent = `---
target: /src/test.ts
what: Test module
when:
  - Testing
---

# Test
`;
      await testEnv.createFile('src/test.ctx.md', contextContent);
      await testEnv.createFile('src/test.ts', 'export const test = 1;');
      await syncCommand({ local: true });

      // Check should pass (exit 0)
      await checkCommand({ local: true });

      expect(exitSpy).toHaveBeenCalledWith(0);
      const output = consoleOutput.getOutput();
      expect(output.log.join('\n')).toContain('"status": "fresh"');
    });

    it('should report new when context is not in registry', async () => {
      // Create context without syncing
      const contextContent = `---
target: /src/new.ts
what: New module
when:
  - Testing
---

# New Context
`;
      await testEnv.createFile('src/new.ctx.md', contextContent);

      // Check should report stale (exit 0 for stale, not error)
      await checkCommand({ local: true });

      expect(exitSpy).toHaveBeenCalledWith(0);
      const output = consoleOutput.getOutput();
      expect(output.log.join('\n')).toContain('"new": 1');
    });

    it('should report error when target file is missing', async () => {
      // Create and sync a context
      const contextContent = `---
target: /src/missing.ts
what: Missing target
when:
  - Testing
---

# Test
`;
      await testEnv.createFile('src/missing.ctx.md', contextContent);
      await testEnv.createFile('src/missing.ts', 'export const x = 1;');
      await syncCommand({ local: true });

      // Delete the target file
      const fs = await import('fs/promises');
      await fs.unlink(testEnv.getPath('src/missing.ts'));

      // Check should report error (exit 1)
      await checkCommand({ local: true });

      expect(exitSpy).toHaveBeenCalledWith(1);
      const output = consoleOutput.getOutput();
      expect(output.log.join('\n')).toContain('"errors": 1');
    });
  });

  describe('--path option filtering', () => {
    it('should check only the specified local context path', async () => {
      // Create multiple contexts
      const context1 = `---
target: /src/a.ts
what: Module A
when:
  - Testing A
---

# A
`;
      const context2 = `---
target: /src/b.ts
what: Module B
when:
  - Testing B
---

# B
`;
      await testEnv.createFile('src/a.ctx.md', context1);
      await testEnv.createFile('src/a.ts', 'export const a = 1;');
      await testEnv.createFile('src/b.ctx.md', context2);
      await testEnv.createFile('src/b.ts', 'export const b = 1;');

      // Sync both contexts
      await syncCommand({ local: true });

      // Now delete b.ts to make b.ctx.md have an error
      const fs = await import('fs/promises');
      await fs.unlink(testEnv.getPath('src/b.ts'));

      // Check only a.ctx.md - should pass even though b.ctx.md has error
      await checkCommand({ path: 'src/a.ctx.md' });

      expect(exitSpy).toHaveBeenCalledWith(0);
      const output = consoleOutput.getOutput();
      const logOutput = output.log.join('\n');
      // Should only report on a.ctx.md (1 fresh, no errors)
      expect(logOutput).toContain('"fresh": 1');
      expect(logOutput).toContain('"errors": 0');
    });

    it('should auto-detect local scope from path', async () => {
      const contextContent = `---
target: /src/test.ts
what: Test
when:
  - Testing
---

# Test
`;
      await testEnv.createFile('src/test.ctx.md', contextContent);
      await testEnv.createFile('src/test.ts', 'export const test = 1;');
      await syncCommand({ local: true });

      // --path without --local should auto-detect local scope
      await checkCommand({ path: 'src/test.ctx.md' });

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should auto-detect global scope from path', async () => {
      const globalContent = `---
what: Global doc
when:
  - Testing
---

# Global
`;
      await testEnv.createFile('ctx/rules/test.md', globalContent);
      await syncCommand({ global: true });

      // --path with ctx/ prefix should auto-detect global scope
      await checkCommand({ path: 'ctx/rules/test.md' });

      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should not report other contexts as deleted when using --path', async () => {
      // Create two contexts and sync them
      const context1 = `---
target: /src/a.ts
what: Module A
when:
  - Testing A
---

# A
`;
      const context2 = `---
target: /src/b.ts
what: Module B
when:
  - Testing B
---

# B
`;
      await testEnv.createFile('src/a.ctx.md', context1);
      await testEnv.createFile('src/a.ts', 'export const a = 1;');
      await testEnv.createFile('src/b.ctx.md', context2);
      await testEnv.createFile('src/b.ts', 'export const b = 1;');
      await syncCommand({ local: true });

      // Delete b.ctx.md from filesystem (but it's still in registry)
      const fs = await import('fs/promises');
      await fs.unlink(testEnv.getPath('src/b.ctx.md'));

      // Check only a.ctx.md - should NOT report b as deleted
      await checkCommand({ path: 'src/a.ctx.md' });

      expect(exitSpy).toHaveBeenCalledWith(0);
      const output = consoleOutput.getOutput();
      const logOutput = output.log.join('\n');
      expect(logOutput).not.toContain('"deleted": 1');
      expect(logOutput).toContain('"deleted": 0');
    });

    it('should return empty result for non-existent path', async () => {
      await checkCommand({ path: 'src/nonexistent.ctx.md' });

      expect(exitSpy).toHaveBeenCalledWith(0);
      const output = consoleOutput.getOutput();
      const logOutput = output.log.join('\n');
      // Should have 0 total contexts
      expect(logOutput).toContain('"total": 0');
    });

    it('should handle path with leading ./', async () => {
      const contextContent = `---
target: /src/test.ts
what: Test
when:
  - Testing
---

# Test
`;
      await testEnv.createFile('src/test.ctx.md', contextContent);
      await testEnv.createFile('src/test.ts', 'export const test = 1;');
      await syncCommand({ local: true });

      // Path with leading ./
      await checkCommand({ path: './src/test.ctx.md' });

      expect(exitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('error handling', () => {
    it('should fail if project is not initialized', async () => {
      await testEnv.cleanup();
      testEnv = new TestEnvironment();
      await testEnv.setup();

      await checkCommand({});

      expect(exitSpy).toHaveBeenCalledWith(1);
    });
  });
});
