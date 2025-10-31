// operations/NavigationOperations.ts
import * as vscode from 'vscode';
import * as path from 'path';

export class NavigationOperations {
  constructor(private readonly workspacePath: string) {}

  async openFile(filePath: string): Promise<void> {
    const uri = vscode.Uri.file(path.join(this.workspacePath, filePath));
    await vscode.commands.executeCommand('vscode.open', uri, { preview: false });
  }
}
