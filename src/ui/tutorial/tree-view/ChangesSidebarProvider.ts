import * as vscode from 'vscode';
import { IGitOperations } from '@domain/ports/IGitOperations';
import { StepTypeSelector } from './StepTypeSelector';
import { UI } from '@gitorial/shared-types';
import { GitStateManager } from './git/git-state-manager';
import { SidebarMessageHandler } from './messaging/SidebarMessageHandler';
import { SidebarMessenger } from './messaging/SidebarMessenger';
import { FileOperations } from './operations/FileOperations';
import { CommitOperations } from './operations/CommitOperations';
import { DiffOperations } from './operations/DiffOperations';
import { NavigationOperations } from './operations/NavigationOperations';
import { GitStatusMapper } from './git/GitStatusMapper';
import { WebviewHtmlBuilder } from './html/WebviewHtmlBuilder';
import { BUILD_FOLDER, WEBVIEW_FOLDER } from './const';
import { Hooks } from './git/git-state-manager/types';

/**
 * WebviewView provider for the Changes view
 * Uses a Svelte-based UI for enhanced interactivity
 */
export class ChangesSidebarProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private sidebarMessanger?: SidebarMessenger;
  private sidebarMessageHandler: SidebarMessageHandler;
  private fileOps: FileOperations;
  private gitStateManager: GitStateManager;

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

    const hooks: Hooks = {
      onSourceFileChange : data => this.refreshOnGitFileStatusChange(data),
      onRebaseStart      : () => {
        console.log('ChangesSidebarProvider: Rebase started');
      },
      onRebaseConflict : async conflictedFiles => {
        console.log('ChangesSidebarProvider: Rebase conflict detected', conflictedFiles);
        await this.sidebarMessanger?.sendConflict(conflictedFiles);
      },
      onRebaseSuccess : () => {
        console.log('ChangesSidebarProvider: Rebase completed successfully');
        this.sidebarMessanger?.sendSuccess();
        vscode.window.showInformationMessage(`Applied changes successfully`);
      },
      onRebaseAbort : () => {
        console.log('ChangesSidebarProvider: Rebase was aborted');
        vscode.window.showWarningMessage('Rebase operation was cancelled');
      },
    };

    this.gitStateManager = new GitStateManager(hooks, workspacePath, gitOperations);

    this.sidebarMessageHandler = new SidebarMessageHandler(this.fileOps, commitOps, diffOps, navOps, gitOperations, onRefresh);

    this.stepTypeSelector.setOnChangeCallback(this.refresh.bind(this));
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.gitStateManager.dispose();
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

  async refreshOnGitFileStatusChange(data: {
    stagedFiles   : UI.Messages.SourceCodeFile[];
    unstagedFiles : UI.Messages.SourceCodeFile[];
    mergeFiles    : UI.Messages.SourceCodeFile[];
  }): Promise<void> {
    console.log('refreshing git file status', data);
    if (!this.sidebarMessanger) {
      return;
    }

    try {
      await this.sidebarMessanger.sendFileDataUpdate(data);
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

}
