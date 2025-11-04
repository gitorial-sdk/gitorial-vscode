import * as vscode from 'vscode';
import { IGitOperations } from '@domain/ports/IGitOperations';

/**
 * Watches for Git rebase state changes and detects conflicts/success
 */
export class RebaseWatcher implements vscode.Disposable {
  private fileWatcher?: vscode.FileSystemWatcher;
  private intervalId?: NodeJS.Timeout;
  private lastRebaseState: 'none' | 'in-progress' | 'conflict' | 'success' = 'none';

  constructor(
    private readonly workspacePath: string,
    private readonly gitOperations: Pick<IGitOperations, 'isRebaseInProgress' | 'hasRebaseConflicts'>,
    private readonly onConflict: () => void,
    private readonly onSuccess: () => void
  ) {}

  /**
   * Start watching for rebase state changes
   */
  public start(): void {
    console.log('RebaseWatcher: Starting rebase state monitoring');

    // Set up file watcher for .git directory changes
    this.setupFileWatcher();

    // Set up polling as backup (every 2 seconds)
    this.intervalId = setInterval(() => {
      this.checkRebaseState();
    }, 2000);

    // Initial check
    this.checkRebaseState();
  }

  /**
   * Set up file watcher for rebase-related .git directories only
   */
  private setupFileWatcher(): void {
    try {
      // Watch only rebase-related directories using glob pattern
      // This matches both .git/rebase-apply/** and .git/rebase-merge/**
      const rebasePattern = new vscode.RelativePattern(this.workspacePath, '.git/rebase-*/**');
      this.fileWatcher = vscode.workspace.createFileSystemWatcher(rebasePattern, false, false, false);

      this.fileWatcher.onDidCreate(() => this.checkRebaseState());
      this.fileWatcher.onDidDelete(() => this.checkRebaseState());

      console.log('RebaseWatcher: File watcher set up for rebase directories only');
    } catch (error) {
      console.warn('RebaseWatcher: Could not set up file watcher for rebase directories:', error);
    }
  }

  /**
   * Check current rebase state and notify if changed
   */
  private async checkRebaseState(): Promise<void> {
    try {
      const isRebaseInProgress = await this.gitOperations.isRebaseInProgress();
      const hasConflicts = await this.gitOperations.hasRebaseConflicts();

      let currentState: typeof this.lastRebaseState;

      if (hasConflicts) {
        currentState = 'conflict';
      } else if (isRebaseInProgress) {
        currentState = 'in-progress';
      } else if (this.lastRebaseState === 'in-progress' || this.lastRebaseState === 'conflict') {
        // We were in rebase state but now we're not - this indicates success
        currentState = 'success';
      } else {
        currentState = 'none';
      }

      // Notify if state changed
      if (currentState !== this.lastRebaseState) {
        console.log(`RebaseWatcher: State changed from ${this.lastRebaseState} to ${currentState}`);

        if (currentState === 'conflict') {
          this.onConflict();
        } else if (currentState === 'success') {
          this.onSuccess();
        }

        this.lastRebaseState = currentState;
      }
    } catch (error) {
      console.error('RebaseWatcher: Error checking rebase state:', error);
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    if (this.fileWatcher) {
      this.fileWatcher.dispose();
      this.fileWatcher = undefined;
    }
  }
}
