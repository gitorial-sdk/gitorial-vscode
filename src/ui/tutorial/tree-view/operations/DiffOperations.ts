// operations/DiffOperations.ts
import { IGitOperations } from '@domain/ports/IGitOperations';
import * as vscode from 'vscode';

export class DiffOperations {
  constructor(
    private readonly workspacePath: string,
    private readonly gitOps: IGitOperations
  ) {}

  async openDiff(filePath: string): Promise<void> {
    const currentCommitHash = await this.gitOps.getCurrentCommitHash();
    await vscode.commands.executeCommand('gitorial.openFileDiff', filePath, currentCommitHash, this.workspacePath);
  }
}
