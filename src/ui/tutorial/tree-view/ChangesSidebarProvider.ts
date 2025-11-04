import * as vscode from 'vscode';
import { IGitOperations } from '@domain/ports/IGitOperations';
import { StepTypeSelector } from './StepTypeSelector';
import { UI } from '@gitorial/shared-types';
import { GitRepositoryWatcher } from '@ui/tutorial/tree-view/git/GitRepositoryWatcher';
import { RebaseWatcher } from '@ui/tutorial/tree-view/git/RebaseWatcher';
import { SidebarMessageHandler } from './messaging/SidebarMessageHandler';
import { SidebarMessenger } from './messaging/SidebarMessenger';
import { FileOperations } from './operations/FileOperations';
import { CommitOperations } from './operations/CommitOperations';
import { DiffOperations } from './operations/DiffOperations';
import { NavigationOperations } from './operations/NavigationOperations';
import { GitStatusMapper } from './git/GitStatusMapper';
import { WebviewHtmlBuilder } from './html/WebviewHtmlBuilder';
import { BUILD_FOLDER, WEBVIEW_FOLDER } from './const';

/**
 * WebviewView provider for the Changes view
 * Uses a Svelte-based UI for enhanced interactivity
 */
export class ChangesSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private sidebarMessanger?: SidebarMessenger;
  private gitWatcher: GitRepositoryWatcher;
  private rebaseWatcher: RebaseWatcher;
  private sidebarMessageHandler: SidebarMessageHandler;
  private fileOps: FileOperations;

  constructor(
    private readonly gitOperations: IGitOperations,
    private readonly stepTypeSelector: StepTypeSelector,
    private readonly workspacePath: string,
    private readonly extensionUri: vscode.Uri
  ) {
    this.fileOps = new FileOperations(gitOperations);
    const commitOps = new CommitOperations(gitOperations);
    const diffOps = new DiffOperations(workspacePath, gitOperations);
    const navOps = new NavigationOperations(workspacePath);
    const onRefresh = () => this.refresh();

    this.sidebarMessageHandler = new SidebarMessageHandler(this.fileOps, commitOps, diffOps, navOps, gitOperations, onRefresh);
    // Bind to preserve `this` when invoked as a callback
    this.stepTypeSelector.setOnChangeCallback(this.refresh.bind(this));

    // Bind to preserve `this` inside the watcher callback
    this.gitWatcher = new GitRepositoryWatcher(this.workspacePath, this.refreshOnGitFileStatusChange.bind(this));
    this.gitWatcher.start();

    // Set up rebase watcher to detect conflicts and success
    this.rebaseWatcher = new RebaseWatcher(
      this.workspacePath,
      this.gitOperations,
      this.handleRebaseConflict.bind(this),
      this.handleRebaseSuccess.bind(this)
    );
    this.rebaseWatcher.start();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.gitWatcher.dispose();
    this.rebaseWatcher.dispose();
  }

  /**
   * Called when the view is first opened or when it becomes visible after being hidden
   */
  async resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): Promise<void> {
    this.view = webviewView;
    this.sidebarMessanger = new SidebarMessenger(this.view.webview);

    webviewView.webview.options = {
      enableScripts      : true,
      localResourceRoots : [vscode.Uri.joinPath(this.extensionUri, WEBVIEW_FOLDER, BUILD_FOLDER)],
    };
    const maybeHtmlContent = WebviewHtmlBuilder.getHtmlContent(webviewView.webview, this.extensionUri);

    if (maybeHtmlContent.isErr()) {
      console.error('Error getting html content from WebviewHtmlBuilder');
      webviewView.webview.html = maybeHtmlContent.error;
    } else {
      webviewView.webview.html = maybeHtmlContent.value;
    }
    // Ensure `this` inside handler points to SidebarMessageHandler instance
    webviewView.webview.onDidReceiveMessage(this.sidebarMessageHandler.handle.bind(this.sidebarMessageHandler));
  }

  /**
   * Refresh the webview with current Git status
   */
  async refresh(): Promise<void> {
    if (!this.view) {
      return;
    }

    try {
      const status = await this.gitOperations.getWorkingDirectoryStatus();
      const { stagedFiles, unstagedFiles, mergeFiles } = GitStatusMapper.mapToFileStatuses(status);
      const stepType = this.stepTypeSelector.getCurrentStepType();
      const stepMessage = this.stepTypeSelector.getCurrentStepMessage();

      const data: UI.Messages.ExtensionToSidebarMessage = {
        type     : 'data-update',
        category : 'sidebar',
        payload  : {
          stagedFiles,
          unstagedFiles,
          mergeFiles,
          stepType,
          stepMessage,
        },
      };
      await this.view.webview.postMessage(data);
    } catch (error) {
      console.error('Failed to refresh webview:', error);
    }
  }

  async refreshOnGitFileStatusChange(): Promise<void> {
    console.log('refreshing git file status');
    if (!this.sidebarMessanger) {
      return;
    }

    try {
      const status = await this.gitOperations.getWorkingDirectoryStatus();
      const { stagedFiles, unstagedFiles, mergeFiles } = GitStatusMapper.mapToFileStatuses(status);
      await this.sidebarMessanger.sendFileDataUpdate({ stagedFiles, unstagedFiles, mergeFiles });
    } catch (error) {
      console.error('Failed to refresh webview:', error);
    }
  }

  /**
   * Reset all changes (unstage all staged files and discard all unstaged changes)
   */
  public async resetAll(): Promise<void> {
    const confirm = await vscode.window.showWarningMessage(
      'Are you sure you want to discard ALL changes? This will unstage all staged files and discard all unstaged changes.',
      { modal: true },
      'Discard All Changes'
    );

    if (confirm === 'Discard All Changes') {
      const result = await this.fileOps.resetAll();
      if (result.isOk()) {
        await this.refresh();
        vscode.window.showInformationMessage('All changes have been discarded');
      } else {
        vscode.window.showInformationMessage(result.error);
      }
    }
  }

  /**
   * Handle rebase conflict detection
   */
  private async handleRebaseConflict(): Promise<void> {
    console.log('ChangesSidebarProvider: Rebase conflict detected');
    if (this.sidebarMessanger) {
      const mergeFiles = await this.gitOperations.getConflictFiles();
      const status = await this.gitOperations.getWorkingDirectoryStatus();
      const fileStatus = mergeFiles.map(f => {
        const fileStatus = GitStatusMapper.determineFileStatus(f, status);
        return { path: f, status: fileStatus };
      });
      await this.sidebarMessanger.sendConflict(fileStatus);
    }
  }

  /**
   * Handle rebase success detection
   */
  private async handleRebaseSuccess(): Promise<void> {
    console.log('ChangesSidebarProvider: Rebase completed successfully');
    if (this.sidebarMessanger) {
      await this.sidebarMessanger.sendSuccess();
    }
  }

}
