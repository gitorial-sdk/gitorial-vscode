import { IGitOperations } from '@domain/ports/IGitOperations';
import { GitStateManager } from '..';
import { GitStateData } from '../types';
import { DebouncedWatcher } from './DebouncedWatcher';
import * as vscode from 'vscode';

/**
 * Watches .git/ directory for rebase operations and updates Git state accordingly.
 *
 * Monitors .git/rebase-* directories to detect when rebases start, conflicts occur,
 * or operations complete. Updates state with isRebasing and hasConflict flags.
 *
 * Changes are debounced to handle rapid file system changes during rebase operations.
 *
 * @example
 * ```typescript
 * const watcher = new StateWatcher(workspacePath, gitOps, stateManager);
 *
 * // Start watching when entering authoring mode
 * watcher.start();
 *
 * // Stop watching when exiting authoring mode
 * watcher.stop();
 *
 * // Final cleanup when disposing extension
 * watcher.dispose();
 * ```
 */
export class StateWatcher extends DebouncedWatcher {
  private dotGitWatcher?: vscode.FileSystemWatcher;
  private workspacePath: string;
  private gitOps: IGitOperations;

  constructor(workspacePath: string, gitOps: IGitOperations, stateManager: GitStateManager) {
    super(stateManager);
    this.workspacePath = workspacePath;
    this.gitOps = gitOps;
  }

  /**
   * Computes rebase and conflict state by checking .git/ directory.
   *
   * @returns Partial state with isRebasing, hasConflict, and gitorialHeadHash flags
   */
  protected async computeStateDelta(): Promise<Partial<GitStateData>> {
    const isRebaseInProgress = await this.gitOps.isRebaseInProgress();
    const hasConflicts = await this.gitOps.hasRebaseConflicts();
    try {
      const gitorialHeadCommitHash = await this.gitOps.getBranchCommitHash('gitorial');

      return {
        hasConflict      : hasConflicts,
        isRebasing       : isRebaseInProgress,
        gitorialHeadHash : gitorialHeadCommitHash,
      };
    } catch (error) {
      console.error('StateWatcher: Error getting gitorial head commit hash:', error);
    }

    return {
      hasConflict : hasConflicts,
      isRebasing  : isRebaseInProgress,
    };
  }
  /**
   * Creates file system watcher for .git/rebase-* directories.
   */
  protected setupWatchers(): void {
    this.setupDotGitWatcher();
  }

  /**
   * Disposes .git/ file system watcher, clearing references.
   */
  protected cleanupWatchers(): void {
    this.dotGitWatcher?.dispose();
    this.dotGitWatcher = undefined;
  }

  /**
   * Since .git/rebase-*\/** is the only directory that we care about, we can just watch that one.
   */
  private setupDotGitWatcher(): void {
    console.log('StateWatcher: Setting up .git/ folder watcher');

    const rebasePattern = new vscode.RelativePattern(this.workspacePath, '.git/rebase-*/**');
    this.dotGitWatcher = vscode.workspace.createFileSystemWatcher(rebasePattern, false, false, false);

    this.dotGitWatcher.onDidCreate(() => this.debouncedCheck());
    this.dotGitWatcher.onDidDelete(() => this.debouncedCheck());
    this.dotGitWatcher.onDidChange(() => this.debouncedCheck());
  }
}
