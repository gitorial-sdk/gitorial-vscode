import { UI } from '@gitorial/shared-types';
import { SystemController } from '@ui/system/SystemController';
import { IGitOperationsFactory } from 'src/domain/ports/IGitOperationsFactory';
import { IActiveTutorialStateRepository } from 'src/domain/repositories/IActiveTutorialStateRepository';
import { Result } from 'neverthrow';

import * as Publishing from './publishing';
import * as Validation from './validation';
import * as Storage from './storage';
import * as StepEditing from './step-editing';
import { TutorialController } from '@ui/tutorial/controller';

import { TutorialAuthoringService } from '@domain/services/authoring/TutorialAuthoringService';

export interface IClearable {
  clearCachedData(): Promise<void>;
}

export interface IWebviewAuthorMessageHandler {
  handleWebviewMessage(message: UI.Messages.WebviewToExtensionAuthorMessage): Promise<void>;
}

export class AuthorModeController implements IWebviewAuthorMessageHandler {
  private storageController: Storage.Controller;
  private stepEditingController: StepEditing.Controller;
  private publishingController: Publishing.Controller;
  private validationController: Validation.Controller;

  constructor(
    private systemController: SystemController,
    gitOperationsFactory: IGitOperationsFactory,
    activeTutorialStateRepository: IActiveTutorialStateRepository,
    workspacePath: string,
    private readonly tutorialController: TutorialController,
    private authoringService: TutorialAuthoringService
  ) {
    this.storageController = new Storage.Controller(systemController, workspacePath, authoringService);

    this.stepEditingController = new StepEditing.Controller(
      systemController,
      this.storageController,
      gitOperationsFactory,
      workspacePath,
      authoringService
    );

    this.publishingController = new Publishing.Controller(
      this.storageController,
      gitOperationsFactory,
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
          let result = await this.storageController.handleMessage(message);
          //this._handleResult(result);
          break;
        case 'addStep':
        case 'removeStep':
        case 'updateStep':
        case 'reorderStep':
        case 'startEditingStep':
        case 'saveStepChanges':
        case 'cancelStepEditing':
          //result = await this.stepEditingController.handleMessage(message);
          //this._handleResult(result);
          break;

        case 'publishTutorial':
        case 'previewTutorial':
          //result = await this.publishingController.handleMessage(message);
          //this._handleResult(result);
          break;
        case 'validateCommit':
          //await this.validationController.handleMessage(message);
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
      this.storageController.clearCachedData(),
      this.stepEditingController.clearCachedData(),
      this.publishingController.clearCachedData(),
      this.validationController.clearCachedData(),
    ]);

    console.log('✅ AuthorModeController: Cached data cleared');
  }

  public async handleExitAuthorMode(): Promise<void> {
    try {
      await this.systemController.setAuthorMode(false);
      await this.clearCachedData();
    } catch (error) {
      console.error('Error exiting author mode:', error);
      await this.systemController.userInteraction.showErrorMessage(
        `Failed to exit Author Mode: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  public async handleEnterAuthorMode(): Promise<void> {
    try {
      await this.systemController.hideLoadingState();
      await this.tutorialController.editorController.closeAllFileTabs();
      await this.systemController.setAuthorMode(true);
      this.storageController.load();
      await this.systemController.userInteraction.showInformationMessage(
        'Author Mode activated! This is a basic implementation.'
      );
    } catch (error) {
      console.error('❌ AUTHOR MODE ERROR:', error);
      await this.systemController.userInteraction.showErrorMessage(
        `Failed to enter Author Mode: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private _handleResult(result: Result<any, any>): void {
    if (result.isErr()) {
      console.error('AuthorModeController: Error:', result.error);
    }
  }
}
