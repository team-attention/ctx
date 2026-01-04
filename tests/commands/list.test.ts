import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';
import YAML from 'yaml';

const { listCommand } = await import('../../src/commands/list.js');
const { syncCommand } = await import('../../src/commands/sync.js');

describe('list command', () => {
  let testEnv: TestEnvironment;
  let consoleOutput: ReturnType<typeof suppressConsole>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    await testEnv.initGlobal(); // Must init global first (sets HOME)
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

  describe('basic functionality', () => {
    it('should return empty array for new project', async () => {
      await listCommand({});

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));
      expect(parsed).toEqual([]);
    });

    it('should list project contexts after sync', async () => {
      // Create a context file
      await testEnv.createFile('.ctx/contexts/api.md', `---
what: API patterns
keywords:
  - api
  - rest
---

# API Patterns
`);

      // Sync to register the context
      await syncCommand({});
      // Reset console output
      consoleOutput.restore();
      consoleOutput = suppressConsole();

      // List contexts
      await listCommand({});

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));
      expect(parsed.length).toBeGreaterThan(0);
      expect(parsed[0]).toHaveProperty('path');
      expect(parsed[0]).toHaveProperty('what');
      expect(parsed[0]).toHaveProperty('keywords');
      expect(parsed[0]).toHaveProperty('registry', 'project');
      expect(parsed[0]).toHaveProperty('type');
    });

    it('should filter by --project flag', async () => {
      await testEnv.createFile('.ctx/contexts/test.md', `---
what: Test context
keywords:
  - test
---
`);
      await syncCommand({});
      consoleOutput.restore();
      consoleOutput = suppressConsole();

      await listCommand({ project: true });

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));
      parsed.forEach((entry: any) => {
        expect(entry.registry).toBe('project');
      });
    });
  });

  describe('type field', () => {
    it('should mark contexts with target as bound', async () => {
      await testEnv.createFile('src/api.ctx.md', `---
target: src/api.ts
what: API implementation
keywords:
  - api
---
`);
      await syncCommand({});
      consoleOutput.restore();
      consoleOutput = suppressConsole();

      await listCommand({});

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));
      const apiContext = parsed.find((e: any) => e.path.includes('api.ctx.md'));
      expect(apiContext?.type).toBe('bound');
      expect(apiContext?.target).toBeTruthy();
    });

    it('should mark contexts without target as standalone', async () => {
      await testEnv.createFile('.ctx/contexts/patterns.md', `---
what: Design patterns
keywords:
  - patterns
---
`);
      await syncCommand({});
      consoleOutput.restore();
      consoleOutput = suppressConsole();

      await listCommand({});

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));
      const patternsContext = parsed.find((e: any) => e.path.includes('patterns.md'));
      expect(patternsContext?.type).toBe('standalone');
      expect(patternsContext?.target).toBeNull();
    });
  });

  describe('output formats', () => {
    beforeEach(async () => {
      await testEnv.createFile('.ctx/contexts/test.md', `---
what: Test context
keywords:
  - test
---
`);
      await syncCommand({});
      consoleOutput.restore();
      consoleOutput = suppressConsole();
    });

    it('should output JSON by default', async () => {
      await listCommand({});

      const output = consoleOutput.getOutput();
      expect(() => JSON.parse(output.log.join(''))).not.toThrow();
    });

    it('should output paths with --paths flag', async () => {
      await listCommand({ paths: true });

      const output = consoleOutput.getOutput();
      // Should be path strings, not JSON
      const lines = output.log.filter(l => l.trim());
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach(line => {
        expect(line).toMatch(/\.md$/);
      });
    });

    it('should output human-readable with --pretty flag', async () => {
      await listCommand({ pretty: true });

      const output = consoleOutput.getOutput();
      const fullOutput = output.log.join('\n');
      expect(fullOutput).toContain('Contexts');
    });
  });

  describe('--target filtering', () => {
    it('should filter by target path', async () => {
      // Create bound context
      await testEnv.createFile('src/api.ctx.md', `---
target: src/api.ts
what: API implementation
keywords:
  - api
---
`);
      // Create standalone context
      await testEnv.createFile('.ctx/contexts/general.md', `---
what: General patterns
keywords:
  - patterns
---
`);
      await syncCommand({});
      consoleOutput.restore();
      consoleOutput = suppressConsole();

      await listCommand({ target: 'src/api.ts' });

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));
      // Should only include bound contexts matching the target
      expect(parsed.every((e: any) => e.type === 'bound')).toBe(true);
    });

    it('should return empty array when no contexts match target', async () => {
      await testEnv.createFile('.ctx/contexts/general.md', `---
what: General patterns
keywords:
  - patterns
---
`);
      await syncCommand({});
      consoleOutput.restore();
      consoleOutput = suppressConsole();

      await listCommand({ target: 'src/nonexistent.ts' });

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));
      expect(parsed).toEqual([]);
    });
  });

  describe('sorting', () => {
    it('should sort project contexts before global', async () => {
      await testEnv.createFile('.ctx/contexts/a.md', `---
what: A context
keywords:
  - a
---
`);
      await testEnv.createFile('.ctx/contexts/b.md', `---
what: B context
keywords:
  - b
---
`);
      await syncCommand({});
      consoleOutput.restore();
      consoleOutput = suppressConsole();

      await listCommand({});

      const output = consoleOutput.getOutput();
      const parsed = JSON.parse(output.log.join(''));
      // All should be project contexts
      expect(parsed.every((e: any) => e.registry === 'project')).toBe(true);
      // Should be sorted alphabetically by path
      const paths = parsed.map((e: any) => e.path);
      const sortedPaths = [...paths].sort();
      expect(paths).toEqual(sortedPaths);
    });
  });
});
