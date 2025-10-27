import { IGitOperations } from '@domain/ports/IGitOperations';
import * as vscode from 'vscode';

/**
 * Tree item representing a change in the Changes view
 */
export class ChangeTreeItem extends vscode.TreeItem {
  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly filePath: string,
    public readonly commitHash: string,
    public readonly iconPath?: vscode.ThemeIcon,
    public readonly command?: vscode.Command,
    public readonly contextValue?: string
  ) {
    super(label, collapsibleState);
    this.iconPath = iconPath;
    this.command = command;
    this.contextValue = contextValue;
  }
}

/**
 * Provides data for the Changes tree view
 */
export class ChangesTreeDataProvider implements vscode.TreeDataProvider<ChangeTreeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<ChangeTreeItem | undefined | null | void> = new vscode.EventEmitter<
    ChangeTreeItem | undefined | null | void
  >();
  readonly onDidChangeTreeData: vscode.Event<ChangeTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  constructor(
    private readonly gitOperations: IGitOperations,
    private readonly workspacePath: string
  ) {}

  /**
   * Refresh the tree view
   */
  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  /**
   * Get the tree item representation for a given element
   */
  getTreeItem(element: ChangeTreeItem): vscode.TreeItem {
    return element;
  }

  /**
   * Get the children for a given element (or root if element is undefined)
   */
  async getChildren(element?: ChangeTreeItem): Promise<ChangeTreeItem[]> {
    if (!vscode.workspace.workspaceFolders) {
      return [];
    }

    if (!element) {
      // Return root level groups: "Changes" and "Staged Changes"
      return this.getRootGroups();
    } else if (element.contextValue === 'changesGroup') {
      // Return unstaged changes
      return this.getUnstagedChanges();
    } else if (element.contextValue === 'stagedGroup') {
      // Return staged changes
      return this.getStagedChanges();
    }

    return [];
  }

  /**
   * Get root level groups: "Changes" and "Staged Changes"
   */
  private async getRootGroups(): Promise<ChangeTreeItem[]> {
    try {
      const status = await this.gitOperations.getWorkingDirectoryStatus();

      const unstagedCount = status.modified.length + status.deleted.length + status.untracked.length;
      const stagedCount = status.staged.length;

      const groups: ChangeTreeItem[] = [];

      // "Staged Changes" group (first)
      const stagedLabel = stagedCount > 0 ? `Staged Changes (${stagedCount})` : 'Staged Changes';
      groups.push(
        new ChangeTreeItem(
          stagedLabel,
          vscode.TreeItemCollapsibleState.Expanded,
          '',
          '',
          undefined,
          undefined,
          'stagedGroup'
        )
      );

      // "Changes" group (second)
      const changesLabel = unstagedCount > 0 ? `Changes (${unstagedCount})` : 'Changes';
      groups.push(
        new ChangeTreeItem(
          changesLabel,
          vscode.TreeItemCollapsibleState.Expanded,
          '',
          '',
          undefined,
          undefined,
          'changesGroup'
        )
      );

      return groups;
    } catch (error) {
      console.error('Failed to load root groups:', error);
      return [];
    }
  }

  /**
   * Get unstaged changes (modified, deleted, untracked)
   */
  private async getUnstagedChanges(): Promise<ChangeTreeItem[]> {
    try {
      const currentCommitHash = await this.gitOperations.getCurrentCommitHash();
      const status = await this.gitOperations.getWorkingDirectoryStatus();

      const items: ChangeTreeItem[] = [];

      // Process unstaged files only
      const unstagedFiles = [
        ...status.modified.map((f: string) => ({ filePath: f, statusLabel: 'M' as const })),
        ...status.deleted.map((f: string) => ({ filePath: f, statusLabel: 'D' as const })),
        ...status.untracked.map((f: string) => ({ filePath: f, statusLabel: 'U' as const }))
      ];

      if (unstagedFiles.length === 0) {
        return [
          new ChangeTreeItem(
            'No changes',
            vscode.TreeItemCollapsibleState.None,
            '',
            '',
            new vscode.ThemeIcon('info'),
            undefined
          )
        ];
      }

      for (const { filePath, statusLabel } of unstagedFiles) {
        items.push(this.createFileItem(filePath, statusLabel, currentCommitHash, false));
      }

      return items;
    } catch (error) {
      console.error('Failed to load unstaged changes:', error);
      return [];
    }
  }

  /**
   * Get staged changes
   */
  private async getStagedChanges(): Promise<ChangeTreeItem[]> {
    try {
      const currentCommitHash = await this.gitOperations.getCurrentCommitHash();
      const status = await this.gitOperations.getWorkingDirectoryStatus();

      const items: ChangeTreeItem[] = [];

      if (status.staged.length === 0) {
        return [
          new ChangeTreeItem(
            'No staged changes',
            vscode.TreeItemCollapsibleState.None,
            '',
            '',
            new vscode.ThemeIcon('info'),
            undefined
          )
        ];
      }

      for (const filePath of status.staged) {
        // Determine if it's a deletion or modification
        const isDeleted = status.deleted.includes(filePath);
        const statusLabel = isDeleted ? 'D' : 'M';
        items.push(this.createFileItem(filePath, statusLabel, currentCommitHash, true));
      }

      return items;
    } catch (error) {
      console.error('Failed to load staged changes:', error);
      return [];
    }
  }

  /**
   * Create a file tree item
   */
  private createFileItem(
    filePath: string,
    statusLabel: 'M' | 'U' | 'D',
    currentCommitHash: string,
    isStaged: boolean
  ): ChangeTreeItem {
    const fileTextIdentifiers = ['md', 'txt'];
    const fileExtension = filePath.split('.')
      .pop() || '';
    const baseIconId = fileTextIdentifiers.includes(fileExtension) ? 'file-text' : 'file-code';

    // Choose icon color based on file status
    let iconColor: vscode.ThemeColor;

    switch (statusLabel) {
      case 'U':
        iconColor = new vscode.ThemeColor('gitDecoration.untrackedResourceForeground');
        break;
      case 'D':
        iconColor = new vscode.ThemeColor('gitDecoration.deletedResourceForeground');
        break;
      case 'M':
      default:
        iconColor = isStaged
          ? new vscode.ThemeColor('gitDecoration.addedResourceForeground')
          : new vscode.ThemeColor('gitDecoration.modifiedResourceForeground');
        break;
    }

    // Create a command to open the diff view
    const command: vscode.Command = {
      command   : 'gitorial.openFileDiff',
      title     : 'Open Diff',
      arguments : [filePath, currentCommitHash, this.workspacePath],
    };

    // For deleted files, show file path with " (Deleted)" suffix
    const displayLabel = statusLabel === 'D' ? `${filePath} (Deleted)` : filePath;

    const item = new ChangeTreeItem(
      displayLabel,
      vscode.TreeItemCollapsibleState.None,
      filePath,
      currentCommitHash,
      new vscode.ThemeIcon(baseIconId, iconColor),
      command
    );

    // Add description showing status
    item.description = statusLabel;

    return item;
  }
}
