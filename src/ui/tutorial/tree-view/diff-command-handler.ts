import * as vscode from 'vscode';
import * as path from 'path';
import { IGitOperations } from '@domain/ports/IGitOperations';

/**
 * Custom text document content provider for Git file contents
 */
class GitFileContentProvider implements vscode.TextDocumentContentProvider {
  constructor(private readonly gitOperations: IGitOperations) {}

  async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
    try {
      // Parse the URI: gitorial:/path/to/file?commit=abc123
      const filePath = uri.path;
      const commitHash = uri.query;

      if (!commitHash) {
        return '';
      }

      // Get file content from git
      const content = await this.gitOperations.getFileContent(commitHash, filePath);
      return content;
    } catch (error) {
      console.error('Failed to load file content:', error);
      return `Error loading file: ${error}`;
    }
  }
}

/**
 * Handles opening file diffs from the tree view
 */
export class DiffCommandHandler {
  private contentProvider: GitFileContentProvider;
  private disposable: vscode.Disposable;

  constructor(private readonly gitOperations: IGitOperations) {
    this.contentProvider = new GitFileContentProvider(gitOperations);
    // Register the content provider for our custom scheme
    this.disposable = vscode.workspace.registerTextDocumentContentProvider('gitorial', this.contentProvider);
  }

  dispose(): void {
    this.disposable.dispose();
  }

  /**
   * Opens a diff view comparing the working directory file vs the committed version
   * @param filePath - Relative path to the file from workspace root
   * @param currentCommitHash - Hash of the current commit (HEAD)
   * @param workspacePath - Absolute path to the workspace
   */
  async openFileDiff(filePath: string, currentCommitHash: string, workspacePath: string): Promise<void> {
    try {
      const fileName = path.basename(filePath);
      const shortHash = currentCommitHash.substring(0, 7);
      const absolutePath = path.join(workspacePath, filePath);

      // Check if file exists (to detect deleted files)
      let fileExists = true;
      try {
        await vscode.workspace.fs.stat(vscode.Uri.file(absolutePath));
      } catch {
        fileExists = false;
      }

      if (!fileExists) {
        // File is deleted - show the old content with a special "empty" right side
        await this.openDeletedFileDiff(filePath, fileName, currentCommitHash, shortHash);
      } else {
        // Normal case - compare committed version vs working directory
        const leftUri = this.createGitorialUri(filePath, currentCommitHash);
        const rightUri = vscode.Uri.file(absolutePath);
        const title = `${fileName} (${shortHash} ↔ Working Directory)`;

        await vscode.commands.executeCommand('vscode.diff', leftUri, rightUri, title);
      }
    } catch (error) {
      console.error('Failed to open diff:', error);
      vscode.window.showErrorMessage(`Failed to open diff: ${error}`);
    }
  }

  /**
   * Opens a view for a deleted file showing the old content (not a diff)
   */
  private async openDeletedFileDiff(
    filePath: string,
    _fileName: string,
    currentCommitHash: string,
    _shortHash: string
  ): Promise<void> {
    // Create URI for the deleted file content from the commit
    // Add "(Deleted)" to the fragment so it appears in the tab title
    const uri = this.createGitorialUri(filePath, currentCommitHash, '(Deleted)');

    // Open the document (not a diff, just the file content)
    const doc = await vscode.workspace.openTextDocument(uri);

    // Show the document in the editor
    await vscode.window.showTextDocument(doc, {
      preview: true,
      preserveFocus: false
    });
  }

  /**
   * Creates a Gitorial URI for a file at a specific commit
   * Uses our custom gitorial:// scheme with content provider
   */
  private createGitorialUri(filePath: string, commitHash: string, suffix?: string): vscode.Uri {
    // Use our custom scheme: gitorial:/path/to/file?commit=hash
    // The query parameter contains the commit hash
    const fileName = path.basename(filePath);
    const displayName = suffix ? `${fileName} ${suffix}` : fileName;

    return vscode.Uri.parse(`gitorial:${filePath}`)
      .with({
        query    : commitHash,
        // Add fragment with filename (and optional suffix) for editor tab title
        fragment : displayName,
      });
  }

  /**
   * Register the command and content provider with VS Code
   */
  static register(context: vscode.ExtensionContext, gitOperations: IGitOperations): void {
    const handler = new DiffCommandHandler(gitOperations);

    const commandDisposable = vscode.commands.registerCommand(
      'gitorial.openFileDiff',
      (filePath: string, commitHash: string, workspacePath: string) => handler.openFileDiff(filePath, commitHash, workspacePath)
    );

    // Register both the command and the handler for disposal
    context.subscriptions.push(commandDisposable, handler);
  }
}
