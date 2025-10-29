import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { IGitOperations } from '@domain/ports/IGitOperations';
import { StepTypeSelector } from './step-type-selector';
import { UI } from '@gitorial/shared-types';
import { GitRepositoryWatcher } from '@ui/tutorial/tree-view/git/git-repository-watcher';

/**
 * WebviewView provider for the Changes view
 * Uses a Svelte-based UI for enhanced interactivity
 */
export class ChangesWebviewProvider implements vscode.WebviewViewProvider {
  private view?: vscode.WebviewView;
  private gitWatcher: GitRepositoryWatcher;

  constructor(
    private readonly gitOperations: IGitOperations,
    private readonly stepTypeSelector: StepTypeSelector,
    private readonly workspacePath: string,
    private readonly extensionUri: vscode.Uri
  ) {
    // Listen for step type changes
    this.stepTypeSelector.setOnChangeCallback(() => {
      this.refresh();
    });

    // Set up Git repository watcher
    this.gitWatcher = new GitRepositoryWatcher(this.workspacePath, () => this.refreshOnGitFileStatusChange());
    this.gitWatcher.start();
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    this.gitWatcher.dispose();
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

    webviewView.webview.options = {
      enableScripts      : true,
      localResourceRoots : [vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist')],
    };

    webviewView.webview.html = this.getHtmlContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (message: UI.Messages.SidebarToExtensionMessage) => {
      console.log('changes webview provider: onDidReceiveMessage');
      console.log(message);
      try {
        switch (message.type) {
          case 'ready':
            // Webview is ready, send initial data
            await this.refresh();
            break;
          case 'commit':
            await this.handleCommit(message.payload.stepType, message.payload.message);
            break;
          case 'stageFile':
            await this.stageFile(message.payload.filePath);
            break;
          case 'unstageFile':
            await this.unstageFile(message.payload.filePath);
            break;
          case 'stageAll':
            await this.stageAll();
            break;
          case 'unstageAll':
            await this.unstageAll();
            break;
          case 'openDiff':
            await this.openDiff(message.payload.filePath);
            break;
          case 'discardChanges':
            await this.discardChanges(message.payload.filePath);
            break;
          case 'discardAllUnstaged':
            await this.discardAllUnstaged();
            break;
          case 'showError':
            vscode.window.showErrorMessage(message.payload.message);
            break;
          case 'refresh':
            await this.refresh();
            break;
          case 'openFile':
            await this.openFile(message.payload.filePath);
            break;
        }
      } catch (error) {
        console.error('Error handling webview message:', error);
        vscode.window.showErrorMessage(`Error: ${error}`);
      }
    });
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
      const stepType = this.stepTypeSelector.getCurrentStepType();
      const stepMessage = this.stepTypeSelector.getCurrentStepMessage();

      // Determine the original status for each staged file
      // A staged file can be: modified (M), deleted (D), or new/untracked (U/A)
      const stagedFiles = status.staged.map(file => {
        if (status.deleted.includes(file)) {
          return { path: file, status: 'D' };
        } else if (status.modified.includes(file)) {
          return { path: file, status: 'M' };
        } else {
          // If it's staged but not in modified/deleted, it's a new file (Added)
          return { path: file, status: 'U' };
        }
      });

      // Unstaged changes (not staged)
      const unstagedFiles = [...status.modified
          .filter(f => !status.staged.includes(f))
          .map(f => ({ path: f, status: 'M' })),
        ...status.untracked
          .map(f => ({ path: f, status: 'U' })),
        ...status.deleted
          .filter(f => !status.staged.includes(f))
          .map(f => ({ path: f, status: 'D' })),
      ];

      // Send update to webview
      const data: UI.Messages.ExtensionToSidebarMessage = {
        type     : 'data-update',
        category : 'sidebar',
        payload  : {
          stagedFiles,
          unstagedFiles,
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
    if (!this.view) {
      return;
    }

    try {
      const status = await this.gitOperations.getWorkingDirectoryStatus();

      // Determine the original status for each staged file
      // A staged file can be: modified (M), deleted (D), or new/untracked (U/A)
      const stagedFiles = status.staged.map(file => {
        if (status.deleted.includes(file)) {
          return { path: file, status: 'D' };
        } else if (status.modified.includes(file)) {
          return { path: file, status: 'M' };
        } else {
          // If it's staged but not in modified/deleted, it's a new file (Added)
          return { path: file, status: 'U' };
        }
      });

      // Unstaged changes (not staged)
      const unstagedFiles = [...status.modified
          .filter(f => !status.staged.includes(f))
          .map(f => ({ path: f, status: 'M' })),
        ...status.untracked
          .map(f => ({ path: f, status: 'U' })),
        ...status.deleted
          .filter(f => !status.staged.includes(f))
          .map(f => ({ path: f, status: 'D' })),
      ];

      // Send update to webview
      const data: UI.Messages.ExtensionToSidebarMessage = {
        type     : 'file-data-update',
        category : 'sidebar',
        payload  : {
          stagedFiles,
          unstagedFiles,
        },
      };
      await this.view.webview.postMessage(data);
    } catch (error) {
      console.error('Failed to refresh webview:', error);
    }
  }

  /**
   * Handle commit from webview
   */
  private async handleCommit(stepType: string, message: string): Promise<void> {
    if (!message || message.trim().length === 0) {
      vscode.window.showErrorMessage('Commit message cannot be empty');
      return;
    }

    const status = await this.gitOperations.getWorkingDirectoryStatus();
    if (status.staged.length === 0) {
      vscode.window.showWarningMessage('No staged changes to commit');
      return;
    }

    const fullMessage = `${stepType}: ${message}`;
    await this.gitOperations.createCommit(fullMessage);

    // Update the step type selector's current message
    this.stepTypeSelector.setCurrentStepMessage(message);

    vscode.window.showInformationMessage(`Committed: ${fullMessage}`);
    await this.refresh();
  }

  /**
   * Stage a file
   */
  private async stageFile(filePath: string): Promise<void> {
    await this.gitOperations.stageFiles([filePath]);
    await this.refresh();
  }

  /**
   * Unstage a file
   */
  private async unstageFile(filePath: string): Promise<void> {
    await this.gitOperations.reset(['HEAD', '--', filePath]);
    await this.refresh();
  }

  /**
   * Stage all changes
   */
  private async stageAll(): Promise<void> {
    await this.gitOperations.stageAllChanges();
    await this.refresh();
  }

  /**
   * Unstage all changes
   */
  private async unstageAll(): Promise<void> {
    await this.gitOperations.reset(['HEAD']);
    await this.refresh();
  }

  /**
   * Open diff for a file
   */
  private async openDiff(filePath: string): Promise<void> {
    const currentCommitHash = await this.gitOperations.getCurrentCommitHash();
    await vscode.commands.executeCommand('gitorial.openFileDiff', filePath, currentCommitHash, this.workspacePath);
  }

  /**
   * Discard changes in a file
   */
  private async discardChanges(filePath: string): Promise<void> {
    const fileName = path.basename(filePath);
    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to discard changes in ${fileName}?`,
      { modal: true },
      'Discard Changes'
    );

    if (confirm === 'Discard Changes') {
      await this.gitOperations.discardChanges([filePath]);
      await this.refresh();
      vscode.window.showInformationMessage(`Discarded changes in ${fileName}`);
    }
  }

  /**
   * Discard all unstaged changes (does not affect staged files)
   */
  private async discardAllUnstaged(): Promise<void> {
    const status = await this.gitOperations.getWorkingDirectoryStatus();
    const unstagedCount =
      status.modified.filter(f => !status.staged.includes(f)).length +
      status.untracked.length +
      status.deleted.filter(f => !status.staged.includes(f)).length;

    if (unstagedCount === 0) {
      vscode.window.showInformationMessage('No unstaged changes to discard');
      return;
    }

    const confirm = await vscode.window.showWarningMessage(
      `Are you sure you want to discard ALL ${unstagedCount} unstaged change(s)? This action cannot be undone.`,
      { modal: true },
      'Discard All Unstaged'
    );

    if (confirm === 'Discard All Unstaged') {
      const stagedSet = new Set(status.staged);

      // Get only unstaged modified/deleted files
      const unstagedModified = status.modified.filter(f => !stagedSet.has(f));
      const unstagedDeleted = status.deleted.filter(f => !stagedSet.has(f));
      const unstagedFiles = [...unstagedModified, ...unstagedDeleted];

      // Discard changes in unstaged tracked files
      if (unstagedFiles.length > 0) {
        await this.gitOperations.discardChanges(unstagedFiles);
      }

      // Clean untracked files (git clean -fd)
      if (status.untracked.length > 0) {
        await this.gitOperations.resetWorkingDirectory();
      }

      await this.refresh();
      vscode.window.showInformationMessage('All unstaged changes have been discarded');
    }
  }

  /**
   * Open a file in the editor
   */
  private async openFile(filePath: string): Promise<void> {
    await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(path.join(this.workspacePath, filePath)), {
      preview : false,
    });
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
      // First, unstage all staged files
      await this.gitOperations.reset(['HEAD']);
      // Then, discard all unstaged changes
      await this.gitOperations.resetWorkingDirectory();
      await this.refresh();
      vscode.window.showInformationMessage('All changes have been discarded');
    }
  }

  /**
   * Generate HTML content for the webview using the built Svelte app
   */
  private getHtmlContent(webview: vscode.Webview): string {
    const svelteAppBuildPath = vscode.Uri.joinPath(this.extensionUri, 'webview-ui', 'dist');
    const svelteAppDiskPath = svelteAppBuildPath.fsPath;
    const indexHtmlPath = path.join(svelteAppDiskPath, 'sidebar.html');

    let htmlContent: string;
    try {
      htmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    } catch (e) {
      console.error(`Error reading sidebar.html from ${indexHtmlPath}: ${e}`);
      return `<!DOCTYPE html><html><body>Error loading webview content. Details: ${e}</body></html>`;
    }

    // Find asset paths using regex
    const cssRegex = /<link[^>]*?href="([^"\>]*?\.css)"/;
    const cssMatch = htmlContent.match(cssRegex);
    const relativeCssPath = cssMatch ? cssMatch[1] : null;

    const jsRegex = /<script[^>]*?src="([^"\>]*?\.js)"/;
    const jsMatch = htmlContent.match(jsRegex);
    const relativeJsPath = jsMatch ? jsMatch[1] : null;

    if (!relativeCssPath || !relativeJsPath) {
      console.error('Could not extract CSS or JS paths from sidebar.html');
      return '<!DOCTYPE html><html><body>Error parsing sidebar.html</body></html>';
    }

    // Create webview URIs
    const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(svelteAppBuildPath, relativeCssPath));
    const jsUri = webview.asWebviewUri(vscode.Uri.joinPath(svelteAppBuildPath, relativeJsPath));

    const nonce = this.getNonce();
    const csp = `default-src 'none'; style-src ${webview.cspSource} https://microsoft.github.io 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource} https://microsoft.github.io;`;

    // Remove original tags
    htmlContent = htmlContent.replace(/<script.*?src=".*?"[^>]*><\/script>/g, '');
    htmlContent = htmlContent.replace(/<link rel="stylesheet".*?href=".*?"[^>]*>/g, '');

    // Inject with webview URIs
    htmlContent = htmlContent.replace(
      '</head>',
      `  <meta http-equiv="Content-Security-Policy" content="${csp}">\n` +
        `  <link rel="stylesheet" type="text/css" href="${cssUri}">\n` +
        `  <link rel="stylesheet" href="https://microsoft.github.io/vscode-codicons/dist/codicon.css">\n` +
        '</head>'
    );
    htmlContent = htmlContent.replace(
      '</body>',
      `  <script defer type="module" nonce="${nonce}" src="${jsUri}"></script>\n` + '</body>'
    );

    return htmlContent;
  }

  /**
   * Generate a nonce for Content Security Policy
   */
  private getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
