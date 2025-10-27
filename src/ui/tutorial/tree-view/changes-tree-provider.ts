import { IGitOperations } from '@domain/ports/IGitOperations';
import * as vscode from 'vscode';
import { StepTypeSelector } from './step-type-selector';

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
    private readonly workspacePath: string,
    private readonly stepTypeSelector?: StepTypeSelector
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
      // Return root level: step type selector + groups
      return this.getRootItems();
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
   * Get root level items: step type selector + step message input + groups
   */
  private async getRootItems(): Promise<ChangeTreeItem[]> {
    const items: ChangeTreeItem[] = [];

    // Add step type selector if available
    if (this.stepTypeSelector) {
      const stepTypeLabel = this.stepTypeSelector.getCurrentStepTypeLabel();
      const stepTypeItem = new ChangeTreeItem(
        `Current Type: ${stepTypeLabel}`,
        vscode.TreeItemCollapsibleState.None,
        '',
        '',
        new vscode.ThemeIcon('tag'), // Tag icon to indicate type/category
        {
          command: 'gitorial.changeStepType',
          title: 'Change Step Type',
          arguments: []
        },
        'stepTypeSelector'
      );
      // Add a more obvious call-to-action
      stepTypeItem.description = '(click to change)';
      // Rich tooltip with instructions
      const tooltip = new vscode.MarkdownString();
      tooltip.appendMarkdown('**Change Step Type**\n\n');
      tooltip.appendMarkdown('Click to select a different step type for your next commit.\n\n');
      tooltip.appendMarkdown('Available types:\n');
      tooltip.appendMarkdown('- 📖 Section\n');
      tooltip.appendMarkdown('- 📝 Template\n');
      tooltip.appendMarkdown('- ✅ Solution\n');
      tooltip.appendMarkdown('- ⚡ Action\n');
      tooltip.appendMarkdown('- 📄 Readme');
      tooltip.isTrusted = true;
      stepTypeItem.tooltip = tooltip;
      items.push(stepTypeItem);

      // Add step message input field
      const stepMessage = this.stepTypeSelector.getCurrentStepMessage();
      const stepMessageItem = new ChangeTreeItem(
        `Message: ${stepMessage}`,
        vscode.TreeItemCollapsibleState.None,
        '',
        '',
        new vscode.ThemeIcon('edit'), // Edit icon to indicate it's editable
        {
          command: 'gitorial.editStepMessage',
          title: 'Edit Step Message',
          arguments: []
        },
        'stepMessageInput'
      );
      stepMessageItem.description = '(click to edit)';
      const messageTooltip = new vscode.MarkdownString();
      messageTooltip.appendMarkdown('**Edit Step Message**\n\n');
      messageTooltip.appendMarkdown('Click to edit the commit message for your next step.\n\n');
      messageTooltip.appendMarkdown(`Current message: ${stepMessage}`);
      messageTooltip.isTrusted = true;
      stepMessageItem.tooltip = messageTooltip;
      items.push(stepMessageItem);
    }

    // Add the groups
    const groups = await this.getRootGroups();
    items.push(...groups);

    return items;
  }

  /**
   * Get root level groups: "Changes" and "Staged Changes"
   */
  private async getRootGroups(): Promise<ChangeTreeItem[]> {
    try {
      const status = await this.gitOperations.getWorkingDirectoryStatus();

      // Count only files that aren't staged (to avoid counting duplicates)
      const stagedFiles = new Set(status.staged);
      const unstagedOnlyCount =
        status.modified.filter(f => !stagedFiles.has(f)).length +
        status.deleted.filter(f => !stagedFiles.has(f)).length +
        status.untracked.length; // Untracked files are never staged

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
      const changesLabel = unstagedOnlyCount > 0 ? `Changes (${unstagedOnlyCount})` : 'Changes';
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
   * Excludes files that are already staged to avoid duplicates
   */
  private async getUnstagedChanges(): Promise<ChangeTreeItem[]> {
    try {
      const currentCommitHash = await this.gitOperations.getCurrentCommitHash();
      const status = await this.gitOperations.getWorkingDirectoryStatus();

      const items: ChangeTreeItem[] = [];

      // Create a set of staged files for quick lookup
      const stagedFiles = new Set(status.staged);

      // Process unstaged files only, excluding those that are already staged
      const unstagedFiles = [
        ...status.modified
          .filter((f: string) => !stagedFiles.has(f))
          .map((f: string) => ({ filePath: f, statusLabel: 'M' as const })),
        ...status.deleted
          .filter((f: string) => !stagedFiles.has(f))
          .map((f: string) => ({ filePath: f, statusLabel: 'D' as const })),
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
