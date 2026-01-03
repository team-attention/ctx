import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';

const { checkCommand } = await import('../../src/commands/check.js');

describe('check command (3-level system)', () => {
  let testEnv: TestEnvironment;
  let consoleOutput: ReturnType<typeof suppressConsole>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    await testEnv.initProject();
    consoleOutput = suppressConsole();

    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((_code?: string | number | null | undefined): never => {
        return undefined as never;
      }) as any;
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    consoleOutput.restore();
    await testEnv.cleanup();
  });

  describe('basic check functionality', () => {
    it('should run check without error on empty project', async () => {
      await checkCommand({});

      // Should complete without error
      expect(exitSpy).toHaveBeenCalledWith(0);
    });

    it('should detect unsynced context files', async () => {
      await testEnv.createFile('src/test.ctx.md', `---
target: /src/test.ts
what: Test module
when:
  - Testing
---

# Test
`);

      await checkCommand({ local: true });

      const output = consoleOutput.getOutput();
      const logOutput = output.log.join('\n');
      // Should report something
      expect(logOutput).toContain('"total"');
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
