import fs from 'fs/promises';
import path from 'path';
import os from 'os';

/**
 * Test environment for 3-Level Context System
 * Provides isolated file system for each test
 */
export class TestEnvironment {
  public tempDir: string = '';
  private originalCwd: string = '';
  private originalHome: string = '';
  private cwdChanged: boolean = false;

  /**
   * Set up isolated test environment
   */
  async setup(): Promise<void> {
    this.originalCwd = process.cwd();
    this.originalHome = process.env.HOME || '';

    const tmpRoot = os.tmpdir();
    this.tempDir = await fs.mkdtemp(path.join(tmpRoot, 'ctx-test-'));

    process.chdir(this.tempDir);
    this.cwdChanged = true;
  }

  /**
   * Clean up test environment
   */
  async cleanup(): Promise<void> {
    if (this.cwdChanged && this.originalCwd) {
      process.chdir(this.originalCwd);
      this.cwdChanged = false;
    }

    if (this.originalHome) {
      process.env.HOME = this.originalHome;
    }

    if (this.tempDir) {
      try {
        await fs.rm(this.tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Initialize project context (.ctx/)
   */
  async initProject(): Promise<void> {
    await fs.mkdir(path.join(this.tempDir, '.ctx', 'contexts'), { recursive: true });

    await fs.writeFile(
      path.join(this.tempDir, '.ctx', 'registry.yaml'),
      `meta:
  version: '2.0.0'
  last_synced: '${new Date().toISOString()}'
contexts: {}
`,
      'utf-8'
    );
  }

  /**
   * Initialize global context (~/.ctx/)
   * Sets HOME to mock directory
   */
  async initGlobal(): Promise<void> {
    const mockHome = path.join(this.tempDir, 'home');
    await fs.mkdir(path.join(mockHome, '.ctx', 'contexts'), { recursive: true });

    await fs.writeFile(
      path.join(mockHome, '.ctx', 'registry.yaml'),
      `meta:
  version: '2.0.0'
  last_synced: '${new Date().toISOString()}'
contexts: {}
index: {}
`,
      'utf-8'
    );

    process.env.HOME = mockHome;
  }

  /**
   * Create a file in test environment
   */
  async createFile(relativePath: string, content: string = ''): Promise<void> {
    const fullPath = path.join(this.tempDir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  /**
   * Read a file from test environment
   */
  async readFile(relativePath: string): Promise<string> {
    return fs.readFile(path.join(this.tempDir, relativePath), 'utf-8');
  }

  /**
   * Check if file exists
   */
  async fileExists(relativePath: string): Promise<boolean> {
    try {
      await fs.access(path.join(this.tempDir, relativePath));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if directory exists
   */
  async dirExists(relativePath: string): Promise<boolean> {
    try {
      const stat = await fs.stat(path.join(this.tempDir, relativePath));
      return stat.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * List files in directory
   */
  async listFiles(relativePath: string = '.'): Promise<string[]> {
    try {
      return await fs.readdir(path.join(this.tempDir, relativePath));
    } catch {
      return [];
    }
  }

  /**
   * Get absolute path
   */
  getPath(relativePath: string): string {
    return path.join(this.tempDir, relativePath);
  }
}

/**
 * Suppress console output during tests
 */
export function suppressConsole(): {
  restore: () => void;
  getOutput: () => { log: string[]; error: string[]; warn: string[] };
} {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const logs: string[] = [];
  const errors: string[] = [];
  const warns: string[] = [];

  console.log = (...args: any[]) => logs.push(args.map(String).join(' '));
  console.error = (...args: any[]) => errors.push(args.map(String).join(' '));
  console.warn = (...args: any[]) => warns.push(args.map(String).join(' '));

  return {
    restore: () => {
      console.log = originalLog;
      console.error = originalError;
      console.warn = originalWarn;
    },
    getOutput: () => ({ log: logs, error: errors, warn: warns }),
  };
}
