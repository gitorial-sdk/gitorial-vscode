import { err, ok, Result } from 'neverthrow';
import { GitStateData } from '../types';
import { DebouncedWatcher } from './DebouncedWatcher';
import * as vscode from 'vscode';
import { GitStateManager } from '..';
import { GitStatusMapper } from '../../GitStatusMapper';
import { IGitOperations } from '@domain/ports/IGitOperations';
import * as path from 'path';

/**
 * VS Code Git Extension API types
 */
interface GitExtension {
  getAPI(version: 1): GitAPI;
}

interface GitAPI {
  repositories         : GitRepository[];
  onDidOpenRepository  : vscode.Event<GitRepository>;
  onDidCloseRepository : vscode.Event<GitRepository>;
}

interface GitRepository {
  rootUri : vscode.Uri;
  state   : GitRepositoryState;
}

interface GitRepositoryState {
  onDidChange : vscode.Event<void>;
}

/**
 * Watches source files in the workspace and updates Git state when changes occur.
 *
 * Monitors user's source code files and
 * tracks their Git status (staged, unstaged, merge conflicts). Uses VS Code's Git API when
 * available, falls back to file system watching if needed.
 *
 * Changes are debounced to avoid excessive state updates during rapid file modifications.
 *
 * @example
 * ```typescript
 * const watcher = new SourceFileWatcher(workspacePath, gitOps, stateManager);
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
export class SourceFileWatcher extends DebouncedWatcher {
  private workspacePath: string;
  private gitOps: IGitOperations;

  private gitApiWatcher?: vscode.Disposable;
  private userFilesWatcher?: vscode.FileSystemWatcher;

  constructor(workspacePath: string, gitOps: IGitOperations, stateManager: GitStateManager) {
    super(stateManager);
    this.workspacePath = workspacePath;
    this.gitOps = gitOps;
  }

  /**
   * Computes and returns the current file tracking state by examining the working directory.
   *
   * @returns A partial GitStateData object with the updated files listing (staged, unstaged, and merge groups)
   */
  protected async computeStateDelta(): Promise<Partial<GitStateData>> {
    const status = await this.gitOps.getWorkingDirectoryStatus();
    const { stagedFiles, unstagedFiles, mergeFiles } = GitStatusMapper.mapToFileStatuses(status);

    return {
      files : {
        staged   : stagedFiles.map(file => file.path),
        unstaged : unstagedFiles.map(file => file.path),
        merge    : mergeFiles.map(file => file.path),
      },
    };
  }

  /**
   * Creates file watchers. Prefers VS Code Git API watcher, falls back to
   * file system watcher if Git API is unavailable.
   */
  protected setupWatchers(): void {
    const result = this.trySetupGitApiWatcher();
    if (result.isErr()) {
      console.error('SourceFileWatcher: Error starting API watcher:', result.error);
      console.info('SourceFileWatcher: Falling back to user files watcher');
      this.setupUserFilesWatcher();
    }
  }

  private trySetupGitApiWatcher(): Result<void, Error> {
    try {
      const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');

      if (!gitExtension) {
        return err(new Error('Git extension not found'));
      }

      // Get the Git API
      const git = gitExtension.exports.getAPI(1);

      // Find the repository for our workspace
      const repository = git.repositories.find(repo => repo.rootUri.fsPath === this.workspacePath);

      if (!repository) {
        return err(new Error('Repository not found in Git API'));
      }

      console.log('SourceFileWatcher: Using Git API for user file change detection');

      // Listen to repository state changes (better than file watching for Git operations)
      this.gitApiWatcher = repository.state.onDidChange(async () => {
        console.log('SourceFileWatcher: Git API detected repository state change');
        super.debouncedCheck();
      });

      return ok();
    } catch (error) {
      return err(new Error(`Failed to set up Git API watcher: ${error instanceof Error ? error.message : String(error)}`));
    }
  }

  private setupUserFilesWatcher(): void {
    console.log('SourceFileWatcher: Setting up user files watcher');

    const pattern = new vscode.RelativePattern(this.workspacePath, '**/*');
    this.userFilesWatcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);

    const debouncedRefresh = async (uri: vscode.Uri) => {
      // Ignore changes in excluded directories
      const relativePath = path.relative(this.workspacePath, uri.fsPath);
      const excludedPatterns = [
        /^\.git\//, // .git directory (handled by rebase watcher)
        /^node_modules\//, // node_modules
        /^dist\//, // dist/build output
        /^out\//, // out directory
        /^build\//, // build directory
        /^\..+/, // hidden files/dirs except .git (already excluded)
        /\.vsix$/, // VS Code extension packages
        /\.log$/, // Log files
      ];

      if (excludedPatterns.some(pattern => pattern.test(relativePath))) {
        return;
      }
      super.debouncedCheck();
    };

    this.userFilesWatcher.onDidChange(debouncedRefresh);
    this.userFilesWatcher.onDidCreate(debouncedRefresh);
    this.userFilesWatcher.onDidDelete(debouncedRefresh);
  }

  /**
   * Disposes Git API watcher and file system watcher, clearing references.
   * Allows watchers to be recreated on next start().
   */
  protected cleanupWatchers(): void {
    this.gitApiWatcher?.dispose();
    this.gitApiWatcher = undefined;

    this.userFilesWatcher?.dispose();
    this.userFilesWatcher = undefined;
  }

}
