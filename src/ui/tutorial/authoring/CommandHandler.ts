import * as vscode from 'vscode';
import { SystemController } from '@ui/system/SystemController';
import { AuthorModeController } from './controller';
import { IUserInteraction } from '@domain/ports/IUserInteraction';

export class AuthoringCommandHandler {
  constructor(
    private systemController: SystemController,
    private authorModeController: AuthorModeController,
    private readonly userInteraction: IUserInteraction,
    private readonly workspacePath: string
  ) {}

  /**
   * Enters author mode for the current workspace
   */
  public async handleEnterAuthorMode(): Promise<void> {
    await this.authorModeController.handleEnterAuthorMode();
  }

  /**
   * Exits author mode and returns to normal tutorial mode
   */
  public async handleExitAuthorMode(): Promise<void> {
    await this.authorModeController.handleExitAuthorMode();
  }

  /**
   * Clears corrupted data that might be causing issues
   */
  public async handleClearCorruptedData(): Promise<void> {
    try {
      console.log('🧹 CLEAR CORRUPTED DATA: Starting cleanup...');

      await this.authorModeController.clearCachedData();

      console.log('✅ CLEAR CORRUPTED DATA: Cleanup complete!');
      await this.userInteraction.showInformationMessage(
        'Corrupted data cleared successfully. Try entering Author Mode again.'
      );
    } catch (error) {
      console.error('🚨 CLEAR CORRUPTED DATA: Error during cleanup:', error);
      await this.userInteraction.showErrorMessage(
        `Failed to clear corrupted data: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Creates a new tutorial manifest from scratch
   */
  public async handleCreateNewTutorial(): Promise<void> {
    try {
      this.userInteraction.showInformationMessage('Create New Tutorial - Feature coming soon!');
    } catch (error) {
      console.error('Error creating new tutorial:', error);
      await this.userInteraction.showErrorMessage(
        `Failed to create tutorial: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Publishes the current tutorial manifest to the gitorial branch
   */
  public async handlePublishTutorial(): Promise<void> {
    try {
      await this.userInteraction.showInformationMessage('Publish Tutorial - Feature coming soon!');
    } catch (error) {
      console.error('Error publishing tutorial:', error);
      await this.userInteraction.showErrorMessage(
        `Failed to publish tutorial: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Registers all author mode commands with VS Code
   */
  public register(context: vscode.ExtensionContext): void {
    console.log('🔥 REGISTERING AUTHOR MODE COMMANDS...');

    context.subscriptions.push(
      vscode.commands.registerCommand('gitorial.enterAuthorMode', () => this.handleEnterAuthorMode())
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('gitorial.exitAuthorMode', () => this.handleExitAuthorMode())
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('gitorial.createNewTutorial', () => this.handleCreateNewTutorial())
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('gitorial.publishTutorial', () => this.handlePublishTutorial())
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('gitorial.clearCorruptedData', () => this.handleClearCorruptedData())
    );

    console.log('Author Mode commands registered.');
  }
}
