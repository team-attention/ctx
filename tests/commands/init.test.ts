import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TestEnvironment, suppressConsole } from '../helpers/testUtils.js';
import YAML from 'yaml';

// Create mock function with proper typing
const mockPrompt = jest.fn<any>();

// Mock inquirer before importing initCommand
jest.unstable_mockModule('inquirer', () => ({
  default: {
    prompt: mockPrompt,
  },
}));

// Mock platform module to avoid actual AI command installation
jest.unstable_mockModule('../../src/lib/platforms/index.js', () => ({
  isPlatformSupported: jest.fn().mockReturnValue(false),
  getPlatform: jest.fn(),
}));

// Import after mocking
await import('inquirer');
const { initCommand } = await import('../../src/commands/init.js');

describe('init command', () => {
  let testEnv: TestEnvironment;
  let consoleOutput: ReturnType<typeof suppressConsole>;
  let exitSpy: jest.SpiedFunction<typeof process.exit>;

  beforeEach(async () => {
    testEnv = new TestEnvironment();
    await testEnv.setup();
    consoleOutput = suppressConsole();

    // Mock process.exit to prevent test worker from dying
    exitSpy = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined): never => {
      throw new Error(`process.exit(${code})`);
    }) as any;

    // Reset mocks
    mockPrompt.mockClear();
    mockPrompt.mockResolvedValue({
      overwrite: false,
      editor: 'claude-code',
    });
  });

  afterEach(async () => {
    exitSpy.mockRestore();
    consoleOutput.restore();
    await testEnv.cleanup();
  });

  describe('fresh initialization', () => {
    it('should create all required files and directories', async () => {
      // Mock inquirer to auto-select editor
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });

      await initCommand();

      // Check files exist
      expect(await testEnv.fileExists('ctx.config.yaml')).toBe(true);
      expect(await testEnv.dirExists('ctx')).toBe(true);
      expect(await testEnv.dirExists('ctx/templates')).toBe(true);
      expect(await testEnv.fileExists('ctx/local-context-registry.yml')).toBe(true);
      expect(await testEnv.fileExists('ctx/global-context-registry.yml')).toBe(true);
      expect(await testEnv.fileExists('ctx/README.md')).toBe(true);
    });

    it('should create valid ctx.config.yaml with correct structure', async () => {
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });

      await initCommand();

      const configContent = await testEnv.readFile('ctx.config.yaml');
      const config = YAML.parse(configContent);

      expect(config).toHaveProperty('editor');
      expect(config).toHaveProperty('version');
      expect(config.editor).toBe('claude-code');
      expect(config.version).toBe('0.1.0');
    });

    it('should create valid local registry file', async () => {
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });

      await initCommand();

      const registryContent = await testEnv.readFile('ctx/local-context-registry.yml');
      const registry = YAML.parse(registryContent);

      expect(registry).toHaveProperty('version');
      expect(registry).toHaveProperty('last_synced');
      expect(registry).toHaveProperty('contexts');
      expect(registry.version).toBe('1.0.0');
      expect(registry.contexts).toEqual({});
    });

    it('should create valid global registry file', async () => {
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });

      await initCommand();

      const registryContent = await testEnv.readFile('ctx/global-context-registry.yml');
      const registry = YAML.parse(registryContent);

      expect(registry).toHaveProperty('version');
      expect(registry).toHaveProperty('last_synced');
      expect(registry).toHaveProperty('contexts');
      expect(registry.version).toBe('1.0.0');
      expect(registry.contexts).toEqual({});
    });

    it('should create README.md in ctx directory', async () => {
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });

      await initCommand();

      const readmeContent = await testEnv.readFile('ctx/README.md');
      expect(readmeContent).toContain('# Context Directory');
      expect(readmeContent).toContain('local-context-registry.yml');
      expect(readmeContent).toContain('global-context-registry.yml');
    });

    it('should copy template files to ctx/templates directory', async () => {
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });

      await initCommand();

      // Check that template files exist
      expect(await testEnv.fileExists('ctx/templates/local-context.md')).toBe(true);
      expect(await testEnv.fileExists('ctx/templates/global-context.md')).toBe(true);
    });

    it('should copy template files with valid content', async () => {
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });

      await initCommand();

      // Check local-context template content
      const localTemplate = await testEnv.readFile('ctx/templates/local-context.md');
      expect(localTemplate).toContain('target:');
      expect(localTemplate).toContain('what:');
      expect(localTemplate).toContain('when:');
      expect(localTemplate).toContain('not_when:');

      // Check global-context template content
      const globalTemplate = await testEnv.readFile('ctx/templates/global-context.md');
      expect(globalTemplate).toContain('when:');
      expect(globalTemplate).toContain('what:');
      expect(globalTemplate).toContain('{{DOCUMENT_TITLE}}');
      expect(globalTemplate.length).toBeGreaterThan(0);
    });
  });

  describe('already initialized project', () => {
    beforeEach(async () => {
      // Pre-initialize the project
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });
      await initCommand();

      // Clear mock calls from initialization
      mockPrompt.mockClear();
    });

    it('should detect existing initialization and prompt for overwrite', async () => {
      // Mock prompt to cancel overwrite
      mockPrompt.mockResolvedValueOnce({ overwrite: false });

      await initCommand();

      // Should have prompted for overwrite
      expect(mockPrompt).toHaveBeenCalledTimes(1);
      expect(mockPrompt.mock.calls[0][0]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'overwrite',
            type: 'confirm',
          }),
        ])
      );
    });

    it('should not overwrite if user declines', async () => {
      // Read original config
      const originalConfig = await testEnv.readFile('ctx.config.yaml');

      // Mock prompt to cancel overwrite
      mockPrompt.mockResolvedValueOnce({ overwrite: false });

      await initCommand();

      // Config should remain unchanged
      const currentConfig = await testEnv.readFile('ctx.config.yaml');
      expect(currentConfig).toBe(originalConfig);
    });

    it('should reinitialize if user confirms overwrite', async () => {
      // Mock prompts: first for overwrite confirmation, then for editor selection
      mockPrompt
        .mockResolvedValueOnce({ overwrite: true })
        .mockResolvedValueOnce({ editor: 'claude-code' });

      await initCommand();

      // Should have prompted twice: overwrite + editor
      expect(mockPrompt).toHaveBeenCalledTimes(2);

      // Files should still exist
      expect(await testEnv.fileExists('ctx.config.yaml')).toBe(true);
      expect(await testEnv.fileExists('ctx/local-context-registry.yml')).toBe(true);
    });
  });

  describe('idempotency', () => {
    it('should produce same result when run multiple times with reinit', async () => {
      // First init
      mockPrompt.mockResolvedValueOnce({ editor: 'claude-code' });
      await initCommand();
      const firstConfig = await testEnv.readFile('ctx.config.yaml');

      // Second init (with overwrite)
      mockPrompt
        .mockResolvedValueOnce({ overwrite: true })
        .mockResolvedValueOnce({ editor: 'claude-code' });
      await initCommand();
      const secondConfig = await testEnv.readFile('ctx.config.yaml');

      // Configs should be structurally equivalent
      const first = YAML.parse(firstConfig);
      const second = YAML.parse(secondConfig);

      expect(first.editor).toBe(second.editor);
      expect(first.version).toBe(second.version);
    });
  });
});
