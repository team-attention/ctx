/**
 * Default patterns for context discovery
 * Used by 3-level context system
 */
export const DEFAULT_PATTERNS = {
  local: ['**/*.ctx.md', '**/ctx.md'],
  ignore: ['node_modules/**', 'dist/**', 'build/**', '.git/**', '.ctx/**'],
};
