import * as vscode from 'vscode';
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
 * Watches for Git repository changes using VS Code's Git extension API
 * Falls back to file system watcher if Git extension is not available
 */
export class GitRepositoryWatcher implements vscode.Disposable {
  private gitWatcherDisposable?: vscode.Disposable;
  private fileWatcher?: vscode.FileSystemWatcher;

  constructor(
    private readonly workspacePath: string,
    private readonly onChange: () => void
  ) {}

  /**
   * Start watching for changes
   */
  public start(): void {
    try {

      const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');

      if (!gitExtension) {
        console.warn('Git extension not found, falling back to file watcher');
        this.setupFileWatcher();
        return;
      }

      // Get the Git API
      const git = gitExtension.exports.getAPI(1);

      // Find the repository for our workspace
      const repository = git.repositories.find(repo => repo.rootUri.fsPath === this.workspacePath);

      if (!repository) {
        console.warn('Repository not found in Git extension, falling back to file watcher');
        this.setupFileWatcher();
        return;
      }

      console.log('Using Git extension API for change detection');

      // Listen to repository state changes
      // This fires when files are modified, staged, unstaged, etc.
      this.gitWatcherDisposable = repository.state.onDidChange(() => {
        console.log('Git repository state changed');
        this.onChange();
      });
    } catch (error) {
      console.error('Error starting Git repository watcher:', error);
      this.setupFileWatcher();
      return;
    }
  }

  /**
   * Fallback: Set up file system watcher to auto-refresh on file changes
   * Only used if Git extension API is not available
   */
  private setupFileWatcher(): void {
    console.log('Setting up file system watcher as fallback');

    const pattern = new vscode.RelativePattern(this.workspacePath, '**/*');
    this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern, false, false, false);

    // Debounce refresh to avoid too many updates
    let refreshTimeout: NodeJS.Timeout | undefined;
    const debouncedRefresh = (uri: vscode.Uri) => {
      // Ignore changes in excluded directories
      const relativePath = path.relative(this.workspacePath, uri.fsPath);
      const excludedPatterns = [
        /^\.git\//, // .git directory
        /^node_modules\//, // node_modules
        /^dist\//, // dist/build output
        /^out\//, // out directory
        /^build\//, // build directory
        /^\..+/, // hidden files/dirs
        /\.vsix$/, // VS Code extension packages
        /\.log$/, // Log files
      ];

      if (excludedPatterns.some(pattern => pattern.test(relativePath))) {
        return;
      }

      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      refreshTimeout = setTimeout(() => {
        this.onChange();
      }, 500);
    };

    this.fileWatcher.onDidChange(debouncedRefresh);
    this.fileWatcher.onDidCreate(debouncedRefresh);
    this.fileWatcher.onDidDelete(debouncedRefresh);
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.fileWatcher?.dispose();
    this.gitWatcherDisposable?.dispose();
  }
}
