import * as vscode from 'vscode';
import { IGitOperations } from '@domain/ports/IGitOperations';
import { StepsTreeDataProvider } from './StepsTreeProvider';
import { StepTypeSelector } from './StepTypeSelector';

/**
 * Handles VS Code commands related to the Steps tree view.
 * Encapsulates step checkout logic and tree view interactions.
 */
export class StepsCommandHandler {
  constructor(
    private readonly gitOperations: IGitOperations,
    private readonly stepsTreeDataProvider: StepsTreeDataProvider,
    private readonly stepTypeSelector: StepTypeSelector
  ) {}

  /**
   * Registers all step-related commands with the VS Code context.
   */
  public register(context: vscode.ExtensionContext): void {
    const checkoutCommand = vscode.commands.registerCommand(
      'gitorial.checkoutStep',
      (commitHash: string) => this.handleCheckoutStep(commitHash)
    );

    context.subscriptions.push(checkoutCommand);
    console.log('Steps commands registered.');
  }

  /**
   * Handles checking out a specific step/commit.
   */
  private async handleCheckoutStep(commitHash: string): Promise<void> {
    const shortHash = commitHash.substring(0, 7);

    // Check if this commit is already checked out
    try {
      const currentCommitHash = await this.gitOperations.getCurrentCommitHash();
      if (currentCommitHash === commitHash) {
        vscode.window.showInformationMessage(`Commit ${shortHash} is already checked out`);
        return;
      }
    } catch (error) {
      console.warn('Could not determine current commit hash:', error);
      // Continue with checkout attempt
    }

    const confirm = await vscode.window.showWarningMessage(
      `Do you want to check out commit ${shortHash}?`,
      { modal: true },
      'Check Out'
    );

    if (confirm === 'Check Out') {
      try {
        await this.gitOperations.checkout(commitHash);
        vscode.window.showInformationMessage(`Checked out commit ${shortHash}`);

        // Reload step type and message from the new commit
        await this.stepTypeSelector.reloadFromCurrentCommit();

        // Refresh the steps tree view to show the new current commit
        this.stepsTreeDataProvider.refresh();
      } catch (error) {
        console.error('Failed to checkout commit:', error);
        vscode.window.showErrorMessage(`Failed to check out commit: ${error}`);
      }
    }
  }
}
