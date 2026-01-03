import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';
import YAML from 'yaml';

// Mock inquirer
const mockPrompt = jest.fn<any>();
jest.unstable_mockModule('inquirer', () => ({
  default: { prompt: mockPrompt },
}));

await import('inquirer');
const { initCommand } = await import('../../src/commands/init.js');

describe('init command (3-level system)', () => {
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

    mockPrompt.mockClear();
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    consoleOutput.restore();
    await testEnv.cleanup();
  });

  describe('project initialization (ctx init .)', () => {
    it('should create .ctx directory structure', async () => {
      await initCommand('.', { yes: true });

      expect(await testEnv.dirExists('.ctx')).toBe(true);
      expect(await testEnv.dirExists('.ctx/contexts')).toBe(true);
      expect(await testEnv.fileExists('.ctx/registry.yaml')).toBe(true);
    });

    it('should create valid registry.yaml', async () => {
      await initCommand('.', { yes: true });

      const content = await testEnv.readFile('.ctx/registry.yaml');
      const registry = YAML.parse(content);

      expect(registry).toHaveProperty('meta');
      expect(registry.meta).toHaveProperty('version');
      expect(registry).toHaveProperty('contexts');
    });

    it('should detect already initialized project', async () => {
      await initCommand('.', { yes: true });

      mockPrompt.mockResolvedValueOnce({ overwrite: false });
      await initCommand('.');

      expect(mockPrompt).toHaveBeenCalled();
    });

    it('should not overwrite if user declines', async () => {
      await initCommand('.', { yes: true });
      const original = await testEnv.readFile('.ctx/registry.yaml');

      mockPrompt.mockResolvedValueOnce({ overwrite: false });
      await initCommand('.');

      const current = await testEnv.readFile('.ctx/registry.yaml');
      expect(current).toBe(original);
    });
  });

  describe('global initialization (ctx init)', () => {
    beforeEach(async () => {
      // Set mock HOME but don't create .ctx yet
      const fs = await import('fs/promises');
      const mockHome = testEnv.getPath('home');
      await fs.mkdir(mockHome, { recursive: true });
      process.env.HOME = mockHome;
    });

    it('should create ~/.ctx directory structure', async () => {
      await initCommand(undefined, { yes: true });

      expect(await testEnv.fileExists('home/.ctx/registry.yaml')).toBe(true);
      expect(await testEnv.dirExists('home/.ctx/contexts')).toBe(true);
    });

    it('should create valid global registry.yaml', async () => {
      await initCommand(undefined, { yes: true });

      const content = await testEnv.readFile('home/.ctx/registry.yaml');
      const registry = YAML.parse(content);

      expect(registry).toHaveProperty('meta');
      expect(registry).toHaveProperty('contexts');
      expect(registry).toHaveProperty('index');
    });
  });

  describe('idempotency', () => {
    it('should produce consistent project structure', async () => {
      await initCommand('.', { yes: true });
      const first = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));

      mockPrompt.mockResolvedValueOnce({ overwrite: true });
      await initCommand('.', { yes: true });
      const second = YAML.parse(await testEnv.readFile('.ctx/registry.yaml'));

      expect(first.meta.version).toBe(second.meta.version);
    });
  });
});
