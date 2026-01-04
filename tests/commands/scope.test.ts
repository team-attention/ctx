import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';

const { listCommand } = await import('../../src/commands/list.js');
const { statusCommand } = await import('../../src/commands/status.js');
const { loadCommand } = await import('../../src/commands/load.js');
const { saveCommand } = await import('../../src/commands/save.js');
const { syncCommand } = await import('../../src/commands/sync.js');

/**
 * Scope Behavior Tests
 *
 * Verifies consistent scope handling across all commands:
 * - Default scope is project
 * - Read commands: Warning + global fallback when outside project (CORE_PRINCIPLE #5)
 * - Write commands: Error when outside project without --global
 * - --global and --project are mutually exclusive (for save)
 */
describe('scope behavior', () => {
  let testEnv: TestEnvironment;
  let consoleOutput: ReturnType<typeof suppressConsole>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
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

  describe('outside project (no .ctx/)', () => {
    beforeEach(async () => {
      // Initialize global only, no project
      await testEnv.initGlobal();
    });

    describe('without --global flag', () => {
      // Read commands: Warning + global fallback (CORE_PRINCIPLE #5)
      it('list: should fallback to global with warning', async () => {
        await listCommand({});

        const output = consoleOutput.getOutput();
        // Should warn about fallback
        expect(output.error.join('')).toContain('No project found');
        // Should return global contexts (empty array in this case)
        const parsed = JSON.parse(output.log.join(''));
        expect(Array.isArray(parsed)).toBe(true);
      });

      it('status: should fallback to global with warning', async () => {
        await statusCommand({});

        const output = consoleOutput.getOutput();
        // Should warn about fallback
        expect(output.error.join('')).toContain('No project found');
        // Should return global status
        const parsed = JSON.parse(output.log.join(''));
        expect(parsed).toHaveProperty('initialized', true);
      });

      it('load: should fallback to global with warning', async () => {
        await loadCommand({ keywords: ['api'] });

        const output = consoleOutput.getOutput();
        // Should warn about fallback
        expect(output.error.join('')).toContain('No project found');
      });

      // Write commands: Error when outside project (CORE_PRINCIPLE #5)
      it('save: should error (write command)', async () => {
        await expect(saveCommand({
          path: 'test.md',
          content: '# Test',
        })).rejects.toThrow('process.exit(1)');

        const output = consoleOutput.getOutput();
        expect(output.error.join('')).toContain('Not in a ctx project');
      });
    });

    describe('with --global flag', () => {
      it('list --global: should work', async () => {
        await listCommand({ global: true });

        const output = consoleOutput.getOutput();
        // Should not error, returns empty array
        const parsed = JSON.parse(output.log.join(''));
        expect(Array.isArray(parsed)).toBe(true);
      });

      it('status --global: should work', async () => {
        await statusCommand({ global: true });

        const output = consoleOutput.getOutput();
        // Should not error, returns status object
        const parsed = JSON.parse(output.log.join(''));
        expect(parsed).toHaveProperty('initialized', true);
        expect(parsed).toHaveProperty('global');
      });

      it('load --global: should work (no results)', async () => {
        await loadCommand({ keywords: ['nonexistent'], global: true });

        const output = consoleOutput.getOutput();
        expect(output.log.join('')).toContain('No matching contexts found');
      });

      it('save --global: should work', async () => {
        await saveCommand({
          path: 'test.md',
          content: '# Test',
          global: true,
        });

        const output = consoleOutput.getOutput();
        expect(output.log.join('')).toContain('Saved');
      });
    });
  });

  describe('mutually exclusive options', () => {
    beforeEach(async () => {
      await testEnv.initProject();
      await testEnv.initGlobal();
    });

    it('save --project --global: should error', async () => {
      await expect(saveCommand({
        path: 'test.md',
        content: '# Test',
        project: true,
        global: true,
      })).rejects.toThrow('process.exit(1)');

      const output = consoleOutput.getOutput();
      expect(output.error.join('')).toContain('mutually exclusive');
    });
  });

  describe('default scope is project', () => {
    beforeEach(async () => {
      await testEnv.initProject();
      await testEnv.initGlobal();

      // Create context in project and register directly
      await testEnv.createFile('.ctx/contexts/project-api.md', `---
what: Project API patterns
keywords:
  - api
  - project
---

# Project API
`);

      // Create context in global and register directly
      await testEnv.createFile('home/.ctx/contexts/global-api.md', `---
what: Global API patterns
keywords:
  - api
  - global
---

# Global API
`);

      // Register project context via sync
      await syncCommand({});
      consoleOutput.restore();
      consoleOutput = suppressConsole();

      // Register global context directly in registry
      // (sync --global requires context_paths matching, which is complex for tests)
      await testEnv.createFile('home/.ctx/registry.yaml', `meta:
  version: '2.0.0'
  last_synced: '${new Date().toISOString()}'
settings:
  context_paths:
    - path: 'contexts/**/*.md'
      purpose: 'Global contexts'
contexts:
  'contexts/global-api.md':
    checksum: 'test-checksum'
    preview:
      what: 'Global API patterns'
      keywords:
        - api
        - global
index: {}
`);
    });

    it('list: should only show project contexts by default', async () => {
      await listCommand({});

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));

      // Should only have project contexts
      const registries = parsed.map((c: any) => c.registry);
      expect(registries).toContain('project');
      expect(registries).not.toContain('global');
    });

    it('list --all: should show both project and global', async () => {
      await listCommand({ all: true });

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));

      // Should have both
      const registries = parsed.map((c: any) => c.registry);
      expect(registries).toContain('project');
      expect(registries).toContain('global');
    });

    it('load: should only search project by default', async () => {
      await loadCommand({ keywords: ['api'], paths: true });

      const output = consoleOutput.getOutput();
      const paths = output.log.join('\n');

      // Should find project context
      expect(paths).toContain('project-api.md');
      // Should NOT find global context
      expect(paths).not.toContain('global-api.md');
    });

    it('load --all: should search both project and global', async () => {
      await loadCommand({ keywords: ['api'], paths: true, all: true });

      const output = consoleOutput.getOutput();
      const paths = output.log.join('\n');

      // Should find both
      expect(paths).toContain('project-api.md');
      expect(paths).toContain('global-api.md');
    });

    it('load --global: should only search global', async () => {
      await loadCommand({ keywords: ['api'], paths: true, global: true });

      const output = consoleOutput.getOutput();
      const paths = output.log.join('\n');

      // Should find global context
      expect(paths).toContain('global-api.md');
      // Should NOT find project context
      expect(paths).not.toContain('project-api.md');
    });
  });

  describe('--project/--global scope validation', () => {
    beforeEach(async () => {
      await testEnv.initProject();
      await testEnv.initGlobal();
    });

    it('save --project: should validate project exists', async () => {
      // --project with explicit path should save to that path
      await saveCommand({
        path: '.ctx/contexts/test.md',
        content: '# Test',
        project: true,
      });

      const output = consoleOutput.getOutput();
      expect(output.log.join('')).toContain('Saved');

      // Verify file location (path is used as-is)
      const exists = await testEnv.fileExists('.ctx/contexts/test.md');
      expect(exists).toBe(true);
    });

    it('save with relative path: should save relative to project root', async () => {
      await saveCommand({
        path: 'src/api.ctx.md',
        content: '# API Context',
      });

      const output = consoleOutput.getOutput();
      expect(output.log.join('')).toContain('Saved');

      // Verify file location
      const exists = await testEnv.fileExists('src/api.ctx.md');
      expect(exists).toBe(true);
    });

    it('save: path is deterministic (--project does not change path)', async () => {
      // --project should NOT change the path, just validate scope
      await saveCommand({
        path: 'docs/notes.md',
        content: '# Notes',
        project: true,
      });

      const output = consoleOutput.getOutput();
      expect(output.log.join('')).toContain('Saved');

      // File saved to exact path specified
      const exists = await testEnv.fileExists('docs/notes.md');
      expect(exists).toBe(true);

      // NOT saved to .ctx/contexts/
      const wrongPath = await testEnv.fileExists('.ctx/contexts/notes.md');
      expect(wrongPath).toBe(false);
    });
  });
});
