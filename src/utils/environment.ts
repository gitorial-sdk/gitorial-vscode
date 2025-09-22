/**
 * Environment utilities for the Gitorial extension.
 */

/**
 * Checks if the extension is running in development mode.
 *
 * In development mode, additional debugging features are enabled:
 * - Manifest files are written to disk for inspection
 * - More verbose logging may be enabled
 * - Debug-only features are accessible
 *
 * @returns True if running in development mode, false otherwise
 */
export const isDevelopmentMode = (): boolean => {
  return process.env.NODE_ENV === 'development' || process.env.VSCODE_DEBUG_MODE === 'true' || process.env.GITORIAL_DEBUG === 'true'
};
