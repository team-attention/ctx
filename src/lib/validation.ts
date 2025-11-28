import { fileExists } from './fileUtils.js';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that a target path is provided and not empty
 */
export function validateTarget(target: string | undefined): ValidationResult {
  if (!target || target.trim() === '') {
    return {
      valid: false,
      error: 'Target path is required. Usage: ctx create <target>',
    };
  }

  return { valid: true };
}

/**
 * Check if a context file already exists at the given path
 */
export async function checkContextFileExists(contextPath: string): Promise<boolean> {
  return fileExists(contextPath);
}
