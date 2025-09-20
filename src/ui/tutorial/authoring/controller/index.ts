import { UI } from '@gitorial/shared-types';
import { SystemController } from '@ui/system/SystemController';
import { IGitOperationsFactory } from 'src/domain/ports/IGitOperationsFactory';
import { IActiveTutorialStateRepository } from 'src/domain/repositories/IActiveTutorialStateRepository';
import { Result } from 'neverthrow';

import * as Publishing from './publishing';
import * as Validation from './validation';
import * as Manifest from './manifest';
import * as StepEditing from './step-editing';
import { IFileSystem } from '@domain/ports/IFileSystem';

export interface IClearable {
  clearCachedData(): Promise<void>;
}

export interface IWebviewAuthorMessageHandler {
  handleWebviewMessage(message: UI.Messages.WebviewToExtensionAuthorMessage): Promise<void>;
}

export class AuthorModeController implements IWebviewAuthorMessageHandler {
  private manifestController: Manifest.Controller;
  private stepEditingController: StepEditing.Controller;
  private publishingController: Publishing.Controller;
  private validationController: Validation.Controller;

  constructor(
    private systemController: SystemController,
    gitFactory: IGitOperationsFactory,
    activeTutorialStateRepository: IActiveTutorialStateRepository,
    private readonly workspacePath: string,
    fs: IFileSystem
  ) {
    this.manifestController = new Manifest.Controller(systemController, gitFactory, fs, workspacePath);
    this.stepEditingController = new StepEditing.Controller(
      systemController,
      this.manifestController,
      gitFactory,
      workspacePath
    );
    this.publishingController = new Publishing.Controller(
      this.manifestController,
      gitFactory,
      workspacePath,
      activeTutorialStateRepository,
      systemController
    );
    this.validationController = new Validation.Controller();
  }

  public async handleWebviewMessage(message: UI.Messages.WebviewToExtensionAuthorMessage): Promise<void> {
    console.log('AuthorModeController: Received webview message', message);

    try {
      switch (message.type) {
        case 'loadManifest':
        case 'saveManifest':
          let result = await this.manifestController.handleMessage(message);
          this.handleResult(result);
          break;
        case 'addStep':
        case 'removeStep':
        case 'updateStep':
        case 'reorderStep':
        case 'startEditingStep':
        case 'saveStepChanges':
        case 'cancelStepEditing':
          result = await this.stepEditingController.handleMessage(message);
          this.handleResult(result);
          break;

        case 'publishTutorial':
        case 'previewTutorial':
          result = await this.publishingController.handleMessage(message);
          this.handleResult(result);
          break;
        case 'validateCommit':
          await this.validationController.handleMessage(message);
          break;
        case 'exitAuthorMode':
          await this.handleExitAuthorMode();
          break;
        default:
          console.warn('AuthorModeController: Unknown message type:', (message as any).type);
      }
    } catch (error) {
      console.error('AuthorModeController: Error handling message:', error);
      this.systemController.reportError(error instanceof Error ? error : new Error(String(error)), 'Author Mode', true);
    }
  }

  public async clearCachedData(): Promise<void> {
    console.log('🧹 AuthorModeController: Clearing cached data...');

    await Promise.all([
      this.manifestController.clearCachedData(),
      this.stepEditingController.clearCachedData(),
      this.publishingController.clearCachedData(),
      this.validationController.clearCachedData(),
    ]);

    console.log('✅ AuthorModeController: Cached data cleared');
  }

  private async handleExitAuthorMode(): Promise<void> {
    console.log('AuthorModeController: Exiting author mode and cleaning up state');
    await this.clearCachedData();
    await this.systemController.setAuthorMode(false);
    console.log('AuthorModeController: Author mode exit completed, tutorial state cleaned');
  }

  public async loadInitialManifest(): Promise<void> {
    await this.manifestController.load();
  }

  private handleResult(result: Result<any, any>): void {
    if (result.isErr()) {
      console.error('AuthorModeController: Error:', result.error);
    }
  }
}
