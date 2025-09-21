/**
 * Generic interface for persistent key-value storage operations.
 *
 * Provides an abstraction layer over storage mechanisms like VS Code's Memento,
 * allowing the application to persist data without tight coupling to specific implementations.
 *
 * ## Storage Types
 * - **Global State**: Extension-wide, survives workspace changes (user preferences)
 * - **Workspace State**: Per workspace/folder (project-specific settings, tutorial progress)
 * - **Alternative**: File-based, in-memory, or remote storage implementations
 *
 * @example
 * ```typescript
 * // Basic usage
 * await storage.update('user.theme', 'dark');
 * const theme = storage.get('user.theme', 'light');
 *
 * // Complex objects
 * const progress = { currentStep: 5, completed: false };
 * await storage.update('tutorial.progress', progress);
 *
 * // Conditional operations
 * if (storage.has('tutorial.progress')) {
 *   const data = storage.get('tutorial.progress');
 * }
 * ```
 *
 * @see {@link MementoAdapter} Primary VS Code implementation
 */
export interface IStateStorage {
  /**
   * Retrieves a value from storage by key.
   * @param key The storage key to retrieve
   * @param defaultValue Optional default value if key doesn't exist
   * @returns The stored value or default value
   */
  get<T>(key: string, defaultValue?: T): T | undefined;

  /**
   * Stores a value in persistent storage under the specified key.
   * @param key The storage key
   * @param value The value to store (must be JSON-serializable)
   * @returns Promise that resolves when value is persisted
   */
  update<T>(key: string, value: T): Promise<void>;

  /**
   * Removes a key-value pair from storage.
   * @param key The storage key to remove
   * @returns Promise that resolves when key is removed
   */
  clear(key: string): Promise<void>;

  /**
   * Checks whether a key exists in storage.
   * @param key The storage key to check
   * @returns True if key exists, false otherwise
   */
  has(key: string): boolean;
}
