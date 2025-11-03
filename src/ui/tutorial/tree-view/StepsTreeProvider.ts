import * as vscode from 'vscode';
import { IGitOperationsFactory } from '@domain/ports/IGitOperationsFactory';
import { DefaultLogFields } from '@domain/ports/IGitOperations';

/**
 * Tree item representing a step in the Steps view
 */
export class StepTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly commitHash: string,
    public readonly iconPath?: vscode.ThemeIcon,
    public readonly command?: vscode.Command,
    public readonly description?: string,
    public readonly tooltip?: vscode.MarkdownString
  ) {
    super(label, collapsibleState);
    this.iconPath = iconPath;
    this.command = command;
    this.description = description;
    this.tooltip = tooltip;
  }
}

/**
 * Provides data for the Steps tree view
 * Shows all commits from the gitorial branch (full branch lifetime)
 * and highlights which commit is currently checked out
 */
export class StepsTreeDataProvider implements vscode.TreeDataProvider<StepTreeItem>, vscode.Disposable {
  private _onDidChangeTreeData: vscode.EventEmitter<StepTreeItem | undefined | null | void> = new vscode.EventEmitter<
    StepTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<StepTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  private commits: DefaultLogFields[] = [];
  private currentCommitHash?: string;
  private headWatcherInterval?: NodeJS.Timeout;

  constructor(
    private readonly gitOperationsFactory: IGitOperationsFactory,
    private readonly workspacePath: string
  ) {
    // Initial load
    this.loadCommits();

    // Start watching for HEAD changes (commit checkouts)
    this.startHeadWatcher();
  }

  /**
   * Load commits from the Git repository
   */
  private async loadCommits(): Promise<void> {
    try {
      const gitOps = this.gitOperationsFactory.fromPath(this.workspacePath);

      const isGitRepo = await gitOps.isGitRepository();
      if (!isGitRepo) {
        this.commits = [];
        this._onDidChangeTreeData.fire();
        return;
      }

      try {
        this.currentCommitHash = await gitOps.getCurrentCommitHash();
      } catch (error) {
        console.warn('Could not get current commit hash:', error);
        this.currentCommitHash = undefined;
      }

      // Get all commits from the gitorial branch (full branch lifetime)
      let commits: DefaultLogFields[] = [];
      try {
        commits = await gitOps.getCommits('gitorial');
      } catch (error) {
        console.warn('Could not get commits from gitorial branch, falling back to current branch:', error);
        // Fallback to current branch if gitorial branch doesn't exist or has issues
        commits = await gitOps.getCommits();
      }
      this.commits = commits;

      this._onDidChangeTreeData.fire();
    } catch (error) {
      console.error('Failed to load commits:', error);
      this.commits = [];
      this._onDidChangeTreeData.fire();
    }
  }

  /**
   * Refresh the tree view by reloading commits
   */
  async refresh(): Promise<void> {
    await this.loadCommits();
  }

  /**
   * Start watching for HEAD changes (commit checkouts)
   * Polls every 2 seconds to detect when the current commit changes
   */
  private startHeadWatcher(): void {
    // Check for HEAD changes every 2 seconds
    this.headWatcherInterval = setInterval(async () => {
      try {
        const gitOps = this.gitOperationsFactory.fromPath(this.workspacePath);
        const newCurrentCommitHash = await gitOps.getCurrentCommitHash();

        // If the current commit hash changed, refresh the view
        if (newCurrentCommitHash !== this.currentCommitHash) {
          console.log('StepsTreeProvider: HEAD changed, refreshing...');
          await this.refresh();
        }
      } catch (_error) {
        // Ignore errors during periodic checks - they'll be caught during explicit refresh
      }
    }, 2000);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.headWatcherInterval) {
      clearInterval(this.headWatcherInterval);
      this.headWatcherInterval = undefined;
    }
  }

  /**
   * Get the tree item representation for a given element
   */
  getTreeItem(element: StepTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children for a given element (or root if element is undefined)
   */
  async getChildren(element?: StepTreeItem): Promise<StepTreeItem[]> {
    if (!vscode.workspace.workspaceFolders) {
      return [];
    }

    if (element) {
      // Return children of the element (if any)
      return [];
    } else {
      // Return root level items
      return this.getRootItems();
    }
  }

  /**
   * Get root level items for the Steps tree view
   */
  private getRootItems(): StepTreeItem[] {
    const items: StepTreeItem[] = [];

    if (this.commits.length === 0) {
      // Show a message when no commits are available
      const emptyItem = new StepTreeItem(
        'No commits found',
        vscode.TreeItemCollapsibleState.None,
        '',
        new vscode.ThemeIcon('info'),
        undefined,
        'Initialize a Git repository to see commits'
      );
      items.push(emptyItem);
      return items;
    }

    // Display commits from newest to oldest
    this.commits.forEach(commit => {
      const isCurrent = commit.hash === this.currentCommitHash;
      const shortHash = commit.hash.substring(0, 7);

      // Truncate commit message if too long
      const message = commit.message.length > 50 ? commit.message.substring(0, 47) + '...' : commit.message;

      // Choose icon based on whether this is the current commit
      let icon: vscode.ThemeIcon;
      let description: string;

      if (isCurrent) {
        icon = new vscode.ThemeIcon('circle-filled', new vscode.ThemeColor('charts.blue'));
        description = `${shortHash} (current)`;
      } else {
        icon = new vscode.ThemeIcon('git-commit');
        description = shortHash;
      }

      // Format tooltip with more details
      const tooltip = new vscode.MarkdownString();
      const commitDate = new Date(commit.date);
      const formattedDate = commitDate.toLocaleString();

      tooltip.appendMarkdown(`**${commit.message}**\n\n`);
      tooltip.appendMarkdown(`Hash: \`${commit.hash}\`\n\n`);
      tooltip.appendMarkdown(`Author: ${commit.author_name} <${commit.author_email}>\n\n`);
      tooltip.appendMarkdown(`Date: ${formattedDate}`);
      if (commit.body) {
        tooltip.appendMarkdown(`\n\n---\n\n${commit.body}`);
      }

      const item = new StepTreeItem(
        message,
        vscode.TreeItemCollapsibleState.None,
        commit.hash,
        icon,
        {
          command   : 'gitorial.checkoutStep',
          title     : 'Check Out Step',
          arguments : [commit.hash],
        },
        description,
        tooltip
      );

      // Add context value for menu items
      item.contextValue = isCurrent ? 'currentCommit' : 'commit';

      items.push(item);
    });

    return items;
  }
}
